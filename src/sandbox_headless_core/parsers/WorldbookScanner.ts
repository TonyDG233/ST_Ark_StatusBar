import { 
    WorldbookScannerInput, 
    WorldbookScannerOutput, 
    TimedEffectsState,
    v2DataWorldInfoEntrySchema 
} from '../types/TavernData';
import { z } from 'zod';
import { MacroEngine, MacroContext } from './MacroEngine';

export type ScannerEntry = z.infer<typeof v2DataWorldInfoEntrySchema> & { world: string };

/**
 * 无头世界书扫描器 (Worldbook Scanner Pipeline)
 * 完全脱离浏览器环境，采用管线架构复刻原版 checkWorldInfo 逻辑。
 * 不负责 Token 计算，仅负责过滤与阵地分发。
 */
export class WorldbookScanner {
    
    /**
     * 运行扫描管线
     */
    public scan(input: WorldbookScannerInput, macroEngine?: MacroEngine, macroCtx?: MacroContext): WorldbookScannerOutput {
        // Stage 1: 预处理 (Pre-processing) - Include Names 
        // 将聊天记录拍扁成字符串大海 (Haystack)
        const chatBuffer = this.buildChatBuffer(input.chatHistory, input.settings.world_info_include_names);

        // 初始化存活条目池
        let survivors = [...input.entries];

        // 浅拷贝时效状态以便更新
        const newTimedEffects: TimedEffectsState = {
            sticky: { ...input.timedEffects.sticky },
            cooldown: { ...input.timedEffects.cooldown },
            delay: { ...input.timedEffects.delay },
        };

        // Stage 2: 粗筛 (Pre-filtering)
        survivors = this.stage2PreFilter(survivors, input.globalScanData.trigger, input.chatHistory.length, input.timedEffects);

        const activatedEntries: ScannerEntry[] = [];

        // Stage 3-5: 强制激活、匹配、概率
        for (const e of survivors) {
            const uidKey = `${e.world}.${e.id}`;
            
            // Stage 3: Force Activation (Sticky & Constant)
            const isSticky = newTimedEffects.sticky[uidKey] && input.chatHistory.length < newTimedEffects.sticky[uidKey].end;
            if (isSticky || e.constant) {
                // 如果是 Constant/Sticky，世界书内容也需要进行一次终极宏替换
                let content = e.content;
                if (macroEngine && macroCtx) {
                    content = macroEngine.evaluate(content, macroCtx);
                }
                activatedEntries.push({
                    ...e,
                    content
                });
                continue;
            }

            // Stage 4: 宏展开与关键字匹配 (Macro & Matching)
            if (this.matchEntry(e, chatBuffer, input.settings, macroEngine, macroCtx)) {
                
                // Stage 5: 概率判定 (Probability)
                if (e.extensions.useProbability && e.extensions.probability !== undefined && e.extensions.probability < 100) {
                    if (Math.random() * 100 > e.extensions.probability) {
                        continue; // 丢出失败，被抛弃
                    }
                }
                
                // 将匹配到的内容进行一次宏替换后再送入
                let content = e.content;
                if (macroEngine && macroCtx) {
                    content = macroEngine.evaluate(content, macroCtx);
                }
                
                activatedEntries.push({
                    ...e,
                    content
                });
            }
        }

        // Stage 5 (续): 同组互斥死斗 (Inclusion Groups)
        const postGroupEntries = this.applyInclusionGroups(activatedEntries);

        // Stage 6: 排序与阵地分发 (Sorting & Positioning)
        return this.stage6Positioning(postGroupEntries, newTimedEffects);
    }

    private buildChatBuffer(chatHistory: WorldbookScannerInput['chatHistory'], includeNames: boolean): string {
        // 按照原版逻辑，逆序拼装
        const reversed = [...chatHistory].reverse();
        return reversed.map(x => {
            if (includeNames && x.name && x.mes) {
                return `${x.name}: ${x.mes}`;
            }
            return x.mes;
        }).join('\n\x01'); // 使用 \x01 作为深度分割符
    }

    private stage2PreFilter(entries: ScannerEntry[], _trigger: string | undefined, currentTurn: number, timedEffects: TimedEffectsState): ScannerEntry[] {
        // 1. 剔除未启用的
        let survivors = entries.filter(e => e.enabled);

        survivors = survivors.filter(e => {
            // Delay 判定 (若有 delay 字段，虽然 v2 契约不强制，但可能有，目前暂略通过 passthrough)
            const delay = (e as any).delay || (e.extensions as any).delay || 0;
            if (delay > 0 && currentTurn < delay) return false;

            // Cooldown 判定
            const uidKey = `${e.world}.${e.id}`;
            const cd = timedEffects.cooldown[uidKey];
            if (cd && currentTurn < cd.end) {
                return false;
            }

            // 递归深度阀门判定 (假设这是第一轮扫描 recursionDepth = 0)
            if (e.extensions.delay_until_recursion) {
                return false;
            }

            return true;
        });

        return survivors;
    }

    private matchEntry(entry: ScannerEntry, haystack: string, settings: WorldbookScannerInput['settings'], macroEngine?: MacroEngine, macroCtx?: MacroContext): boolean {
        let primaryMatched = false;
        
        // Primary Keys Match
        if (!entry.keys || entry.keys.length === 0) {
            primaryMatched = false; // 没有主关键词，除非 constant 否则不触发
        } else {
            for (let k of entry.keys) {
                // 如果传入了宏替换，优先对单个 key 进行宏展开
                const expandedKey = (macroEngine && macroCtx) ? macroEngine.evaluate(k, macroCtx) : k;
                if (this.matchKey(haystack, expandedKey, entry, settings)) {
                    primaryMatched = true;
                    break;
                }
            }
        }

        if (!primaryMatched) return false;

        // Secondary Keys (Selective Logic)
        if (entry.secondary_keys && entry.secondary_keys.length > 0) {
            let secondaryMatchesCount = 0;
            for (let sk of entry.secondary_keys) {
                const expandedSecondaryKey = (macroEngine && macroCtx) ? macroEngine.evaluate(sk, macroCtx) : sk;
                if (this.matchKey(haystack, expandedSecondaryKey, entry, settings)) {
                    secondaryMatchesCount++;
                }
            }

            const logic = entry.extensions.selectiveLogic ?? 0;
            switch(logic) {
                case 0: // AND_ANY
                    return secondaryMatchesCount > 0;
                case 1: // NOT_ALL
                    return secondaryMatchesCount < entry.secondary_keys.length;
                case 2: // NOT_ANY
                    return secondaryMatchesCount === 0;
                case 3: // AND_ALL
                    return secondaryMatchesCount === entry.secondary_keys.length;
                default:
                    return secondaryMatchesCount > 0;
            }
        }

        return true;
    }

    private matchKey(haystack: string, needle: string, entry: ScannerEntry, settings: WorldbookScannerInput['settings']): boolean {
        if (!needle) return false;
        
        // 正则判定
        if (needle.startsWith('/') && needle.lastIndexOf('/') > 0) {
            try {
                const lastSlash = needle.lastIndexOf('/');
                const pattern = needle.slice(1, lastSlash);
                const flags = needle.slice(lastSlash + 1);
                const regex = new RegExp(pattern, flags);
                return regex.test(haystack);
            } catch (e) {
                // regex parse error, fallback
            }
        }

        const caseSensitive = entry.extensions.case_sensitive ?? settings.world_info_case_sensitive;
        const targetHaystack = caseSensitive ? haystack : haystack.toLowerCase();
        const targetNeedle = caseSensitive ? needle : needle.toLowerCase();

        const matchWholeWords = entry.extensions.match_whole_words ?? settings.world_info_match_whole_words;

        if (matchWholeWords) {
            const words = targetNeedle.trim().split(/\s+/);
            if (words.length > 1) {
                // 多个词直接退化为子串匹配
                return targetHaystack.includes(targetNeedle);
            } else {
                // 单个词使用单词边界正则 (Escape regex)
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?:^|\\W)(${escapeRegex(targetNeedle)})(?:$|\\W)`);
                return regex.test(targetHaystack);
            }
        }

        return targetHaystack.includes(targetNeedle);
    }

    private applyInclusionGroups(entries: ScannerEntry[]): ScannerEntry[] {
        const groups = new Map<string, ScannerEntry[]>();
        const noGroup: ScannerEntry[] = [];

        for (const e of entries) {
            if (e.extensions.group && e.extensions.group.trim() !== '') {
                const g = e.extensions.group.trim();
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g)!.push(e);
            } else {
                noGroup.push(e);
            }
        }

        const survivors: ScannerEntry[] = [...noGroup];

        for (const groupEntries of groups.values()) {
            if (groupEntries.length === 1) {
                survivors.push(groupEntries[0]);
                continue;
            }

            // Check override
            const overrides = groupEntries.filter(e => e.extensions.group_override);
            let candidates = overrides.length > 0 ? overrides : groupEntries;

            if (candidates.length === 1) {
                survivors.push(candidates[0]);
                continue;
            }

            // Roll point by group_weight
            let totalWeight = candidates.reduce((sum, e) => sum + (e.extensions.group_weight || 100), 0);
            let roll = Math.random() * totalWeight;
            let current = 0;
            let selected = candidates[candidates.length - 1]; // fallback

            for (const e of candidates) {
                current += (e.extensions.group_weight || 100);
                if (roll <= current) {
                    selected = e;
                    break;
                }
            }
            survivors.push(selected);
        }

        return survivors;
    }

    private stage6Positioning(entries: ScannerEntry[], newTimedEffects: TimedEffectsState): WorldbookScannerOutput {
        // 同层排序：根据 insertion_order (运行时为 order) 降序
        const sorted = [...entries].sort((a, b) => b.insertion_order - a.insertion_order);

        const output: WorldbookScannerOutput = {
            activated: {
                before: [], after: [], atDepth: [],
                ANTop: [], ANBottom: [], EMTop: [], EMBottom: [], outlet: []
            },
            newTimedEffects
        };

        for (const e of sorted) {
            const pos = e.extensions.position;
            // 原版对应: 0: before, 1: after, 2: ANTop, 3: ANBottom, 4: atDepth, 5: EMTop, 6: EMBottom
            switch(pos) {
                case 0: output.activated.before.unshift(e); break;
                case 1: output.activated.after.unshift(e); break;
                case 2: output.activated.ANTop.unshift(e); break;
                case 3: output.activated.ANBottom.unshift(e); break;
                case 4: output.activated.atDepth.unshift(e); break;
                case 5: output.activated.EMTop.unshift(e); break;
                case 6: output.activated.EMBottom.unshift(e); break;
                default: 
                    // 如果存在自定义或其他位置，放入 outlet
                    output.activated.outlet.unshift(e);
                    break;
            }
        }

        return output;
    }
}

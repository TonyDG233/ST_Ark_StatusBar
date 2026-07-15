/**
 * 无头宏替换引擎 (Headless Macro Engine)
 * 
 * 专门为脱离浏览器的后端环境设计，一比一复刻了原版 TauriTavern 的 substituteParamsLegacy 逻辑。
 * 它纯粹依靠正则表达式链进行替换，不依赖任何 DOM 或浏览器状态。
 */

export interface MacroContext {
    // === 基础环境变量 ===
    user: string;
    char: string;
    
    // === 变量状态池 (由外部传入，引擎执行 setvar 时会直接修改这个引用) ===
    localVariables: Record<string, string>;
    globalVariables: Record<string, string>;
    
    // === 扩展/只读环境信息 (对应角色卡等) ===
    description?: string;
    personality?: string;
    scenario?: string;
    persona?: string;
    mesExamples?: string;
    charVersion?: string;
    charDepthPrompt?: string;
    creatorNotes?: string;
    
    // === 聊天上下文信息 ===
    lastUserMessage?: string;
    lastCharMessage?: string;
    lastMessage?: string;
    
    // === 其他扩展群组与 API 信息 ===
    group?: string;
    notChar?: string;
    model?: string;
}

export class MacroEngine {
    
    /**
     * 核心替换管道
     */
    public evaluate(content: string, ctx: MacroContext): string {
        if (!content) return '';

        let result = content;

        // 1. Pre-Env Macros (操作型与变量变更)
        const preMacros = this.getPreEnvMacros(ctx);
        result = this.runMacros(result, preMacros);

        // 2. 环境变量展开 (Environment)
        const envMacros = this.getEnvMacros(ctx);
        result = this.runMacros(result, envMacros);

        // 3. Post-Env Macros (元数据、清洗与格式化)
        const postMacros = this.getPostEnvMacros(ctx);
        result = this.runMacros(result, postMacros);

        return result;
    }

    private runMacros(text: string, macros: { regex: RegExp; replace: (...args: any[]) => string }[]): string {
        let current = text;
        for (const macro of macros) {
            if (!current) break;
            // 简单的短路检查，如果没有左括号或 <，则跳过
            if (!macro.regex.source.startsWith('<') && !current.includes('{{') && !current.includes('<')) {
                continue;
            }
            try {
                current = current.replace(macro.regex, macro.replace);
            } catch (e) {
                // Ignore matching errors in headless mode
            }
        }
        return current;
    }

    // ========================================================================
    // 阶段 1：Pre-Env Macros (优先处理逻辑，防止被当作普通文本展开)
    // ========================================================================
    private getPreEnvMacros(ctx: MacroContext) {
        return [
            // 遗留的非花括号写法
            { regex: /<USER>/gi, replace: () => ctx.user },
            { regex: /<BOT>/gi, replace: () => ctx.char },
            { regex: /<CHAR>/gi, replace: () => ctx.char },
            { regex: /<GROUP>/gi, replace: () => ctx.group || '' },
            { regex: /<CHARIFNOTGROUP>/gi, replace: () => ctx.group || ctx.char },
            
            // 掷骰子与计算
            { regex: /{{roll::([^}]+)}}/gi, replace: (_: any, formula: string) => this.rollDice(formula) },
            { regex: /{{roll:([^}]+)}}/gi, replace: (_: any, formula: string) => this.rollDice(formula) },
            { regex: /{{roll ([^}]+)}}/gi, replace: (_: any, formula: string) => this.rollDice(formula) },
            
            // ============ 变量操作指令区 ============
            { regex: /{{setvar::([^:]+)::([^}]*)}}/gi, replace: (_: any, name: string, value: string) => { ctx.localVariables[name.trim()] = value; return ''; } },
            { regex: /{{addvar::([^:]+)::([^}]+)}}/gi, replace: (_: any, name: string, value: string) => { this.addVar(ctx.localVariables, name, value); return ''; } },
            { regex: /{{incvar::([^}]+)}}/gi, replace: (_: any, name: string) => { this.incVar(ctx.localVariables, name, 1); return ''; } },
            { regex: /{{decvar::([^}]+)}}/gi, replace: (_: any, name: string) => { this.incVar(ctx.localVariables, name, -1); return ''; } },
            { regex: /{{getvar::([^}]+)}}/gi, replace: (_: any, name: string) => ctx.localVariables[name.trim()] || '' },
            { regex: /{{hasvar::([^}]+)}}/gi, replace: (_: any, name: string) => (ctx.localVariables[name.trim()] !== undefined).toString() },
            { regex: /{{deletevar::([^}]+)}}/gi, replace: (_: any, name: string) => { delete ctx.localVariables[name.trim()]; return ''; } },
            
            // 全局变量操作
            { regex: /{{setglobalvar::([^:]+)::([^}]*)}}/gi, replace: (_: any, name: string, value: string) => { ctx.globalVariables[name.trim()] = value; return ''; } },
            { regex: /{{addglobalvar::([^:]+)::([^}]+)}}/gi, replace: (_: any, name: string, value: string) => { this.addVar(ctx.globalVariables, name, value); return ''; } },
            { regex: /{{incglobalvar::([^}]+)}}/gi, replace: (_: any, name: string) => { this.incVar(ctx.globalVariables, name, 1); return ''; } },
            { regex: /{{decglobalvar::([^}]+)}}/gi, replace: (_: any, name: string) => { this.incVar(ctx.globalVariables, name, -1); return ''; } },
            { regex: /{{getglobalvar::([^}]+)}}/gi, replace: (_: any, name: string) => ctx.globalVariables[name.trim()] || '' },
            { regex: /{{hasglobalvar::([^}]+)}}/gi, replace: (_: any, name: string) => (ctx.globalVariables[name.trim()] !== undefined).toString() },
            { regex: /{{deleteglobalvar::([^}]+)}}/gi, replace: (_: any, name: string) => { delete ctx.globalVariables[name.trim()]; return ''; } },

            // ============ 基础排版与占位 ============
            { regex: /{{newline}}/gi, replace: () => '\n' },
            { regex: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, replace: () => '' },
            { regex: /{{noop}}/gi, replace: () => '' },
            
            // ============ DOM UI 毒瘤替换区 ============
            // 彻底跳过获取文本框内容的宏，因为这在 Headless 环境中毫无意义
            { regex: /{{input}}/gi, replace: () => '' },
        ];
    }

    // ========================================================================
    // 阶段 2：环境解包 (Environment Macros)
    // ========================================================================
    private getEnvMacros(ctx: MacroContext) {
        const envMap: Record<string, string | undefined> = {
            'user': ctx.user,
            'char': ctx.char,
            'group': ctx.group,
            'groupNotMuted': ctx.group,
            'notChar': ctx.notChar,
            'description': ctx.description,
            'personality': ctx.personality,
            'scenario': ctx.scenario,
            'persona': ctx.persona,
            'mesExamples': ctx.mesExamples,
            'mesExamplesRaw': ctx.mesExamples,
            'charVersion': ctx.charVersion,
            'char_version': ctx.charVersion,
            'charDepthPrompt': ctx.charDepthPrompt,
            'creatorNotes': ctx.creatorNotes,
            'model': ctx.model,
            // 简单兼容 instruct 宏
            'systemPrompt': '',
            'charInstruction': '',
            'charPrompt': ''
        };

        const macros = [];
        for (const [varName, value] of Object.entries(envMap)) {
            // 使用正则确保整词匹配 {{user}} 而不误伤
            const safeName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            macros.push({
                regex: new RegExp(`{{(?:${safeName})}}`, 'gi'),
                replace: () => value || ''
            });
        }
        return macros;
    }

    // ========================================================================
    // 阶段 3：Post-Env Macros (格式清洗与元数据)
    // ========================================================================
    private getPostEnvMacros(ctx: MacroContext) {
        return [
            // 屏蔽 Token 计算宏 (在组装完成前没有准确意义，返回预设的 mock)
            { regex: /{{maxPrompt}}/gi, replace: () => '8192' },
            { regex: /{{maxPromptTokens}}/gi, replace: () => '8192' },
            { regex: /{{maxContext}}/gi, replace: () => '8192' },
            { regex: /{{maxContextTokens}}/gi, replace: () => '8192' },
            { regex: /{{maxResponse}}/gi, replace: () => '512' },
            { regex: /{{maxResponseTokens}}/gi, replace: () => '512' },
            
            // 聊天游标
            { regex: /{{lastMessage}}/gi, replace: () => ctx.lastMessage || '' },
            { regex: /{{lastUserMessage}}/gi, replace: () => ctx.lastUserMessage || '' },
            { regex: /{{lastCharMessage}}/gi, replace: () => ctx.lastCharMessage || '' },
            
            // 工具逻辑
            { regex: /{{reverse:(.+?)}}/gi, replace: (_: any, str: string) => Array.from(str).reverse().join('') },
            
            // ============ 最高频：删除大段注释 ============
            { regex: /\{\{\/\/([\s\S]*?)\}\}/gm, replace: () => '' },

            // 日期与时间 (Mock: 返回当前服务器时间或固定格式)
            { regex: /{{time}}/gi, replace: () => new Date().toLocaleTimeString() },
            { regex: /{{date}}/gi, replace: () => new Date().toLocaleDateString() },
            { regex: /{{weekday}}/gi, replace: () => new Date().toLocaleDateString('default', { weekday: 'long' }) },
            { regex: /{{isotime}}/gi, replace: () => new Date().toISOString().substring(11, 16) },
            { regex: /{{isodate}}/gi, replace: () => new Date().toISOString().substring(0, 10) },
            { regex: /{{datetimeformat +([^}]*)}}/gi, replace: () => new Date().toISOString() }, // 简易 mock
            { regex: /{{time_UTC([-+]\d+)}}/gi, replace: () => new Date().toLocaleTimeString() }, 
            
            // 其它
            { regex: /{{idle_duration}}/gi, replace: () => '0' },
            { regex: /{{outlet::(.+?)}}/gi, replace: () => '' },
            { regex: /{{timeDiff::(.*?)::(.*?)}}/gi, replace: () => '' },
            { regex: /{{banned "(.*)"}}/gi, replace: () => '' }, // 仅仅吃掉屏蔽词标签，不真正去拉黑
            
            // ============ 随机化系统 ============
            { regex: /{{random::(.*?)::(.*?)}}/gi, replace: (_: any, a: string, b: string) => {
                const min = parseInt(a); const max = parseInt(b);
                if (!isNaN(min) && !isNaN(max)) return Math.floor(Math.random() * (max - min + 1) + min).toString();
                return '';
            }},
            { regex: /{{random}}/gi, replace: () => Math.random().toString() },
            
            { regex: /{{pick::(.*?)}}/gi, replace: (_: any, content: string) => {
                const options = content.split('::');
                if (options.length === 0) return '';
                return options[Math.floor(Math.random() * options.length)];
            }}
        ];
    }

    // === 工具辅助函数 ===
    private addVar(store: Record<string, string>, name: string, value: string) {
        const k = name.trim();
        if (store[k] !== undefined) {
            // 如果是数字，尝试进行数值相加，否则进行字符串拼接
            const num1 = parseFloat(store[k]);
            const num2 = parseFloat(value);
            if (!isNaN(num1) && !isNaN(num2)) {
                store[k] = (num1 + num2).toString();
            } else {
                store[k] += value;
            }
        } else {
            store[k] = value;
        }
    }

    private incVar(store: Record<string, string>, name: string, amount: number) {
        const k = name.trim();
        let num = parseFloat(store[k]);
        if (isNaN(num)) num = 0;
        store[k] = (num + amount).toString();
    }

    private rollDice(formula: string): string {
        // 简易骰子实现，例如 "1d20"
        try {
            formula = formula.trim().toLowerCase();
            if (/^\d+$/.test(formula)) formula = `1d${formula}`; // 处理只有数字的简写
            const match = formula.match(/^(\d+)d(\d+)$/);
            if (match) {
                const count = parseInt(match[1]);
                const sides = parseInt(match[2]);
                if (count > 0 && sides > 0) {
                    let sum = 0;
                    for (let i=0; i<count; i++) sum += Math.floor(Math.random() * sides) + 1;
                    return sum.toString();
                }
            }
        } catch(e) {}
        return formula; // 解析失败原样返回
    }
}

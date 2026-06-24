/**
 * @file systemInitializer.ts
 * @description PRTS 系统最终装配与资源预加载逻辑 (转译自 prts_analyze.js 结尾处)
 */

import { data, system } from './../store/avgState';
import { scenarioExtend, scenarioRegex } from '../utils/scenario_extend';
import { fun_report_toggle, fun_report_to_developer } from './uiController';
import { txt_playback } from './engineActions';
import { support } from '../utils/support';
import { GetCookie } from '../utils/toolbox';
import { strToObject } from '../utils/toolbox';
import { preloadQueue } from './PreloadService';

// 取消 declare global mw 的隐式声明，通过 (window as any).mw 来引用
/**
 * 原版预加载器核心函数：解析文本、提取图片/音频引用，塞入 LoadQueue
 * TODO: 未来脱离 createjs 后，需重写为 Promise.all(Image.onload) 模型
 */
export function fun_sys_preload() {
    let page = system.page;
    let assets = new Set<string>();
    let exFun = scenarioExtend;
    let regexStr = scenarioRegex;

    // 内部的日志结构体，用于在“预加载阶段”扫描并整理多行剧本/选项的分支逻辑
    let logs = {
        now: "", name: "", multi: false, deci: false, first: null as any, node: null as any, options: [] as string[], stacks: [] as any[],
        multiID: "",
        init() {
            this.multiEnd();
            this.deciEnd();
        },
        multiBegin(id?: string) {
            this.multi = true;
            this.multiID = id || "";
        },
        multiEnd() {
            this.multi = false;
            this.multiID = "";
            this.name = "";
            this.now = "";
        },
        deciBegin(node: any) {
            this.deci = true;
            this.first = node;
            this.node = node;
        },
        deciAppend(node: any) {
            this.node.append(node);
            this.node = node;
        },
        deciPop() {
            this.stacks.pop();
            let obj = this.stacks[this.stacks.length - 1]; // last() 的转写
            if (obj) this.node = obj.self;
            return obj;
        },
        deciPush(node: any, arr: any[]) {
            this.stacks.push({ self: node, values: arr, selected: new Set() });
        },
        deciEnd() {
            this.deci = false;
            this.first = null;
            this.options = [];
            this.stacks = [];
        },
        getRecordPara() {
            return {
                name: this.name,
                text: this.now,
                mode: this.deci,
                target: this.node,
            };
        },
    };

    let txts = data.txt;
    let imgs = data.back;
    let chars = data.char;
    let cfgs = data.setting;

    // 将被 tween 指令和 character 指令共享的资源加载逻辑提取为局部函数，消除 fallthrough
    const processCharacterAssets = (m1: string, sets: any, page: string, i: number, txts: string[], chars: any, cfgs: any, assets: Set<string>, exFun: any) => {
        if (cfgs.check('char', page, i)) {
            let pas = cfgs.char[page][i + 1];
            sets.name = pas.name || sets.name;
            if (m1 === "character") sets.name2 = pas.name2 || sets.name2;
            txts[i] = exFun.serialize(m1, sets);
        }
        let names = [];
        if (sets.name) names.push(sets.name.toLowerCase());
        if (m1 === "character" && sets.name2) names.push(sets.name2.toLowerCase());
        
        for (let name of names) {
            let [k, idx] = exFun.charLink(name);
            if (k === -1) continue;
            let key = exFun.charFormat(k as string, idx as number);
            if (!chars[key]) {
                support.log(-2, false, `<${m1}>Linked key [${key}] not exist.`);
                continue;
            }
            assets.add(chars[key]);
        }
    };

    for (let i = 0; i < txts.length; i++) {
        if (cfgs.check('override', page, i)) {
            txts[i] = cfgs.override[page][i + 1];
        }
        let txt = txts[i];
        if (!txt || txt.match(new RegExp(regexStr.space)) || txt.match(new RegExp(regexStr.comment))) continue;

        let match = txt.match(new RegExp(regexStr.command));
        if (match == null) {
            if (logs.multi) {
                txt_playback("@pa", logs.getRecordPara() as any);
                logs.multiEnd();
            }

            logs.name = "";
            logs.now = txt;
            txt_playback("@pa", logs.getRecordPara() as any);
            continue;
        }

        support.log(-1, true, `[Pre]Ready to analyze Line [${i + 1}]`);

        if (match[1] != undefined) {
            let m1 = match[1].toLowerCase();
            let sets = strToObject(match[2] as string); // 替换掉原有的原型链污染调用

            switch (m1) {
                case "animtext": {
                    if (!match[5]) continue;
                    let mc = Array.from(match[5].matchAll(new RegExp(regexStr.animatepara, 'g')));
                    let arr = [];
                    for (let m of mc) {
                        arr.push(m[2]);
                    }
                    if (arr.length === 0) continue;

                    let text = arr.join("<br/>");
                    logs.name = "";
                    logs.now = text;
                    txt_playback("@pa", logs.getRecordPara() as any);
                    break;
                }
                case 'background':
                case 'image':
                case 'showitem': {
                    if (cfgs.check('image', page, i)) {
                        let pas = cfgs.image[page][i + 1];
                        for (let k of Object.keys(pas)) {
                            sets[k] = pas[k as keyof typeof pas];
                        }
                        txts[i] = exFun.serialize(match[1], sets);
                    }
                    let key = sets.image ? (m1 === "background" ? "bg_" : "") + sets.image.toLowerCase() : "";
                    if (!key) continue;
                    if (!imgs[key]) {
                        support.log(-2, false, `<${m1}>Linked key [${key}] not exist.`);
                        continue;
                    }
                    assets.add(imgs[key]);
                    break;
                }
                case 'backgroundtween':
                case 'imagetween':
                case 'largebgtween':
                case 'largeimgtween': {
                    if (cfgs.check('tween', page, i)) {
                        let pas = cfgs.tween[page][i + 1];
                        for (let k of Object.keys(pas)) {
                            sets[k] = pas[k as keyof typeof pas];
                        }
                        txts[i] = exFun.serialize(match[1], sets);
                    }
                    processCharacterAssets(m1, sets, page, i, txts, chars, cfgs, assets, exFun);
                    break;
                }
                case 'character':
                case 'charactercutin':
                case 'charslot': {
                    processCharacterAssets(m1, sets, page, i, txts, chars, cfgs, assets, exFun);
                    break;
                }
                case 'decision': {
                    let ops = sets.options ? exFun.formatTxt(sets.options).split(';') : [];
                    let vas = sets.values ? sets.values.split(';') : [];
                    if (!ops || !vas || ops.length === 0) continue;
                    
                    let panel = document.createElement('div');
                    panel.classList.add("decision");
                    let group = document.createElement("li");
                    group.classList.add("decision");
                    
                    for (let j = 0; j < ops.length; j++) {
                        logs.options[vas[j] as any] = ops[j];
                        let span = document.createElement("span");
                        span.classList.add("decision");
                        span.innerHTML = `【${ops[j]}】`;
                        group.append(span);
                    }
                    
                    group.style.height = `${ops.length * 22}px`;
                    panel.append(group);
                    
                    if (logs.deci) {
                        logs.deciAppend(panel);
                    } else {
                        logs.deciBegin(panel);
                    }
                    logs.deciPush(panel, vas);
                    break;
                }
                case 'gridbg':
                case 'verticalbg':
                case 'largebg':
                case 'largeimg': {
                    let arr = sets.imagegroup ? sets.imagegroup.split('/') : [];
                    for (let img of arr) {
                        let key = (m1.endsWith('bg') ? "bg_" : "") + img.toLowerCase();
                        if (!key) continue;
                        if (!imgs[key]) {
                            support.log(-2, false, `<${m1}>Linked key [${key}] not exist.`);
                            continue;
                        }
                        assets.add(imgs[key]);
                    }
                    break;
                }
                case 'multiline': {
                    if (!sets.name) continue;
                    if (!logs.multi) {
                        logs.now = "";
                    }
                    logs.name = sets.name;
                    logs.now += match[5];
                    
                    if (sets.end === "true") {
                        txt_playback("@pa", logs.getRecordPara() as any);
                        logs.multiEnd();
                    } else {
                        logs.multiBegin();
                    }
                    break;
                }
                case 'playmusic':
                case 'playsound': {
                    let auds = [];
                    if (m1 === "playmusic" && sets.intro) auds.push(sets.intro);
                    if (sets.key) auds.push(sets.key);
                    
                    for (let aud of auds) {
                        let key = exFun.getAudioUrl(aud) || "";
                        if (!key) continue;
                        assets.add(key);
                    }
                    break;
                }
                case 'predicate': {
                    if (txts[i + 1]?.toLowerCase().includes("predicate") && logs.stacks.length === 1) {
                        continue;
                    }

                    let refs = sets.references ? sets.references.split(';') : [];
                    if (logs.stacks.length === 0) { // empty() 转写
                        support.log(1, false, "<Predicate>The stacks is empty.Has skipped the command.");
                        continue;
                    }
                    let ptr = logs.stacks[logs.stacks.length - 1];
                    let selv: any[] = [];
                    
                    do {
                        let refv = refs.filter((x: any) => ptr.values.includes(x));
                        let remv = ptr.values.filter((x: any) => !ptr.selected.has(x));
                        if (refv.length === ptr.values.length || remv.length === 0) {
                            ptr = logs.deciPop() || ptr;
                            continue;
                        }
                        selv = refv.filter((x: any) => !ptr.selected.has(x));
                        break;
                    } while (logs.stacks.length !== 0);
                    
                    if (logs.stacks.length === 0) {
                        document.getElementById("playback_all_result")?.append(logs.first);
                        logs.deciEnd();
                        continue;
                    }
                    
                    let group = document.createElement('div');
                    group.className = 'predicate';
                    ptr.self.append(group);
                    logs.node = group;
                    
                    for (let val of selv) {
                        let op = logs.options[val];
                        if (!op) {
                            support.log(1, false, `<Predicate>Can't find the options data of value [${op}].`);
                            continue;
                        }
                        let span = document.createElement('span');
                        span.innerHTML = "【" + op + "】";
                        ptr.selected.add(val);
                        group.append(span);
                    }
                    break;
                }
                case 'sticker':
                case 'subtitle': {
                    let text = sets.text || "";
                    logs.name = "";
                    if (!text) {
                        if (logs.multi) {
                            txt_playback("@pa", logs.getRecordPara() as any);
                            logs.multiEnd();
                        }
                        continue;
                    }
                    if (m1 === "sticker" && !logs.multiID.endsWith(sets.id) && logs.multi) {
                        txt_playback("@pa", logs.getRecordPara() as any);
                        logs.multiEnd();
                    }

                    if (sets.multi === "true") {
                        logs.now += text;
                        logs.multiBegin(sets.id);
                        continue;
                    }

                    logs.now = text;
                    txt_playback("@pa", logs.getRecordPara() as any);
                    break;
                }
                case 'video': {
                    let res = sets.res ? sets.res.toLowerCase() : "";
                    if (!res) continue;
                    assets.add(system.sourceUrl + res);
                    break;
                }
            }
            continue;
        } else if (match[3]) {
            switch (match[3].toLowerCase()) {
                case 'predicate': {
                    if (logs.first) document.getElementById("playback_all_result")?.append(logs.first);
                    logs.deciEnd();
                    break;
                }
            }
            continue;
        } else if (match[4] && match[5]) {
            let p = strToObject(match[4] as string);
            if (p == null || p.name === undefined) continue;
            
            if (logs.multi) {
                txt_playback("@pa", logs.getRecordPara() as any);
                logs.multiEnd();
            }
            logs.name = p.name;
            logs.now = match[5];
            txt_playback("@pa", logs.getRecordPara() as any);
        }
    }

    // 核心调用：将爬取到的静态资产灌入下载队列
    for (let asset of assets) {
        preloadQueue.loadFile(asset);
    }
    
    if (logs.first) document.getElementById("playback_all_result")?.append(logs.first);
}

/**
 * 引擎收尾初始化：绑定底部的报表与全局播放控制按钮
 */
export function fun_sys_init() {
    let report = document.getElementById("button_report");
    
    document.getElementById("button_playback")?.addEventListener("click", () => {
        txt_playback("sys_playback", "button_playback");
    });
    
    document.getElementById("button_playback_all")?.addEventListener("click", () => {
        txt_playback("sys_playback_all", "button_playback_all", true);
    });

    if (report) {
        report.addEventListener("click", function (event) {
            if (event.defaultPrevented) return;
            fun_report_toggle();
        });
        
        for (let i = 0; i < report.children.length; i++) {
            let ele = report.children[i];
            ele.addEventListener("click", function (e) {
                e.preventDefault();
            });
        }
        
        const btnSubmit = document.getElementById("report_submit") as HTMLButtonElement;
        if (btnSubmit) {
            btnSubmit.addEventListener("click", function (e) {
                const mw = (window as any).mw;
                if (!mw || !mw.config.values.wgUserGroups.includes("user")) {
                    mw?.notify("您需要登录后才能使用此功能~");
                    return;
                }
                if (GetCookie("ak_scerp_cd")) {
                    mw?.notify("您在短时间内已经报告过了，请5分钟后再试吧~");
                    return;
                }
                var note = document.getElementById("report_note") as HTMLInputElement;
                if (!note || !note.value.trim()) {
                    mw?.notify("请填写上相关备注信息~");
                    return;
                }
                this.disabled = true;
                this.classList.add("waiting");
                fun_report_to_developer(note.value);
                e.preventDefault();
            });
        }

        document.getElementById("report_cancel")?.addEventListener("click", function (e) {
            fun_report_toggle();
            e.preventDefault();
        });
    }
}

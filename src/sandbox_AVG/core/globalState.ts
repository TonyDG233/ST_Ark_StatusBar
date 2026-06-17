/**
 * @file globalState.ts
 * @description PRTS 全局状态、松散变量与内部微型业务方法
 */

import { Timer } from './timer';
import { PRTSData, SystemState } from '../types/system';
import { preloadQueue } from './PreloadService';

declare global {
    // 屏蔽未解析工具和黑盒函数的类型检测
    var fun_playback: any;
    var fun_setting: any;
    var timer_auto: any;
    var txt_next: any;
    var txt_stop: any;
    var txt_click: any;
    var fun_skip_start: any;
    var fun_skip_stop: any;
    var fun_auto_stop: any;
    var fun_fullscreen_check: any;
    var fun_fullscreen_support: any;
}

// ==========================================
// 1. 松散的全局状态与常量
// ==========================================
export let public_disabled = false;

// TODO: Vue 重构后，Timer 可能变为 store 里的方法
export const globalTimer = new Timer();

export const data_cutin: Record<string, any> = {};

export const scenarioState = {
    index: 0,
    max: 0
};

export function setPublicDisabled(val: boolean) {
    public_disabled = val;
}

// ==========================================
// 2. Data 对象 (静态数据容器)
// ==========================================
export const data: PRTSData = {
    txt: [],
    audio: {},
    back: {},
    char: {},
    link: {},
    setting: {
        title: {},
        char: {},
        image: {},
        tween: {},
        override: {},
        disable: { prefix: {}, title: {} },
        set(page: string, str: string) {
            return this.title[page] ? str.replace(page, this.title[page]) : str.replace('/BEG', ' 行动前').replace('/END', ' 行动后').replace('/NBT', '');
        },
        check(sub: string, key: string, line: number) {
            let ret = false;
            line++;
            ret = (this as any)[sub] && (this as any)[sub][key] && (this as any)[sub][key][line] != undefined;
            if (ret && typeof fun_msg !== "undefined") fun_msg(-1, false, `Line [${line}] data has been overrided.`);
            return ret;
        }
    }
};

// ==========================================
// 3. System 对象 (核心运行时状态机)
// ==========================================
export const system: SystemState = {
    page: "",
    sourceUrl: "https://static.prts.wiki/",
    assetUrl: "https://torappu.prts.wiki/assets/",
    // debug: document.URL.includes("&debug=true"), // 由于不再直接操作 DOM，初始化留到 loader
    debug: false, 
    error: { type: "", info: undefined, stat: false },
    txt: {
        max: 0, index: 0, name: "", now: "", now_temp: "", now_index: 0, dynamic: undefined,
        init() {
            this.now_index = 0;
            this.now_temp = "";
        },
        over() {
            this.now_index = this.now.length;
            this.now_temp = this.now;
        },
        checkBind(id: string) {
            if (!this.dynamic || !this.dynamic.id) return false;
            return this.dynamic.id.endsWith(id);
        },
        delay: {
            word: 30, per: 50, common: 1500,
            set(tar: 'word' | 'per' | 'common', value: number) {
                if ((this as any)[tar] && value) (this as any)[tar] = value;
            },
            reset(tar: 'all' | 'word' | 'per' | 'common') {
                if (tar === "all") {
                    this.word = 30; this.per = 50; this.common = 1500;
                } else if (tar === "word") {
                    this.word = 30;
                } else if (tar === "per") {
                    this.per = 50;
                } else if (tar === "common") {
                    this.common = 1500;
                }
            }
        }
    },
    flag: { auto: 0, respond: 0, skip: 0, load: 0 },
    stats: { reset: false, click: false, theater: false, auto: false, log_all: true, step: false, report: false, log_suppress: false },
    decision: { mode: false, select: 1, values: [-1, -1, -1] },
    disabled: {
        flag: false,
        note: "",
        init() {
            const sets = data.setting.disable;
            for (let p in sets.prefix) {
                if (!system.page.startsWith(p)) continue;
                this.flag = true;
                this.note = sets.prefix[p];
                return;
            }
            for (let t in sets.title) {
                if (system.page !== t) continue;
                this.flag = true;
                this.note = sets.title[t]; // 原版 Bug: sets.title[p]，已修复
                return;
            }
        }
    },
    source: {},
    multi: {
        mode: false,
        check() {
            if (!this.mode) return false;
            this.end();
            this.init();
            return true;
        },
        init() {
            system.txt.init();
        },
        begin() {
            this.init();
            this.mode = true;
        },
        end(tar: string = "@p") {
            if (typeof fun_playback !== "undefined") fun_playback(tar, system.txt.name);
            this.reset();
        },
        reset() {
            system.txt.delay.reset("word");
            this.mode = false;
        }
    },
    auto: {
        mode: false,
        flag: 0,
        toggle() {
            if (this.mode) this.stop();
            else this.start();
        },
        start() {
            this.mode = true;
            if (system.txt.index == 0 && typeof fun_setting !== "undefined") fun_setting("pre");
            globalTimer.clear("auto");
            this.flag = 1;
            this.resume();
        },
        stop() {
            globalTimer.clear("auto");
            const btn = document.getElementById("button_auto");
            if (btn) btn.innerHTML = "";
            this.mode = false;
        },
        suspend() {
            if (!this.mode) return;
            globalTimer.clear("auto");
        },
        resume() {
            if (!this.mode) return;
            // timer_auto 方法由于被拆分，使用 typeof 校验
            if (typeof timer_auto !== "undefined") {
                globalTimer.create("auto", timer_auto as any, 400, true);
            }
            this.checkNext();
        },
        checkNext() {
            if (!system.stats.click || globalTimer.hasTimer("dynamic") || globalTimer.hasTimer("txt")) return;
            if (typeof txt_next !== "undefined") txt_next();
        }
    },
    skipnode: { stat: false, waitTarget: null },
    preload: {
        start() {
            const self = this.handler;
            if (typeof fun_msg !== "undefined") fun_msg(2, false, "Source start loading...");
            preloadQueue.load();
            const c = document.getElementById("sys_clicker");
            if (c) {
                c.removeEventListener("mousedown", self.begin);
                c.removeEventListener("mouseup", self.end);
                c.removeEventListener("mouseleave", self.end);
                c.removeEventListener("touchstart", self.begin);
                c.removeEventListener("touchend", self.end);
                c.removeEventListener("touchcancel", self.end);
            }
        },
        init() {
            preloadQueue.onFileLoad = (url: string) => {
                if (typeof fun_msg !== "undefined") fun_msg(0, true, "Source Loaded:", url);
                const output = document.getElementById("dialog_output");
                if (output) output.innerHTML = "正在载入资源:" + url;
            };
            preloadQueue.onComplete = () => {
                if (typeof fun_msg !== "undefined") fun_msg(2, false, "All source loaded complete.");
                system.preload.complete();
            };
            
            const self = this.handler;
            const clicker = document.getElementById("sys_clicker");
            if (clicker) {
                clicker.addEventListener("mousedown", self.begin);
                clicker.addEventListener("mouseup", self.end);
                clicker.addEventListener("mouseleave", self.end);
                clicker.addEventListener("touchstart", self.begin);
                clicker.addEventListener("touchend", self.end);
                clicker.addEventListener("touchcancel", self.end);
            }
        },
        complete() {
            // TODO: 这些纯原生的 DOM 事件绑定，必须在 Vue 重构时彻底转化为 @click/@mousedown 绑定到 Template 上
            const auto = document.getElementById("button_auto");
            const main = document.getElementById("sys_main");
            const clicker = document.getElementById("sys_clicker");
            
            if (clicker) {
                clicker.addEventListener("click", function(ev) { if (typeof txt_click !== "undefined") txt_click(); ev.preventDefault(); });
                if (typeof fun_skip_start !== "undefined") clicker.addEventListener("mousedown", fun_skip_start);
                if (typeof fun_skip_stop !== "undefined") {
                    clicker.addEventListener("mouseup", fun_skip_stop);
                    clicker.addEventListener("mouseleave", fun_skip_stop);
                    clicker.addEventListener("touchend", fun_skip_stop);
                    clicker.addEventListener("touchleave", fun_skip_stop); // 注意：原生的触屏移出可能没有 touchleave，但照抄原版
                }
                if (typeof fun_skip_start !== "undefined") clicker.addEventListener("touchstart", fun_skip_start);
            }

            document.getElementById("button_reset")?.addEventListener("click", (ev) => {
                const stats = system.stats;
                if (system.skipnode.stat) {
                    if (typeof fun_msg !== "undefined") fun_msg(1, true, `skipnode mode triggered.`);
                    if (system.skipnode.waitTarget) {
                        system.skipnode.waitTarget.remove();
                        if (typeof txt_next !== "undefined") txt_next();
                    }
                    return;
                } else if (!stats.reset || stats.report) {
                    if (typeof fun_msg !== "undefined") fun_msg(0, true, "reset didn't pass.");
                    return;
                }
                if (globalTimer.hasTimer("auto") && typeof fun_auto_stop !== "undefined") fun_auto_stop();
                if (globalTimer.hasTimer("dynamic") && typeof txt_stop !== "undefined") txt_stop();
                if (typeof fun_setting !== "undefined") fun_setting("reset");
                const output = document.getElementById("dialog_output");
                if (output) output.innerHTML = "剧情模拟已重置，单击开始剧情回顾";
                ev.preventDefault();
            });

            if (main) {
                main.addEventListener("mousemove", function(e) {
                    this.style.cursor = "default";
                    if (typeof fun_fullscreen_check !== "undefined" && !fun_fullscreen_check()) return;
                    globalTimer.clear("mousehide");
                    globalTimer.create("mousehide", () => {
                        this.style.cursor = "none";
                    }, 1500);
                    e.preventDefault();
                });
            }

            document.addEventListener("keydown", function(ev) {
                if (system.debug && ev.ctrlKey) {
                    const eles = document.getElementsByClassName("dialog_style header");
                    if (eles && eles.length > 0) {
                        eles[0].classList.toggle("debug");
                    }
                }
            });

            if (auto) {
            auto.addEventListener("click", function(ev) {
                const stats = system.stats;
                if ((!stats.click && system.txt.max == 0) || stats.theater || stats.report) {
                    if (typeof fun_msg !== "undefined") fun_msg(0, true, "auto didn't pass.");
                    return;
                }
                    if (!stats.auto) {
                        stats.auto = true;
                        if (system.txt.index == 0 && typeof fun_setting !== "undefined") fun_setting("pre");
                        globalTimer.clear("auto");
                        system.flag.auto = 1;
                        if (typeof timer_auto !== "undefined") globalTimer.create("auto", timer_auto as any, 400, true);
                        if (stats.click && !globalTimer.hasTimer("dynamic") && !globalTimer.hasTimer("txt")) {
                            if (typeof txt_next !== "undefined") txt_next();
                        }
                    } else {
                        if (typeof fun_auto_stop !== "undefined") fun_auto_stop();
                    }
                    ev.preventDefault();
                });
                auto.classList.remove("forbid");
            }

            const sets = system.stats;
            sets.click = true;
            const output = document.getElementById("dialog_output");

            if (system.error.stat) {
                if (output) output.innerHTML = "部分数据预载入异常，本次剧情回顾可能存在图片/音频消失的情况。LOG ALL已禁用<br/>单击开始剧情回顾";
                sets.log_all = false;
            } else {
                if (output) output.innerHTML = "资源加载完毕。单击开始剧情回顾";
            }

            if (sets.log_all) (document.getElementById("button_playback_all") as any)?.setShow();
            if (typeof fun_fullscreen_support !== "undefined" && fun_fullscreen_support()) (document.getElementById("button_fullscreen") as any)?.setShow();
            if (system.user.client == "desktop") (document.getElementById("button_report") as any)?.setShow();
        },
        handler: {
            begin: function() {
                if (globalTimer.hasTimer("preload_wait")) return;
                globalTimer.create("preload_wait", function() {
                    system.preload.start();
                }, 1000);
            },
            end: function() {
                globalTimer.clear("preload_wait");
            }
        }
    },
    user: { name: "", client: "", display: "" },
    ui: {
        width: 960,
        height: 540,
        multiply: 0.75,
        applySkipNode() {
            const btn = document.getElementById("button_reset");
            if (!btn) return;
            if (system.skipnode.stat) {
                btn.classList.add("skipnode");
            } else {
                btn.classList.remove("skipnode");
            }
        }
    }
};

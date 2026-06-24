import { Timer } from '../core/timer';
import { PRTSData, SystemState } from '../types/system';
import { support } from '../utils/support';

// ==========================================
// 1. 全局配置与单例状态
// ==========================================
export let public_disabled = false;

// 暂时保留全局 Timer，直到完全剥离原版 setTimeout/requestAnimationFrame 依赖
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
            support.log(-1, false, `Line [${line}] data has been overrided.`);
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
                this.note = sets.title[t];
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
            if (typeof (window as any).fun_playback !== "undefined") (window as any).fun_playback(tar, system.txt.name);
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
            if (system.txt.index == 0 && typeof (window as any).fun_setting !== "undefined") (window as any).fun_setting("pre");
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
            // TODO: 需要在 action 里注册真正的 timer_auto
            if (typeof (window as any).timer_auto !== "undefined") {
                globalTimer.create("auto", (window as any).timer_auto, 400, true);
            }
            this.checkNext();
        },
        checkNext() {
            if (!system.stats.click || globalTimer.hasTimer("dynamic") || globalTimer.hasTimer("txt")) return;
            if (typeof (window as any).txt_next !== "undefined") (window as any).txt_next();
        }
    },
    skipnode: { stat: false, waitTarget: null },
    preload: {
        start() {
            const self = this.handler;
            support.log(2, false, "Source start loading...");
            // TODO: 真正的 preloadQueue 应该注入进此作用域
            (window as any).preloadQueue?.load();
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
            // 这个初始化现在放在外部 DataLoader / Vue mounted 控制了，暂时留存以避免空指针
        },
        complete() {
            // 这个也应重构至 Vue 的声明周期
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
/**
 * @file engineActions.ts
 * @description PRTS 引擎运行时交互核心逻辑，从 prts_analyze.js 中拆分
 * 
 * 包含了所有的“动作级”触发函数，例如：点击事件 (txt_click)、进入下一句 (txt_next)、
 * 打字机中断停止 (txt_stop)、跳过系统 (fun_skip_start) 等。
 * 在 Vue3 改造后，这些方法可以挂载到 `methods` 或者是 setup function 供模板触发。
 */

import { data, globalTimer, system } from '../store/avgState';
import { SCENARIO_CONSTANTS } from '../types/enums';
import { support } from '../utils/support';
import { audioDispose, domSetHide, domSetShow } from '../utils/toolbox';
import { registry } from './analyzerCore';
import { timer_auto } from './callbacks';
import { fun_fullscreen_check, fun_setting } from './uiController';

export function txt_click() {
    if (!system || system.stats.theater || globalTimer.hasTimer("click_block")) return;
    if (system.stats.auto) fun_auto_stop();
    if (!system.stats.click) {
        support.log(0, true, "Click didn't passed.");
        return;
    }
    support.log(0, true, "Click passed.");
    if (system.txt.index === 0 && typeof fun_setting !== 'undefined') fun_setting("pre");
    
    // TODO: Vue 重构后，音频管理将从 DOM 剥离
    let audio: any = document.getElementById("dialog_audio");
    if (audio) {
        audioDispose(audio);
    }
    
    if (globalTimer.hasTimer("dynamic")) {
        if (typeof txt_stop !== 'undefined') txt_stop();
        if (system.txt.dynamic) {
            (system.txt.dynamic as any).innerHTML = system.txt.now;
        }
        return;
    }
    if (typeof txt_next !== 'undefined') txt_next();
}

export function txt_fullscreen() {
    let e1: any = document.getElementById("sys_fullscreen");
    let e2: any = document.getElementById("button_fullscreen");
    if (!e1 || !e2) return;
    
    let isFull = e2.classList.contains("return");
    if (isFull) {
        if (typeof fun_fullscreen_check !== 'undefined' && fun_fullscreen_check()) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen();
            else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
            else if ((document as any).webkitCancelFullScreen) (document as any).webkitCancelFullScreen();
            else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen();
        }
    } else {
        if (e1.requestFullscreen) e1.requestFullscreen();
        else if (e1.mozRequestFullScreen) e1.mozRequestFullScreen();
        else if (e1.webkitRequestFullscreen) e1.webkitRequestFullscreen();
        else if (e1.webkitRequestFullScreen) e1.webkitRequestFullScreen();
        else if (e1.msRequestFullscreen) e1.msRequestFullscreen();
    }
}

export function txt_next() {
    /* before */
    if (system.txt.index >= system.txt.max) {
        support.log(1, true, "<Txt>index=" + system.txt.index + ",max=" + system.txt.max);
        if (globalTimer.hasTimer("auto") && typeof (window as any).fun_auto_stop !== 'undefined') (window as any).fun_auto_stop();
        if (typeof (window as any).fun_setting !== 'undefined') (window as any).fun_setting("reset");
        const out = document.getElementById("dialog_output");
        if (out) out.innerHTML = "剧情模拟已结束，单击将重新开始剧情回顾";
        return;
    }
    /* check */
    let ret = 0;
    let idx = system.txt.index;
    let txt = data.txt[idx];
    
    // TODO: 移除 JQuery 强耦合
    const $: any = (window as any).$;
    if ($) $(".dialog_style.header").attr({ "d-now": idx });
    
    // 连接到重构后的 CommandRegistry
    ret = txt === "" ? -2 : registry.dispatch(txt, system.flag.skip >= SCENARIO_CONSTANTS.wait_trigger);
    
    if (system.debug && system.stats.step && ret === 1) ret = 2;
    if (ret !== 0) system.txt.index++;
    
    switch (ret) {
        case -2:
            support.log(0, true, "Has skipped the space or unused part.");
            txt_next();
            break;
        case -1:
            support.log(0, true, "Has skipped the error part.");
            txt_next();
            break;
        case 1:
            support.log(0, true, "Data analyze complete.");
            txt_next();
            break;
        case 2:
            support.log(0, true, "Break and wait.");
            break;
        default:
            if (system.txt.index < system.txt.max && system.txt.index >= 0) {
                let i = system.flag.skip >= SCENARIO_CONSTANTS.wait_trigger ? 1 : system.txt.delay.word;
                globalTimer.create("dynamic", () => {
                    if (typeof (window as any).timer_dialog !== 'undefined') (window as any).timer_dialog();
                }, i, true);
            }
            break;
    }
}

export function txt_playback(target: string, bind: string, isAll: boolean = false) {
    let obj1: any = document.getElementById(target);
    let obj2: any = document.getElementById(bind);
    if (!obj1 || !obj2) return;
    
    let isIn = obj2.classList.contains("return");
    if (isIn) {
        if (system.stats.auto && system.flag.respond === 1 && !isAll) {
            globalTimer.create("auto", () => {
                if (typeof timer_auto !== 'undefined') timer_auto();
            }, 400, true);
            if (!globalTimer.hasTimer("txt") && !globalTimer.hasTimer("dynamic")) txt_next();
        }
        domSetHide(obj1);
        obj2.classList.add("normal");
        obj2.classList.remove("return");
        system.flag.respond--;
    } else {
        if (system.stats.auto && system.flag.respond === 0 && !isAll) globalTimer.clear("auto");
        domSetShow(obj1);
        if (!isAll) {
            obj1.scrollTop = obj1.scrollHeight - 540;
        }
        obj2.classList.remove("normal");
        obj2.classList.add("return");
        system.flag.respond++;
    }
}

export function txt_stop() {
    let txt = system.txt;
    let delay = txt.delay;
    let p = delay.per;
    let c = delay.common;
    
    if (system.flag.skip >= SCENARIO_CONSTANTS.wait_trigger) {
        p = 0;
        c = 0;
    }
    
    if (txt.dynamic && (txt.dynamic as any).parentElement) {
        if ((txt.dynamic as any).parentElement.id === "sys_subtitle") {
            delay.reset("word");
        }
    }
    
    let ms = (txt.now.length * p) + c;
    const $: any = (window as any).$;
    let obj = $ ? $("#dialog_audio") : [];
    
    if (system.stats.theater) {
        ms = c;
    } else if (obj.length > 0) {
        let voice: any = obj[0];
        ms = (voice.duration - voice.currentTime) * 1000;
    }
    
    globalTimer.clear("txt");
    globalTimer.create("txt", () => {
        if (globalTimer.hasTimer("auto")) txt_next();
    }, ms);
    
    globalTimer.clear("dynamic");
    globalTimer.create("click_block", function () {}, 100);
    
    if (system.multi.mode) {
        system.txt.over();
    } else {
        system.txt.init();
    }
    system.txt.index++;
}

export function fun_auto_stop() {
    globalTimer.clear("auto");
    const btn = document.getElementById("button_auto");
    if (btn) btn.innerHTML = "";
    system.stats.auto = false;
}

export function fun_delay(key_cmd: string, key_time: any, key_type: string = "s") {
    if (system.stats.step) return;
    var t = Number.isNaN(+key_time) ? 1 : +key_time;
    if (key_type === "s") t *= 1000;
    if (key_cmd === "block") {
        if (typeof fun_setting !== 'undefined') fun_setting("cmd_close");
        if (system.flag.skip === SCENARIO_CONSTANTS.wait_trigger) t = 0;
        setTimeout(function () {
            if (typeof fun_setting !== 'undefined') fun_setting("cmd_open");
            if (system.stats.reset) txt_next();
        }, t);
    }
}

export function fun_skip_start() {
    if (!system || system.stats.theater || system.txt.max === 0 || system.flag.respond > 0) return;
    if (globalTimer.hasTimer("skip")) {
        if (typeof fun_skip_stop !== 'undefined') fun_skip_stop();
    }
    globalTimer.create("skip", () => {
        if (++system.flag.skip >= SCENARIO_CONSTANTS.wait_trigger) {
            if (system.stats.auto) fun_auto_stop();
            globalTimer.clear("skip");
            globalTimer.setFake("auto");
            txt_next();
        }
    }, 10, true);
}

export function fun_skip_stop() {
    if (!system) return;
    if (system.flag.skip === SCENARIO_CONSTANTS.wait_trigger) {
        globalTimer.removeFake("auto");
        globalTimer.create("click_block", function () {}, 100);
    } else {
        globalTimer.clear("skip");
    }
    system.flag.skip = 0;
}

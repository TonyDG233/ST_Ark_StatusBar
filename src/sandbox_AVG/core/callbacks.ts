/**
 * @file callbacks.ts
 * @description PRTS 定时器与循环回调核心逻辑
 * 
 * 这个模块包含了在剧情播放时高频调用的定时器回调函数：
 * - timer_auto: 用于控制“自动播放”按钮上的播放进度指示（如 ▶▶）的更新
 * - timer_dialog: 控制打字机效果逐字输出的核心逻辑，并且处理诸如 `<color>` 和特殊占位符 (`&#nnnn;`) 的不被截断的问题。
 * - timer_shake_common: 通用的振动动画函数，常用来处理镜头震动或立绘震动。
 */

import { system, globalTimer } from './globalState';
import { txt_stop } from './engineActions';

export function timer_auto() {
    let ele = document.getElementById("button_auto");
    if (!ele) return;
    
    switch (system.flag.auto) {
        case 1:
            ele.innerHTML = "";
            break;
        case 2:
            ele.innerHTML = "▶";
            break;
        case 3:
            ele.innerHTML = "▶▶";
            system.flag.auto = 0;
            break;
    }
    system.flag.auto++;
}

export function timer_dialog() {
    let txt = system.txt;
    let tag = "", str = txt.now, str_tmp = txt.now_temp, len = str.length, idx = txt.now_index;
    
    if (idx < len) {
        if (str[idx] === "<") {
            let i = idx;
            while (++i < len && str[i] !== ">");
            if (i < len) {
                if (str[idx + 1] !== "/") {
                    tag = "</" + str.substring(idx + 1, i) + ">";
                    if (typeof fun_msg !== 'undefined') fun_msg(1, true, "<TimerDialog>tag=" + tag);
                }
                if (str[i + 1] === "<") { /* prevent the belong mark. */
                    let i2 = i + 1;
                    while (++i2 < len && (str[i2] !== ">" || str[i2 + 1] === "<"));
                    if (i2 < len) i = i2;
                }
                str_tmp += str.substring(idx, i + 1);
                idx = i + 1;
            }
        } else if (str[idx] === "&") {
            if (idx + 6 < len && str.slice(idx, idx + 6) === "&nbsp;") {
                str_tmp += str.slice(idx, idx + 6);
                idx += 6;
            } else if (str[idx + 1] === "#" && str.slice(idx, idx + 7).match(/&#\d{4};/)) {
                str_tmp += str.slice(idx, idx + 7);
                idx += 7;
            }
        }
        
        txt.now_temp = str_tmp + (txt.now[idx] || "");
        if (txt.dynamic) {
            (txt.dynamic as any).innerHTML = txt.now_temp + tag;
        }
        txt.now_index = Math.min(++idx, len);
        return;
    }
    txt_stop();
}

export function timer_shake_common(tar: any, str_x: number, str_y: number, ustb_p: number, max_t: number) {
    let o = tar;
    const $: any = (window as any).$;
    
    if (typeof tar === "string" && $) {
        o = $("#" + tar);
    }
    if (!o || !o.length) {
        globalTimer.clearAll();
        if (typeof fun_msg !== 'undefined') fun_msg(-2, false, `<ShakeCommon>Err tar of [${tar}]`);
        return;
    }
    
    let rx = Math.floor(Math.random() * 99) + 1;
    let ry = Math.floor(Math.random() * 99) + 1;
    if (typeof fun_msg !== 'undefined') fun_msg(1, true, "<ShakeCommon>rnd_x:" + rx + ",rnd_y:" + ry);
    
    let d = [-1, -0.707, 0, 1, 0.707];
    rx = rx < ustb_p ? Math.floor(Math.random() * 5) : 0;
    ry = ry < ustb_p ? Math.floor(Math.random() * 5) : 0;
    
    o.css({ left: d[rx] * str_x, top: d[ry] * str_y });
    
    let t = parseInt(o.attr("d-sh-t") || "0");
    if (max_t < 0) return;
    else if (++t < max_t) {
        o.attr("d-sh-t", t);
        return;
    }
    
    let n = o.attr("d-sh-n");
    if (n) globalTimer.clear(n);
    o.css({ left: 0, top: 0, "transform-duration": "" });
    o.removeAttr("d-sh-t");
    o.removeAttr("d-sh-n");
}

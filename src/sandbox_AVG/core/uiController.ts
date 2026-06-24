/**
 * @file uiController.ts
 * @description PRTS UI 状态控制、回放历史与全屏交互管理器 (转译自 prts_analyze.js)
 */

import { system, data, globalTimer } from './../store/avgState';
import { SCENARIO_CONSTANTS } from '../types/enums';
import { fun_stop_audio } from './audioController';
import { support } from '../utils/support';
import { GetCookie, SetCookie } from '../utils/toolbox';
import { domSetClear, domHide, domShow, domSetHide, domSetShow } from '../utils/toolbox';

/**
 * 处理系统状态切换 (重置引擎、预准备、拦截交互)
 * TODO: 这是典型的命令式 DOM 操纵，在全面接入 Vue3 之后，
 * 应当直接通过 Pinia Action 改变 State，由视图层 v-show 自动反应。
 */
export function fun_setting(key: string) {
    switch (key) {
        case "pre": {
            if (system.debug) system.txt.max = data.txt.length;
            else if (system.txt.max === 0) system.txt.max = data.txt.length;
            
            support.log(1, true, "<Txt>max: " + system.txt.max);
            system.stats.reset = true;
            
            const eles = document.getElementsByClassName("dialog_style header");
            if (eles && eles.length > 0) {
                eles[0].setAttribute("d-max", String(system.txt.max));
            }
            
            document.getElementById("dialog_name") && domSetClear(document.getElementById("dialog_name"));
            document.getElementById("dialog_output") && domSetClear(document.getElementById("dialog_output"));
            document.getElementById("playback_result") && domSetClear(document.getElementById("playback_result"));
            document.getElementById("sys_dialog") && domHide(document.getElementById("sys_dialog"));
            document.getElementById("button_reset")?.classList.remove("forbid");
            
            const blocker = document.getElementById("sys_blocker");
            if (blocker) blocker.style.backgroundColor = "rgba(0,0,0,0)";
            break;
        }
        case "reset": {
            fun_stop_audio("@all");
            globalTimer.clearAll();
            
            document.getElementById("sys_video") && domSetClear(document.getElementById("sys_video"));
            document.getElementById("sys_subtitle") && domSetClear(document.getElementById("sys_subtitle"));
            document.getElementById("sys_back") && domSetClear(document.getElementById("sys_back"));
            document.getElementById("sys_image") && domSetClear(document.getElementById("sys_image"));
            document.getElementById("sys_char") && domSetClear(document.getElementById("sys_char"));
            document.getElementById("sys_item") && domSetClear(document.getElementById("sys_item"));
            document.getElementById("sys_cutin") && domSetClear(document.getElementById("sys_cutin"));
            document.getElementById("sys_decision") && domSetHide(document.getElementById("sys_decision"));
            
            const cam = document.getElementById("sys_camera");
            if (cam) cam.style.cssText = "";
            const blk = document.getElementById("sys_blocker");
            if (blk) blk.style.cssText = "";
            const dName = document.getElementById("dialog_name");
            if (dName) {
                dName.style.cssText = "";
                dName.innerHTML = "剧情模拟器";
            }
            
            document.getElementById("sys_dialog") && domShow(document.getElementById("sys_dialog"));
            system.stats.reset = false;
            system.multi.reset();
            
            if (system.stats.theater) {
                system.stats.theater = false;
                document.getElementById("button_playback") && domSetShow(document.getElementById("button_playback"));
                document.getElementById("button_auto") && domSetShow(document.getElementById("button_auto"));
            }
            
            if (system.skipnode.stat) {
                system.skipnode.stat = false;
                system.ui.applySkipNode();
            }
            
            fun_setting("cmd_open");
            document.getElementById("button_reset")?.classList.add("forbid");
            
            system.txt.index = 0;
            // 注意：这里原版用了 null，在 TS 开启 strict 模式时可能会报错，稳妥起见改为 undefined
            system.txt.dynamic = undefined; 
            system.flag.respond = 0;
            break;
        }
        case "cmd_suspend":
            system.flag.respond++;
            // fallthrough
        case "cmd_close":
            system.stats.click = false;
            break;
        case "cmd_resume":
            system.flag.respond--;
            // fallthrough
        case "cmd_open":
            system.stats.click = true;
            break;
    }
}

/**
 * 向剧本历史记录板写入文本
 */
export function fun_playback(tar: string, args: any) {
    if (system.stats.log_suppress) {
        system.stats.log_suppress = false;
        return;
    }
    
    let group = document.createElement("li");
    let log: HTMLElement | null = null;
    let pas = (typeof args === "object") ? args : { name: args };
    let name = pas.name;
    let text = pas.text || system.txt.now;
    
    if (name === undefined || !text) return;
    
    if (pas.mode) {
        log = pas.target;
    } else {
        switch (tar) {
            case 'playback':
            case '@p':
                log = document.getElementById("playback_result");
                break;
            case 'playback_all':
            case '@pa':
                log = document.getElementById("playback_all_result");
                break;
        }
    }
    
    if (name.trim()) {
        let em = document.createElement("em");
        group.append(em);
        em.innerHTML = name;
        if (support.getLen(name, support.getFont(16)) > SCENARIO_CONSTANTS.log_em_limit_px) {
            em.style.fontSize = "12px";
        }
        if (pas.color) em.style.color = pas.color;
    }
    
    let span = document.createElement("span");
    span.innerHTML = fun_txt_format(text).replace(/\<(?!br).*?\>/g, "");
    group.append(span);
    
    if (log) log.append(group);
}

/**
 * 专供文本历史记录的纯文本清洗器
 */
export function fun_txt_format(key_txt: string): string {
    let t = key_txt.trim();
    t = t.replace(/{@nickname}/ig, system.user.name);
    t = t.replace(/{@nbs}/ig, " ");
    try {
        t = t.replaceAll("<color=", "<font color=").replaceAll("</color>", "</font>");
        t = t.replaceAll("{@s}", "").replaceAll("\\n", "<br/>");
    } catch (err) {
        support.log(-1, false, "This browser not support replaceAll function.");
        t = t.replace(/<color=/ig, "<font color=").replace(/<\/color>/ig, "</font>");
        t = t.replace(/{@s}/ig, "");
        t = t.replace(/\\n/g, "<br/>");
    }
    return t;
}

/**
 * 物理全屏缩放接管 (利用 scale 矩阵和 CSS left/top 直接拉大画布并填充满屏幕)
 */
export function fun_fullscreen() {
    let sx = screen.width, sy = screen.height;
    let s = Math.min(sx / SCENARIO_CONSTANTS.base_width, sy / SCENARIO_CONSTANTS.base_height);
    let px = (sx - SCENARIO_CONSTANTS.base_width * s) / 2;
    let py = (sy - SCENARIO_CONSTANTS.base_height * s) / 2;
    
    support.log(1, true, `screen.width: ${sx},screen.height: ${sy},scale: ${s}`);
    support.log(1, true, `screen.availWidth: ${screen.availWidth},screen.availHeight: ${screen.availHeight},width_offset: ${px},height_offset: ${py}`);
    
    let ele1 = document.getElementById("sys_main");
    let ele2 = document.getElementById("button_fullscreen");
    let ele3 = document.getElementById("sys_offset");
    
    if (fun_fullscreen_check()) {
        if (ele1) ele1.style.transform = `scale(${s})`;
        if (ele2) {
            ele2.classList.remove("normal");
            ele2.classList.add("return");
        }
        if (ele3) {
            ele3.style.left = `${px}px`;
            ele3.style.top = `${py}px`;
        }
    } else {
        if (ele1) ele1.style.transform = "";
        if (ele2) {
            ele2.classList.add("normal");
            ele2.classList.remove("return");
        }
        if (ele3) {
            ele3.style.left = "";
            ele3.style.top = "";
        }
    }
}

export function fun_fullscreen_check(): boolean {
    return !!(document.fullscreenElement || (document as any).mozFullScreenElement || (document as any).webkitIsFullScreen || (document as any).webkitFullScreen || (document as any).msFullScreenElement);
}

export function fun_fullscreen_support(): boolean {
    let temp = document.documentElement;
    return document.fullscreenEnabled || ('requestFullscreen' in temp) || ('webkitRequestFullScreen' in temp) || (('mozRequestFullScreen' in temp) && (document as any).mozFullScreenEnabled) || false;
}

/**
 * 向 PRTS 开发者报告当前故障信息 (已被抽空)
 * TODO: 剧情模拟器在酒馆插件环境运行，不支持向 PRTS Wiki 发起 MediaWiki API 请求
 */
export function fun_report_to_developer(note: string) {
    support.log(3, false, "Report feature is disabled in Tavern Helper environment. Note: " + note);
}

/**
 * 切换故障报告 UI 界面 (已被抽空)
 */
export function fun_report_toggle() {
    support.log(3, false, "Report UI feature is disabled.");
}

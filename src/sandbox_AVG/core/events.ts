/**
 * @file events.ts
 * @description PRTS 剧情引擎生命周期与事件绑定入口 (转译自 prts_events.js)
 */

import { system, public_disabled } from '../store/avgState';
import { fun_sys_init, fun_sys_preload } from './systemInitializer';
import { txt_fullscreen } from './engineActions';
import { fun_fullscreen, fun_fullscreen_support } from './uiController';

// 仅保留无法被 TS 推断的对 JQuery 原型链的扩展和极其特定的方法
declare global {
    interface JQuery {
        fadeToExit(duration?: number | string, easing?: string): any;
        remove(): any;
        fadeOut(duration: any, easing: any, complete: Function): any;
    }

    interface HTMLElement {
        setShow(): void;
        setHide(): void;
    }
}

/**
 * 引擎生命周期与 DOM 事件初始化函数
 * TODO: 目前仍保留对部分全局 DOM 节点的操作，在 Vue 重构时会通过 onMounted 和 v-show 替代
 */
export function initPrtsEvents() {
    const $: any = (window as any).$;
    const mw: any = (window as any).mw;

    // TODO: 考虑是否仍需直接扩展 $.prototype。在纯 Vue3 时代，可以改写为原生的 CSS 动画或 Vue Transition
    $.prototype.fadeToExit = function(duration?: number | string, easing?: string) {
        if (!duration) {
            return this.remove();
        }
        return this.fadeOut(duration, easing, function(this: any) { this.remove(); });
    };

    // 1. 原 $(document).ready 的等价转译
    $(document).ready(() => {
        $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function() {
            fun_fullscreen();
        });
        
        $("#button_fullscreen").click(function() {
            txt_fullscreen();
        });
        
        let name = mw?.config?.get("wgUserName");
        system.user.name = name ? name.replace(/[Dd][Rr]\./, "") : "博士";
        
        try {
            fun_sys_preload();
        } catch (err: any) {
            const dialogOutput = document.getElementById("dialog_output");
            if (dialogOutput) {
                dialogOutput.innerHTML = "数据载入异常。请尝试刷新页面或是提交异常反馈。";
            }
            system.error.type = "preload_error";
            system.error.info = err.toString();
            system.error.stat = true;
        }
    });

    // 2. 原 IIFE (立即执行函数) 的等价转译，负责检查状态和更新 UI
    (function checkAndInitializeUI() {
        const logAll: any = document.getElementById("button_playback_all");
        const txt = document.getElementById("dialog_output");

        if (!system.error.stat && system.stats.log_all && logAll) {
            logAll.setShow();
        }
        
        if (fun_fullscreen_support()) {
            const fullscreenBtn: any = document.getElementById("button_fullscreen");
            if (fullscreenBtn) fullscreenBtn.setShow();
        }

        if (public_disabled || system.disabled.flag) {
            let r = system.disabled.note;
            if (txt) {
                txt.innerHTML = (public_disabled ? "剧情模拟器已被全局停用" : "该页面的剧情模拟器已被停用") 
                                + "，查看剧情所有文本请单击LOG ALL" 
                                + (r ? "<br/>附言: " + r : "");
            }
            const btnAuto: any = document.getElementById("button_auto");
            const btnReset: any = document.getElementById("button_reset");
            const btnPlayback: any = document.getElementById("button_playback");
            
            if (btnAuto) btnAuto.setHide();
            if (btnReset) btnReset.setHide();
            if (btnPlayback) btnPlayback.setHide();
            
            if (logAll) {
                logAll.setShow();
                logAll.style.left = "24px";
            }
            return; // 原版遇到禁用，直接中断后续逻辑
        }

        if (system.user.client == "desktop") {
            const btnReport: any = document.getElementById("button_report");
            if (btnReport) btnReport.setShow();
        }

        if (system.error.stat) {
            return; // 原版此处拦截
        }

        if (txt) {
            txt.innerHTML = "页面已加载完毕。为避免意外的数据消耗，剧情资源仅在长按1s后开始预载。如果您仅需浏览纯文本内容，请直接单击LOG ALL";
        }
        
        system.preload.init();
    })();

    // 3. 触发原版引擎的最终初始化
    fun_sys_init();
}

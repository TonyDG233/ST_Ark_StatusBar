/**
 * @file events.ts
 * @description PRTS 剧情引擎生命周期与事件绑定入口 (转译自 prts_events.js)
 */

// 临时使用 any 屏蔽类型检查，保证功能 1:1 跑通。
// TODO: 后续需移除这些声明，并从专门的 types/ 目录引入强类型的 System 接口。
declare global {
    interface Window {
        $: any; // jQuery
        mw: any; // MediaWiki 环境变量
        system: any; // 全局系统状态中枢，未来需要被 Pinia Store 替换
        public_disabled: boolean;
        
        // 全局方法声明
        fun_fullscreen: () => void;
        txt_fullscreen: () => void;
        fun_sys_preload: () => void;
        fun_fullscreen_support: () => boolean;
        fun_sys_init: () => void;
    }
    
    // 扩展 jQuery 和 HTMLElement 的类型定义以适应老版本遗留原型扩展
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
 * TODO: 目前严重依赖 window 全局变量，未来应重构为依赖注入 (如传入 store 单例)
 */
export function initPrtsEvents() {
    const $ = window.$;
    const mw = window.mw;
    const system = window.system;

    // TODO: 考虑是否仍需直接扩展 $.prototype。在纯 Vue3 时代，可以改写为原生的 CSS 动画或 Vue Transition
    $.prototype.fadeToExit = function(duration?: number | string, easing?: string) {
        if (!duration) {
            return this.remove();
        }
        return this.fadeOut(duration, easing, function(this: any) { this.remove(); });
    };

    // 1. 原 $(document).ready 的等价转译
    // TODO: 在 Vue3 重构后，这一块应当放在最外层 Container 组件的 onMounted 钩子中执行
    $(document).ready(() => {
        $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange', function() {
            window.fun_fullscreen();
        });
        
        $("#button_fullscreen").click(function() {
            window.txt_fullscreen();
        });
        
        let name = mw?.config?.get("wgUserName");
        system.user.name = name ? name.replace(/[Dd][Rr]\./, "") : "博士";
        
        try {
            window.fun_sys_preload();
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
    // TODO: 这一部分大量的 DOM 操作（setShow, setHide, innerHTML），在转为 Vue 组件后，必须通过 v-if / v-show 和响应式文本绑定来替代。
    (function checkAndInitializeUI() {
        const logAll = document.getElementById("button_playback_all");
        const txt = document.getElementById("dialog_output");

        if (!system.error.stat && system.stats.log_all && logAll) {
            logAll.setShow();
        }
        
        if (window.fun_fullscreen_support()) {
            document.getElementById("button_fullscreen")?.setShow();
        }

        if (window.public_disabled || system.disabled.flag) {
            let r = system.disabled.note;
            if (txt) {
                txt.innerHTML = (window.public_disabled ? "剧情模拟器已被全局停用" : "该页面的剧情模拟器已被停用") 
                                + "，查看剧情所有文本请单击LOG ALL" 
                                + (r ? "<br/>附言: " + r : "");
            }
            document.getElementById("button_auto")?.setHide();
            document.getElementById("button_reset")?.setHide();
            document.getElementById("button_playback")?.setHide();
            
            if (logAll) {
                logAll.setShow();
                logAll.style.left = "24px";
            }
            return; // 原版遇到禁用，直接中断后续逻辑
        }

        if (system.user.client == "desktop") {
            document.getElementById("button_report")?.setShow();
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
    // TODO: 当所有组件迁移到 Vue 之后，此函数将被拆解为各个组件的数据获取与载入逻辑。
    window.fun_sys_init();
}

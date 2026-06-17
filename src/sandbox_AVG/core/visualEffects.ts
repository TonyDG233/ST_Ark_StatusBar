/**
 * @file visualEffects.ts
 * @description PRTS 视觉效果控制器 (转译自 prts_analyze.js)
 * 
 * 此模块负责生成幕布（Curtain）或者全局遮罩（Masker）之类的动画特效。
 * 在 Vue3 重构中，`fun_curtain_create` 的 DOM 直接操作和通过定时器刷新的渐变效果
 * 建议后续重构为通过 CSS 变量绑定和 CSS Transition，以大幅提升性能。
 */

import { globalTimer } from './globalState';

/**
 * 屏幕幕布/遮罩动画生成器
 */
export function fun_curtain_create(dire: string | number, fr: number, to: number, dur: number, alpha: number | string) {
    const dire_map: Record<string, string> = {
        "0": "180deg",
        "1": "225deg",
        "2": "270deg",
        "4": "0deg",
        "5": "45deg",
        "6": "90deg"
    };

    const dire_name = `curtain_${dire}`;
    let ele = document.getElementById(dire_name);

    if (!ele) {
        ele = document.createElement("div");
        ele.id = dire_name;
        ele.className = "common_style curtain";
        const masker = document.getElementById("sys_masker");
        if (masker) masker.append(ele);
    }

    const ang = Number.isNaN(+dire) ? String(dire) : dire_map[String(dire)];
    const fr_p = fr * 100;
    const to_p = to * 100;
    const tick = dur * 100;

    if (tick <= 0) {
        ele.style.backgroundImage = `linear-gradient(${ang}, black ${to_p}%, transparent ${to_p}%)`;
        ele.style.opacity = parseFloat(String(alpha)).toString();
        return;
    }

    const sep = (to_p - fr_p) / tick;
    const sep_a = (1 - parseFloat(String(alpha))) / tick;

    ele.setAttribute("d-end", String(to_p));
    ele.setAttribute("d-now", String(fr_p));
    ele.setAttribute("d-sep", String(sep));

    if (sep_a) {
        ele.style.opacity = "1";
        ele.setAttribute("d-alpha", String(alpha));
        ele.setAttribute("d-sep-a", String(sep_a));
    }

    globalTimer.create(`dyn_curtain_${dire}`, function () {
        const o = document.getElementById(dire_name);
        if (!o) {
            globalTimer.clear(`dyn_curtain_${dire}`);
            return;
        }

        let n = parseFloat(o.getAttribute("d-now") || "0");
        const s = parseFloat(o.getAttribute("d-sep") || "0");
        const e = parseFloat(o.getAttribute("d-end") || "0");
        const s_a = o.getAttribute("d-sep-a");

        n += s;
        o.style.backgroundImage = `linear-gradient(${ang}, black ${n}%, transparent ${n}%)`;

        if (s_a) {
            let n_a = parseFloat(o.style.opacity || "1");
            n_a -= parseFloat(s_a);
            o.style.opacity = String(n_a);
        }

        if ((s > 0 && n < e) || (s < 0 && n > e)) {
            o.setAttribute("d-now", String(n));
            return;
        }

        globalTimer.clear(`dyn_curtain_${dire}`);
        o.style.backgroundImage = `linear-gradient(${ang}, black ${e}%, transparent ${e}%)`;
        if (s_a) {
            o.style.opacity = String(parseFloat(o.getAttribute("d-alpha") || "1"));
        }
    }, 10, true);
}

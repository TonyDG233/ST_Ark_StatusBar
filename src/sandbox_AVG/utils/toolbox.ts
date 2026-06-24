/**
 * @file toolbox.ts
 * @description PRTS 底层核心工具库 (转译自 krliov.toolbox.js)
 * 
 * 核心改造：
 * 原版极其严重地污染了 Array, String, Math, HTMLElement 和 HTMLAudioElement 的原型链。
 * 根据 MASTER_PLAN，为适配现代 TypeScript 与 Vue3 架构，已将所有原型链方法重写为类型安全的纯函数。
 * 
 * TODO: 在彻底重写 prts_analyze.js 中的 3000 行 switch 逻辑时，
 * 必须将原版的 `match.toObject()` 等调用替换为本文件的 `strToObject(match)`。
 */

import { support } from './support';

// ==========================================
// 1. Math 工具
// ==========================================
export function mathClamp(v: number, l: number, r: number): number {
    return v < l ? l : v > r ? r : v;
}

// ==========================================
// 2. Array 纯函数工具
// ==========================================
export function arrayEmpty(arr: any[]): boolean {
    return !arr || arr.length === 0;
}

export function arrayGetSum(arr: number[] | string[]): number {
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
        s += +arr[i];
    }
    return s;
}

export function arrayLast<T>(arr: T[]): T | undefined {
    return arrayEmpty(arr) ? undefined : arr[arr.length - 1];
}

export function arrayRemoveEmpty<T>(arr: T[]): void {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] == undefined) { // match null or undefined
            arr.splice(i--, 1);
        }
    }
}

// ==========================================
// 3. String 纯函数工具
// ==========================================
export function strGetValue(str: string, sep: string = ':'): string {
    const p = str.lastIndexOf(sep);
    if (p === -1) return "";
    return str.substring(p + sep.length);
}

export function strGetKey(str: string, sep: string = ':'): string {
    const p = str.lastIndexOf(sep);
    if (p === -1) return str;
    return str.substring(0, p);
}

/**
 * 测算字符串在指定字体下的渲染像素宽度
 * @param str 要测算的字符串
 * @param font CSS 字体描述符
 */
export function strGetPx(str: string, font: string): number {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return 0;
    context.font = font;
    return context.measureText(str).width;
}

/**
 * 原 `String.prototype.toObject`
 * 负责将形如 `name="Amiya", focus=1` 的字符串解析为键值对对象
 */
export function strToObject(str: string, sep1: string = ",", sep2: string = "=", tolower: boolean = true): Record<string, string> {
    const regStr = `\\s*(.*?)\\s*${sep2}\\s*(?:['"](.*?)['"]|([\\w.-]+))\\s*${sep1}?`;
    const reg = new RegExp(regStr, 'g');
    let ms: RegExpMatchArray[] = [];
    
    try {
        ms = Array.from(str.matchAll(reg));
    } catch {
        let arr;
        while ((arr = reg.exec(str)) !== null) {
            ms.push(arr);
        }
    }
    
    const o: Record<string, string> = {};
    for (const m of ms) {
        let p = m[1];
        let v = m[2] === undefined ? m[3] : m[2];
        if (tolower) p = p.toLowerCase();
        o[p] = v;
    }
    
    // 如果一次都没匹配到，尝试去掉 g 修饰符单次匹配
    if (Object.keys(o).length === 0) {
        const singleReg = new RegExp(regStr);
        const m = str.match(singleReg);
        if (m) {
            let p = m[1];
            let v = m[2] === undefined ? m[3] : m[2];
            if (tolower) p = p.toLowerCase();
            o[p] = v;
        }
    }
    return o;
}

export function strToArray(str: string, sep: string): string[] {
    return str.replace(/\r/g, "").split(sep);
}

// ==========================================
// 4. HTMLAudioElement 纯函数工具
// ==========================================
export function audioReset(audio: HTMLAudioElement): void {
    audio.pause();
    audio.onended = null;
    audio.loop = false;
    audio.src = "";
}

export function audioDispose(audio: HTMLAudioElement): void {
    audioReset(audio);
    audio.remove();
}

/**
 * 极其重要的音频淡入淡出动画方法
 * @param audio 目标音频元素
 * @param duration 秒 (注意：根据原版 krliov.toolbox.js 设计，此处的 duration 确实是秒为单位)
 * @param v_end 目标音量 (0-1)
 * @param isremove 动画结束后是否销毁元素
 */
export function audioFade(audio: HTMLAudioElement, duration: number, v_end: number = 0, isremove: boolean = false): void {
    v_end = mathClamp(v_end, 0, 1);
    if (isremove) {
        audio.id = "";
        audio.className = "";
    }
    
    const id_old = Number(audio.getAttribute("v-id"));
    if (id_old) {
        clearInterval(id_old);
    }
    
    const fadeStep = (audio.volume - v_end) / duration / 50;
    audio.setAttribute("v-fade", String(fadeStep));
    audio.setAttribute("v-end", String(v_end));
    
    const id = setInterval(function () {
        const v = Number(audio.getAttribute("v-end")) || 0;
        const f = Number(audio.getAttribute("v-fade")) || 0.1;
        
        if ((f > 0 && audio.volume <= v) || (f < 0 && audio.volume >= v) || f === 0) { 
            audio.volume = v; 
            clearInterval(Number(audio.getAttribute("v-id"))); 
            if (audio.getAttribute("v-remove") === "true") {
                audio.remove();
            } else { 
                audio.removeAttribute("v-id"); 
                audio.removeAttribute("v-fade"); 
                audio.removeAttribute("v-end"); 
                audio.removeAttribute("v-remove"); 
            } 
            return; 
        }
        audio.volume = mathClamp(audio.volume - f, 0, 1);
    }, 20);
    
    audio.setAttribute("v-id", String(id));
    audio.setAttribute("v-remove", String(isremove));
}

// ==========================================
// 5. HTMLElement 纯函数工具 (DOM 控制)
// ==========================================
export function domHide(el: HTMLElement | null): void {
    if (el) el.style.display = "none";
}

export function domShow(el: HTMLElement | null): void {
    if (el) el.style.display = "block";
}

export function domSetClear(el: HTMLElement | null): void {
    if (el) el.innerHTML = "";
}

export function domSetHide(el: HTMLElement | null): void {
    if (el) el.classList.add("hidden");
}

export function domSetShow(el: HTMLElement | null): void {
    if (el) el.classList.remove("hidden");
}

export function domFadeIn(el: HTMLElement | null, durationMs: number): void {
    if (!el) return;
    const a_beg = el.style.opacity ? parseFloat(el.style.opacity) : (el.style.display === "none" ? 0 : 1);
    
    if (Number.isNaN(+durationMs) || durationMs <= 0 || a_beg >= 1) {
        el.style.opacity = "";
        domShow(el);
        return;
    }
    
    // 计算每 10 毫秒的步长
    const a_step = (1 - a_beg) / (durationMs / 10);
    const id_old = el.getAttribute("v-id");
    if (id_old) {
        clearInterval(+id_old);
    }
    
    const timer = setInterval(() => {
        let a = el.style.opacity ? parseFloat(el.style.opacity) : 0;
        a += a_step;
        if (a >= 1) { 
            const id = el.getAttribute("v-id");
            if (id) clearInterval(+id);
            el.style.opacity = "";
            domShow(el);
            return;
        }
        el.style.opacity = String(a);
    }, 10);
    
    el.setAttribute("v-id", String(timer));
    el.style.display = "";
    el.style.opacity = String(a_beg);
}

/**
 * 平替 jQuery fadeTo: 淡入/淡出到指定透明度
 * @param el 目标 HTMLElement
 * @param durationMs 动画持续时间（毫秒）
 * @param targetOpacity 目标透明度 (0-1)
 */
export function domFadeTo(el: HTMLElement | null, durationMs: number, targetOpacity: number): void {
    if (!el) return;
    
    let a_beg = el.style.opacity ? parseFloat(el.style.opacity) : (el.style.display === "none" ? 0 : 1);
    const a_end = mathClamp(targetOpacity, 0, 1);
    
    // 快速出口
    if (Number.isNaN(+durationMs) || durationMs <= 0 || a_beg === a_end) {
        el.style.opacity = String(a_end);
        if (a_end > 0) domShow(el);
        return;
    }
    
    // 初始化显示状态
    if (el.style.display === "none" && a_end > 0) {
        domShow(el);
        a_beg = 0;
    }
    
    const a_step = (a_end - a_beg) / (durationMs / 10);
    const id_old = el.getAttribute("v-id");
    if (id_old) clearInterval(+id_old);
    
    const timer = setInterval(() => {
        let a = el.style.opacity ? parseFloat(el.style.opacity) : a_beg;
        a += a_step;
        
        // 浮点数比较的容差处理，判断是否越过终点
        if ((a_step > 0 && a >= a_end) || (a_step < 0 && a <= a_end)) {
            const id = el.getAttribute("v-id");
            if (id) clearInterval(+id);
            el.style.opacity = String(a_end);
            return;
        }
        el.style.opacity = String(a);
    }, 10);
    
    el.setAttribute("v-id", String(timer));
    el.style.opacity = String(a_beg);
}

/**
 * 原作者基于毫秒 (ms) 设计的原生 jQuery fadeToExit 的纯函数平替
 * 该函数会在目标元素的透明度逐渐降低至 0 后，将其从 DOM 中移除
 * @param el 目标 HTMLElement
 * @param durationMs 动画持续时间（毫秒）
 */
export function domFadeToExit(el: HTMLElement | null, durationMs: number = 0): void {
    if (!el) return;
    
    // 快速出口：如果没有 duration，直接移除
    if (durationMs <= 0) {
        el.remove();
        return;
    }

    const a_beg = el.style.opacity ? parseFloat(el.style.opacity) : (el.style.display === "none" ? 0 : 1);
    
    // 如果已经完全透明或隐藏，直接移除
    if (a_beg === 0) {
        el.remove();
        return;
    }
    
    // 计算每 10 毫秒的衰减步长
    const a_step = a_beg / (durationMs / 10);
    const id_old = el.getAttribute("v-id");
    if (id_old) clearInterval(+id_old);
    
    const timer = setInterval(() => {
        let a = el.style.opacity ? parseFloat(el.style.opacity) : 1;
        a -= a_step;
        
        if (a > 0) {
            el.style.opacity = String(a);
        } else {
            // 动画结束
            const id = el.getAttribute("v-id");
            if (id) clearInterval(+id);
            el.remove();
        }
    }, 10);
    
    el.setAttribute("v-id", String(timer));
}

export interface CookieOptions {
    expires?: string;
    path?: string;
    domain?: string;
}

export function SetCookie(name: string, value: string, options: CookieOptions): void {
    const t = new Date();
    const m = options.expires ? options.expires.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i) : null;
    const res: string[] = [];

    if (m) {
        const expireMs = ((((parseInt(m[1]) || 0) * 24 + (parseInt(m[2]) || 0)) * 60 + (parseInt(m[3]) || 0)) * 60 + (parseInt(m[4]) || 0)) * 1000;
        t.setTime(t.getTime() + expireMs);
        res.push("expires=" + t.toUTCString());
        support.log(3, false, "cool down: " + t.toUTCString());
    }
    if (options.path) {
        res.push("path=" + options.path);
    }
    if (options.domain) {
        res.push("domain=" + options.domain);
    }
    document.cookie = name + "=" + value + ";" + res.join(";");
}

export function GetCookie(name: string): string | null {
    const cook = document.cookie;
    const arr = cook.split(';');
    for (const d of arr) {
        const str = d.trim();
        if (str.startsWith(name + "=")) {
            return str.substring(name.length + 1);
        }
    }
    return null;
}

export function RemoveCookie(name: string, options: CookieOptions): void {
    const res = ["expires=Thu, 01 Jan 1970 00:00:00 GMT"];
    if (options.path) {
        res.push("path=" + options.path);
    }
    if (options.domain) {
        res.push("domain=" + options.domain);
    }
    document.cookie = name + "=;" + res.join(";");
}

export function DeepCopy<T>(k: T): T {
    function arrCopy(k2: any[]): any[] {
        const arr: any[] = [];
        for (const e of k2) {
            arr.push(typeof e === "object" && e !== null ? DeepCopy(e) : e);
        }
        return arr;
    }

    function objCopy(k2: Record<string, any>): Record<string, any> {
        const obj: Record<string, any> = {};
        for (const d of Object.entries(k2)) {
            obj[d[0]] = typeof d[1] === "object" && d[1] !== null ? DeepCopy(d[1]) : d[1];
        }
        return obj;
    }

    if (k === null) return k;
    return Array.isArray(k) ? (arrCopy(k) as unknown as T) : typeof k === "object" ? (objCopy(k as any) as unknown as T) : k;
}

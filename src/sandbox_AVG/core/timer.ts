/**
 * @file timer.ts
 * @description PRTS 定时器与纯函数工具箱 (转译自 prts_timer.js)
 */

declare global {
    // 全局方法声明，屏蔽外部黑盒函数报错
    function fun_msg(type: number, isDebug: boolean, ...msgs: any[]): void;
}

// 定义定时器内部对象接口
export interface TimerObject {
    delegate: Function;
    interval: boolean;
    id?: number | ReturnType<typeof setTimeout>;
    trigger?: boolean;
}

// TODO: 如果需要全局单例模式，未来可以改为 export const timerManager = new Timer();
export class Timer {
    // list 既存对象，也用 -1 表示 fake (伪造/占位符)
    private list: Record<string, TimerObject | number>;

    constructor() {
        this.list = {};
    }

    /**
     * 创建定时器
     * n=name, f=function, t=delay, p=isinterval
     * @param n 名称，即标识符
     * @param f 需要执行的函数体
     * @param t 等待时间/循环时间
     * @param p 是否为循环的定时器
     * @return 创建成功返回true，否则为false
     */
    public create(n: string, f: Function, t: number = 1000, p: boolean = false): boolean {
        const self = this;
        self.clear(n, true);

        // 使用 +t 防止传入字符串型的数字
        if (typeof n !== "string" || typeof f !== 'function' || Number.isNaN(+t)) {
            return false;
        }

        const obj: TimerObject = {
            delegate: f,
            interval: p
        };

        if (p) {
            obj.id = setInterval(function () {
                obj.delegate();
            }, +t);
        } else {
            obj.trigger = false;
            obj.id = setTimeout(function () {
                obj.delegate();
                obj.trigger = true;
                self.clear(n);
            }, +t);
        }
        self.list[n] = obj;
        return true;
    }

    /**
     * 清除定时器
     * @param n 名称，标识符
     * @param s 是否需要在移除时执行未执行的函数
     * @return 移除成功返回true，否则为false
     */
    public clear(n: string, s: boolean = false): boolean {
        const self = this;
        if (!self.isTimer(n)) return false;

        const o = self.list[n] as TimerObject;
        // 如果要求提前执行，且还未触发过
        if (s && !o.trigger && typeof o.delegate === "function") {
            o.delegate();
        }

        if (o.id) {
            if (o.interval) clearInterval(o.id as number);
            else clearTimeout(o.id as number);
        }
        delete self.list[n];
        return true;
    }

    /**
     * 清除所有定时器
     */
    public clearAll(): void {
        const self = this;
        for (const n in self.list) {
            const o = self.list[n];
            if (typeof o === 'object') {
                if (o.interval) clearInterval(o.id as number);
                else clearTimeout(o.id as number);
            }
        }
        self.list = {};
    }

    /**
     * 判断定时器标识是否存在 (包括 Fake)
     */
    public hasTimer(n: string): boolean {
        return this.list[n] !== undefined;
    }

    /**
     * 判断是否为有效的定时器 (不包括 Fake)
     */
    public isTimer(n: string): boolean {
        return this.hasTimer(n) && !this.isFake(n);
    }

    /**
     * 设定一个占位定时器 (Fake)
     */
    public setFake(n: string): boolean {
        if (this.isTimer(n)) return false;
        this.list[n] = -1;
        return true;
    }

    /**
     * 移除占位定时器
     */
    public removeFake(n: string): boolean {
        if (!this.isFake(n)) return false;
        delete this.list[n];
        return true;
    }

    /**
     * 检查是否为占位定时器
     */
    public isFake(n: string): boolean {
        return this.list[n] === -1;
    }
}

// TODO: 下方这些纯工具函数未来可迁移至 src/sandbox_AVG/utils/common.ts

/**
 * 深拷贝函数
 * TODO: 修复了原版的一个致命 Bug。原版 `DeepCopy(d)` 会错误地将 `[key, value]` 数组递归进去，现已修正为 `DeepCopy(d[1])`。
 * @param k 要拷贝的目标
 */
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
            // Fix 原版 Bug: 原版写的是 DeepCopy(d)，实际上应该是 DeepCopy(d[1])
            obj[d[0]] = typeof d[1] === "object" && d[1] !== null ? DeepCopy(d[1]) : d[1];
        }
        return obj;
    }

    if (k === null) return k;
    return Array.isArray(k) ? (arrCopy(k) as unknown as T) : typeof k === "object" ? (objCopy(k as any) as unknown as T) : k;
}

export interface CookieOptions {
    expires?: string;
    path?: string;
    domain?: string;
}

// TODO: Cookie 操作后续可考虑使用成熟库（如 js-cookie 或 VueUse 的 useCookie）来替换这套手写代码。
export function SetCookie(name: string, value: string, options: CookieOptions): void {
    const t = new Date();
    const m = options.expires ? options.expires.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i) : null;
    const res: string[] = [];

    if (m) {
        // (d*24 + h)*60 + m)*60 + s
        const expireMs = ((((parseInt(m[1]) || 0) * 24 + (parseInt(m[2]) || 0)) * 60 + (parseInt(m[3]) || 0)) * 60 + (parseInt(m[4]) || 0)) * 1000;
        t.setTime(t.getTime() + expireMs);
        
        // Fix 原版 Bug: 原代码拼写成了 "expire="，标准 HTTP 应该是 "expires="
        res.push("expires=" + t.toUTCString());
        
        if (typeof fun_msg !== "undefined") {
            fun_msg(3, false, "cool down: " + t.toUTCString());
        }
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
        // Fix 原版 Bug: 原版 startsWith(name) 会导致 "username" 被 "user" 错误匹配，现加入 "=" 严谨化
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
    // 原代码是 document.cookie = name + "=" + ";" ... 这里保留逻辑，移除值
    document.cookie = name + "=;" + res.join(";");
}

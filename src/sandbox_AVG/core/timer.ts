/**
 * @file timer.ts
 * @description PRTS 定时器与纯函数工具箱 (转译自 prts_timer.js)
 */

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


/**
 * @file support.ts
 * @description PRTS 底层渲染支持与辅助函数 (转译自 prts_scenario.js 的 support 对象)
 */

import { LogType } from '../types/enums';
import { system } from '../store/avgState';

declare global {
    // 屏蔽对 String 原型链扩展的报错 (来自外部 krliov.toolbox.js)
    interface String {
        getPx(font: string): number;
    }
}

export const support = {
    /**
     * 在 Canvas 上绘制带遮罩（阴影）的立绘
     * @param can Canvas 元素对象
     * @param url 图片路径
     * @param w 绘制宽度
     * @param h 绘制高度
     * @param black [起始位置, 结束位置] 决定立绘黑影（未选中状态）的渐变占比
     */
    drawChar: function (can: HTMLCanvasElement, url: string, w: number, h: number, ...black: (number | undefined)[]) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            if (can.width != w || can.height != h) {
                can.width = w;
                can.height = h;
            }
            support.log(LogType.trace, true, `<DrawChar>url: ${img.src},imgW: ${img.width},imgH: ${img.height}`);
            
            const ctx = can.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, w, h);
            if (ctx.globalCompositeOperation === "source-atop") {
                ctx.globalCompositeOperation = "source-over";
            }
            ctx.drawImage(img, 0, 0, w, h);
            
            if (black.length === 0 || black[0] === undefined || black[1] === undefined) return;
            
            // 绘制黑色立绘遮罩层 (通常用于未说话的配角暗化效果)
            const gri = ctx.createLinearGradient(0, h * black[0]!, 0, h * black[1]!);
            gri.addColorStop(0, "black"); 
            gri.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = gri;
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillRect(0, 0, w, h * black[1]!);
        };
    },

    /**
     * 在 Canvas 指定坐标绘制基础图片
     */
    drawImage: function (can: HTMLCanvasElement, url: string, w: number, h: number, x: number, y: number) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            support.log(LogType.trace, true, `<DrawImage>url: ${img.src},imgW: ${img.width},imgH: ${img.height}`);
            const ctx = can.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(x, y, w, h);
            ctx.drawImage(img, x, y, w, h);
        };
    },

    /**
     * 格式化字体字符串 (强制方舟字体 Noto Sans)
     */
    getFont: function (size: number): string {
        return size + "px Noto Sans S Chinese";
    },

    /**
     * 计算文本在屏幕上的真实物理宽度 (Px)
     * TODO: 此处重度依赖 krliov.toolbox.js 对 String 原型链注入的 `getPx`。
     * 后续应考虑将计算逻辑直接提取为纯函数 (利用 Canvas measureText 实现)。
     */
    getLen: function (str: string, font: string, base: number = 0): number {
        const arr = str.split('<br/>');
        let len = 0;
        for (const d of arr) {
            // 清除所有的内置 HTML 标签（如 <font>, <b> 等），仅测算纯文本
            const s = d.replace(/\<.*?\>/g, "");
            const px = s.getPx(font);
            len += base ? Math.ceil(px / base) : px;
        }
        return len;
    },

    /**
     * 去除 CSS url() 的外壳，提取真实连接
     */
    getUrl: function (n: string): string {
        return n.replace(/^url\(["']|["']\)$/g, "");
    },

    /**
     * 将 0-255 / 0-1 的入参转化为标准的 rgba 字符串
     */
    getRGBA: function (c_r: number, c_g: number, c_b: number, c_a: number): string {
        const d = [c_r, c_g, c_b, c_a];
        for (let i = 0; i < d.length; i++) {
            d[i] = Math.max(0, d[i]);
            // 原版神奇的边界处理：如果输入大于 1 则认为是 0-255，否则认为是 0-1 占比
            if (d[i] <= 1 && d[i] !== 0) d[i] = Math.floor(d[i] * 255);
            d[i] = d[i] / 255;
        }
        return `rgba(${d.join(",")})`;
    },

    /**
     * 向控制台输出带有时间信息的彩色调试数据
     * @param type 日志级别 (见 Enums.LogType)
     * @param debug 是否仅在系统开启 debug 模式时才输出
     * @param msgs 具体信息参数群
     */
    log: function (type: number, debug: boolean, ...msgs: any[]) {
        if (debug && !system.debug) return;

        const t = new Date();
        const t_txt = t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate() + " " + t.getHours() + ":" + t.getMinutes() + ":" + t.getSeconds();
        
        const data = msgs.slice(1);
        data.unshift(t_txt);

        switch (type) {
            case LogType.trace:
                data.unshift("[%s][Trace]:" + msgs[0]);
                console.log(...data);
                break;
            case LogType.debug:
                data.unshift("%c[%s][Debug]:" + msgs[0], "background-color:orange;");
                console.debug(...data);
                break;
            case LogType.info:
                data.unshift("[%s][Info]:" + msgs[0]);
                console.log(...data);
                break;
            case LogType.warn:
                data.unshift("[%s][Warn]:" + msgs[0]);
                console.warn(...data);
                break;
            case LogType.error:
                data.unshift("[%s][Error]:" + msgs[0]);
                console.error(...data);
                break;
            case LogType.sp1:
            case LogType.sp2:
                data.unshift("%c[%s][Info]:" + msgs[0], "color:#0080ff");
                console.log(...data);
                break;
        }
    },

    /**
     * 去除多余的末尾逗号，主要修复服务端下发的残次 JSON 字符串
     */
    removeComma: function (dat: string): string {
        const i = dat.search(/,\s+\}$/);
        return i === -1 ? dat : dat.substring(0, i) + '}';
    }
};

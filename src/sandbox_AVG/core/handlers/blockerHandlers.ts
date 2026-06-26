import { CommandHandler } from '../analyzerCore';
import { data } from '../../store/avgState';
import { fun_delay } from '../engineActions';
import { domFadeToExit } from '../../utils/toolbox';

// ----------------------------------------------------------------------
// Blocker & Curtain Handlers
// ----------------------------------------------------------------------

export const handleBlocker: CommandHandler = (ctx) => {
    const t = ctx.args.fadetime === undefined ? 0.2 : parseFloat(ctx.args.fadetime);
    let d1 = ctx.args.a === undefined ? 1 : parseFloat(ctx.args.a);
    const d2 = ctx.args.r === undefined ? 0 : parseFloat(ctx.args.r);
    const d3 = ctx.args.g === undefined ? 0 : parseFloat(ctx.args.g);
    const d4 = ctx.args.b === undefined ? 0 : parseFloat(ctx.args.b);

    if (d1 > 1) d1 = 1;
    const o1 = $("#sys_blocker");

    if (ctx.args.image) {
        d1 = Math.max(0, 1 - d1);
    }

    // 修复原版和解包数据的 Unity 小数点色值问题
    // 鹰角解包数据里，纯红写的是 r=1 而不是 255（Unity Color 标准）
    // 而浏览器 rgba(1,0,0) 是极其微弱接近黑色的红，需要转换为 0-255 范围
    const normalizeRGB = (val: number) => {
        if (val < 0) return 0;
        if (val > 0 && val <= 1) return Math.round(val * 255);
        return Math.round(val);
    };

    const r = normalizeRGB(d2);
    const g = normalizeRGB(d3);
    const b = normalizeRGB(d4);

    const rgba = `rgba(${r},${g},${b},${d1})`;

    if (ctx.isSkip) {
        o1.stop(true).css("transition", "").css("background-color", rgba);
        o1.css("background-image", ctx.args.image ? `url('${data.back[ctx.args.image]}')` : "");
        return 1;
    }

    o1.stop(true)
      .css("transition", `background-color ${t}s linear`)
      .css("background-color", rgba);
    
    o1.css("background-image", ctx.args.image ? `url('${data.back[ctx.args.image]}')` : "");

    if (ctx.args.block === "true") {
        fun_delay("block", t);
        return 2;
    }
    return 1;
};

export const handleCurtain: CommandHandler = (ctx) => {
    const o1 = $("#sys_masker");

    if (ctx.isSkip) {
        o1.children(".curtain").remove();
        return 1;
    }

    o1.children(".curtain").each((_, el) => domFadeToExit(el, 200));
    if (ctx.args.block === "true") {
        fun_delay("block", 0.2);
        return 2;
    }
    return 1;
};

// ----------------------------------------------------------------------
// Interlude Handlers
// ----------------------------------------------------------------------

export const handleInterlude: CommandHandler = (ctx) => {
    if (ctx.isSkip) return 1; // 原版在跳过时直接略过 interlude

    const ch = ctx.args.channel;
    if (!ch) return -1;

    let obj = document.querySelector("#inter_" + ch) as HTMLElement;
    if (!obj) {
        obj = document.createElement("span");
        obj.className = "interlude";
        obj.id = "inter_" + ch;
        obj.style.position = "absolute";
        // 需要通过某机制将其挂载到幕布容器，原版在这行并没有挂载它，
        // 测试版中这是一个半成品。我们会忠实保留其定义状态。
    }

    const mask = ctx.args.maskid || "";
    const sizeArr = ctx.args.size ? ctx.args.size.split(',') : [0, 0];
    const offsetArr = ctx.args.offset ? ctx.args.offset.split(',') : [0, 0];
    
    let sx = Number(sizeArr[0]) * 0.75;
    let sy = Number(sizeArr[1]) * 0.75;
    let px = Number(offsetArr[0]) * 0.75;
    let py = Number(offsetArr[1]) * 0.75;

    // TODO: 使用 px, py 进行坐标偏移处理 (原版此处逻辑缺失，暂时读取避免 unused variable 报错)
    console.debug(`Interlude offset: ${px}, ${py}`);

    if (sx > 0 && sy > 0) {
        obj.style.width = `${sx}px`;
        obj.style.height = `${sy}px`;
        if (mask) {
            obj.classList.add(mask);
            if (mask === "ui_cutin_mask_horizon") obj.style.marginTop = `${-sy / 2}px`;
            else if (mask === "ui_cutin_mask_vertical") obj.style.marginLeft = `${-sx / 2}px`;
        }
    }
    return 1;
};

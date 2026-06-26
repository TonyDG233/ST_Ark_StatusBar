import { CommandHandler } from '../analyzerCore';
import { data, globalTimer } from '../../store/avgState';
import { domFadeIn, domFadeToExit, domFadeTo } from '../../utils/toolbox';
import { fun_delay } from '../engineActions';

// ----------------------------------------------------------------------
// Image Handlers (#sys_image)
// ----------------------------------------------------------------------

export const handleImage: CommandHandler = (ctx) => {
    // 兼容 image 和 imgeffect 两个指令的别名
    const o1 = $('#sys_image');
    const fadetime = ctx.args.fadetime ? +ctx.args.fadetime : 0.15;
    const n = (ctx.args.image && ctx.args.image.toLowerCase()) || "";

    if (ctx.isSkip) {
        if (n === "") {
            o1.empty();
        } else {
            o1.children('div').remove();
            if (data.back[n] === undefined || data.back[n] === "") return 1;

            const e1 = $('<div></div>');
            const sx = ctx.args.xscale || ctx.args.width || 1;
            const sy = ctx.args.yscale || ctx.args.height || 1;
            const px = (ctx.args.x && ctx.args.x * 0.75) || 0;
            const py = (ctx.args.y && ctx.args.y * 0.75) || 0;

            const i1 = new Image();
            i1.src = data.back[n];
            // 在 skip 下，为了简化 onload 异步我们先附上 matrix (暂不进行动态 resize 适配)
            // 原版中即使 skip 也需要准确算出宽高等参数，不过由于跳过后往往接下一个指令，这不致命
            e1.css({
                "position": "absolute",
                "background-image": `url(${data.back[n]})`,
                "transform": `matrix(${sx},0,0,${sy},${px},${-py})`
            });
            o1.append(e1);
        }
        return 1;
    }

    o1.children().stop(true, true);
    const c1 = o1.children('div').length;

    if (n === "") {
        if (fadetime > 0) {
            o1.children('div').each((_, el) => domFadeToExit(el, fadetime * 1000));
            if (ctx.args.block === "true") {
                fun_delay("block", fadetime);
                return 2;
            }
        } else {
            o1.empty();
        }
        return 1;
    }

    let e1 = document.createElement('div');
    let $e1 = $(e1);
    const sx = ctx.args.xscale || ctx.args.width || 1;
    const sy = ctx.args.yscale || ctx.args.height || 1;
    const px = (ctx.args.x && ctx.args.x * 0.75) || 0;
    const py = (ctx.args.y && ctx.args.y * 0.75) || 0;

    if (data.back[n] === undefined || data.back[n] === "") {
        console.error(`<Image>Data [${n}] not exist,please check the data list.`);
        return -1;
    }

    // 修复异步获取不到宽度导致的 0 和 NaN 问题
    let tsx = 1280 * 0.75;
    let tsy = 720 * 0.75;
    const i1 = new Image();
    i1.src = data.back[n];
    if (i1.width > 0) {
        tsx = i1.width * 0.75;
        tsy = i1.height * 0.75;
    }

    if (ctx.args.screenadapt === "coverall") {
        let w = tsx / 960, h = tsy / 540;
        let scale = Math.min(w, h);
        if (scale === 0) scale = 1; // 防御性处理
        tsx /= scale; tsy /= scale;
    }

    const tpx = 480 - tsx / 2;
    const tpy = 270 - tsy / 2;
    // 颠倒 Y 轴
    const finalPy = -py;

    $e1.css({
        "position": "absolute",
        "width": tsx + "px",
        "height": tsy + "px",
        "left": tpx + "px",
        "top": tpy + "px",
        "background-image": `url(${data.back[n]})`,
        "background-size": `${tsx}px ${tsy}px`,
        "transform": `matrix(${sx},0,0,${sy},${px},${finalPy})`
    });

    o1.append($e1);
    $e1.hide();
    domFadeIn(e1, fadetime * 1000);
    setTimeout(() => {
        o1.children(`div:lt(${c1})`).remove();
    }, fadetime * 1000);

    if (ctx.args.block === "true") {
        fun_delay("block", fadetime);
        return 2;
    }

    return 1;
};

export const handleImageTween: CommandHandler = (ctx) => {
    const o1 = $("#sys_image").children("div:last");
    
    if (ctx.isSkip) {
        if (o1.length === 0) return 1;
        const pStr = o1.css("transform").replace(/\s/g, "").match(/^[a-z]+\((.*)\)/);
        const p = pStr == null ? [1, 0, 0, 1, 0, 0] : pStr[1].split(',');
        const sxt = ctx.args.xscaleto || ctx.args.xscale || p[0];
        const syt = ctx.args.yscaleto || ctx.args.yscale || p[3];
        const pxt = ctx.args.xto ? ctx.args.xto * 0.75 : ctx.args.x ? ctx.args.x * 0.75 : p[4];
        let pyt = ctx.args.yto ? ctx.args.yto * 0.75 : ctx.args.y ? ctx.args.y * 0.75 : -p[5];
        pyt = -pyt;

        o1.css("transition", "").css("transform", `matrix(${sxt},0,0,${syt},${pxt},${pyt})`);
        return 1;
    }

    if (o1.length === 0) return -1;
    const t = ctx.args.duration || 0.15;
    
    const pStr = o1.css("transform").replace(/\s/g, "").match(/^[a-z]+\((.*)\)/);
    const p = pStr == null ? [1, 0, 0, 1, 0, 0] : pStr[1].split(',');
    
    const sxf = ctx.args.xscalefrom || ctx.args.xscale || p[0];
    const sxt = ctx.args.xscaleto || ctx.args.xscale || p[0];
    const syf = ctx.args.yscalefrom || ctx.args.yscale || p[3];
    const syt = ctx.args.yscaleto || ctx.args.yscale || p[3];
    const pxf = ctx.args.xfrom ? ctx.args.xfrom * 0.75 : ctx.args.x ? ctx.args.x * 0.75 : p[4];
    const pxt = ctx.args.xto ? ctx.args.xto * 0.75 : ctx.args.x ? ctx.args.x * 0.75 : p[4];
    let pyf = ctx.args.yfrom ? ctx.args.yfrom * 0.75 : ctx.args.y ? ctx.args.y * 0.75 : -p[5];
    let pyt = ctx.args.yto ? ctx.args.yto * 0.75 : ctx.args.y ? ctx.args.y * 0.75 : -p[5];
    
    pyf = -pyf; pyt = -pyt;

    o1.css("transform", `matrix(${sxf},0,0,${syf},${pxf},${pyf})`);
    
    globalTimer.create("imaget_w", () => {
        o1.css("transition", `transform ${t}s linear`)
          .css("transform", `matrix(${sxt},0,0,${syt},${pxt},${pyt})`);
    }, 20);

    if (ctx.args.duration === undefined || ctx.args.block === "true") {
        fun_delay("block", t);
        return 2;
    }

    return 1;
};

export const handleImageRotate: CommandHandler = (ctx) => {
    const o1 = $("#sys_image").children("div:last");
    
    if (ctx.isSkip) {
        if (o1.length === 0) return 1;
        const ang = ctx.args.angle || 0;
        const d1 = o1.css("transform").replace(/rotate\(.*?\)/g, "");
        o1.css("transition", "").css("transform", `${d1} rotate(${ang}deg)`);
        return 1;
    }

    if (o1.length === 0) return -1;
    const ang = ctx.args.angle || 0;
    const fd = ctx.args.fadetime || 0;
    const d1 = o1.css("transform").replace(/rotate\(.*?\)/g, "");
    
    o1.css("transition", `transform ${fd}s`);
    
    globalTimer.create("img_rot_w", () => {
        o1.css("transform", `${d1} rotate(${ang}deg)`);
    }, 20);

    if (ctx.args.block === "true") {
        fun_delay("block", fd);
        return 2;
    }

    return 1;
};

// ----------------------------------------------------------------------
// cgitem 特效图 Handlers
// ----------------------------------------------------------------------

export const handleCgItem: CommandHandler = (ctx) => {
    // 挂载点从 sys_image 改为 sys_camera，以支持 layer 越级覆盖
    const o1 = $('#sys_camera');
    const n = (ctx.args.image && ctx.args.image.toLowerCase()) || "";

    if (n === "") return -1;
    if (data.back[n] === undefined || data.back[n] === "") {
        console.warn(`<CgItem> Data [${n}] not exist.`);
        return -1;
    }

    const sxf = ctx.args.sfrom !== undefined ? +ctx.args.sfrom : 1;
    const syf = ctx.args.sfrom !== undefined ? +ctx.args.sfrom : 1;
    const sxt = ctx.args.sto !== undefined ? +ctx.args.sto : 1;
    const syt = ctx.args.sto !== undefined ? +ctx.args.sto : 1;
    
    // 解析坐标, pfrom/pto 格式为 "x,y"
    let pxf = 0, pyf = 0, pxt = 0, pyt = 0;
    if (ctx.args.pfrom) {
        const parts = ctx.args.pfrom.split(',');
        pxf = +parts[0] * 0.75;
        pyf = +parts[1] * 0.75;
    }
    if (ctx.args.pto) {
        const parts = ctx.args.pto.split(',');
        pxt = +parts[0] * 0.75;
        pyt = +parts[1] * 0.75;
    }
    pyf = -pyf;
    pyt = -pyt;

    const layer = ctx.args.layer !== undefined ? +ctx.args.layer : 2;

    const e1 = document.createElement('div');
    const $e1 = $(e1);
    
    // 保底尺寸，防止 new Image().width 异步为 0
    let tsx = 1280 * 0.75;
    let tsy = 720 * 0.75;
    // 如果碰巧缓存了可以直接取
    const i1 = new Image();
    i1.src = data.back[n];
    if (i1.width > 0) {
        tsx = i1.width * 0.75;
        tsy = i1.height * 0.75;
    }

    const tpx = 480 - tsx / 2;
    const tpy = 270 - tsy / 2;

    // 解析透明度动画
    const afrom = ctx.args.afrom !== undefined ? +ctx.args.afrom : 0;
    const ato = ctx.args.ato !== undefined ? +ctx.args.ato : 1;
    const aduration = ctx.args.aduration !== undefined ? +ctx.args.aduration : 0;
    
    // 解析 style 混合模式 (解决 Unity 黑底特效图渲染为巨大黑块的问题)
    const style = ctx.args.style === undefined ? "" : ctx.args.style.toLowerCase();
    let blendMode = "normal";
    if (style === "cg") {
        // 原作中黑底特效图使用 Screen/Additive 滤掉黑色背景
        blendMode = "screen";
    }

    $e1.css({
        "position": "absolute",
        "width": tsx + "px",
        "height": tsy + "px",
        "left": tpx + "px",
        "top": tpy + "px",
        "background-image": `url(${data.back[n]})`,
        "background-size": `100% 100%`,
        "transform": `matrix(${sxf},0,0,${syf},${pxf},${pyf})`,
        "z-index": layer,
        "opacity": afrom,
        "display": "block",
        "mix-blend-mode": blendMode
    });
    
    // 把特定的 image id 保存到 DOM 的 data 属性上，方便 hidecgitem 寻找
    $e1.attr("data-cgitem-id", n);

    if (ctx.isSkip) {
        $e1.css("transform", `matrix(${sxt},0,0,${syt},${pxt},${pyt})`);
        $e1.css("opacity", ato);
        o1.append($e1);
        return 1;
    }

    o1.append($e1);
    
    if (aduration > 0) {
        domFadeTo(e1, aduration * 1000, ato);
    } else {
        $e1.css("opacity", ato);
    }
    
    // 如果存在位移/缩放补间
    if (ctx.args.sduration || ctx.args.pduration) {
        const dur = Math.max(ctx.args.sduration || 0, ctx.args.pduration || 0);
        globalTimer.create(`cgitem_${n}_w`, () => {
            $e1.css("transition", `transform ${dur}s linear`)
               .css("transform", `matrix(${sxt},0,0,${syt},${pxt},${pyt})`);
        }, 20);
    }

    if (ctx.args.block === "true") {
        // 阻塞时间优先取 aduration，否则取位移的，如果都没有则不阻塞
        const blockTime = Math.max(aduration, ctx.args.sduration || 0, ctx.args.pduration || 0);
        if (blockTime > 0) {
            fun_delay("block", blockTime);
            return 2;
        }
    }

    return 1;
};

export const handleHideCgItem: CommandHandler = (ctx) => {
    // 对应寻找挂载点 sys_camera
    const o1 = $('#sys_camera');
    const fadetime = ctx.args.fadetime !== undefined ? +ctx.args.fadetime : 0.16;
    const n = (ctx.args.image && ctx.args.image.toLowerCase()) || "";

    if (ctx.isSkip) {
        if (n !== "") {
            o1.children(`div[data-cgitem-id="${n}"]`).remove();
        } else {
            o1.children('div[data-cgitem-id]').remove();
        }
        return 1;
    }

    let targetElements;
    if (n !== "") {
        targetElements = o1.children(`div[data-cgitem-id="${n}"]`);
    } else {
        targetElements = o1.children('div[data-cgitem-id]');
    }

    if (targetElements.length === 0) return -1;

    targetElements.each((_, el) => domFadeToExit(el, fadetime * 1000));
    
    if (ctx.args.block === "true") {
        fun_delay("block", fadetime);
        return 2;
    }
    return 1;
};

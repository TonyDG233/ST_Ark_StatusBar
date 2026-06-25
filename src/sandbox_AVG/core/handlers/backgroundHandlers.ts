import { CommandHandler } from '../analyzerCore';
import { data, globalTimer } from '../../store/avgState';
import { support } from '../../utils/support';
import { domFadeToExit, domFadeIn } from '../../utils/toolbox';
import { fun_delay } from '../engineActions';

// ----------------------------------------------------------------------
// Background Handlers
// ----------------------------------------------------------------------

export const handleBackground: CommandHandler = (ctx) => {
    const o1 = $('#sys_back');
    const fadetime = ctx.args.fadetime === undefined ? 0.15 : parseFloat(ctx.args.fadetime);
    const n = (ctx.args.image && "bg_" + ctx.args.image.toLowerCase()) || "";

    if (ctx.isSkip) {
        // 跳过模式下的逻辑
        if (n === "") {
            o1.empty();
        } else {
            o1.children('div').remove(); // 瞬间清场
            // 我们依然需要创建最终节点并注入，否则后续没有节点可以 tween
            const e1 = $('<div></div>');
            let sx = ctx.args.xscale || ctx.args.width || 1;
            let sy = ctx.args.yscale || ctx.args.height || 1;
            const px = (ctx.args.x && ctx.args.x * 0.75) || 0;
            const py = (ctx.args.y && ctx.args.y * 0.75) || 0;
            sx *= 1.2; sy *= 1.2; // 原版写死的 temp 参数修正

            if (data.back[n] === undefined || data.back[n] === "") {
                return 1;
            }

            e1.css({
                "position": "absolute",
                "transform": `matrix(${sx},0,0,${sy},${px},${-py})`,
                // 直接附加最终状态，不等待 onload 过渡
                "background-image": `url(${data.back[n]})`
            });
            e1.attr("d-adapt", "coverall");
            // 因为跳过了动画，我们就省略复杂的 onload size 适配，或者依赖 css object-fit
            o1.append(e1);
        }
        return 1;
    }

    // 正常播放模式
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
    let sx = ctx.args.xscale || ctx.args.width || 1;
    let sy = ctx.args.yscale || ctx.args.height || 1;
    const px = (ctx.args.x && ctx.args.x * 0.75) || 0;
    const py = (ctx.args.y && ctx.args.y * 0.75) || 0;

    if (data.back[n] === undefined || data.back[n] === "") {
        console.error(`<Background>Data [${n}] not exist,please check the data list.`);
        return -1;
    }

    sx *= 1.2; sy *= 1.2; // 原版代码的神秘倍率

    const i1 = new Image();
    i1.src = data.back[n];
    ctx.args.screenadapt = "coverall";
    $e1.attr("d-adapt", ctx.args.screenadapt);

    i1.onload = function(this: GlobalEventHandlers) {
        const img = this as unknown as HTMLImageElement;
        let w = img.width * 0.75, h = img.height * 0.75;
        if ($e1.attr("d-adapt") === "coverall") {
            let s_x = w / 960, s_y = h / 540;
            let s = Math.min(s_x, s_y);
            w /= s; h /= s;
        }
        let x = 480 - w / 2, y = 270 - h / 2;
        $e1.css({"width": w, "height": h, "left": x, "top": y, "background-size": `${w}px ${h}px`, "background-image": `url(${img.src})`});
    };

    $e1.css({ "position": "absolute", "transform": `matrix(${sx},0,0,${sy},${px},${-py})` });
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

export const handleBackgroundTween: CommandHandler = (ctx) => {
    const o1 = $("#sys_back").children("div:last");
    
    if (ctx.isSkip) {
        // 跳过动画直接锁定最终状态
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
    const t = ctx.args.duration === undefined ? 0.15 : parseFloat(ctx.args.duration);
    
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

    o1.css("transition", "").css("transform", `matrix(${sxf},0,0,${syf},${pxf},${pyf})`);
    
    globalTimer.create("backt_w", () => {
        o1.css("transition", `transform ${t}s linear`)
          .css("transform", `matrix(${sxt},0,0,${syt},${pxt},${pyt})`);
    }, 20);

    if (ctx.args.duration === undefined || ctx.args.block === "true") {
        fun_delay("block", t);
        return 2;
    }

    return 1;
};

// ----------------------------------------------------------------------
// Grid / Large Background Canvas Handlers
// ----------------------------------------------------------------------

export const handleGridBg: CommandHandler = (ctx) => {
    const cmd = ctx.command;
    const isBg = cmd.endsWith("bg");
    const o1 = isBg ? $("#sys_back") : $("#sys_image");
    
    // 如果是 skip 模式并且要跳过动画
    if (ctx.isSkip) {
        o1.children('canvas').remove();
        // 原版中即使在 skip 模式也会把最终结果 append 进去
        // 但由于 Canvas 渲染需要图片全部 onload 且绘制循环代价高，我们简化：
        // (原版的 skip 中，仅执行了 remove 操作，这是合法的，因为跳过后往往接着普通的 background 或直接剧终)
        return 1;
    }

    const ig = ctx.args.imagegroup === undefined ? [] : ctx.args.imagegroup.split('/');
    const sw = ctx.args.solidwidth === undefined ? [] : ctx.args.solidwidth.split('/');
    const sh = ctx.args.solidheight === undefined ? [] : ctx.args.solidheight.split('/');
    
    if (ig.length === 0 || sw.length === 0 || sh.length === 0) return -1;
    
    const px = ctx.args.x === undefined ? 0 : ctx.args.x * 0.75;
    const py = ctx.args.y === undefined ? 0 : ctx.args.y * 0.75;
    
    // 替换 array.getSum() 为 reduce
    const sumSw = sw.reduce((a: number, b: string) => a + Number(b), 0);
    const sumSh = sh.reduce((a: number, b: string) => a + Number(b), 0);
    
    const sx = sumSw * 0.9;
    const sy = sumSh * 0.9;
    
    const t = ctx.args.fadetime || 0.15;
    const c1 = o1.children('canvas').length;
    
    const o2 = document.createElement("canvas");
    const $o2 = $(o2);
    
    // 使用原版魔法基准宽高 (960, 540)
    const base_width = 960;
    const base_height = 540;

    if (cmd.startsWith("grid")) {
        const leng = ig.length;
        const r = Math.ceil(Math.sqrt(leng));
        const cx = Math.floor(sx / r);
        const cy = Math.floor(sy / r);
        const offset_px = (base_width - cx) / 2;
        const offset_py = (base_height - cy) / 2;
        
        $o2.attr({ width: cx, height: cy });
        o2.style.left = `${offset_px}px`;
        o2.style.top = `${offset_py}px`;
        
        let offx = 0;
        let offy = 0;
        for (let i = 0; i < leng; i++) {
            const imgKey = (isBg ? "bg_" : "") + ig[i].toLowerCase();
            support.drawImage(o2, data.back[imgKey] || data.char[imgKey], Number(sw[i]) * 0.9, Number(sh[i]) * 0.9, offx, offy);
            offx += Number(sw[i]) * 0.9;
            if (i > 0 && (i + 1) % 2 === 0) {
                offx = 0;
                offy += Number(sh[i]) * 0.9;
            }
        }
    } else if (cmd.startsWith("vertical")) {
        const offset_px = (base_width - sx) / 2;
        const offset_py = (base_height - sy) / 2;
        $o2.attr({ width: sx, height: sy });
        o2.style.left = `${offset_px}px`;
        o2.style.top = `${offset_py}px`;
        
        let offx = 0;
        const leni = sw.length;
        for (let i = 0; i < leni; i++) {
            let offy = 0;
            const lenj = sh.length;
            for (let j = 0; j < lenj; j++) {
                const imgKey = (isBg ? "bg_" : "") + ig[i + j * leni].toLowerCase();
                support.drawImage(o2, data.back[imgKey] || data.char[imgKey], Number(sw[i]) * 0.9, Number(sh[j]) * 0.9, offx, offy);
                offy += Number(sh[j]) * 0.9;
            }
            offx += Number(sw[i]) * 0.9;
        }
    } else if (cmd.startsWith("large")) {
        const offset_px = (base_width - sx) / 2;
        const offset_py = (base_height - sy) / 2;
        $o2.attr({ width: sx, height: sy });
        o2.style.left = `${offset_px}px`;
        o2.style.top = `${offset_py}px`;
        
        let offx = 0;
        for (let i = 0; i < sw.length; i++) {
            let offy = 0;
            const lenj = sh.length;
            for (let j = 0; j < lenj; j++) {
                const imgKey = (isBg ? "bg_" : "") + ig[i * lenj + j].toLowerCase();
                support.drawImage(o2, data.back[imgKey] || data.char[imgKey], Number(sw[i]) * 0.9, Number(sh[j]) * 0.9, offx, offy);
                offy += Number(sh[j]) * 0.9;
            }
            offx += Number(sw[i]) * 0.9;
        }
    } else {
        return -1;
    }
    
    $o2.css({
        "position": "absolute",
        "transform": `matrix(1.2,0,0,1.2,${px},${-py})`
    });
    
    o1.append($o2);
    
    $o2.hide();
    domFadeIn(o2, t * 1000);
    setTimeout(() => {
        o1.children(`canvas:lt(${c1})`).remove();
    }, t * 1000);
    
    if (ctx.args.block === "true") {
        fun_delay("block", t);
        return 2;
    }
    return 1;
};

export const handleLargeBgTween: CommandHandler = (ctx) => {
    const cmd = ctx.command;
    const isBg = cmd === "largebgtween";
    const o1 = isBg ? $("#sys_back").children("canvas:last") : $("#sys_image").children("canvas:last");
    
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
    
    globalTimer.create("large_t_w", () => {
        o1.css("transition", `transform ${t}s linear`)
          .css("transform", `matrix(${sxt},0,0,${syt},${pxt},${pyt})`);
    }, 20);

    if (ctx.args.block === "true") {
        fun_delay("block", t);
        return 2;
    }
    return 1;
};


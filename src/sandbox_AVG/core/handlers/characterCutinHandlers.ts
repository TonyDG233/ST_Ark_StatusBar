import { CommandHandler } from '../analyzerCore';
import { data } from '../../store/avgState';
import { scenarioExtend } from '../../utils/scenario_extend';
import { domFadeToExit } from '../../utils/toolbox';
import { fun_delay } from '../engineActions';

// 在原始版本中，全屏切图逻辑共享了一个全局状态对象，用于储存上次动画结束时的位置和样式以供退出时复用。
// 在 TS 改造中，我们将它放到模块内部的单例或者上下文属性中。
const data_cutin: Record<string, any> = {};

export const handleCharacterCutin: CommandHandler = (ctx) => {
    const o1 = $("#sys_cutin");

    if (ctx.isSkip) {
        // Skip 模式下的清理逻辑：瞬间移除整个 cutin，不播放展开和淡出动画。
        o1.children().each((_, el) => domFadeToExit(el, 150));
        return 1;
    }

    if (ctx.args.widgetid === undefined) {
        o1.empty();
        return -1;
    }

    const t = ctx.args.fadetime === undefined ? 140 : ctx.args.fadetime * 1000;
    let n = ctx.args.name === undefined ? "" : String(ctx.args.name).toLowerCase();
    const id = "cutin_" + String(ctx.args.widgetid).replace(/ /g, "_");
    
    const px = ctx.args.offsetx === undefined ? 480 : 480 + Number(ctx.args.offsetx) * 0.75;
    const py = ctx.args.offsety === undefined ? 0 : -Number(ctx.args.offsety) * 0.75;
    
    const w = ctx.args.width === undefined ? 150 : Number(ctx.args.width) * 0.75;
    const h = ctx.args.height === undefined ? 540 : Number(ctx.args.height) * 0.75;

    let o2 = $(`#${id}`);

    // 如果未传名字且元素存在，意味着这是个消除指令
    if (n === "" && o2.length > 0) {
        const pas = data_cutin[id];
        if (pas.style === 0) {
            domFadeToExit(o2[0], t);
        } else {
            if (pas.style > 0 && pas.style <= 3) {
                o2.animate({"width": 0, "left": pas.left, "backgroundPositionX": pas.imgX}, t, "linear");
            } else if (pas.style > 3 && pas.style <= 6) {
                o2.animate({"height": 0, "top": pas.top, "backgroundPositionY": pas.imgY}, t, "linear");
            }
        }
        if (ctx.args.block === "true") {
            fun_delay("block", t, "ms");
            return 2;
        }
        return 1;
    }

    if (o2.length === 0) {
        const div = document.createElement('div');
        o1.append(div);
        o2 = $(div);
        o2.attr({"id": id, "class": "cutin_style"});
    }

    const [d1, c1] = scenarioExtend.charLink(n);
    if (d1 === -1) return -1;
    
    n = scenarioExtend.charFormat(d1 as string, c1 as number);
    const infos = scenarioExtend.charPos(d1 as string);
    const fx = w / 2;
    const fy = h / 2;
    
    // 背景图片定位
    let ixs = -infos[0] / 2 + fx;
    let iys = infos[3];
    let ixe = ixs;
    let iye = iys;

    // 偏移量边界
    let ls = px - fx;
    let ts = py;
    let le = ls;
    let te = ts;

    const cutin_paras: any = {};

    switch (ctx.args.fadestyle) {
        case 'horiz_expand_center':
            cutin_paras.style = 1;
            ls += fx;
            ixs -= fx;
            break;
        case 'horiz_expand_left2right':
            cutin_paras.style = 2;
            break;
        case 'horiz_expand_right2left':
            cutin_paras.style = 3;
            ls += w;
            ixs -= w;
            break;
        case 'vert_expand_center':
            cutin_paras.style = 4;
            ts += fy;
            iys -= fy;
            break;
        case 'vert_expand_top2buttom':
            cutin_paras.style = 5;
            break;
        case 'vert_expand_buttom2top':
            cutin_paras.style = 6;
            ts += h;
            iys -= h;
            break;
        default:
            cutin_paras.style = 0;
            break;
    }

    cutin_paras.width = w;
    cutin_paras.height = h;
    cutin_paras.offsetx = px;
    cutin_paras.left = ls;
    cutin_paras.top = ts;
    cutin_paras.imgX = ixs;
    cutin_paras.imgY = iys;
    data_cutin[id] = cutin_paras;

    if (!data.char[n]) console.error(`<CharacterCutin> Data [${n}] not exist.`);

    o2.css({
        "backgroundSize": `${infos[0]}px ${infos[1]}px`,
        "backgroundImage": `url('${data.char[n]}')`,
        "backgroundPosition": `${ixs}px ${iys}px`
    });
    
    o2.css({"left": ls, "top": ts});

    if (cutin_paras.style === 0) {
        o2.hide().css({"width": w, "height": h}).fadeIn(t);
    } else if (cutin_paras.style > 0 && cutin_paras.style <= 3) {
        o2.css({"width": 0, "height": h}).animate({"width": w, "left": le, "backgroundPositionX": ixe}, t, "linear");
    } else if (cutin_paras.style > 3 && cutin_paras.style <= 6) {
        o2.css({"width": w, "height": 0}).animate({"height": h, "top": te, "backgroundPositionY": iye}, t, "linear");
    }

    if (ctx.args.block === "true") {
        fun_delay("block", t, "ms");
        return 2;
    }

    return 1;
};

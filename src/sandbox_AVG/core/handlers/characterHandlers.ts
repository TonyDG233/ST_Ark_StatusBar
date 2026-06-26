import { CommandHandler } from '../analyzerCore';
import { data, globalTimer } from '../../store/avgState';
import { scenarioExtend } from '../../utils/scenario_extend';
import { support } from '../../utils/support';
import { domFadeToExit, domFadeTo, domFadeIn } from '../../utils/toolbox';
import { fun_delay } from '../engineActions';
import { timer_shake_common } from '../callbacks';

const base_width = 960;
const base_height = 540;

export const handleCharacter: CommandHandler = (ctx) => {
    // 兼容 isSkip 下的清理逻辑:
    // 在原版的跳过逻辑中，无论原来传了什么参数，只要是 skip，就直接抹去 #sys_char 的展示
    if (ctx.isSkip) {
        $("#sys_char").children().each((_, el) => domFadeToExit(el, 150));
        fun_delay("block", 0.2);
        return 2;
    }

    const n1 = ctx.args.name ? ctx.args.name.toLowerCase() : "";
    const n2 = ctx.args.name2 ? ctx.args.name2.toLowerCase() : "";
    const f = +(ctx.args.focus || 0);
    const dur = +(ctx.args.fadetime || 0.15);
    const cnt = n2 ? 2 : 1;

    let tarA = "char_left";
    let tarB = "char_right";

    if (!n1 && !n2) {
        $("#sys_char").children().each((_, el) => domFadeToExit(el, dur * 950));
        if (ctx.args.block === "true") {
            fun_delay("block", dur);
            return 2;
        }
        return -2;
    }

    let char = $(`#${tarB}`);
    
    // 双人模式处理 (存在 n2)
    if (n2) {
        globalTimer.clear("char2_reset", true);
        const ent = ctx.args.enter2 || "";
        const len = char.children().length;

        if (char.length === 0) {
            const e = document.createElement("div");
            e.id = tarB;
            e.className = "char_style char";
            $("#sys_char").append(e);
            char = $(e);
        } else {
            char.stop(true);
        }

        const [n, i] = scenarioExtend.charLink(n2);
        if (n === -1) return -1;
        
        const k = scenarioExtend.charFormat(n as string, i);
        if (!data.char[k]) {
            console.error(`<character> Linked key [${k}] not exist.`);
        }

        const can = char.children(":last");
        if (f === -1 || f === 1) {
            char.addClass("unfocus");
        } else {
            char.removeClass("unfocus");
        }

        if (can.attr("data-n") === String(n) && can.attr("data-cnt") === String(cnt)) {
            support.drawChar(can[0] as HTMLCanvasElement, data.char[k], (can[0] as HTMLCanvasElement).width, (can[0] as HTMLCanvasElement).height, ctx.args.blackstart2, ctx.args.blackend2);
            if (ctx.args.fadetime || ctx.args.duration) {
                can.hide();
                domFadeIn(can[0], dur * 950 || 0);
            }
        } else {
            const [sx, sy, px, py] = scenarioExtend.charPos(n as string, 1);
            const e = $(document.createElement("canvas"));
            e.css({"position": "absolute", "left": px, "top": py});
            e.attr({"data-n": String(n), "data-cnt": cnt, "width": sx, "height": sy});
            
            support.drawChar(e[0] as HTMLCanvasElement, data.char[k], sx, sy, ctx.args.blackstart2, ctx.args.blackend2);
            char.append(e);
            
            if (k === "char_empty") char.attr("style", "");
            
            const sf = char.attr("style") === "" ? false : (can.attr("data-n") === "char_empty" && can.attr("data-cnt") === String(cnt) ? false : true);
            
            e.hide();
            domFadeIn(e[0], dur * 1000);
            if (sf) {
                globalTimer.create("char2_reset", () => char.attr("style", ""), dur * 950);
            }
            char.children(`:lt(${len})`).each((_, el) => domFadeToExit(el, dur * 950));
        }

        if (ent) {
            globalTimer.clear("char2_enter");
            char.attr("style", "");
            const tx = ent === "left" ? -base_width : ent === "right" ? base_width : 0;
            const ty = ent === "up" ? -base_height : ent === "down" ? base_height : 0;
            
            char.css("transform", `matrix(1,0,0,1,${tx},${ty})`);
            globalTimer.create("char2_enter", () => {
                char.css({"transition": `transform ${dur}s`, "transform": "matrix(1,0,0,1,0,0)"});
            }, 20);
        }
    } else {
        domFadeToExit(char[0], dur * 950);
        const tarADOM = document.getElementById(tarA);
        if (tarADOM) domFadeToExit(tarADOM, dur * 950);
        tarA = "char_middle";
    }

    char = $(`#${tarA}`);
    
    // 主人物处理 (n1)
    if (n1) {
        const ent = ctx.args.enter || "";
        const len = char.children().length;
        globalTimer.clear("char1_reset", true);

        if (char.length === 0) {
            const e = document.createElement("div");
            e.id = tarA;
            e.className = "char_style char";
            $("#sys_char").append(e);
            char = $(e);
        } else {
            char.stop(true);
        }

        const [n, i] = scenarioExtend.charLink(n1);
        if (n === -1) return -1;

        const k = scenarioExtend.charFormat(n as string, i);
        if (!data.char[k]) {
            console.error(`<character> Linked key [${k}] not exist.`);
        }

        const can = char.children(":last");
        if (f === -1 || f === 2) {
            char.addClass("unfocus");
        } else {
            char.removeClass("unfocus");
        }

        if (can.attr("data-n") === String(n) && can.attr("data-cnt") === String(cnt)) {
            support.drawChar(can[0] as HTMLCanvasElement, data.char[k], (can[0] as HTMLCanvasElement).width, (can[0] as HTMLCanvasElement).height, ctx.args.blackstart, ctx.args.blackend);
            if (ctx.args.fadetime || ctx.args.duration) {
                can.hide();
                domFadeIn(can[0], dur * 950 || 0);
            }
        } else {
            if (tarA !== "char_middle") {
                const charMiddle = document.getElementById("char_middle");
                if (charMiddle) domFadeToExit(charMiddle, dur * 950);
            }
            
            const [sx, sy, px, py] = scenarioExtend.charPos(n as string, n2 ? -1 : 0);
            const e = $(document.createElement("canvas"));
            e.css({"position": "absolute", "left": px, "top": py});
            e.attr({"data-n": String(n), "data-cnt": cnt, "width": sx, "height": sy});
            
            support.drawChar(e[0] as HTMLCanvasElement, data.char[k], sx, sy, ctx.args.blackstart, ctx.args.blackend);
            char.append(e);
            
            if (k === "char_empty") char.attr("style", "");
            
            const sf = char.attr("style") === "" ? false : (can.attr("data-n") === "char_empty" && can.attr("data-cnt") === String(cnt) ? false : true);
            e.hide();
            domFadeIn(e[0], dur * 1000);
            
            if (sf) {
                globalTimer.create("char1_reset", () => char.attr("style", ""), dur * 950);
            }
            char.children(`:lt(${len})`).each((_, el) => domFadeToExit(el, dur * 950));
        }

        if (ent) {
            globalTimer.clear("char1_enter");
            char.attr("style", "");
            const tx = ent === "left" ? -base_width : ent === "right" ? base_width : 0;
            const ty = ent === "up" ? -base_height : ent === "down" ? base_height : 0;
            
            char.css("transform", `matrix(1,0,0,1,${tx},${ty})`);
            globalTimer.create("char1_enter", () => {
                char.css({"transition": `transform ${dur}s`, "transform": "matrix(1,0,0,1,0,0)"});
            }, 20);
        }
    }

    if (ctx.args.block === "true") {
        fun_delay("block", dur);
        return 2;
    }
    
    return 1;
};

export const handleCharSlot: CommandHandler = (ctx) => {
    if (ctx.isSkip) {
        // Skip 模式与 Character 的 skip 处理逻辑合并（统一为 fadeToExit 或者直接移除）
        $("#sys_char").children().each((_, el) => domFadeToExit(el, 150));
        fun_delay("block", 0.2);
        return 2;
    }

    let p = ctx.args.slot;
    const t = +(ctx.args.duration || 0.15);
    const o = $("#sys_char");

    if (!p) {
        o.children().each((_, el) => domFadeToExit(el, t * 950));
        if (ctx.args.isblock) {
            fun_delay("block", t);
            return 2;
        }
        return 1;
    }

    const n = ctx.args.name ? ctx.args.name.toLowerCase() : "";
    let f = ctx.args.focus || "unset";
    let ps = 0;

    switch (p.toLowerCase()) {
        case "left":
        case "l":
            p = "char_left";
            ps = -1;
            break;
        case "middle":
        case "m":
            p = "char_middle";
            ps = 0;
            break;
        case "right":
        case "r":
            p = "char_right";
            ps = 1;
            break;
    }

    let o1 = $(`#${p}`);
    if (o1.length === 0) {
        o1 = $(document.createElement("div"));
        o1[0].id = p;
        o1.addClass("char_style slot");
        o.append(o1);
    }

    let o3 = o1.children(":last");

    if (n) {
        if (!o3.attr("data-n")) ctx.args.end = "false";
        if (!ctx.args.focus) f = ctx.args.slot;
        
        const c11 = o1.children().length;
        const [charN, i] = scenarioExtend.charLink(n);
        if (charN === -1) return -1;
        
        const n1 = scenarioExtend.charFormat(charN as string, i);
        if (!data.char[n1]) console.error(`<CharSlot>Data [${n1}] not exist.`);

        const [sx, sy, px, py] = scenarioExtend.charPos(charN as string, ps);

        if (o3.attr("data-n") === String(charN)) {
            support.drawChar(o3[0] as HTMLCanvasElement, data.char[n1], sx, sy, ctx.args.bstart, ctx.args.bend);
            domFadeTo(o3[0], t * 950, 1);
            if (ctx.args.fadetime) {
                o3.hide();
                domFadeIn(o3[0], ctx.args.fadetime * 950);
            }
        } else {
            const e = $(document.createElement("canvas"));
            e.css({"position": "absolute", "left": px, "top": py});
            e.attr({"data-n": String(charN), "width": sx, "height": sy});
            support.drawChar(e[0] as HTMLCanvasElement, data.char[n1], sx, sy, ctx.args.bstart, ctx.args.bend);
            
            o1.append(e);
            e.hide();
            domFadeIn(e[0], t * 1000);
            o1.children(`:lt(${c11})`).each((_, el) => domFadeToExit(el, t * 950));
            o3 = e;
        }
    }

    const o1DOM = o1[0] as HTMLElement & { props?: any };
    const pas = ctx.args.end === "true" ? {px: 0, py: 0, sx: 1, sy: 1} : (o1DOM.props || {px: 0, py: 0, sx: 1, sy: 1});
    
    // preload transform data
    const tsf = [pas.sx, 0, 0, pas.sy, pas.px, pas.py];

    // TODO: pos_multiply import required if missing, mapped to 0.75 locally
    const mtpy = 0.75; 

    if (ctx.args.posfrom && ctx.args.posto) {
        const pf = ctx.args.posfrom.split(',');
        const pt = ctx.args.posto.split(',');
        if (pf.length === 2 && pt.length === 2) {
            tsf[4] = pf[0] * mtpy;
            tsf[5] = -pf[1] * mtpy;
            pas.px = pt[0] * mtpy;
            pas.py = -pt[1] * mtpy;
        }
    } else if (ctx.args.posto) {
        const pt = ctx.args.posto.split(',');
        if (pt.length === 2) {
            pas.px += pt[0] * mtpy;
            pas.py -= pt[1] * mtpy;
        }
    }

    if (f === "none") {
        o1.addClass("unfocus");
    } else if (f !== "unset") {
        if (ctx.args.focus === "all") f = "l,m,r";
        const fs = f.toLowerCase().split(',');
        
        for (let idx = 0; idx < fs.length; idx++) {
            switch(fs[idx]) {
                case 'l':
                case 'left':
                    fs[idx] = "left";
                    break;
                case 'm':
                case 'middle':
                    fs[idx] = "middle";
                    break;
                case 'r':
                case 'right':
                    fs[idx] = "right";
                    break;
            }
        }
        
        o.children().each((_, el) => {
            const s = el.id || "";
            let match = false;
            for (const f of fs) {
                if (s.includes(f)) {
                    el.classList.remove("unfocus");
                    match = true;
                    break;
                }
            }
            if (!match) el.classList.add("unfocus");
        });
    }

    o1DOM.props = pas;
    if (ctx.args.posfrom || ctx.args.posto) {
        o1.css("transition", "").css("transform", `matrix(${tsf[0]},0,0,${tsf[3]},${tsf[4]},${tsf[5]})`);
        globalTimer.create(`charslot_${p}`, () => {
            o1.css("transition", `transform ${t}s`)
              .css("transform", `matrix(${pas.sx},0,0,${pas.sy},${pas.px},${pas.py})`);
        }, 20);
    }

    if (ctx.args.block === "true" || ctx.args.isblock) {
        fun_delay("block", t);
        return 2;
    }
    
    return 1;
};

// ----------------------------------------------------------------------
// Character Action Handlers (Move, Jump, Rotate, Shake, Zoom, Exit)
// ----------------------------------------------------------------------

export const handleCharacterAction: CommandHandler = (ctx) => {
    const n = ctx.args.name === undefined ? "" : String(ctx.args.name);
    if (n === "") return -1;
    
    const tp = ctx.args.type;
    const px = ctx.args.xpos === undefined ? 0 : Number(ctx.args.xpos) * 0.75;
    const py = ctx.args.ypos === undefined ? 0 : Number(ctx.args.ypos) * 0.75;
    const fd = ctx.args.duration === undefined ? (ctx.args.fadetime === undefined ? 0.25 : +ctx.args.fadetime) : +ctx.args.duration;
    const pw = ctx.args.power === undefined ? 0 : Number(ctx.args.power) * 0.75;
    const tm = ctx.args.times === undefined ? 1 : +ctx.args.times;
    
    const o1 = $(`#char_${n}`);
    if (o1.length === 0) {
        console.warn(`<CharacterAction> Unexpected character length for name: ${n}`);
        return -1;
    }

    if (ctx.isSkip) {
        // 跳过动画模式
        // 在 skip 状态下，必须解析当前矩阵加上便宜量，瞬间锁定到最终位置。
        // 但由于 shake / jump 没有永久性偏移，rotate / move 有永久性变化。
        // 为了安全起见，我们将应用变换瞬间完成并返回。
        const d1 = o1[0].style.transform.replace(/\s/g, "").match(/^matrix\((.*)\).*$/i);
        const pos = d1 == null ? [1, 0, 0, 1, 0, 0] : d1[1].split(",").map(Number);
        pos[4] += px; 
        pos[5] -= py;

        switch (tp) {
            case 'move':
            case 'exit':
                if (tp === 'exit') {
                    let exitDir = ctx.args.direction === "left" ? -1920 : 1920;
                    exitDir += (n === "left" ? 480 : -480);
                    pos[4] = exitDir;
                }
                o1.css("transition", "").css("transform", `matrix(${pos.join(',')})`);
                break;
            case 'zoom':
                pos[0] = ctx.args.xscale || ctx.args.scale || pos[0];
                pos[3] = ctx.args.yscale || ctx.args.scale || pos[3];
                o1.css("transition", "").css("transform", `matrix(${pos.join(',')})`);
                break;
            case 'rotate':
            case 'shake':
            case 'jump':
                // 瞬间恢复原位或由于无法表示动态过程而忽略
                break;
        }
        return 1;
    }

    // 正常播放模式
    globalTimer.clear("trans_action", true);
    
    const d1 = o1[0].style.transform.replace(/\s/g, "").match(/^matrix\((.*)\).*$/i);
    const pos = d1 == null ? [1, 0, 0, 1, 0, 0] : d1[1].split(",").map(Number);
    pos[4] += px; 
    pos[5] -= py;

    switch (tp) {
        case 'move':
            o1.css("transition", `transform ${fd}s linear`);
            break;
        case 'jump':
            for (let i = 0; i < tm; i++) {
                setTimeout(() => {
                    o1.animate({"top": `-=${pw}`}, fd * 500, () => {
                        o1.animate({"top": 0}, fd * 500);
                    });
                }, fd * i * 950);
            }
            o1.css("transition", `transform ${fd}s`);
            break;
        case 'rotate':
            const o2 = o1.children();
            o2.css("transform", "");
            globalTimer.clear(`${n}_rotate`);
            if (ctx.args.stop === "true") return 1;
            
            const st = ctx.args.start === undefined ? 0 : ctx.args.start;
            const le = ctx.args.leftend === undefined ? -15 : -ctx.args.leftend;
            const re = ctx.args.rightend === undefined ? 15 : ctx.args.rightend;
            
            o2.css({
                "transform-origin": "center",
                "transition": `transform ${fd}s ease-in-out`,
                "transform": `rotate(${st}deg)`
            });
            o2.attr({"data-r": 0, "data-c": 0, "data-cm": tm});
            
            globalTimer.create(`${n}_rotate`, () => {
                const d = o2.attr("data-r");
                const cStr = o2.attr("data-c");
                let c = Number(cStr);
                const t = o2.attr("data-cm");
                
                if (d === "0") o2.css("transform", `rotate(${le}deg)`);
                else o2.css("transform", `rotate(${re}deg)`);
                
                o2.attr("data-r", d === "1" ? "0" : "1");
                if (t === "-1") return;
                
                if (++c > Number(t)) {
                    o2.css("transform", "");
                    globalTimer.clear(`${n}_rotate`);
                }
                o2.attr("data-c", c);
            }, fd * 1000, true);
            return 1;
        case 'shake':
            {
                const timerName = `action_${n}`;
                globalTimer.clear(timerName);
                o1.css({left: 0, top: 0});
                if (ctx.args.stop === "true") {
                    o1.removeAttr("d-sh-n");
                    o1.removeAttr("d-sh-t");
                    return 1;
                }
                o1.attr({"d-sh-n": timerName, "d-sh-t": 0});
                const c = tm > 0 ? Math.max(Math.round(fd * 1000 / tm), 1) : fd;
                globalTimer.create(timerName, () => timer_shake_common(o1, pw, pw, ctx.args.randomness || 90, tm), c, true);
            }
            return 1;
        case 'zoom':
            pos[0] = ctx.args.xscale || ctx.args.scale || pos[0];
            pos[3] = ctx.args.yscale || ctx.args.scale || pos[3];
            o1.css({"transition": `transform ${fd}s linear`});
            break;
        case 'exit':
            let c1 = ctx.args.direction === "left" ? -1920 : 1920;
            c1 = c1 + (n === "left" ? 480 : -480);
            pos[4] = c1;
            o1.css("transition", `transform ${fd}s ease-in-out`);
            break;
        default:
            console.warn(`<CharacterAction>: Unknown type data: ${tp}`);
            return -1;
    }

    globalTimer.create("trans_action", () => {
        o1.css("transform", `matrix(${pos.join(',')})`);
    }, 20);

    if (ctx.args.isblock === "true") {
        fun_delay("block", fd);
        return 2;
    }
    
    return 1;
};

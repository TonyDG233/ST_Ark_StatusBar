import { globalTimer } from '../../store/avgState';
import { CommandHandler } from '../analyzerCore';
import { timer_shake_common } from '../callbacks';
import { fun_delay } from '../engineActions';
// ----------------------------------------------------------------------
// Camera Handlers
// ----------------------------------------------------------------------

export const handleCameraEffect: CommandHandler = (ctx) => {
    // 包括普通的 effect 和 grayscale
    const effect = ctx.args.effect === undefined ? "" : String(ctx.args.effect).toLowerCase();
    const amount = ctx.args.amount === undefined ? 0 : ctx.args.amount;
    const t = ctx.args.fadetime === undefined ? -1 : +ctx.args.fadetime;
    const o1 = $("#sys_camera");

    if (ctx.isSkip) {
        // 如果是快进，所有的过渡将瞬间完成，或者直接置空
        o1.css("transition", "");
        if (amount == 0 || effect === "") {
            o1.css("filter", "");
        } else if (effect === 'grayscale') {
            o1.css("filter", `grayscale(${amount})`);
        }
        return 1;
    }

    if (t > 0) {
        o1.css("transition", `filter ${t}s linear`);
        globalTimer.create("cmreff_w", () => {
            o1.css("transition", "");
        }, t * 1000);
    }

    if (amount == 0 || effect === "") {
        o1.css("filter", "");
        return 1;
    }

    switch (effect) {
        case 'grayscale':
            o1.css("filter", `grayscale(${amount})`);
            break;
        default:
            o1.css("filter", "");
            break;
    }

    return 1;
};

export const handleCameraShake: CommandHandler = (ctx) => {
    const mode = ctx.args.mode === undefined ? "" : ctx.args.mode.toLowerCase();
    const o1 = $("#sys_camera");

    if (ctx.isSkip) {
        // 瞬间停止所有震动，清空样式
        globalTimer.clear("shake");
        o1.css({ left: 0, top: 0, "transition-duration": "" });
        o1.removeAttr("d-sh-n").removeAttr("d-sh-t");
        return 1;
    }

    if (mode === "stop" || ctx.args.stop === "true") {
        globalTimer.clear("shake");
        o1.css({ left: 0, top: 0, "transition-duration": "" });
        o1.removeAttr("d-sh-n").removeAttr("d-sh-t");
        return 1;
    }

    globalTimer.clear("shake");
    o1.css({ left: 0, top: 0 });

    const duration = ctx.args.duration === undefined ? -1 : +ctx.args.duration;
    const strx = ctx.args.xstrength === undefined ? 0 : ctx.args.xstrength * 0.75;
    const stry = ctx.args.ystrength === undefined ? 0 : ctx.args.ystrength * 0.75;
    const rnd = ctx.args.randomness === undefined ? 90 : +ctx.args.randomness;
    const vibrato = ctx.args.vibrato === undefined ? 30 : +ctx.args.vibrato;

    // c1: 震动间隔(ms) = 1000 / 震动频率
    const c1 = Math.floor(1000 / vibrato);
    // c2: 震动总次数 = 时长 * 震动频率
    let c2 = duration * vibrato;

    if (c2 >= 0 && c2 < 1) {
        console.warn("<CameraShake> The duration is too short, use the minimum value to instead.");
        c2 = 1;
    }

    // 设置 CSS 过渡时长，匹配单次震动的平滑度
    o1.css("transition-duration", (1 / vibrato).toFixed(4) + "s");

    o1.attr({ "d-sh-n": "shake", "d-sh-t": 0 });
    
    globalTimer.create("shake", () => {
        timer_shake_common("sys_camera", strx, stry, rnd, c2);
    }, c1, true);

    if (ctx.args.block === "true") {
        fun_delay("block", duration);
        return 2;
    }

    return 1;
};

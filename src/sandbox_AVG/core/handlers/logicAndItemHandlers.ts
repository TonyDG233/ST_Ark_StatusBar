import { CommandHandler } from '../analyzerCore';
import { system, data, globalTimer } from '../../store/avgState';
import { fun_delay, txt_next } from '../engineActions';
import { fun_audio_create, fun_get_audio_url } from '../audioController';
import { domFadeToExit, domFadeIn } from '../../utils/toolbox';

// ----------------------------------------------------------------------
// Logic & Items Handlers
// ----------------------------------------------------------------------

export const handleDelay: CommandHandler = (ctx) => {
    if (ctx.isSkip) return 1; // 跳过模式下完全无视 delay，直接推图
    
    fun_delay("block", ctx.args.time || 0);
    return 2;
};

export const handleDecision: CommandHandler = (ctx) => {
    // Decision 不能在跳过模式下被跳过，必须暂停等待用户交互
    const options = ctx.args.options === undefined ? "" : ctx.args.options;
    const values = ctx.args.values === undefined ? "" : ctx.args.values;
    if (options === "") return -1;
    
    const op = options.split(';');
    const va = values.split(';');
    
    system.decision.mode = true;
    const sysDec = $("#sys_decision");
    sysDec.empty().show();
    $("#sys_clicker").hide();
    
    for (let i = 0; i < op.length; i++) {
        const e = document.createElement("div");
        e.className = "decision";
        e.innerHTML = op[i];
        
        const $e = $(e);
        sysDec.append($e);
        $e.hide();
        domFadeIn(e, (ctx.args.fadetime || 0.15) * 1000);
        
        // 绑定点击决策逻辑
        $e.on("click", function() {
            fun_audio_create(fun_get_audio_url("$btn_click"), { remove: true });
            sysDec.children().each((_, el) => domFadeToExit(el, 150));
            sysDec.hide();
            system.decision.select = va[i] ? va[i] : (i + 1).toString();
            $("#sys_clicker").show();
            txt_next();
        });
    }
    
    return 2;
};

export const handlePredicate: CommandHandler = (ctx) => {
    if (ctx.isSkip) {
        system.decision.mode = false;
        return 1;
    }

    if (ctx.args.references === undefined) {
        system.decision.mode = false;
        return 1; // 视为执行完毕或退出判断
    }

    if (ctx.args.references.includes(system.decision.select)) {
        system.decision.mode = false;
        return 1;
    }

    // 不满足条件，保持 mode 且拦截
    system.decision.mode = true;
    return 1;
};

export const handleTheater: CommandHandler = (ctx) => {
    const dur = ctx.args.fadetime === undefined ? 0.25 : +ctx.args.fadetime;

    if (ctx.isSkip) {
        // 快速上下场
        if (ctx.args.action === "off") system.stats.theater = false;
        else if (ctx.args.action === "on") system.stats.theater = true;
        return 1;
    }

    if (ctx.args.action === "off") {
        system.stats.theater = false;
        $("#sys_offset").css("transition", `transform ${dur}s linear`).css("transform", "");
        $("#sys_camera").css("transition", `transform ${dur}s linear`).css("transform", "");
        if (ctx.args.block === "true") {
            fun_delay("block", dur);
            return 2;
        }
    } else if (ctx.args.action === "on") {
        system.stats.theater = true;
        $("#sys_offset").css("transition", `transform ${dur}s linear`).css("transform", "matrix(1,0,0,1,0,-54)");
        $("#sys_camera").css("transition", `transform ${dur}s linear`).css("transform", "matrix(1,0,0,1,0,54)");
        if (ctx.args.block === "true") {
            fun_delay("block", dur);
            return 2;
        }
    }
    
    return 1;
};

export const handleShowItem: CommandHandler = (ctx) => {
    const o1 = $("#sys_item");
    const n = (ctx.args.image && ctx.args.image.toLowerCase()) || "";
    const b = ctx.args.block || "true";
    const t = ctx.args.fadetime || 0.16;

    if (ctx.isSkip) return 1; // skip 模式通常直接跳过中间弹出的道具展示

    if (n === "") return -1;
    if (data.back[n] === undefined || data.back[n] === "") {
        console.warn(`<ShowItem> Data [${n}] not exist.`);
        return -1;
    }

    const i1 = new Image();
    i1.src = data.back[n];
    // 使用原版指定的魔法缩放
    const sx = i1.width * 0.6;
    const sy = i1.height * 0.6;
    const px = (960 - sx) / 2 - 7.5;
    const py = (540 - sy) / 2 - 7.5;

    const e1 = document.createElement('div');
    const $e1 = $(e1);
    $e1.addClass("item_style");
    $e1.css({
        "background-image": `url(${data.back[n]})`,
        "background-size": "100%",
        "width": sx + "px",
        "height": sy + "px",
        "left": px + "px",
        "top": py + "px"
    });

    $e1.hide();
    domFadeIn(e1, t * 1000);
    o1.append($e1);

    if (b === "true") {
        fun_delay("block", t);
        return 2;
    }
    return 1;
};

export const handleHideItem: CommandHandler = (ctx) => {
    const o1 = $("#sys_item").children();
    const t = ctx.args.fadetime === undefined ? 0.16 : +ctx.args.fadetime;

    if (ctx.isSkip) {
        $("#sys_item").children("div").remove();
        return 1;
    }

    if (o1.length === 0) return -1;

    o1.each((_, el) => domFadeToExit(el, t * 1000));
    
    if (ctx.args.block === "true") {
        fun_delay("block", t);
        return 2;
    }
    return 1;
};

export const handleTimerClear: CommandHandler = (ctx) => {
    const name = ctx.args.name;
    if (name) {
        globalTimer.clear(name);
    }
    return 1;
};

export const handleTimerSticker: CommandHandler = (ctx) => {
    if (ctx.isSkip) return 1;

    const name = ctx.args.name;
    const t = ctx.args.delay;
    if (name && t) {
        globalTimer.create(name, () => {
            const parts = name.split('_');
            // TODO: 未来需通过 analyzerCore 再次 dispatch 该指令，避免绕回暴露
            (window as any).txt_analyze(`[stickerclear(id=${parts[parts.length - 1]})]`);
        }, t * 1000);
    }
    return 1;
};

// ---------------
// 版本独占/杂项逻辑
// ---------------

export const handleSkipNode: CommandHandler = () => {
    // 原版独有，用于防点击阻断
    if (system.skipnode) {
        system.skipnode.stat = true;
    }
    return 1;
};

export const handleSkipToEnd: CommandHandler = () => {
    // Test 版独有自定义宏
    system.txt.index = system.txt.max;
    return 2;
};

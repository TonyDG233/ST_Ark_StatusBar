import { CommandHandler } from '../analyzerCore';
import { system, globalTimer } from '../../store/avgState';
import { scenarioExtend } from '../../utils/scenario_extend';
import { domFadeToExit, domFadeIn } from '../../utils/toolbox';
import { fun_delay } from '../engineActions';

/**
 * [animtext] 从原版恢复的文本表现，通常用于渲染没有名字的连续、带延迟换行的特殊文本
 */
export const handleAnimText: CommandHandler = (ctx) => {
    if (!ctx.text) return -2;
    
    // 从原版 `scenario.regex.animatepara` 迁移出来的匹配逻辑
    const animatepara = /<delay.*?>(.*?)<\/delay>/gi; 
    // 注意: 这里假设原来的正则目的就是为了截出纯文本并换行
    // 由于在 TypeScript 中 matchAll 提取规则和原版一致，保留：
    const mc = Array.from(ctx.text.matchAll(animatepara));
    
    let arr = [];
    for (let m of mc) {
        arr.push(m[1] || m[2]); // 根据不同正则捕获组位置可能略有差异，通常原版取 m[2]
    }
    
    // 如果正则没取到，直接把原文本扔回去
    if (arr.length === 0) {
        arr.push(ctx.text);
    }
    
    const text = arr.join("<br/>");
    
    system.txt.dynamic = document.getElementById("dialog_output") as HTMLElement;
    system.txt.name = "";
    system.txt.now = text; // 注意: 原版直接赋值没有跑 formatTxt
    
    if (typeof (window as any).fun_playback !== 'undefined') {
        (window as any).fun_playback("@p", "");
    }
    
    const dialogName = document.getElementById("dialog_name");
    if (dialogName) dialogName.innerHTML = "";
    
    const sysDialog = document.getElementById("sys_dialog");
    if (sysDialog) sysDialog.style.display = "block";
    
    return 0;
};

/**
 * [animtextclean] 行为完全等同于 skip 状态下的 dialog 清理
 */
export const handleAnimTextClean: CommandHandler = () => {
    const dialog = $("#sys_dialog");
    const dialogName = $("#dialog_name");
    const dialogOutput = $("#dialog_output");

    dialogName.empty();
    dialogOutput.empty();
    dialog.stop(true, true).hide();
    
    return 1;
};

/**
 * [dialog] 处理对话框消失
 */
export const handleDialog: CommandHandler = (ctx) => {
    const dialog = $("#sys_dialog");
    const dialogName = $("#dialog_name");
    const dialogOutput = $("#dialog_output");

    if (ctx.isSkip) {
        // Skip 模式：瞬间隐藏清理
        dialogName.empty();
        dialogOutput.empty();
        dialog.stop(true, true).hide();
        return 1;
    } else {
        // 正常模式：处理延时淡出
        const dur = +(ctx.args.fadetime || 0);
        dialog.stop(true, true).fadeOut(dur * 950, 'linear');
        
        if (ctx.args.block === "true") {
            fun_delay("block", dur);
            return 2;
        }
        return 1;
    }
};

/**
 * [dialogsetting] 测试版独有指令，控制打字机表现
 */
export const handleDialogSetting: CommandHandler = (ctx) => {
    const delay = system.txt.delay;
    const dialogName = $("#dialog_name");

    if (ctx.isSkip) {
        delay.reset("all");
        dialogName.removeAttr("style");
        return 1; // 跳过模式只重置，不影响演出
    }

    if (ctx.args.reset === "true") {
        delay.reset("all");
        dialogName.css("color", "");
        return 1;
    }
    
    delay.set("word", ctx.args.interval);
    delay.set("per", ctx.args.delay);
    delay.set("common", ctx.args.delayall);
    
    if (ctx.args.namecolor) {
        dialogName.css("color", ctx.args.namecolor);
    }
    
    return 1;
};

/**
 * [multiline] 多行连缀打印 (由于无 skip 模式重写，两者表现一致)
 */
export const handleMultiline: CommandHandler = (ctx) => {
    if (ctx.args.name === undefined) return -1;
    
    // 多行模式不应该被直接 skip 打断文本组合本身，但速度可能由其它机制处理
    system.txt.delay.set("word", (ctx.args.delay * 1000) || 30);
    system.txt.dynamic = document.getElementById("dialog_output") as HTMLElement;
    
    if (!system.multi.mode) {
        system.multi.begin();
        system.txt.now = "";
    }
    
    system.txt.name = ctx.args.name;
    // formatTxt 转换
    system.txt.now += scenarioExtend.formatTxt(ctx.text);
    
    $("#dialog_name").html(ctx.args.name);
    $("#sys_dialog").show();
    
    if (ctx.args.end === "true") {
        system.multi.end();
    }
    
    return 0;
};

/**
 * [focusout] 原版独有指令，目前为空逻辑，直接跳过
 */
export const handleFocusOut: CommandHandler = () => {
    return 1;
};

/**
 * [header] 预处理指令，运行时应当被忽略 (-1)
 */
export const handleHeader: CommandHandler = () => {
    return -1;
};

/**
 * [stickerclear] & [subtitle] (当作为无参指令清理时，被分发到这里)
 * 注意：由于原版逻辑中带参数的 subtitle 和 sticker 合并在了一起，我们先处理纯清理指令
 */
export const handleStickerClear: CommandHandler = (ctx) => {
    const isSubtitle = ctx.command === "subtitle";
    const targetClass = isSubtitle ? "span.subtitle" : "span.sticker";

    if (ctx.isSkip) {
        $("#sys_subtitle").children(targetClass).remove(); // skip 模式直接删
    } else {
        $("#sys_subtitle").children(targetClass).each((_, el) => domFadeToExit(el, 200));
        fun_delay("block", 0.2);
        return 2;
    }
    return 1;
};

/**
 * [sticker] 与 带参 [subtitle] 的渲染核心
 */
export const handleSticker: CommandHandler = (ctx) => {
    if (ctx.isSkip) return 1; // 多数演出在 skip 模式下会被抹除或不生成

    const cmd = ctx.command;
    const txt = ctx.args.text === undefined ? "" : scenarioExtend.formatTxt(ctx.args.text);
    const align = ctx.args.alignment === undefined ? "" : ctx.args.alignment;
    const size = ctx.args.size === undefined ? 18 : ctx.args.size * 0.75;
    const delay = ctx.args.delay === undefined ? 0 : +ctx.args.delay;
    const width = ctx.args.width === undefined ? 675 : ctx.args.width * 0.75;
    const px = ctx.args.x === undefined ? 0 : ctx.args.x * 0.75;
    const py = ctx.args.y === undefined ? 0 : ctx.args.y * 0.75;
    const fadetime = ctx.args.fadetime || 0;

    if (cmd === "sticker" && !ctx.args.id) {
        console.warn("<Sticker>Parameter id not applied");
        return -1;
    }

    if (!txt) {
        if (ctx.args.id) {
            system.multi.check();
            const el = document.getElementById(`${cmd}_${ctx.args.id}`);
            if (el) domFadeToExit(el, fadetime * 1000);
        } else if (cmd === "subtitle") {
            $("#sys_subtitle").children(`span.${cmd}`).each((_, el) => domFadeToExit(el, fadetime * 1000));
        }
        return 1;
    }

    // 生成 DOM 元素
    let e1 = document.createElement("span");
    e1.id = cmd + "_" + ctx.args.id;
    e1.className = cmd;
    if (align === "c") e1.style.textAlign = "center";
    else if (align === "r") e1.style.textAlign = "right";

    e1.style.fontSize = size + "px";
    e1.style.lineHeight = (size + 5) + "px";
    e1.style.width = width + "px";
    
    // 处理 X/Y 偏移
    const offsetW = (width - 675) / 2;
    e1.style.transform = `translate(${px - offsetW}px, ${py}px)`;
    e1.innerHTML = txt;

    // 挂载与动画
    let $e1 = $(e1);
    $("#sys_subtitle").append($e1);
    
    if (delay > 0) {
        $e1.hide();
        globalTimer.create("timer_sticker_" + ctx.args.id, () => { domFadeIn(e1, fadetime * 1000); }, delay);
    } else {
        if (fadetime > 0) {
            $e1.hide();
            domFadeIn(e1, fadetime * 1000);
        }
    }

    return 1;
};

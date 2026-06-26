import { CommandHandler } from '../analyzerCore';
import { system } from '../../store/avgState';
import { fun_delay } from '../engineActions';
import { fun_playback } from '../uiController';

/**
 * [animtext] 
 * @TODO 【后续Agent请注意：此处未来需要彻底重构】
 * 目前的逻辑只是简陋地将文本输出到普通的 dialog_output 中（原版 PRTS 沙盒的历史遗留妥协）。
 * 实际上，游戏原版这里的 name="group_location_stamp" 是一种极其复杂的 UI 动效（地点转换印章效果）。
 * 包含：贝塞尔曲线弹出的渐变背景框、向外扩散的白色粗边菱形、从 X 旋转 45 度并形变为指南针瘦菱形的内部图标等。
 * 未来需要：
 * 1. 废弃写入 dialog_output 的逻辑。
 * 2. 将 animtext 的数据 (p1, p2, pos, style) 塞入 Pinia 状态管理 (如 ui_state_store)。
 * 3. 在 Vue 视图层拦截并渲染独立的 <LocationStamp> 组件，使用 GSAP 或 CSS3 Keyframes 还原该动效。
 */
export const handleAnimText: CommandHandler = (ctx) => {
    if (!ctx.text) return -2;
    
    // 从原版 `scenario.regex.animatepara` 迁移出来的匹配逻辑: <p=(\d+)>(.*?)<\/>
    const animatepara = /<p=(\d+)>(.*?)<\/>/gi; 
    
    const mc = Array.from(ctx.text.matchAll(animatepara));
    
    let arr = [];
    for (let m of mc) {
        arr.push(m[2]); 
    }
    
    // 如果没取到多行 <p=x> 的格式，直接把原文本扔回去
    if (arr.length === 0) {
        arr.push(ctx.text);
    }
    
    const text = arr.join("<br/>");
    
    const dialogOutput = document.getElementById("dialog_output");
    system.txt.dynamic = dialogOutput as HTMLElement;
    system.txt.name = "";
    system.txt.now = text; // 注意: 原版直接赋值没有跑 formatTxt
    
    // 立即清空 DOM 容器，防止在定时器启动前展示上一句残留文本
    if (dialogOutput) {
        dialogOutput.innerHTML = "";
    }
    
    if (fun_playback !== undefined) {
        fun_playback("@p", "");
    }
    
    const dialogName = document.getElementById("dialog_name");
    if (dialogName) dialogName.innerHTML = "";
    
    const sysDialog = document.getElementById("sys_dialog");
    if (sysDialog) sysDialog.style.display = "block";
    
    return 0;
};

/**
 * [animtextclean] 行为完全等同于 skip 状态下的 dialog 清理
 * @TODO 同样需要重构，未来应触发 Pinia store 中对应 animtext 组件的退出动画（或直接销毁）。
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

    // 挂载与动画
    let $e1 = $(e1);
    $("#sys_subtitle").append($e1);
    
    // 淡入控制
    if (delay > 0) {
        $e1.hide();
        globalTimer.create("timer_sticker_" + ctx.args.id, () => { domFadeIn(e1, fadetime * 1000); }, delay);
    } else {
        if (fadetime > 0) {
            $e1.hide();
            domFadeIn(e1, fadetime * 1000);
        }
    }

    // 核心修复：恢复打字机路由 (返回 0)。
    // 否则引擎会直接跳到下一行执行 [subtitle] 清理指令，导致整个副标题一闪而过被完全“跳过”。
    system.txt.delay.set("word", (ctx.args.delay * 1000) || 30);
    system.txt.dynamic = e1;
    
    if (!system.multi.mode) {
        system.multi.begin();
        system.txt.now = "";
    }
    
    system.txt.name = "";
    system.txt.now += txt;
    
    if (!system.multi.mode) {
        if (fun_playback !== undefined) fun_playback("@p", "");
    }
    
    return 0;
};

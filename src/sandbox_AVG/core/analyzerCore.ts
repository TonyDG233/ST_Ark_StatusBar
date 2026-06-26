import * as exFun from '../utils/scenario_extend';
import { strToObject } from '../utils/toolbox';
import { system } from './../store/avgState';

/**
 * 🚨🚨🚨 内部逻辑严重破损警告 (CRITICAL WARNING) 🚨🚨🚨
 * 
 * 本文件的内部逻辑以及整个 core/handlers/ 目录下的处理器由于早期重构失误，处于严重破损和功能丢失状态。
 * 之前的重构错误地破坏了指令解析生命周期，并且强行使用 DOM 替换导致各类时间、坐标计算丢失上下文及类型错误。
 * 
 * 强制要求后续开发者：
 * 1. 务必回顾参考 `src/poc/prts_v3_sandbox/prts_analyze.js` 中的完整原版逻辑，重新开发和整理所有内容。
 * 2. 不要信任目前 handlers/ 中的任何数学运算或动画替代逻辑，必须 1:1 对齐原版的时序和回调。
 * 
 * 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
 * 
 * 引擎执行上下文，封装当前指令的所有关键信息，彻底替代原版的 temp = {}
 */
export interface ExecutionContext {
    command: string;           // 指令名，例如 'dialog', 'background'
    args: Record<string, any>; // 解析后的指令参数字典
    text: string;              // 指令后面的附带文本
    isSkip: boolean;           // 是否处于快进跳过状态
    rawText: string;           // 原始文本行
}

/**
 * 指令处理函数的签名
 * 返回值语义继承自原版：
 *  0 : 正常解析结束，引擎继续处理下一行或等待点击
 *  1 : (常见于动画等) 继续解析，无需等待
 *  2 : 挂起引擎，交由 globalTimer 时序接管
 * -1 : 警告/错误状态，停止解析
 * -2 : 空行、注释或被忽略的指令，跳过处理
 */
export type CommandHandler = (ctx: ExecutionContext) => number;

import { support } from '../utils/support';
import { handleMusicVolume, handlePlayMusicOrSound, handleStopMusicOrSound } from './handlers/audioHandlers';
import { handleBackground, handleBackgroundTween, handleGridBg, handleLargeBgTween } from './handlers/backgroundHandlers';
import { handleBlocker, handleCurtain, handleInterlude } from './handlers/blockerHandlers';
import { handleCameraEffect, handleCameraShake } from './handlers/cameraHandlers';
import { handleCharacterCutin } from './handlers/characterCutinHandlers';
import { handleCharacter, handleCharacterAction, handleCharSlot } from './handlers/characterHandlers';
import { handleImage, handleImageRotate, handleImageTween, handleCgItem, handleHideCgItem } from './handlers/imageHandlers';
import { handleDecision, handleDelay, handleHideItem, handlePredicate, handleShowItem, handleSkipNode, handleSkipToEnd, handleTheater, handleTimerClear, handleTimerSticker } from './handlers/logicAndItemHandlers';
import { handleAnimText, handleAnimTextClean, handleDialog, handleDialogSetting, handleFocusOut, handleHeader, handleMultiline, handleSticker, handleStickerClear } from './handlers/textHandlers';
import { handleVideo } from './handlers/videoHandlers';
import { fun_playback } from './uiController';

class CommandRegistry {
    private handlers: Map<string, CommandHandler> = new Map();

    constructor() {
        // Text & UI Handlers
        this.register('animtext', handleAnimText);
        this.register('animtextclean', handleAnimTextClean);
        this.register('dialog', handleDialog);
        this.register('dialogsetting', handleDialogSetting);
        this.register('focusout', handleFocusOut);
        this.register('multiline', handleMultiline);
        this.register('header', handleHeader);
        this.register('sticker', handleSticker);
        this.register('subtitle', handleSticker);
        this.register('stickerclear', handleStickerClear);

        // Scene Handlers
        this.register('background', handleBackground);
        this.register('backgroundtween', handleBackgroundTween);
        this.register('gridbg', handleGridBg);
        this.register('verticalbg', handleGridBg);
        this.register('largebg', handleGridBg);
        this.register('largeimg', handleGridBg);
        this.register('largebgtween', handleLargeBgTween);
        this.register('largeimgtween', handleLargeBgTween);
        
        this.register('image', handleImage);
        this.register('imgeffect', handleImage);
        this.register('bgeffect', handleImage);
        this.register('imagetween', handleImageTween);
        this.register('imagerotate', handleImageRotate);
        
        this.register('blocker', handleBlocker);
        this.register('curtain', handleCurtain);
        this.register('interlude', handleInterlude);
        
        // Character Handlers
        this.register('character', handleCharacter);
        this.register('charslot', handleCharSlot);
        this.register('characteraction', handleCharacterAction);
        this.register('charactercutin', handleCharacterCutin);
        
        this.register('video', handleVideo);

        // Camera Handlers
        this.register('cameraeffect', handleCameraEffect);
        this.register('camerashake', handleCameraShake);

        // Audio Handlers
        this.register('playmusic', handlePlayMusicOrSound);
        this.register('playsound', handlePlayMusicOrSound);
        this.register('stopmusic', handleStopMusicOrSound);
        this.register('stopsound', handleStopMusicOrSound);
        this.register('musicvolume', handleMusicVolume);
        this.register('soundvolume', handleMusicVolume);

        // Logic & Item Handlers
        this.register('delay', handleDelay);
        this.register('decision', handleDecision);
        this.register('predicate', handlePredicate);
        this.register('theater', handleTheater);
        this.register('showitem', handleShowItem);
        this.register('cgitem', handleCgItem);
        this.register('hideitem', handleHideItem);
        this.register('hidecgitem', handleHideCgItem);
        this.register('timerclear', handleTimerClear);
        this.register('timersticker', handleTimerSticker);
        this.register('skipnode', handleSkipNode);
        this.register('skiptoend', handleSkipToEnd);
    }

    /**
     * 注册特定指令的处理函数
     */
    register(command: string, handler: CommandHandler) {
        this.handlers.set(command.toLowerCase(), handler);
    }

    /**
     * 判断是否已注册该指令
     */
    has(command: string): boolean {
        return this.handlers.has(command.toLowerCase());
    }

    /**
     * 核心解析与路由分发引擎
     * 替代原版 txt_analyze 巨型 switch 函数
     */
    dispatch(txt: string, isSkip: boolean = false): number {
        // 打印调试日志
        support.log(1, true, `<Line ${system.txt.index}>${txt}`);

        // 1. 空行与注释检测
        if (!txt || txt.match("^\\s+$") || txt.match("^\\s*//.*$")) {
            return -2;
        }

        // 2. 正则解析指令
        // 原版正则: "^\[\s*(?:(.*?)\((.*)\)|(?:([\.\w]*)|(.*)))\s*\]\s*(.*)"
        const match = txt.match("^\\[\\s*(?:(.*?)\\((.*)\\)|(?:([\\.|\\w]*)|(.*)))\\s*\\]\\s*(.*)");

        // 3. 处理无指令纯文本 (通常作为 dialog 处理)
        if (match == null && !system.decision.mode) {
            system.multi.check();
            system.txt.dynamic = document.getElementById("dialog_output") as HTMLElement;
            system.txt.name = "";
            system.txt.now = exFun.scenarioExtend.formatTxt(txt); // formatTxt 从 scenario_extend 获取
            
            if (typeof fun_playback !== 'undefined') {
                fun_playback("@p", "");
            }
            
            const dialogName = document.getElementById("dialog_name");
            if (dialogName) dialogName.innerHTML = ""; // 替代 $("#dialog_name").empty()
            
            const sysDialog = document.getElementById("sys_dialog");
            if (sysDialog) sysDialog.style.display = "block"; // 替代 $("#sys_dialog").show()
            
            return 0;
        } else if (system.decision.mode) {
            // Decision 模式下拦截非 predicate 指令
            let d1 = match == undefined ? "" : match[1] == undefined ? "" : match[1].toLowerCase();
            let d2 = match == undefined ? "" : match[3] == undefined ? "" : match[3].toLowerCase();
            if (d1 != 'predicate' && d2 != 'predicate') return -2;
        }

        // 4. 解析标准指令集: [command(args)] text
        if (match && match[1] != undefined) {
            const command = match[1].toLowerCase();
            const args = strToObject(match[2] || "");
            const textContent = match[5] || "";

            if (args.hidelog) {
                system.stats.log_suppress = true;
            }

            if (this.handlers.has(command)) {
                const ctx: ExecutionContext = {
                    command,
                    args,
                    text: textContent,
                    isSkip,
                    rawText: txt
                };
                return this.handlers.get(command)!(ctx);
            } else {
                console.warn(`[PRTS Analyzer] Unhandled command with args: ${command}`);
                return -2;
            }
        } 
        // 5. 解析无参指令: [command] text 
        else if (match && match[3] != undefined) {
            const command = match[3].toLowerCase();
            const textContent = match[5] || "";

            if (this.handlers.has(command)) {
                const ctx: ExecutionContext = {
                    command,
                    args: {}, // 无参指令
                    text: textContent,
                    isSkip,
                    rawText: txt
                };
                return this.handlers.get(command)!(ctx);
            } else {
                console.warn(`[PRTS Analyzer] Unhandled simple command: ${command}`);
                return -2;
            }
        } 
        // 6. 解析简写对话模式: [name="Character"] text
        else if (match && match[4] && match[5]) {
            const args = strToObject(match[4]);
            if (args.name !== undefined) {
                // 等价于标准的 dialog 模式
                system.multi.check();
                system.txt.dynamic = document.getElementById("dialog_output") as HTMLElement;
                system.txt.name = args.name;
                system.txt.now = exFun.scenarioExtend.formatTxt(match[5]);
                
                if (typeof fun_playback !== 'undefined') {
                    fun_playback("@p", args.name);
                }
                
                const dialogName = document.getElementById("dialog_name");
                if (dialogName) dialogName.innerHTML = args.name;
                
                const sysDialog = document.getElementById("sys_dialog");
                if (sysDialog) sysDialog.style.display = "block";
                
                return 0;
            }
        }

        console.warn(`[PRTS Analyzer] Unrecognized format: ${txt}`);
        return -2;
    }
}

export const registry = new CommandRegistry();

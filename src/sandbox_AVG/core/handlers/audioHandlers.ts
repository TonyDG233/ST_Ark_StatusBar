import { CommandHandler } from '../analyzerCore';
import { fun_get_audio_url, fun_audio_create, fun_stop_audio } from '../audioController';

// ----------------------------------------------------------------------
// Audio Handlers
// ----------------------------------------------------------------------

export const handlePlayMusicOrSound: CommandHandler = (ctx) => {
    // 兼容 playmusic 和 playsound
    const cmd = ctx.command;
    const ms = ctx.args.delay ? ctx.args.delay * 1000 : 0;
    const intro = fun_get_audio_url(ctx.args.intro);
    const key = fun_get_audio_url(ctx.args.key);
    const id = cmd === "playmusic" ? "sys_music" : (ctx.args.channel && "audio_" + ctx.args.channel) || "";
    const vol = ctx.args.volume ? Math.min(ctx.args.volume * 0.5, 1) : 0.4;

    if (ctx.isSkip) {
        // 在快进模式下，如果播放的是音效(sound)，我们不执行播放动作（因为会产生噪音堆叠）
        // 如果播放的是背景音乐(music)，我们需要将其切换到位，让快进停止后直接是目标BGM
        if (cmd === "playsound") {
            return 1;
        }
        // 如果是 playmusic，跳过前奏(intro)的延迟，直接载入主干循环
    }

    if (!key) {
        console.warn(`<${cmd}> The key is not specific.`);
        return -1;
    }

    if (id) {
        fun_stop_audio(id);
    }

    const args: any = { id: id, volume: vol, delay: ctx.isSkip ? 0 : ms };

    if (cmd === "playsound") {
        args.loop = ctx.args.loop === "true";
        args.remove = !args.loop;
    } else if (cmd === "playmusic" && !intro) {
        args.loop = true;
    }

    // 在 skip 下忽略 intro，直接放 key
    const targetUrl = (ctx.isSkip && cmd === "playmusic") ? key : (intro || key);
    const aud = fun_audio_create(targetUrl, args);
    
    if (aud) {
        aud.classList.add(cmd);
        // 背景音乐如果是带前奏的组合曲，绑定循环
        if (cmd === "playmusic" && intro && !ctx.isSkip) {
            aud.setAttribute("data-loop", key);
            aud.onended = function () {
                const el = this as HTMLAudioElement;
                el.src = el.getAttribute("data-loop") as string;
                el.removeAttribute("data-loop");
                el.loop = true;
                el.play();
            };
        }
    }

    return 1;
};

export const handleStopMusicOrSound: CommandHandler = (ctx) => {
    const cmd = ctx.command;
    const id = cmd === "stopmusic" ? "@music" : (ctx.args.channel && "audio_" + ctx.args.channel) || "@sound";
    // 跳过模式下时间极速为 0 瞬间停止
    const fadeTime = ctx.isSkip ? 0 : (ctx.args.fadetime || 1);
    
    fun_stop_audio(id, { time: fadeTime });
    return 1;
};

export const handleMusicVolume: CommandHandler = (ctx) => {
    const cmd = ctx.command; // musicvolume 或 soundvolume
    if (ctx.args.volume === undefined) {
        console.warn(`<${cmd}> Can't find the volume parameter.`);
        return -1;
    }

    const ch = cmd === "musicvolume" ? "sys_music" : (ctx.args.channel && "audio_" + ctx.args.channel) || "";
    if (ch === "") return -1;

    const o1 = document.getElementById(ch);
    if (o1 === null) return -1;

    const fadeTime = ctx.isSkip ? 0 : (ctx.args.fadetime || 0);

    // 调用工具栏里面的原生 fade
    // @ts-ignore
    o1.fade(fadeTime, ctx.args.volume * 0.5);

    return 1;
};
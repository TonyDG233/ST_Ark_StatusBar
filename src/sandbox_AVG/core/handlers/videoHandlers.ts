import { CommandHandler } from '../analyzerCore';
import { system } from '../../store/avgState';
import { fun_setting } from '../uiController';
import { txt_next } from '../engineActions';

// ----------------------------------------------------------------------
// Video Handlers
// ----------------------------------------------------------------------

export const handleVideo: CommandHandler = (ctx) => {
    if (!ctx.args.res) {
        return -1;
    }

    if (ctx.isSkip) {
        // 在快进模式下，我们直接忽略视频播放以节省时间并推进进度
        return 1;
    }

    fun_setting("cmd_suspend");

    const video = document.createElement("video");
    const container = document.querySelector("#sys_video");
    if (!container) return -1;

    container.appendChild(video);
    
    // 使用全量 URL 或者资源标识
    video.src = system.sourceUrl + ctx.args.res.toLowerCase();
    // 适配页面宽高
    video.width = system.ui.width; 
    video.height = system.ui.height;
    video.autoplay = true;

    // 当视频播放结束或出错时，清理自身并唤醒引擎
    const cleanupAndNext = () => {
        video.remove();
        fun_setting("cmd_resume");
        txt_next();
    };

    video.onended = cleanupAndNext;
    video.onerror = cleanupAndNext;

    // TODO: skipnode 防护节点逻辑，这似乎是原版用于防止误触的
    if (system.skipnode && system.skipnode.stat) {
        system.skipnode.waitTarget = video;
    }

    // 返回 2，挂起解析引擎，等待事件触发下一帧
    return 2;
};

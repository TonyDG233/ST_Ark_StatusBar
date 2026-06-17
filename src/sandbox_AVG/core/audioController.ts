/**
 * @file audioController.ts
 * @description PRTS 音频控制与生命周期管理 (转译自 prts_analyze.js)
 */

import { system, data } from './globalState';
import { audioFade } from '../utils/toolbox';

/**
 * 获取音频资源的 CDN 完整路径
 * 注意：此函数专门针对 "audio" 进行拼接，有别于 scenarioExtend 中针对 "music" 的逻辑
 * @param key 资源键名
 */
export function fun_get_audio_url(key: string): string {
    if (!key) return "";
    let p = key.toLowerCase();
    return key.startsWith("$") 
        ? data.audio[p.substring(1)] 
        : key.startsWith("@") 
            ? system.assetUrl + p.substring(1) 
            : system.assetUrl + p.replace("sound_beta_2", "audio") + ".mp3";
}

/**
 * 创建并播放一个独立音轨实例
 * TODO: 这种直接插入 DOM 的操作在 Vue 中是不推荐的，未来应交给一个无 UI 的 AudioService 进行纯内存管理
 * @param url 资源的绝对地址
 * @param args 包含 vol, loop, remove, delay 等控制参数的字典
 */
export function fun_audio_create(url: string, args: any) {
    if (!url) return;
    if (!args) args = {};
    
    const sysAudio = document.getElementById("sys_audio");
    if (!sysAudio) return; // 容错拦截
    
    const sound = new Audio(url);
    sysAudio.append(sound);
    sound.id = args.id || "";
    // 强制全局基础音量削减一半
    sound.volume = (args.vol * 0.5) || 0.5;
    
    if (args.loop) {
        sound.loop = true;
    } else if (args.remove) {
        sound.onended = function() {
            (this as any).remove(); 
        };
    }
    
    if (args.delay) {
        setTimeout(() => {
            sound.play().catch(e => console.warn("Audio autoplay blocked by browser", e));
        }, args.delay);
    } else {
        sound.autoplay = true;
    }
    return sound;
}

/**
 * 停止并销毁特定的音频元素
 * @param key 音轨 DOM 的 ID，或者是特殊的群组命令 (@all, @music, @sound)
 * @param args 配置选项 (如淡出时间 time)
 */
export function fun_stop_audio(key: string, args?: any) {
    let pas = args || { time: 0.5 };
    
    if (!key.startsWith("@")) {
        let tar = document.getElementById(key);
        if (tar && tar instanceof HTMLAudioElement) {
            audioFade(tar, pas.time, 0, true);
        }
        return;
    }
    
    switch(key) {
        case "@all": {
            let tars = document.getElementById("sys_audio")?.children;
            if (tars) {
                for (let i = 0; i < tars.length; i++) {
                    let tar = tars[i];
                    if (tar instanceof HTMLAudioElement) {
                        audioFade(tar, 1, 0, true);
                    }
                }
            }
            break;
        }
        case "@music": {
            let tar = document.getElementById("sys_music");
            if (tar && tar instanceof HTMLAudioElement) {
                audioFade(tar, pas.time, 0, true);
            }
            break;
        }
        case "@sound": {
            // 通过 class 定位特定的音效文件
            let tars = document.getElementById("sys_audio")?.querySelectorAll(".playsound");
            if (tars) {
                for (let i = 0; i < tars.length; i++) {
                    let tar = tars[i];
                    if (tar instanceof HTMLAudioElement) {
                        audioFade(tar as HTMLAudioElement, pas.time, 0, true);
                    }
                }
            }
            break;
        }
    }
}

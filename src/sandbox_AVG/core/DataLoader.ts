/**
 * @file DataLoader.ts
 * @description PRTS 数据加载器与系统初始配置器
 */

import { data, system, public_disabled, setPublicDisabled } from './../store/avgState';
import { strToObject } from '../utils/toolbox';

// 使用 Webpack 特性直接载入本地静态数据
import datasTxtRaw from '../data/datas_txt.txt?raw';
import datasOverrideRaw from '../data/datas_override.txt?raw';
import datasBackObj from '../data/datas_back.json';
import datasCharObj from '../data/datas_char.json';
import datasAudioObj from '../data/datas_audio.json';
import datasLinkObj from '../data/datas_link.json';

export interface PRTSDataSource {
    txt: string;
    override: string;
    back: Record<string, any>;
    char: Record<string, any>;
    audio: Record<string, any>;
    link: Record<string, any>;
}

export function loadPRTSDataLocal() {
    try {
        initPRTSDataAndSystem({
            txt: datasTxtRaw,
            override: datasOverrideRaw,
            back: datasBackObj,
            char: datasCharObj,
            audio: datasAudioObj,
            link: datasLinkObj
        });
        console.log("[DataLoader] PRTS 静态数据内存挂载完成.");
    } catch (e) {
        console.error("Failed to load PRTS data from local imports:", e);
    }
}

/**
 * 直接从内存中读取和反序列化静态配置数据，不再依赖 DOM 元素
 */
export function initPRTSDataAndSystem(source: PRTSDataSource) {
    let ride = data.setting;

    if (source.override) {
        let arr = source.override.split('\n');
        for (let str of arr) {
            if (str === "" || str.match("^\\s+$") || str.match("^\\s*//.*$")) continue;
            let match = str.match("^\\s*(.*?)\\:(.*)$");
            if (!match || !match[2]) continue;
            let m1 = match[1].toLowerCase(), m2 = match[2];

            switch (m1) {
                case 'title': {
                    let [p, n] = m2.split('=');
                    if (!n) continue;
                    p = p.replace(/_/g, " ");
                    (ride as any)[m1][p] = n;
                    break;
                }
                case 'char':
                case 'image':
                case 'tween': {
                    let [d, v] = m2.split(';');
                    let [p, l] = d.split(',');
                    if (!v || !l) continue;
                    p = p.replace(/_/g, " ");
                    let ls = l.split('.'), vs = v.split(',');
                    let innerObj: Record<string, string> = {};
                    
                    if (!(ride[m1 as keyof typeof ride] as any)[p]) {
                        (ride[m1 as keyof typeof ride] as any)[p] = {};
                    }
                    
                    for (let vc of vs) {
                        let [k2, v2] = vc.split('=');
                        innerObj[k2] = v2;
                    }
                    
                    for (let lc of ls) {
                        (ride[m1 as keyof typeof ride] as any)[p][lc] = innerObj;
                    }
                    break;
                }
                case 'override': {
                    let i = m2.indexOf(';');
                    if (i === -1) continue;
                    let d = m2.substring(0, i), v = m2.substring(i + 1);
                    let [p, l] = d.split(',');
                    if (!l) continue;
                    p = p.replace(/_/g, " ");
                    if (v === undefined) v = "";
                    if (!ride[m1][p]) ride[m1][p] = {};
                    ride[m1][p][l] = v;
                    break;
                }
                case 'disable': {
                    if (public_disabled) continue;
                    let vs = m2.split(';');
                    if (vs.length === 2 && vs[0] === "public") {
                        system.disabled.note = arr[1] || "";
                        setPublicDisabled(true);
                    }
                    let t = "", p = "";
                    for (let vc of vs) {
                        let [k, v] = vc.split(':');
                        if (!v) continue;
                        switch (k) {
                            case "prefix":
                            case "title":
                                t = t || k;
                                p = p || v;
                                (ride.disable as any)[k][v] = "";
                                break;
                            case "note":
                                if (t && p) {
                                    (ride.disable as any)[t][p] = v;
                                }
                                break;
                        }
                    }
                    break;
                }
            }
        }
    }

    if (source.txt) {
        data.txt = source.txt.split('\n');
        let m = data.txt[0].match(/\[header\((.*)\)/i);
        if (m) {
            let set = strToObject(m[1]);
            if (set.is_prtswiki_only === "true") system.stats.log_all = false;
        }
    }

    if (source.back) {
        for (const [k, v] of Object.entries(source.back)) {
            if (k) data.back[k] = v;
        }
    }

    if (source.char) {
        for (const [k, v] of Object.entries(source.char)) {
            if (k) data.char[k] = v;
        }
    }

    if (source.audio) {
        try {
            for (let k in source.audio) {
                const lowerPath = source.audio[k].toString().toLowerCase();
                if (lowerPath.indexOf("sound_beta_2") === -1) continue;
                data.audio[k] = lowerPath.replace("sound_beta_2", system.assetUrl + "audio") + ".mp3";
            }
        } catch (e) {
            console.error("Failed to parse datas_audio", e);
        }
        data.audio["btn_click"] = system.assetUrl + "audio/AVG/g_ui_btn_n.mp3";
    }

    if (source.link) {
        try {
            data.link = source.link;
        } catch (e) {
            console.error("Failed to parse datas_link", e);
        }
    }

    const user = system.user;
    user.client = document.URL.includes("m.prts.wiki") ? "mobile" : "desktop";
    user.display = window.screen.availWidth * 0.7 < window.screen.availHeight ? "vert" : "horiz";
    
    system.debug = document.URL.includes("&debug=true");
    
    let tarStr = "firstHeading";
    let tarObj = document.getElementById(tarStr);
    if (tarObj) {
        system.page = tarObj.innerText;
        document.title = ride.set(system.page, document.title);
        tarObj.innerHTML = ride.set(system.page, system.page);
    } else {
        system.page = "AVG Sandbox";
    }

    system.disabled.init();
}

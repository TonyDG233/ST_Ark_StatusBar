/**
 * @file DataLoader.ts
 * @description PRTS 数据加载器与系统初始配置器
 */

import { data, system, public_disabled, setPublicDisabled } from './globalState';
import { strToObject } from '../utils/toolbox';

/**
 * 从页面隐藏的 DOM 节点读取并反序列化静态配置数据
 * TODO: 在迁移到 Vue 后，此方法必须废弃！应改写为通过 fetch() 读取 public/data/ 目录下的 JSON
 */
export function initPRTSDataAndSystem() {
    let obj = document.getElementById("datas_override");
    let ride = data.setting;

    if (obj) {
        let arr = obj.innerHTML.split('\n');
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
        console.log(ride);
    }

    obj = document.getElementById("datas_txt");
    if (obj) {
        data.txt = (obj.textContent || "").split('\n');
        let m = data.txt[0].match(/\[header\((.*)\)/i);
        if (m) {
            let set = strToObject(m[1]);
            if (set.is_prtswiki_only === "true") system.stats.log_all = false;
        }
    }

    obj = document.getElementById("datas_back");
    if (obj) {
        for (let d of obj.innerHTML.split('\n')) {
            let [k, v] = d.split(',');
            if (k) data.back[k] = v;
        }
    }

    obj = document.getElementById("datas_char");
    if (obj) {
        for (let d of obj.innerHTML.split('\n')) {
            let [k, v] = d.split(',');
            if (k) data.char[k] = v;
        }
    }

    obj = document.getElementById("datas_audio");
    if (obj) {
        let str = obj.innerHTML.toLocaleLowerCase(), pos = str.search(/,\s+\}$/);
        if (pos !== -1) {
            if (typeof fun_msg !== "undefined") fun_msg(0, false, "The inner code has been executed.");
            str = str.substring(0, pos) + "}"; /* 防止背刺 */
        }
        try {
            let dics = JSON.parse(str);
            for (let k in dics) {
                if (dics[k].toString().indexOf("sound_beta_2") === -1) continue;
                data.audio[k] = dics[k].replace("sound_beta_2", system.assetUrl + "audio") + ".mp3";
            }
        } catch (e) {
            console.error("Failed to parse datas_audio", e);
        }
        data.audio["btn_click"] = system.sourceUrl + "music/general/g_ui/g_ui_btn_n.mp3";
    }

    obj = document.getElementById("datas_link");
    if (obj) {
        try {
            data.link = JSON.parse(obj.innerHTML.toLowerCase());
        } catch (e) {
            console.error("Failed to parse datas_link", e);
        }
    }

    const user = system.user;
    user.client = document.URL.includes("m.prts.wiki") ? "mobile" : "desktop";
    user.display = window.screen.availWidth * 0.7 < window.screen.availHeight ? "vert" : "horiz";
    
    // 初始化页面标题并检测 Debug 模式
    system.debug = document.URL.includes("&debug=true");
    
    let tarStr = "firstHeading";
    let tarObj = document.getElementById(tarStr);
    if (tarObj) {
        system.page = tarObj.innerText;
        document.title = ride.set(system.page, document.title);
        tarObj.innerHTML = ride.set(system.page, system.page);
    }

    // 触发系统内部的鉴权检查 (验证此页面是否被 disable)
    system.disabled.init();
}

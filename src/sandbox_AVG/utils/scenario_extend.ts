/**
 * @file scenario_extend.ts
 * @description PRTS 剧本正则匹配与核心扩展工具 (转译自 prts_scenario.js 中的 scenario 节点)
 */

import { LogType } from '../types/enums';
import { support } from './support';
import { data, system } from '../store/avgState';

export const scenarioRegex = {
    space: "^\\s+$",
    comment: "^\\s*//.*$",
    command: "^\\[\\s*(?:(.*?)\\((.*)\\)|(?:([\\.|\\w]*)|(.*)))\\s*\\]\\s*(.*)",
    animatepara: "<p=(\\d+)>(.*?)<\\/>",
};

export const scenarioExtend = {
    /**
     * 解析角色名/差分标识，映射到真实的图库索引
     * 例: 匹配 "Amiya#1$2" 等复杂语法
     * @returns [角色字典键名(string), 具体的差分图片索引(number)] 或者 [-1, -1]
     */
    charLink: function (str: string): [string | number, number] {
        const link = data.link;
        let n: string, i: string | number;

        if (str.match(new RegExp(scenarioRegex.space))) {
            support.log(LogType.error, false, "The input parameter is empty,has skipped the data.");
            return [-1, -1];
        }

        const m = str.trim().match(/^([^@#$]+)(?:([@#$])([a-z\d]+)|#(\d+)\$(\d+))?$/);
        support.log(LogType.trace, true, "regex match: ", m);

        if (!m) {
            support.log(LogType.error, false, "Can't get key from the input parameter,has skipped the data.");
            return [-1, -1];
        }

        n = m[1];
        i = m[3];

        if (!link[n]) {
            support.log(LogType.warn, false, `The appointed key [${n}] not exist,has skipped the data.`);
            return [-1, -1];
        }

        // 处理复杂组差分 (如 #1$2)
        if (m[2] === '$' || (m[4] && m[5])) {
            const g = '$' + (m[5] || i); // group
            i = m[4] || i;
            
            const ps = link[n].array.findIndex((v: any) => v.name.endsWith(g));
            let pe = link[n].array.findIndex((v: any, vi: number) => !v.name.endsWith(g) && vi > ps);
            
            if (ps === -1) {
                support.log(LogType.warn, false, `The analyze key [${n}:${i}] not exist,use the default char to instead.`);
                return [n, 0];
            }
            
            pe = pe === -1 ? link[n].array.length - 1 : pe - 1;
            
            if (m[2]) return [n, ps];
            
            try {
                i = parseInt(i as string, 10) - 1;
            } catch (err) {
                support.log(LogType.warn, false, "Data analyze error,use the default char to instead.");
                i = ps;
            }
            
            if ((i as number) > pe - ps) {
                support.log(LogType.warn, false, `The analyze key [${n}:${i}] is out of range,use the default char to instead.`);
                i = ps;
            }
            return [n, (i as number) + ps];
        } 
        // 处理普通组差分 (如 #1)
        else if (m[2] === "#") {
            try {
                i = parseInt(i as string, 10) - 1;
            } catch (err) {
                support.log(LogType.warn, false, "Data analyze error,use the default char to instead.");
                i = 0;
            }
            
            if ((i as number) >= link[n].array.length) {
                support.log(LogType.warn, false, `The analyze key [${n}:${i}] is out of range,use the default char to instead.`);
                i = 0;
            }
            return [n, i as number];
        } 
        // 处理别名差分 (如 @alias)
        else if (m[2] === '@') {
            for (let idx = 0; idx < link[n].array.length; idx++) {
                if (link[n].array[idx].alias == i) return [n, idx]; // 注意: 这里原版用了 ==，可能存在字符串和数字匹配
            }
            support.log(LogType.warn, false, "Data analyze error,use the default char to instead.");
            return [n, 0];
        }

        return [n, 0];
    },

    /**
     * 根据字典键名和索引获取图片的相对路径
     */
    charFormat: function (key: string, idx: number): string {
        const link = data.link;
        if (link[key] === undefined) {
            support.log(LogType.error, false, `Character key [${key}] not exist,please check the link list.`);
            return key;
        }
        return link[key].array[idx].name;
    },

    /**
     * 极度重要：立绘坐标与缩放计算器 (映射 PRTS 原版 0.75 缩放与相对位移)
     * @param key 角色字典键名
     * @param pos 指定位置: -1(左), 0(中), 1(右)
     * @returns [宽度, 高度, Canvas_X, Canvas_Y]
     */
    charPos: function (key: string, pos: number = 0): [number, number, number, number] {
        const link = data.link;
        let px: number, py: number, sx: number, sy: number;
        
        px = link[key].pos.x * 0.75;
        py = link[key].pos.y * 0.75;
        sx = link[key].size.x * 0.75;
        sy = link[key].size.y * 0.75;
        
        switch (pos) {
            case -1:
                px = 330 - sx / 2 + px;
                break;
            case 0:
                px = 480 - sx / 2 + px;
                break;
            case 1:
                px = 630 - sx / 2 + px;
                break;
        }
        py = 540 - sy / 2 - py;
        
        return [sx, sy, px, py];
    },

    /**
     * 替换游戏剧本文本中的玩家名字与特殊标记
     */
    replaceTxt: function (str: string): string {
        if (!str) return "";
        return str.replace(/{@nickname}/ig, system.user.name).replace(/{@nbs}/ig, " ");
    },

    /**
     * 将秒数格式化为 hh:mm:ss 形式
     */
    formatTime: function (time: number): string {
        const arr = [
            Math.floor(time / 3600), 
            Math.floor((time % 3600) / 60), 
            Math.floor(time % 60)
        ];
        
        return arr.map(v => v < 10 ? "0" + v.toString() : v.toString()).join(":");
    },

    /**
     * 将方舟内部的富文本标记 (如 <color=>) 转化为 HTML (<font color=>) 并处理换行
     */
    formatTxt: function (str: string): string {
        if (!str) return "";

        let t = scenarioExtend.replaceTxt(str);
        t = t.replace(/<color=/ig, "<font color=").replace(/<\/color>/ig, "</font>");
        t = t.replace(/ /g, "&nbsp;");
        t = t.replace(/\\n/g, "<br/>");
        return t;
    },

    /**
     * 拼接音频 URL 逻辑
     * @param key 音频键名
     */
    getAudioUrl: function (key: string): string {
        if (!key) return "";
        const p = key.toLowerCase();
        
        if (key.startsWith("$")) {
            return data.audio[p.substring(1)];
        } else if (key.startsWith("@")) {
            return system.assetUrl + p.substring(1);
        } else {
            return system.assetUrl + p.replace("sound_beta_2", "music") + ".mp3";
        }
    },

    /**
     * 将对象格式化为方舟指令模式字符串
     * @param header 指令头部，如 [character
     * @param obj 参数对象 {name: "Amiya", focus: 1}
     * @returns 组合出的命令 [character(name="Amiya", focus="1")]
     */
    serialize: function (header: string, obj: Record<string, any>): string {
        const res: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined) continue;
            res.push(`${k}="${v}"`);
        }
        return `[${header}(${res.join(', ')})]`;
    }
};

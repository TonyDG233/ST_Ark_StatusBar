/* PRTS Fetch 数据挂载器 (需在 Live Server 下运行) */
const dataFiles = [
    { id: "datas_txt", file: "data/datas_txt.txt", isJson: false },
    { id: "datas_override", file: "data/datas_override.txt", isJson: false },
    { id: "datas_back", file: "data/datas_back.json", isJson: true },
    { id: "datas_char", file: "data/datas_char.json", isJson: true },
    { id: "datas_audio", file: "data/datas_audio.json", isJson: true },
    { id: "datas_link", file: "data/datas_link.json", isJson: true }
];

async function loadDataAndInject() {
    console.log('开始通过 fetch 加载本地数据资产...');
    
    for (let item of dataFiles) {
        try {
            const resp = await fetch(item.file);
            if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
            let text = await resp.text();
            
            if (item.isJson) { 
                const jsonObj = JSON.parse(text);
                // datas_char 和 datas_back 原引擎是以 split(',') 读取的
                if (item.id === 'datas_char' || item.id === 'datas_back') {
                    text = Object.entries(jsonObj).map(([k, v]) => `${k},${v}`).join('\n');
                } else if (item.id === 'datas_audio' || item.id === 'datas_link') {
                    // audio 和 link 原版是从 DOM string 去 JSON.parse 的，压回一行
                    text = JSON.stringify(jsonObj);
                }
            }
            
            let pre = document.createElement('pre');
            pre.id = item.id;
            pre.className = (item.id === 'datas_txt') ? 'hidden' : 'hidden navigation-not-searchable';
            pre.innerHTML = text; // 利用浏览器原生 innerHTML 自动处理必要的实体转义
            document.body.appendChild(pre);
            console.log(`[${item.id}] 加载完成`);
        } catch (e) {
            console.error(`Failed to load ${item.file}:`, e);
        }
    }
    
    console.log('数据挂载完毕，严格按序动态加载引擎脚本...');
    const engineScripts = ['prts_timer.js', 'prts_analyze.js', 'prts_scenario.js', 'prts_events.js'];
    for (let src of engineScripts) {
        let s = document.createElement('script');
        s.src = './' + src;
        document.body.appendChild(s);
        await new Promise((resolve, reject) => { 
            s.onload = resolve; 
            s.onerror = () => reject(`Failed to load ${src}`);
        });
    }
}

document.addEventListener('DOMContentLoaded', loadDataAndInject);

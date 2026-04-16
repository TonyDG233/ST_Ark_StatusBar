/**
 * POC: 世界书全量备份机制测试 (带悬浮窗)
 * 
 * 目标:
 * 1. 测试从现有世界书完整复制数据。
 * 2. 测试创建一个新的独立世界书作为备份 (例如前缀 [ARK_BACKUP_]).
 * 3. 验证备份内容是否一致.
 * 4. 测试将备份世界书的数据恢复到原世界书中.
 * 
 * 运行方式: 直接将此代码复制到酒馆 F12 控制台运行。会在页面右下角生成一个控制面板。
 */

(function() {
    // 检查是否已经存在面板，避免重复创建
    if (document.getElementById('poc-wb-backup-panel')) {
        console.log('[POC] 控制面板已存在。');
        return;
    }

    // --- 创建悬浮面板 UI ---
    const panel = document.createElement('div');
    panel.id = 'poc-wb-backup-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid #555;
        border-radius: 8px;
        padding: 15px;
        color: #fff;
        font-family: sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;

    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 5px;">
            📚 世界书备份还原 POC
            <button id="poc-wb-close" style="float: right; background: none; border: none; color: #aaa; cursor: pointer; font-size: 16px; margin-top: -2px;">&times;</button>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">目标世界书:</label>
            <select id="poc-wb-select" style="width: 100%; padding: 5px; background: #333; color: #fff; border: 1px solid #666; border-radius: 4px;">
                <option value="">加载中...</option>
            </select>
        </div>

        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #ccc;">当前备份:</label>
            <input type="text" id="poc-wb-current-backup" readonly placeholder="尚未创建备份" style="width: 100%; padding: 5px; background: #222; color: #888; border: 1px solid #444; border-radius: 4px; box-sizing: border-box;" />
        </div>

        <div style="display: flex; gap: 10px;">
            <button id="poc-wb-btn-backup" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">1. 创建备份</button>
            <button id="poc-wb-btn-restore" disabled style="flex: 1; padding: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: not-allowed; font-weight: bold; opacity: 0.5;">2. 还原备份</button>
        </div>
        
        <div id="poc-wb-log" style="margin-top: 15px; font-size: 12px; color: #aaa; max-height: 100px; overflow-y: auto; background: #111; padding: 5px; border-radius: 4px; border: 1px inset #333;">
            准备就绪。
        </div>
    `;

    document.body.appendChild(panel);

    // --- 获取 DOM 元素 ---
    const selectEl = document.getElementById('poc-wb-select');
    const inputBackupEl = document.getElementById('poc-wb-current-backup');
    const btnBackup = document.getElementById('poc-wb-btn-backup');
    const btnRestore = document.getElementById('poc-wb-btn-restore');
    const logEl = document.getElementById('poc-wb-log');
    const btnClose = document.getElementById('poc-wb-close');

    // --- 内部状态 ---
    let currentBackupName = '';
    let currentTargetName = '';

    // --- 日志函数 ---
    const log = (msg) => {
        const time = new Date().toLocaleTimeString();
        logEl.innerHTML += `<div>[${time}] ${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
        console.log(`[POC] ${msg}`);
    };

    // --- 初始化世界书列表 ---
    (async function init() {
        try {
            const allWorldbooks = await window.TavernHelper.getWorldbookNames();
            selectEl.innerHTML = '';
            if (allWorldbooks.length === 0) {
                selectEl.innerHTML = '<option value="">(无世界书)</option>';
                log('未找到任何世界书');
                return;
            }
            
            allWorldbooks.forEach(wb => {
                const opt = document.createElement('option');
                opt.value = wb;
                opt.textContent = wb;
                selectEl.appendChild(opt);
            });
            currentTargetName = selectEl.value;
            log('已加载世界书列表');
        } catch (e) {
            log('获取世界书列表失败: ' + e.message);
        }
    })();

    selectEl.addEventListener('change', (e) => {
        currentTargetName = e.target.value;
        currentBackupName = '';
        inputBackupEl.value = '';
        btnRestore.disabled = true;
        btnRestore.style.cursor = 'not-allowed';
        btnRestore.style.opacity = '0.5';
        log(`切换目标为: ${currentTargetName}`);
    });

    btnClose.addEventListener('click', () => {
        panel.remove();
    });

    // --- 创建备份逻辑 ---
    btnBackup.addEventListener('click', async () => {
        if (!currentTargetName) {
            alert('请先选择目标世界书！');
            return;
        }

        try {
            log(`开始读取: ${currentTargetName}`);
            const originalEntries = await window.TavernHelper.getWorldbook(currentTargetName);
            log(`读取成功，共 ${originalEntries.length} 个条目`);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupWbName = `[ARK_BACKUP_${timestamp}]_${currentTargetName}`;
            
            log(`正在创建备份: ${backupWbName}`);
            const isCreated = await window.TavernHelper.createOrReplaceWorldbook(backupWbName, originalEntries, { render: 'debounced' });
            
            // 验证备份
            const backupEntries = await window.TavernHelper.getWorldbook(backupWbName);
            if (backupEntries.length !== originalEntries.length) {
                log(`<span style="color:red">❌ 警告：备份条目数不匹配! 原:${originalEntries.length}, 备份:${backupEntries.length}</span>`);
            } else {
                log(`<span style="color:lime">✅ 备份成功！</span>`);
                currentBackupName = backupWbName;
                inputBackupEl.value = currentBackupName;
                inputBackupEl.style.color = '#fff';
                
                // 激活还原按钮
                btnRestore.disabled = false;
                btnRestore.style.cursor = 'pointer';
                btnRestore.style.opacity = '1';
                
                // 尝试刷新酒馆界面的世界书列表
                if (window.SillyTavern && window.SillyTavern.updateWorldInfoList) {
                    await window.SillyTavern.updateWorldInfoList();
                }
                
                alert(`✅ 备份已创建！\n名称: ${backupWbName}\n\n现在您可以去修改原世界书 "${currentTargetName}" 的内容。\n修改完成后，点击面板上的【还原备份】按钮进行恢复测试。`);
            }

        } catch (e) {
            log(`<span style="color:red">❌ 备份失败: ${e.message}</span>`);
            console.error(e);
        }
    });

    // --- 还原备份逻辑 ---
    btnRestore.addEventListener('click', async () => {
        if (!currentTargetName || !currentBackupName) return;

        if (!confirm(`【危险操作警告】\n即将把备份:\n${currentBackupName}\n的内容覆盖回原世界书:\n${currentTargetName}\n\n是否继续？`)) {
             log("已取消还原。");
             return;
        }

        try {
            log(`正在读取备份数据...`);
            const backupEntries = await window.TavernHelper.getWorldbook(currentBackupName);
            
            log(`正在执行还原...`);
            await window.TavernHelper.replaceWorldbook(currentTargetName, backupEntries, { render: 'immediate' });
            
            log(`<span style="color:lime">✅ 还原成功！</span>`);
            alert(`✅ 还原完成！\n请检查原世界书 "${currentTargetName}" 是否已恢复到备份状态。`);
            
        } catch (e) {
            log(`<span style="color:red">❌ 还原失败: ${e.message}</span>`);
            console.error(e);
        }
    });

})();

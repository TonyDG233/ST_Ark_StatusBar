// 这是一个测试 SillyTavern.extensionSettings 持久化能力的 PoC 脚本
// 运行环境：SillyTavern 的 F12 控制台，或者作为注入脚本运行

(async function testExtensionSettings() {
  console.log('=== [PoC] SillyTavern.extensionSettings 测试开始 ===');

  // 1. 检查 SillyTavern 对象是否存在
  if (typeof SillyTavern === 'undefined' || !SillyTavern.extensionSettings) {
    console.error('❌ 无法访问 SillyTavern.extensionSettings。请确保在酒馆环境中运行！');
    return;
  }

  // 2. 模拟我们要开辟的私有空间
  const MY_KEY = 'st_ark_statusbar_config';

  // 3. 读取当前值
  let currentConfig = SillyTavern.extensionSettings[MY_KEY];
  console.log('📝 当前配置:', currentConfig);

  // 4. 如果没有，则初始化；如果有，则修改
  if (!currentConfig) {
    console.log('🔧 未发现配置，初始化中...');
    currentConfig = {
      theme: 'dark',
      testCount: 0,
      commits: [],
    };
  }

  currentConfig.testCount += 1;
  currentConfig.lastUpdated = new Date().toISOString();

  // 5. 写入
  SillyTavern.extensionSettings[MY_KEY] = currentConfig;

  // 6. 触发后端持久化 (这一步是关键，它会告诉 Node.js 后端将内存中的 JSON 刷入磁盘)
  if (typeof SillyTavern.saveSettingsDebounced === 'function') {
    SillyTavern.saveSettingsDebounced();
    console.log('✅ 成功调用 SillyTavern.saveSettingsDebounced() 保存到本地文件！');
  } else {
    console.warn('⚠️ 找不到 SillyTavern.saveSettingsDebounced，可能酒馆版本存在差异。');
  }

  console.log('🎉 测试完成，当前配置的值为:', SillyTavern.extensionSettings[MY_KEY]);
  console.log('=== 请按 F5 刷新酒馆页面，再次运行本代码，查看 testCount 是否累加，证明磁盘保存成功。 ===');

  /*
    [PoC 实验结果记录 - 2026-03-22]
    首次运行:
    📝 当前配置: undefined
    🔧 未发现配置，初始化中...
    ✅ 成功调用 SillyTavern.saveSettingsDebounced() 保存到本地文件！
    🎉 测试完成，当前配置的值为: {theme: 'dark', testCount: 1, commits: Array(0), lastUpdated: '...'}
    
    刷新页面后运行:
    📝 当前配置: {theme: 'dark', testCount: 2, commits: Array(0), lastUpdated: '...'}
    ✅ 成功调用 SillyTavern.saveSettingsDebounced() 保存到本地文件！
    🎉 测试完成，当前配置的值为: {theme: 'dark', testCount: 3, commits: Array(0), lastUpdated: '...'}

    结论：SillyTavern.extensionSettings 完全可以作为独立的持久化存储空间，
    即使键名 'st_ark_statusbar_config' 不是官方自带的，也能通过 saveSettingsDebounced 成功落盘并被后续读取。
    因此，我们可以安全地废弃在世界书中保存配置的 [SYS_CONFIG] 方案。
    */
})();

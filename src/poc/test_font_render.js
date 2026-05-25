/**
 * 最小化字体渲染可行性测试脚本 (PoC) - 适配酒馆助手环境版
 * 
 * 用法：将此脚本直接新建为一个酒馆助手“脚本”，启用后它会自动注入到宿主页面。
 */
(async function runFontRenderTest() {
  const ST_WINDOW = window.parent || window;
  const ST_DOC = ST_WINDOW.document;

  if (ST_WINDOW.toastr) {
    ST_WINDOW.toastr.info("测试脚本已触发，正在注入测试 DOM...");
  } else {
    console.log("测试脚本已触发！");
  }
  
  const FONT_URL = 'https://fastly.jsdelivr.net/npm/material-symbols@0.44.9/material-symbols-outlined.woff2';
  const FONT_FAMILY = 'Test Material Symbols CSS';

  // 1. 注入严格提权的测试 CSS 到宿主 Head
  const style = ST_DOC.createElement('style');
  style.innerHTML = `
    @font-face {
      font-family: '${FONT_FAMILY}';
      src: url('${FONT_URL}') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: block;
    }
    .test-font-container {
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 2px solid #ff4757;
      border-radius: 12px;
      padding: 20px;
      z-index: 9999999; /* 保证最高层级 */
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      color: #000;
      font-family: sans-serif;
      text-align: center;
      min-width: 250px;
    }
    .test-icon {
      /* 故意取一个完全不同的名字，防止和本地可能的缓存/系统同名字体冲突 */
      font-family: '${FONT_FAMILY}', sans-serif !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-size: 32px !important;
      line-height: 1 !important;
      letter-spacing: normal !important;
      text-transform: none !important;
      display: inline-block !important;
      white-space: nowrap !important;
      word-wrap: normal !important;
      direction: ltr !important;
      
      /* 强制开启所有可能被干掉的连字特性 */
      -webkit-font-feature-settings: 'liga' 1 !important;
      font-feature-settings: 'liga' 1 !important;
      font-variant-ligatures: discretionary-ligatures normal !important;
      -webkit-font-smoothing: antialiased !important;
      
      margin: 10px 5px;
      color: #2ed573;
    }
    .test-title { font-size: 16px; margin-bottom: 5px; font-weight: bold; }
    .test-status { font-size: 14px; margin-top: 10px; color: #57606f; }
    .test-close { 
      margin-top: 10px; padding: 5px 15px; cursor: pointer;
      background: #ff4757; color: white; border: none; border-radius: 5px;
    }
  `;
  ST_DOC.head.appendChild(style);

  // 2. 建立测试面板 DOM，直接注入到宿主 Body
  const container = ST_DOC.createElement('div');
  container.className = 'test-font-container';
  container.innerHTML = `
    <div class="test-title">CSS 原生 @font-face 渲染测试</div>
    
    <div style="margin-bottom: 5px;">
      <span style="font-size:12px; display:inline-block; width:60px;">文本连字:</span>
      <span class="test-icon">menu_book</span>
      <span class="test-icon">security</span>
      <span class="test-icon">history</span>
    </div>

    <div>
      <span style="font-size:12px; display:inline-block; width:60px;">HEX 编码:</span>
      <span class="test-icon">&#xea19;</span> <!-- menu_book -->
      <span class="test-icon">&#xe32a;</span> <!-- security -->
      <span class="test-icon">&#xe889;</span> <!-- history -->
    </div>
    
    <div id="test-status" class="test-status">等待浏览器原生 CSS 解析字体...</div>
    <button class="test-close" onclick="this.parentElement.remove()">关闭测试</button>
  `;
  ST_DOC.body.appendChild(container);

  // 原生 CSS 加载无法像 JS API 那样精确 catch 错误，
  // 但我们可以通过 document.fonts.ready 检查。
  if (ST_DOC.fonts && ST_DOC.fonts.ready) {
    ST_DOC.fonts.ready.then(() => {
      ST_DOC.getElementById('test-status').innerHTML = '<span style="color:#2ed573">✅ 浏览器报告字体解析完成！</span><br>如果还是没图标，说明这台设备彻底没救了。';
    });
  } else {
     ST_DOC.getElementById('test-status').innerHTML = '<span style="color:#eccc68">⚠️ 无法检测状态，请直接看图标是否显示。</span>';
  }
})();

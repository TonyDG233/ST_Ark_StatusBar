/**
 * ARK_STATUSBAR 全局资源管理器 (AssetManager)
 * 负责统一预加载图片、字体等外部依赖，并提供多 CDN 降级兜底方案，
 * 同时配合 Toastr/控制台 提供可视化的加载进度与报错追踪。
 *
 * [ARCHITECTURAL NOTE]
 * 本文件目前以单一 Service 的形态存在。
 * 未来随着游戏内容（大量剧情 CG、人物立绘、音频等）的扩展，
 * 此模块将演变为 Facade（门面模式）。届时底层的资源类型加载逻辑
 * 需分化至具体的子服务 (如 ImageLoaderService, AudioLoaderService) 中，
 * 本类仅保留统一调度和分发入口的作用。
 */

// 声明全局 toastr，酒馆环境中原生存在
declare const toastr: any;

export class AssetManager {
  // 定义 CDN 轮询优先级池 (Github Pages Raw / JSDelivr)
  static CDNS = {
    gh_testingcf: 'https://testingcf.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@latest',
    gh_fastly: 'https://fastly.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@latest',
    gh_default: 'https://cdn.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@latest',
  };

  static NPM_CDNS = {
    fastly: 'https://fastly.jsdelivr.net/npm',
    testingcf: 'https://testingcf.jsdelivr.net/npm',
    default: 'https://cdn.jsdelivr.net/npm',
    unpkg: 'https://unpkg.com',
  };

  static FONT_CDNS = {
    loli: 'https://fonts.loli.net',
    fontim: 'https://fonts.font.im',
    google: 'https://fonts.googleapis.com',
  };

  /**
   * 带降级重试机制的图片加载器
   */
  static async preloadImageWithFallback(paths: string[]): Promise<string> {
    let lastError: any = null;
    for (const path of paths) {
      try {
        return await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(path);
          img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
          img.src = path;
        });
      } catch (e) {
        lastError = e;
        console.warn(`[AssetManager] 图片加载失败，准备尝试下一个降级节点: ${path}`);
      }
    }
    console.error('[AssetManager] 核心图片全部节点加载失败！', lastError);
    // 返回一个透明的安全 Base64 作为终极兜底，防止 CSS 解析报错
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  /**
   * 动态 CSS 加载器 (通过 <link> 标签插入)
   */
  static async loadCSSWithFallback(urls: string[], id: string): Promise<void> {
    const ST_DOC = window.parent?.document || document;
    if (ST_DOC.getElementById(id)) return; // 已经加载过了

    for (const url of urls) {
      try {
        await new Promise<void>((resolve, reject) => {
          const link = ST_DOC.createElement('link');
          link.id = id;
          link.rel = 'stylesheet';
          link.onload = () => resolve();
          link.onerror = () => {
            link.remove(); // 失败则移除废弃标签
            reject(new Error(`CSS load failed: ${url}`));
          };
          link.href = url;
          ST_DOC.head.appendChild(link);
        });
        return; // 成功则直接返回
      } catch (e) {
        console.warn(`[AssetManager] CSS 加载失败，尝试降级: ${url}`);
      }
    }
    console.error(`[AssetManager] 样式库加载失败 (ID: ${id})`);
  }

  /**
   * 使用 JS 原生 FontFace API 强制加载并注册字体
   * 优势：能精准捕捉成功或失败，不受 Webpack 打包及 CSS 规则位置影响。
   */
  static async loadFontFace(family: string, urls: string[], descriptors: FontFaceDescriptors = {}): Promise<void> {
    for (const url of urls) {
      try {
        const font = new FontFace(family, `url(${url})`, descriptors);
        await font.load();
        
        // 如果是在 iframe 中，需要同时注册到宿主和当前 document
        document.fonts.add(font);
        const ST_DOC = window.parent?.document;
        if (ST_DOC && ST_DOC !== document) {
          ST_DOC.fonts.add(font);
        }
        return;
      } catch (e) {
        console.warn(`[AssetManager] 字体 ${family} 从节点加载失败，尝试降级: ${url}`);
      }
    }
    console.error(`[AssetManager] 字体 ${family} 所有节点加载失败！`);
  }

  /**
   * 核心预加载流程控制
   * @param onProgress 允许上层系统传入回调函数，从而实现全局统一的进度汇报
   */
  static async initCoreAssets(onProgress?: (step: string, percent: number) => void) {
    const tasks = [
      { name: 'Material Symbols 图标', run: this.loadMaterialSymbols.bind(this) },
      { name: 'UI 文本字体', run: this.loadTextFonts.bind(this) },
      { name: '主题背景贴图', run: this.loadBackgroundImages.bind(this) },
    ];

    let completed = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // 开始加载前汇报一次
      if (onProgress) onProgress(task.name, Math.floor((completed / tasks.length) * 100));

      try {
        await task.run();
      } catch (err: any) {
        console.error(`[AssetManager] 致命错误：核心加载项 ${task.name} 崩溃`, err);
        if (typeof toastr !== 'undefined') {
          toastr.error(`加载 ${task.name} 失败！请检查网络或切换代理。`, '资源加载异常', { timeOut: 5000 });
        }
      }
      completed++;
      
      // 加载完毕后汇报进度
      if (onProgress) onProgress(task.name, Math.floor((completed / tasks.length) * 100));
    }
  }

  // --- 具体加载任务拆分 ---

  private static async loadMaterialSymbols() {
    console.info('[AssetManager] Loading Material Symbols...');
    // 使用 JS API 直接请求静态的 WOFF2 字体包
    await this.loadFontFace(
      'Material Symbols Outlined',
      [
        `${this.NPM_CDNS.testingcf}/material-symbols@0.14.4/material-symbols-outlined.woff2`,
        `${this.NPM_CDNS.fastly}/material-symbols@0.14.4/material-symbols-outlined.woff2`,
        `${this.NPM_CDNS.default}/material-symbols@0.14.4/material-symbols-outlined.woff2`,
      ],
      {
        style: 'normal',
        weight: '100 700',
        display: 'swap', // 使用 swap 防止长时间阻塞，虽然我们已经阻塞了 UI
      }
    );
  }

  private static async loadTextFonts() {
    console.info('[AssetManager] Loading UI Text Fonts...');
    // 文本字体包含大量切片，用 JS API 逐个请求过于复杂。
    // 最好的方式是降级：优先 loli.net，其次 font.im，最后用 Google 原生，如果全挂则静默失败使用系统自带字体。
    await this.loadCSSWithFallback([
      `${this.FONT_CDNS.loli}/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@300;400;500;700&display=swap`,
      `${this.FONT_CDNS.fontim}/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@300;400;500;700&display=swap`,
      `${this.FONT_CDNS.google}/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@300;400;500;700&display=swap`,
    ], 'ark-statusbar-text-fonts');
  }

  private static async loadBackgroundImages() {
    console.info('[AssetManager] Loading Theme Backgrounds...');
    
    // 图片资源不仅有 CDN 节点的降级，还带有版本降级。
    // 如果 @latest 未及时更新或者挂了，则回退到一个已经缓存好已知可用的 commit hash 节点 (a633c71)。
    const bgLightUrl = await this.preloadImageWithFallback([
      `${this.CDNS.gh_testingcf}/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
      `${this.CDNS.gh_fastly}/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
      `${this.CDNS.gh_default}/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
      `https://testingcf.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@a633c71/src/ARK_STATUSBAR/assets/page-bg-light.jpg`
    ]);

    const bgDarkUrl = await this.preloadImageWithFallback([
      `${this.CDNS.gh_testingcf}/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
      `${this.CDNS.gh_fastly}/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
      `${this.CDNS.gh_default}/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
      `https://testingcf.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@a633c71/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`
    ]);

    // 将预加载成功的图片地址作为 CSS 变量注入宿主的 root 节点
    const ST_DOC = window.parent?.document || document;
    ST_DOC.documentElement.style.setProperty('--ark-bg-light-url', `url('${bgLightUrl}')`);
    ST_DOC.documentElement.style.setProperty('--ark-bg-dark-url', `url('${bgDarkUrl}')`);
  }
}

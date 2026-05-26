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

import { reject } from 'lodash';

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
   * 采用“交错并发竞速 (Staggered Race)”机制加载图片：
   * 如果首选节点在超时时间内未响应，则启动下一个节点的加载（并发竞速），
   * 哪个先加载完就用哪个，避免某个 CDN 失联或返回慢导致整个启动流程卡死。
   */
  static async preloadImageWithFallback(paths: string[], staggerMs = 1500): Promise<string> {
    return new Promise(resolve => {
      let resolved = false;
      let failedCount = 0;
      let startedCount = 0;

      const tryNode = (index: number) => {
        if (resolved || index >= paths.length) return;

        startedCount = Math.max(startedCount, index + 1);
        const path = paths[index];
        let hasFinished = false;

        const img = new Image();
        img.onload = () => {
          if (!resolved) {
            resolved = true;
            resolve(path);
          }
        };
        img.onerror = () => {
          hasFinished = true;
          failedCount++;
          if (!resolved) {
            console.warn(`[AssetManager] 图片降级节点失败: ${path}`);
            if (failedCount === paths.length) {
              console.error('[AssetManager] 核心图片全部节点加载失败！');
              // 必须 reject，让上层捕获并弹出 toastr
              reject(new Error('核心图片全部节点加载失败'));
            } else if (startedCount === index + 1) {
              tryNode(index + 1);
            }
          }
        };
        img.src = path;

        setTimeout(() => {
          if (!resolved && !hasFinished && startedCount === index + 1) {
            console.warn(`[AssetManager] 图片加载超时，触发并发降级竞速: ${path}`);
            tryNode(index + 1);
          }
        }, staggerMs);
      };

      tryNode(0);
    });
  }

  /**
   * 动态 CSS 加载器 (带交错竞速机制)
   */
  static async loadCSSWithFallback(urls: string[], id: string, staggerMs = 1500): Promise<void> {
    const ST_DOC = window.parent?.document || document;
    if (ST_DOC.getElementById(id)) return;

    return new Promise(resolve => {
      let resolved = false;
      let failedCount = 0;
      let startedCount = 0;

      const tryNode = (index: number) => {
        if (resolved || index >= urls.length) return;

        startedCount = Math.max(startedCount, index + 1);
        const url = urls[index];
        let hasFinished = false;

        const link = ST_DOC.createElement('link');
        link.className = `ark-css-fallback-${id}`;
        link.rel = 'stylesheet';

        link.onload = () => {
          if (!resolved) {
            resolved = true;
            link.id = id;
            // 清理其他竞速失败的冗余标签
            ST_DOC.querySelectorAll(`.ark-css-fallback-${id}`).forEach(el => {
              if (el !== link) el.remove();
            });
            resolve();
          }
        };
        link.onerror = () => {
          link.remove();
          hasFinished = true;
          failedCount++;
          if (!resolved) {
            console.warn(`[AssetManager] CSS 降级节点失败: ${url}`);
            if (failedCount === urls.length) {
              console.error(`[AssetManager] 样式库加载失败 (ID: ${id})`);
              reject(new Error(`样式库加载失败 (ID: ${id})`));
            } else if (startedCount === index + 1) {
              tryNode(index + 1);
            }
          }
        };
        link.href = url;
        ST_DOC.head.appendChild(link);

        setTimeout(() => {
          if (!resolved && !hasFinished && startedCount === index + 1) {
            console.warn(`[AssetManager] CSS 加载超时，触发并发降级竞速: ${url}`);
            tryNode(index + 1);
          }
        }, staggerMs);
      };

      tryNode(0);
    });
  }

  /**
   * 使用 JS 原生 FontFace API 强制加载并注册字体 (带交错竞速机制)
   */
  static async loadFontFace(
    family: string,
    urls: string[],
    descriptors: FontFaceDescriptors = {},
    staggerMs = 1500,
  ): Promise<void> {
    return new Promise(resolve => {
      let resolved = false;
      let failedCount = 0;
      let startedCount = 0;

      const tryNode = (index: number) => {
        if (resolved || index >= urls.length) return;

        startedCount = Math.max(startedCount, index + 1);
        const url = urls[index];
        let hasFinished = false;

        // 【核心修复】：跨 Iframe 的 FontFace 对象在部分移动端 Webview（及特定 Safari 版本）中，
        // 即使调用 ST_DOC.fonts.add() 也会被隐式丢弃（Illegal Invocation / Realm 隔离）。
        // 因此必须借用宿主的 FontFace 构造器来实例化字体对象。
        const HostWindow = window.parent || window;
        const HostFontFace = (HostWindow as any).FontFace || FontFace;

        const font = new HostFontFace(family, `url(${url})`, descriptors);
        font
          .load()
          .then(() => {
            if (!resolved) {
              resolved = true;
              // 注册到当前 iframe
              document.fonts.add(font);
              // 注册到宿主
              if (HostWindow.document && HostWindow.document !== document) {
                HostWindow.document.fonts.add(font);
              }
              resolve();
            }
          })
          .catch(() => {
            hasFinished = true;
            failedCount++;
            if (!resolved) {
              console.warn(`[AssetManager] 字体 ${family} 节点失败: ${url}`);
              if (failedCount === urls.length) {
                console.error(`[AssetManager] 字体 ${family} 全部节点加载失败！`);
                reject(new Error(`字体 ${family} 全部节点加载失败`));
              } else if (startedCount === index + 1) {
                tryNode(index + 1);
              }
            }
          });

        setTimeout(() => {
          if (!resolved && !hasFinished && startedCount === index + 1) {
            console.warn(`[AssetManager] 字体 ${family} 超时，触发并发降级竞速: ${url}`);
            tryNode(index + 1);
          }
        }, staggerMs);
      };

      tryNode(0);
    });
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

    // 采用最新的 0.44.9 版本，彻底解决此前旧版本 "keep" 等图标变字母的缺失问题。
    // 使用交错并发竞速机制（Staggered Race）来保证某个 CDN 节点被墙或回源卡死时能极速降级。
    await this.loadFontFace(
      'Material Symbols Outlined',
      [
        `${this.NPM_CDNS.testingcf}/material-symbols@0.44.9/material-symbols-outlined.woff2`,
        `${this.NPM_CDNS.fastly}/material-symbols@0.44.9/material-symbols-outlined.woff2`,
        `${this.NPM_CDNS.default}/material-symbols@0.44.9/material-symbols-outlined.woff2`,
      ],
      {
        style: 'normal',
        weight: '100 700',
        display: 'swap',
      },
      1500, // 竞速间隔
    );
  }

  private static async loadTextFonts() {
    console.info('[AssetManager] Loading UI Text Fonts...');
    // 文本字体包含大量切片，用 JS API 逐个请求过于复杂。
    // 最好的方式是降级：优先 loli.net，其次 font.im，最后用 Google 原生，如果全挂则静默失败使用系统自带字体。
    await this.loadCSSWithFallback(
      [
        `${this.FONT_CDNS.loli}/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@300;400;500;700&display=swap`,
        `${this.FONT_CDNS.fontim}/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@300;400;500;700&display=swap`,
        `${this.FONT_CDNS.google}/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700;800;900&family=Noto+Serif+SC:wght@300;400;500;700&display=swap`,
      ],
      'ark-statusbar-text-fonts',
    );
  }

  private static async loadBackgroundImages() {
    console.info('[AssetManager] Loading Theme Backgrounds...');

    // 图片资源不仅有 CDN 节点的降级，还带有版本降级。
    // 为了极速响应避免 @latest 在 CDN 缓存未命中时的等待，我们将确定可用的固定 hash (a633c71) 提到首位。
    // 若后续需要更新背景图，只需更新这里的硬编码 hash 或者把它挪回 fallback 序列中即可。
    const bgLightUrl = await this.preloadImageWithFallback([
      `https://testingcf.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@a633c71/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
      `${this.CDNS.gh_testingcf}/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
      `${this.CDNS.gh_fastly}/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
      `${this.CDNS.gh_default}/src/ARK_STATUSBAR/assets/page-bg-light.jpg`,
    ]);

    const bgDarkUrl = await this.preloadImageWithFallback([
      `https://testingcf.jsdelivr.net/gh/TonyDG233/ST_Ark_StatusBar@a633c71/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
      `${this.CDNS.gh_testingcf}/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
      `${this.CDNS.gh_fastly}/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
      `${this.CDNS.gh_default}/src/ARK_STATUSBAR/assets/page-bg-dark.jpg`,
    ]);

    // 将预加载成功的图片地址作为 CSS 变量注入宿主的 root 节点
    const ST_DOC = window.parent?.document || document;
    ST_DOC.documentElement.style.setProperty('--ark-bg-light-url', `url('${bgLightUrl}')`);
    ST_DOC.documentElement.style.setProperty('--ark-bg-dark-url', `url('${bgDarkUrl}')`);
  }
}

import { unref } from 'vue';
import { BASELINE_STATE } from '../config/baseline';
import { configStore } from './core/config_store';
import { logger } from './core/logger';

/**
 * 状态栏全局管理器 (Singleton 单例模式)
 * 负责与 SillyTavern 核心环境交互、管理持久化配置以及接管发送拦截功能。
 */
export class StatusBarManager {
  private static instance: StatusBarManager;
  private targetWorldbook: string | null = null; // 当前绑定的世界书名称
  private interceptorBound: boolean = false; // 标识是否已经绑定了拦截器事件
  
  public tempDisabledUids: number[] = []; // 单次临时阻断的条目 UID 列表

  private isDryRunning: boolean = false; // 防重入和防并发的干跑锁

  private constructor() {
    // 拦截器状态变更由 store 托管
    configStore.onInterceptorStateChanged = (shouldEnable: boolean) => {
      if (shouldEnable) {
        this.bindInterceptor();
      } else {
        this.unbindInterceptor();
      }
    };
  }

  // 获取单例实例
  static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
  }

  // 提供对配置存储的快速访问别名，用于兼容现存未拆分的逻辑调用
  get currentConfig() {
    return unref(configStore.state);
  }

  /**
   * 初始化管理器：获取当前世界书、加载配置并绑定相关事件。
   */
  async init() {
    console.info('[ARK_StatusBar] Initializing Manager...');
    try {
      // 获取当前角色所绑定的世界书名称
      const result = await getCharWorldbookNames('current');
      if (result.primary) this.targetWorldbook = result.primary;
      else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

      if (!this.targetWorldbook) {
        console.warn('[ARK_StatusBar] No worldbook bound to current character.');
      }

      // 将原来的 loadOrInitConfig 和 saveConfig 逻辑都委托给 Store
      await configStore.loadOrInitConfig(this.targetWorldbook);
      
      // 绑定事件监听器 (如聊天改变时检测 Baseline 差异)
      this.setupEvents();
    } catch (error) {
      console.error('[ARK_StatusBar] Init failed:', error);
    }
  }

  // --------------------------------------------------------------------------
  // The loadOrInitConfig and saveConfig methods have been completely removed
  // and migrated to logic/core/config_store.ts
  // --------------------------------------------------------------------------

  private eventsBound: boolean = false;

  /**
   * 设置环境事件监听。
   */
  private setupEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // 监听生成结束事件：恢复“临时阻断”的世界书条目 (需求2)
    eventOn(tavern_events.GENERATION_ENDED, async () => {
      if (this.tempDisabledUids.length > 0 && this.targetWorldbook) {
        console.info('[ARK_StatusBar] Restoring temp disabled entries after generation...');
        const uidsToRestore = [...this.tempDisabledUids];
        this.tempDisabledUids = []; // 立即清空，防止重入
        try {
          await updateWorldbookWith(this.targetWorldbook, (wbEntries: any[]) => {
            let changed = false;
            for (const entry of wbEntries) {
              if (uidsToRestore.includes(entry.uid)) {
                entry.enabled = true;
                changed = true;
              }
            }
            return wbEntries;
          });
          // 虽然生成结束后界面可能已关闭，但仍抛出事件以便状态同步
          document.dispatchEvent(new CustomEvent('ark-chat-changed'));
        } catch (e) {
          console.error('[ARK_StatusBar] Failed to restore temp disabled entries', e);
        }
      }
    });

    // 监听酒馆原生 CHAT_CHANGED 事件（切换聊天或重新加载时）
    eventOn(tavern_events.CHAT_CHANGED, async () => {
      console.info('[ARK_StatusBar] Chat changed, checking baseline diff and reloading...');

      try {
        // 用户可能切换了角色，因此需要重新获取绑定的世界书
        const result = await getCharWorldbookNames('current');
        if (result.primary) this.targetWorldbook = result.primary;
        else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

        if (this.targetWorldbook) {
          await configStore.loadOrInitConfig(this.targetWorldbook);
          await this.checkBaselineDiff(); // 检查当前状态是否偏离了设定的 Baseline
        }
      } catch (error) {
        console.error('[ARK_StatusBar] Failed to handle chat change', error);
      }

      // 派发事件通知 UI 刷新 "全部条目" 列表
      document.dispatchEvent(new CustomEvent('ark-chat-changed'));
    });
  }

  /**
   * 检查当前世界书状态与 Baseline (基准线) 的差异。
   */
  public async checkBaselineDiff() {
    if (!this.targetWorldbook) return;
    try {
      // 如果要求静默下一次警告（如刚恢复 Baseline 后），则跳过并复位标志
      if (this.currentConfig.suppressNextDiffWarning) {
        console.info('[ARK_StatusBar] Suppressing diff warning as requested.');
        await configStore.updateConfig({ suppressNextDiffWarning: false });
        return;
      }

      const entries = await getWorldbook(this.targetWorldbook);
      let hasDiff = false;
      for (const key of Object.keys(BASELINE_STATE)) {
        const entry = entries.find((e: any) => e.name === key || e.comment === key);
        const baseline = BASELINE_STATE[key];

        if (entry) {
          const currentType = entry.strategy?.type || 'selective';
          // 只要开关状态或触发类型（蓝/绿灯）有不一致，即认为存在差异
          if (entry.enabled !== baseline.enabled || currentType !== baseline.type) {
            hasDiff = true;
            break;
          }
        }
      }

      // 如果存在差异，可以通过抛出事件让 UI 进行提示
      if (hasDiff) {
        const event = new CustomEvent('ark-baseline-diff-detected');
        document.dispatchEvent(event);
      }
    } catch (e) {
      console.error('[ARK_StatusBar] Diff check failed', e);
    }
  }

  // --- 拦截器与发送检测核心逻辑 ---

  /**
   * 提取公共的双轨并行干跑流程 (需求1 & 需求4)
   *
   * @note [给后续 Agent 的警告]：此函数在移动端极易发生异步执行流死锁（由于酒馆内核超时或异常未回传）。
   * 所有新增的异步逻辑，必须包裹在 `Promise.race` 超时防假死结构中。
   * 同时，任何改变执行流的新逻辑，必须调用 `logger.logDebug()` 埋点，以便开发者定位问题。
   */
  private async executeDualTrackDryRun(isManualTest: boolean, text: string) {
    if (this.isDryRunning) {
      console.warn('[ARK_StatusBar] Dry run is already in progress. Ignoring concurrent request.');
      logger.logDebug('executeDualTrackDryRun_IGNORE_CONCURRENT', null, this.targetWorldbook);
      return;
    }

    this.isDryRunning = true;
    logger.logDebug('executeDualTrackDryRun_START', { isManualTest, textLength: text.length }, this.targetWorldbook);

    try {
      // 兼容获取 context (避免裸取导致代理对象遗失)
      // @ts-ignore
      const globalGetContext = typeof getContext === 'function' ? getContext : null;
      const context = globalGetContext
        ? globalGetContext()
        : typeof SillyTavern !== 'undefined' && typeof (SillyTavern as any).getContext === 'function'
          ? (SillyTavern as any).getContext()
          : null;

      const worldInfoFn = context?.getWorldInfoPrompt;
      const generateFn = context?.generate;

      logger.logDebug('executeDualTrackDryRun_CONTEXT', {
        hasContext: !!context,
        hasWorldInfoFn: !!worldInfoFn,
        hasGenerateFn: !!generateFn,
      }, this.targetWorldbook);

      if (!worldInfoFn) {
        console.warn('[ARK_StatusBar] Required API getWorldInfoPrompt not available.');
        if (!isManualTest) this.releaseInterceptAndSend();
        else {
          const event = new CustomEvent('ark-interceptor-triggered', {
            detail: { entries: [], isManualTest: true, tokenCount: 0 },
          });
          document.dispatchEvent(event);
        }
        return;
      }

      // ==========================================
      // 第一轨：提取精确世界书阵列 (使用 getWorldInfoPrompt)
      // ==========================================
      const rawChat = context.chat || [];
      const chatStrings = rawChat.map((msg: any) => {
        if (typeof msg === 'string') return msg;
        if (msg && msg.mes !== undefined) {
          let name = msg.name;
          if (!name && typeof SillyTavern !== 'undefined') {
            name = msg.is_user ? SillyTavern.name1 : SillyTavern.name2;
          }
          // 重要: 酒馆扫描严格要求 "Name: Message" 格式
          return name ? `${name}: ${msg.mes}` : String(msg.mes);
        }
        return String(msg);
      });

      const mockChat = [...chatStrings];
      if (text) {
        const userName = typeof SillyTavern !== 'undefined' ? SillyTavern.name1 : 'User';
        mockChat.push(`${userName}: ${text}`);
      }

      // CRITICAL FIX: SillyTavern 原生 `getWorldInfoPrompt` 扫描 Depth 时，严格要求数组倒序，索引 0 为最新消息。
      mockChat.reverse();
      (mockChat as any).__isMock = true;

      let activatedEntries: any[] = [];
      const worldInfoListener = (evt: any) => {
        const raw = evt.detail || evt;
        logger.logDebug('executeDualTrackDryRun_RAW_ENTRIES_RECEIVED', raw, this.targetWorldbook);

        // 放开限制：接收所有被激活的绿灯条目，在UI中通过 e.world 字段进行溯源展示
        activatedEntries = raw || [];
        logger.logDebug('executeDualTrackDryRun_ALL_ENTRIES', { filteredCount: activatedEntries.length }, this.targetWorldbook);
      };

      const eventTarget = window.parent?.document || document;
      eventTarget.addEventListener('world_info_activated', worldInfoListener);
      // @ts-ignore
      if (typeof eventOn === 'function') eventOn('world_info_activated', worldInfoListener);

      const timeoutError = new Error('DRY_RUN_TIMEOUT');

      // 包装世界书干跑为带超时的 Promise
      const worldInfoPromise = async () => {
        logger.logDebug('executeDualTrackDryRun_BEFORE_AWAIT_WORLDINFO', null, this.targetWorldbook);
        await worldInfoFn(mockChat, 1000000, false);
        logger.logDebug('executeDualTrackDryRun_AFTER_AWAIT_WORLDINFO', null, this.targetWorldbook);
      };

      try {
        await Promise.race([
          worldInfoPromise(),
          new Promise((_, reject) => setTimeout(() => reject(timeoutError), 5000)),
        ]);
      } catch (error) {
        if (error === timeoutError) {
          console.warn('[ARK_StatusBar] World Info dry run timeout after 5s.');
          logger.logDebug('executeDualTrackDryRun_TIMEOUT_WORLDINFO', null, this.targetWorldbook);
        } else {
          console.error('[ARK_StatusBar] World Info dry run failed', error);
          logger.logDebug('executeDualTrackDryRun_ERROR_WORLDINFO', error, this.targetWorldbook);
        }
      } finally {
        eventTarget.removeEventListener('world_info_activated', worldInfoListener);
        // @ts-ignore
        if (typeof eventOff === 'function') eventOff('world_info_activated', worldInfoListener);
      }

      // ==========================================
      // 第二轨：获取完整的组装聚合 Token (使用 generate)
      // ==========================================
      let tokenCount: number | string = 0;
      const promptReadyListener = async (evt: any) => {
        const data = evt.detail || evt;
        if (!data.dryRun) return;

        logger.logDebug('executeDualTrackDryRun_PROMPT_READY', {
          chatLength: data.chat?.length,
          promptLength: data.prompt?.length,
        }, this.targetWorldbook);

        const payloadStrings = data.chat || data.prompt || [];
        let fullText = '';
        if (Array.isArray(payloadStrings)) {
          if (payloadStrings.length > 0 && typeof payloadStrings[0] === 'object') {
            fullText = payloadStrings.map((m: any) => m.content || `${m.name}: ${m.mes}`).join('\n');
          } else {
            fullText = payloadStrings.join('\n');
          }
        } else {
          fullText = String(payloadStrings);
        }
        try {
          if (typeof SillyTavern !== 'undefined' && typeof (SillyTavern as any).getTokenCountAsync === 'function') {
            tokenCount = await (SillyTavern as any).getTokenCountAsync(fullText);
            logger.logDebug('executeDualTrackDryRun_TOKEN_CALCULATED', tokenCount, this.targetWorldbook);
          } else {
            tokenCount = 'API失效';
          }
        } catch (e) {
          console.error('[ARK_StatusBar] Failed to count tokens', e);
          tokenCount = '计算失败';
        }
      };

      eventTarget.addEventListener('chat_completion_prompt_ready', promptReadyListener);
      // @ts-ignore
      if (typeof eventOn === 'function') eventOn('chat_completion_prompt_ready', promptReadyListener);

      const generatePromise = async () => {
        if (generateFn) {
          logger.logDebug('executeDualTrackDryRun_BEFORE_AWAIT_GENERATE', null, this.targetWorldbook);
          await generateFn('normal', {}, true);
          logger.logDebug('executeDualTrackDryRun_AFTER_AWAIT_GENERATE', null, this.targetWorldbook);
        } else {
          console.warn('[ARK_StatusBar] generate API not available, skipping precise token count.');
          tokenCount = '未获取到API';
        }
      };

      try {
        await Promise.race([
          generatePromise(),
          new Promise((_, reject) => setTimeout(() => reject(timeoutError), 8000)),
        ]);
      } catch (error) {
        if (error === timeoutError) {
          console.warn('[ARK_StatusBar] Prompt Token dry run timeout after 8s.');
          tokenCount = '计算超时';
          logger.logDebug('executeDualTrackDryRun_TIMEOUT_GENERATE', null, this.targetWorldbook);
        } else {
          console.error('[ARK_StatusBar] Prompt Token dry run failed', error);
          tokenCount = '干跑失败';
          logger.logDebug('executeDualTrackDryRun_ERROR_GENERATE', error, this.targetWorldbook);
        }
      } finally {
        eventTarget.removeEventListener('chat_completion_prompt_ready', promptReadyListener);
        // @ts-ignore
        if (typeof eventOff === 'function') eventOff('chat_completion_prompt_ready', promptReadyListener);
      }

      logger.logDebug('executeDualTrackDryRun_END_DISPATCH', {
        finalActivatedCount: activatedEntries?.length,
        tokenCount,
      }, this.targetWorldbook);

      // ==========================================
      // 终点：统合抛出预警结果
      // ==========================================
      if (isManualTest) {
        const event = new CustomEvent('ark-interceptor-triggered', {
          detail: { entries: activatedEntries, isManualTest: true, tokenCount },
        });
        document.dispatchEvent(event);
      } else {
        if (activatedEntries && activatedEntries.length > 0) {
          const event = new CustomEvent('ark-interceptor-triggered', {
            detail: { entries: activatedEntries, isManualTest: false, tokenCount },
          });
          document.dispatchEvent(event);
        } else {
          // 没有触发任何目标词条，静默放行
          logger.logDebug('executeDualTrackDryRun_SILENT_PASS', null, this.targetWorldbook);
          this.releaseInterceptAndSend();
        }
      }
    } finally {
      // 无论成功、失败还是超时，永远释放干跑锁
      this.isDryRunning = false;
      logger.logDebug('executeDualTrackDryRun_FINALLY_UNLOCK', null, this.targetWorldbook);
    }
  }

  /**
   * 运行“主动检测”流程 (Manual Test)。
   */
  public async runManualTest() {
    console.info('[ARK_StatusBar] Running manual test...');
    const ST_DOC = window.parent?.document || document;
    const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
    const text = textarea?.value?.trim() || '';

    await this.executeDualTrackDryRun(true, text);
  }

  /**
   * 用户点击发送按钮或按下回车时触发拦截的 Handler
   */
  private handleIntercept = async (e: Event) => {
    const ST_DOC = window.parent?.document || document;
    const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
    const text = textarea?.value?.trim() || '';

    // 如果是键盘事件
    if (e.type.startsWith('key')) {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Enter') {
        // 守护判断：如果未开启回车拦截，或者是换行 (shift+Enter)，则完全放行
        if (!this.currentConfig?.enableEnterToIntercept || keyboardEvent.shiftKey) {
          return;
        }

        // 拦截回车！吃掉事件以防止任何原生监听器被触发
        e.preventDefault();
        e.stopImmediatePropagation();

        // 为防止按一次回车触发多次（keydown, keypress, keyup），只在 keydown 阶段执行逻辑
        if (e.type !== 'keydown') {
          return;
        }
      } else {
        // 其他按键直接放行
        return;
      }
    } else {
      // 这是点击 Send 按钮的事件
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    if (!text) return;

    console.info('[ARK_StatusBar] Generation intercepted! Running dual track dry run...');
    await this.executeDualTrackDryRun(false, text);
  };

  /**
   * 将拦截逻辑绑定到原生的 Send 按钮和文本输入框。
   * 采用捕获阶段(true)优先拿到事件，并在多个键相上挂载以彻底屏蔽。
   */
  private bindInterceptor() {
    if (this.interceptorBound) return;
    const ST_DOC = window.parent?.document || document;
    const sendBtn = ST_DOC.querySelector('#send_but');
    const textarea = ST_DOC.querySelector('#send_textarea');

    if (sendBtn && textarea) {
      sendBtn.addEventListener('click', this.handleIntercept, true);
      textarea.addEventListener('keydown', this.handleIntercept, true);
      textarea.addEventListener('keypress', this.handleIntercept, true);
      textarea.addEventListener('keyup', this.handleIntercept, true);
      this.interceptorBound = true;
      console.info('[ARK_StatusBar] Interceptor bound.');
    }
  }

  /**
   * 解绑拦截器。
   */
  private unbindInterceptor() {
    if (!this.interceptorBound) return;
    const ST_DOC = window.parent?.document || document;
    const sendBtn = ST_DOC.querySelector('#send_but');
    const textarea = ST_DOC.querySelector('#send_textarea');

    if (sendBtn && textarea) {
      sendBtn.removeEventListener('click', this.handleIntercept, true);
      textarea.removeEventListener('keydown', this.handleIntercept, true);
      textarea.removeEventListener('keypress', this.handleIntercept, true);
      textarea.removeEventListener('keyup', this.handleIntercept, true);
      this.interceptorBound = false;
      console.info('[ARK_StatusBar] Interceptor unbound.');
    }
  }

  /**
   * 取消拦截并强制发送。
   * （先解绑拦截器 -> 主动触发原生按钮 -> 延迟半秒后再重新绑定拦截器）
   */
  public releaseInterceptAndSend() {
    this.unbindInterceptor();
    const ST_DOC = window.parent?.document || document;
    const sendBtn = ST_DOC.querySelector('#send_but') as HTMLElement;
    if (sendBtn) {
      console.info('[ARK_StatusBar] Releasing interceptor and sending...');
      sendBtn.click(); // 执行真实的原生发送逻辑
      // 延迟重新挂载拦截器，防止死循环
      setTimeout(() => {
        if (this.currentConfig?.isInterceptorEnabled) {
          this.bindInterceptor();
        }
      }, 500);
    }
  }
}

import { BASELINE_STATE } from '../config/baseline';

// 系统配置条目的前缀，用于在世界书中快速定位配置条目
export const CONFIG_ENTRY_PREFIX = '[SYS_CONFIG]';
// 系统配置条目的完整名称
export const CONFIG_ENTRY_FULL_NAME = '[SYS_CONFIG]系统配置文件请勿打开';

export const DEBUG_ENTRY_PREFIX = '[SYS_DEBUG]';
export const DEBUG_ENTRY_FULL_NAME = '[SYS_DEBUG]系统调试日志导出';

/**
 * 状态栏的全局配置接口，所有持久化配置都会保存在世界书的 [SYS_CONFIG] 条目中。
 */
export interface ArkConfig {
  _desc: string; // 配置文件说明，防止用户误修改
  theme: 'light' | 'dark' | 'transparent'; // 当前 UI 主题
  isSystemEnabled: boolean; // 系统总开关，控制整个状态栏是否启用
  isInterceptorEnabled: boolean; // 拦截器开关，控制是否在发送时拦截预警
  enableEnterToIntercept: boolean; // 是否拦截回车键 (默认关闭)
  isDebugMode?: boolean; // 新增：是否开启调试模式
  uiWidth: number; // 状态栏 UI 的宽度
  uiFontSize: number; // 状态栏 UI 的基础字体大小
  commits: ArkCommit[]; // 操作历史记录（类似 Git commit）
  lastUpdateTime: number; // 最后一次配置更新的时间戳
  suppressNextDiffWarning?: boolean; // 是否屏蔽下一次的 Baseline 差异警告
  pinnedEntries?: number[]; // 用户置顶偏好的世界书条目 UID 列表
}

// 默认的初始配置
const DEFAULT_CONFIG: ArkConfig = {
  _desc: '这是ARK_STATUSBAR的自动备份条目，请勿手动修改',
  theme: 'light', // 默认主题为浅色
  isSystemEnabled: true,
  isInterceptorEnabled: true,
  enableEnterToIntercept: false, // 默认关闭回车拦截，不打扰习惯回车发送的用户
  isDebugMode: false, // 默认关闭调试模式
  uiWidth: 400,
  uiFontSize: 14,
  commits: [],
  lastUpdateTime: 0,
  pinnedEntries: [],
};

/**
 * 历史记录（Commit）的结构定义，用于记录对世界书条目状态的修改。
 */
export interface ArkCommit {
  id: string; // 唯一的提交 ID
  timestamp: number; // 提交时间戳
  description: string; // 提交的文字描述
  changes: {
    uid: number; // 修改的世界书条目 UID
    comment: string; // 变动的条目名称/备注
    from: boolean; // 变更前的 enabled 状态
    to: boolean; // 变更后的 enabled 状态
  }[];
}

/**
 * 状态栏全局管理器 (Singleton 单例模式)
 * 负责与 SillyTavern 核心环境交互、管理持久化配置以及接管发送拦截功能。
 */
export class StatusBarManager {
  private static instance: StatusBarManager;
  private targetWorldbook: string | null = null; // 当前绑定的世界书名称
  private interceptorBound: boolean = false; // 标识是否已经绑定了拦截器事件
  public currentConfig: ArkConfig | null = null; // 内存中缓存的当前配置
  public onConfigUpdate?: (config: ArkConfig) => void; // 配置更新的回调 (已弃用，建议监听 ark-config-updated 事件)
  public tempDisabledUids: number[] = []; // 单次临时阻断的条目 UID 列表

  private debugLogQueue: any[] = [];
  private flushTimeout: any = null;
  private isDryRunning: boolean = false; // 防重入和防并发的干跑锁

  /**
   * 追加调试日志到内存队列，并延迟持久化到世界书
   */
  public logDebug(action: string, data: any) {
    if (!this.currentConfig?.isDebugMode) return;

    // 控制台也打印一份
    console.log(`[ARK_DEBUG] ${action}`, data);

    // 推入内存队列
    this.debugLogQueue.push({
      time: new Date().toISOString(),
      action,
      data: data
        ? JSON.parse(
            JSON.stringify(data, (key, value) => {
              // 防止循环引用报错
              if (typeof value === 'object' && value !== null) {
                if (value === window || value === document) return '[DOM Node]';
              }
              // 压缩冗长的文本字段，防止日志文件体积爆炸
              if (typeof value === 'string' && value.length > 50) {
                if (key === 'content' || key === 'prompt' || key === 'mes' || key === 'text') {
                  return value.substring(0, 50) + '...[已截断]';
                }
              }
              return value;
            }),
          )
        : null,
    });

    // 限制单次记录最大条目防止卡死
    if (this.debugLogQueue.length > 50) {
      this.debugLogQueue.splice(0, this.debugLogQueue.length - 50);
    }

    this.scheduleFlushDebugLogs();
  }

  private scheduleFlushDebugLogs() {
    if (this.flushTimeout) clearTimeout(this.flushTimeout);
    this.flushTimeout = setTimeout(() => {
      this.flushDebugLogsToWorldbook();
    }, 2000); // 防抖 2 秒
  }

  private async flushDebugLogsToWorldbook() {
    if (!this.targetWorldbook || this.debugLogQueue.length === 0) return;
    try {
      let entries = await getWorldbook(this.targetWorldbook);
      let debugEntry = entries.find((e: any) => e.name === DEBUG_ENTRY_FULL_NAME);

      const logContent = JSON.stringify(this.debugLogQueue, null, 2);

      if (!debugEntry) {
        await createWorldbookEntries(this.targetWorldbook, [
          {
            name: DEBUG_ENTRY_FULL_NAME,
            comment: '调试日志内容。如果需要提交bug，请复制此内容或导出包含此条目的世界书。',
            content: logContent,
            enabled: false,
            constant: false,
          },
        ]);
      } else {
        await updateWorldbookWith(this.targetWorldbook, (wbEntries: any[]) => {
          const e = wbEntries.find(x => x.name === DEBUG_ENTRY_FULL_NAME);
          if (e) {
            e.content = logContent;
            e.enabled = false;
          }
          return wbEntries;
        });
      }
    } catch (e) {
      console.error('[ARK_DEBUG] Failed to flush logs', e);
    }
  }

  private constructor() {}

  // 获取单例实例
  static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
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
        return;
      }

      // 加载或初始化配置文件
      await this.loadOrInitConfig();
      // 绑定事件监听器 (如聊天改变时检测 Baseline 差异)
      this.setupEvents();
    } catch (error) {
      console.error('[ARK_StatusBar] Init failed:', error);
    }
  }

  /**
   * 从世界书中加载配置，如果不存在则初始化一个默认配置写入世界书。
   */
  private async loadOrInitConfig() {
    if (!this.targetWorldbook) return;
    let entries = await getWorldbook(this.targetWorldbook);

    // 根据前缀匹配查找是否已有配置条目
    let configEntry = entries.find(
      (e: any) =>
        (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) || (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
    );

    if (!configEntry) {
      console.info(`[ARK_StatusBar] Creating ${CONFIG_ENTRY_FULL_NAME}...`);
      const initConfig: ArkConfig = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };

      // 创建新的配置条目（保持关闭状态，作为纯数据容器使用）
      await createWorldbookEntries(this.targetWorldbook, [
        {
          name: CONFIG_ENTRY_FULL_NAME,
          comment: CONFIG_ENTRY_FULL_NAME,
          content: JSON.stringify(initConfig, null, 2),
          enabled: false,
          constant: false,
        },
      ]);
      this.currentConfig = initConfig;
    } else {
      try {
        this.currentConfig = JSON.parse(configEntry.content);
        // 合并默认配置，以防新版本新增了字段
        this.currentConfig = { ...DEFAULT_CONFIG, ...this.currentConfig };
      } catch (e) {
        console.error('[ARK_StatusBar] Failed to parse config JSON, using default:', e);
        this.currentConfig = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };
      }
    }

    if (this.onConfigUpdate && this.currentConfig) {
      this.onConfigUpdate(this.currentConfig);
    }
    // 派发全局事件通知 UI 更新配置
    document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: this.currentConfig }));

    // 如果系统和拦截器都处于开启状态，则绑定物理事件拦截
    if (this.currentConfig?.isSystemEnabled && this.currentConfig?.isInterceptorEnabled) {
      this.bindInterceptor();
    }
  }

  /**
   * 保存配置到世界书中，并触发更新事件。
   */
  async saveConfig(configUpdate: Partial<ArkConfig>) {
    if (!this.targetWorldbook || !this.currentConfig) return;
    this.currentConfig = { ...this.currentConfig, ...configUpdate, lastUpdateTime: Date.now() };

    try {
      await updateWorldbookWith(this.targetWorldbook, (wbEntries: any[]) => {
        const entry = wbEntries.find(
          e =>
            (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) ||
            (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
        );
        if (entry) {
          entry.content = JSON.stringify(this.currentConfig, null, 2);
          entry.enabled = false;
        }
        return wbEntries;
      });
      if (this.onConfigUpdate) {
        this.onConfigUpdate(this.currentConfig);
      }
      document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: this.currentConfig }));

      // 根据配置决定是否重新绑定或解绑拦截器
      if (this.currentConfig.isSystemEnabled && this.currentConfig.isInterceptorEnabled) {
        this.bindInterceptor();
      } else {
        this.unbindInterceptor();
      }
    } catch (error) {
      console.error('[ARK_StatusBar] Failed to save config:', error);
    }
  }

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
          await this.loadOrInitConfig();
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
      if (this.currentConfig?.suppressNextDiffWarning) {
        console.info('[ARK_StatusBar] Suppressing diff warning as requested.');
        await this.saveConfig({ suppressNextDiffWarning: false });
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
   * 同时，任何改变执行流的新逻辑，必须调用 `this.logDebug()` 埋点，以便开发者定位问题。
   */
  private async executeDualTrackDryRun(isManualTest: boolean, text: string) {
    if (this.isDryRunning) {
      console.warn('[ARK_StatusBar] Dry run is already in progress. Ignoring concurrent request.');
      this.logDebug('executeDualTrackDryRun_IGNORE_CONCURRENT', null);
      return;
    }

    this.isDryRunning = true;
    this.logDebug('executeDualTrackDryRun_START', { isManualTest, textLength: text.length });

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

      this.logDebug('executeDualTrackDryRun_CONTEXT', {
        hasContext: !!context,
        hasWorldInfoFn: !!worldInfoFn,
        hasGenerateFn: !!generateFn,
      });

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
        this.logDebug('executeDualTrackDryRun_RAW_ENTRIES_RECEIVED', raw);

        // 需求1: 精确匹配 world 名称，抛弃不属于目标世界书的乱入词条
        const targetWb = this.targetWorldbook;
        activatedEntries = raw.filter((e: any) => e.world === targetWb);
        this.logDebug('executeDualTrackDryRun_FILTERED_ENTRIES', { targetWb, filteredCount: activatedEntries.length });
      };

      const eventTarget = window.parent?.document || document;
      eventTarget.addEventListener('world_info_activated', worldInfoListener);
      // @ts-ignore
      if (typeof eventOn === 'function') eventOn('world_info_activated', worldInfoListener);

      const timeoutError = new Error('DRY_RUN_TIMEOUT');

      // 包装世界书干跑为带超时的 Promise
      const worldInfoPromise = async () => {
        this.logDebug('executeDualTrackDryRun_BEFORE_AWAIT_WORLDINFO', null);
        await worldInfoFn(mockChat, 1000000, false);
        this.logDebug('executeDualTrackDryRun_AFTER_AWAIT_WORLDINFO', null);
      };

      try {
        await Promise.race([
          worldInfoPromise(),
          new Promise((_, reject) => setTimeout(() => reject(timeoutError), 5000)),
        ]);
      } catch (error) {
        if (error === timeoutError) {
          console.warn('[ARK_StatusBar] World Info dry run timeout after 5s.');
          this.logDebug('executeDualTrackDryRun_TIMEOUT_WORLDINFO', null);
        } else {
          console.error('[ARK_StatusBar] World Info dry run failed', error);
          this.logDebug('executeDualTrackDryRun_ERROR_WORLDINFO', error);
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

        this.logDebug('executeDualTrackDryRun_PROMPT_READY', {
          chatLength: data.chat?.length,
          promptLength: data.prompt?.length,
        });

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
            this.logDebug('executeDualTrackDryRun_TOKEN_CALCULATED', tokenCount);
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
          this.logDebug('executeDualTrackDryRun_BEFORE_AWAIT_GENERATE', null);
          await generateFn('normal', {}, true);
          this.logDebug('executeDualTrackDryRun_AFTER_AWAIT_GENERATE', null);
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
          this.logDebug('executeDualTrackDryRun_TIMEOUT_GENERATE', null);
        } else {
          console.error('[ARK_StatusBar] Prompt Token dry run failed', error);
          tokenCount = '干跑失败';
          this.logDebug('executeDualTrackDryRun_ERROR_GENERATE', error);
        }
      } finally {
        eventTarget.removeEventListener('chat_completion_prompt_ready', promptReadyListener);
        // @ts-ignore
        if (typeof eventOff === 'function') eventOff('chat_completion_prompt_ready', promptReadyListener);
      }

      this.logDebug('executeDualTrackDryRun_END_DISPATCH', {
        finalActivatedCount: activatedEntries?.length,
        tokenCount,
      });

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
          this.logDebug('executeDualTrackDryRun_SILENT_PASS', null);
          this.releaseInterceptAndSend();
        }
      }
    } finally {
      // 无论成功、失败还是超时，永远释放干跑锁
      this.isDryRunning = false;
      this.logDebug('executeDualTrackDryRun_FINALLY_UNLOCK', null);
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

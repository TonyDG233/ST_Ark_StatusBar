import { unref } from 'vue';
import { useArkConfig } from '../../core/config_store';
import { ArkEventBus } from '../../core/event_bus';
import { WorldbookMapper } from './worldbook_mapper';

/**
 * 拦截与干跑逻辑服务
 * 从原来的 StatusBarManager 中剥离，专门负责截获发送动作、执行双轨干跑。
 */
class SendInterceptor {
  private static instance: SendInterceptor;
  private isDryRunning: boolean = false;
  private interceptorBound: boolean = false;

  private constructor() {
    // 监听内部事件：当配置变更导致拦截器开关变化时，自动绑定或解绑
    ArkEventBus.on('config:interceptor_state_changed', shouldEnable => {
      if (shouldEnable) {
        this.bindInterceptor();
      } else {
        this.unbindInterceptor();
      }
    });
  }

  static getInstance(): SendInterceptor {
    if (!SendInterceptor.instance) {
      SendInterceptor.instance = new SendInterceptor();
    }
    return SendInterceptor.instance;
  }

  /**
   * 运行“主动检测”流程 (Manual Test)。
   */
  public async runManualTest() {
    console.info('[ARK_Interceptor] Running manual test...');
    const ST_DOC = window.parent?.document || document;
    const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
    const text = textarea?.value?.trim() || '';

    await this.executeDualTrackDryRun(true, text);
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
      console.info('[ARK_Interceptor] Releasing interceptor and sending...');
      sendBtn.click(); // 执行真实的原生发送逻辑
      // 延迟重新挂载拦截器，防止死循环
      setTimeout(() => {
        const currentConfig = unref(useArkConfig());
        if (currentConfig?.isInterceptorEnabled) {
          this.bindInterceptor();
        }
      }, 500);
    }
  }

  /**
   * 用户点击发送按钮或按下回车时触发拦截的 Handler
   * （使用事件委托在 document 上捕获，防止 ST 动态重建 DOM 导致监听丢失）
   */
  private handleIntercept = async (e: Event) => {
    const target = e.target as HTMLElement;
    
    // 判断事件目标是否为发送按钮（或其内部图标）或输入框
    const isSendBtn = target.id === 'send_but' || !!target.closest('#send_but');
    const isTextarea = target.id === 'send_textarea';

    // 如果不是我们关心的元素触发的事件，直接放行
    if (!isSendBtn && !isTextarea) return;

    const ST_DOC = window.parent?.document || document;
    const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
    const text = textarea?.value?.trim() || '';
    const currentConfig = unref(useArkConfig());

    if (isTextarea && e.type.startsWith('key')) {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Enter') {
        // 守护判断：如果未开启回车拦截，或者是换行 (shift+Enter)，则完全放行
        if (!currentConfig?.enableEnterToIntercept || keyboardEvent.shiftKey) {
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
    } else if (isSendBtn && e.type === 'click') {
      // 这是点击 Send 按钮的事件
      e.preventDefault();
      e.stopImmediatePropagation();
    } else {
      // 忽略不相关的组合事件，如 textarea 的 click，或 sendBtn 的 keydown
      return;
    }

    if (!text) return;

    console.info('[ARK_Interceptor] Generation intercepted! Running dual track dry run...');
    await this.executeDualTrackDryRun(false, text);
  };

  /**
   * 将拦截逻辑通过事件委托绑定到 document。
   * 这样可以防止 SillyTavern 动态重新渲染 DOM 导致原本直接绑定的元素丢失监听器。
   * 采用捕获阶段(true)优先拿到事件，并在多个键相上挂载以彻底屏蔽。
   */
  public bindInterceptor() {
    if (this.interceptorBound) return;
    const ST_DOC = window.parent?.document || document;

    ST_DOC.addEventListener('click', this.handleIntercept, true);
    ST_DOC.addEventListener('keydown', this.handleIntercept, true);
    ST_DOC.addEventListener('keypress', this.handleIntercept, true);
    ST_DOC.addEventListener('keyup', this.handleIntercept, true);
    this.interceptorBound = true;
    console.info('[ARK_Interceptor] Interceptor bound using event delegation.');
  }

  /**
   * 解绑拦截器。
   */
  public unbindInterceptor() {
    if (!this.interceptorBound) return;
    const ST_DOC = window.parent?.document || document;

    ST_DOC.removeEventListener('click', this.handleIntercept, true);
    ST_DOC.removeEventListener('keydown', this.handleIntercept, true);
    ST_DOC.removeEventListener('keypress', this.handleIntercept, true);
    ST_DOC.removeEventListener('keyup', this.handleIntercept, true);
    this.interceptorBound = false;
    console.info('[ARK_Interceptor] Interceptor unbound.');
  }

  /**
   * 提取公共的双轨并行干跑流程 (需求1 & 需求4)
   *
   * @note [给后续 Agent 的警告]：此函数在移动端极易发生异步执行流死锁（由于酒馆内核超时或异常未回传）。
   * 所有新增的异步逻辑，必须包裹在 `Promise.race` 超时防假死结构中。
   * 同时，任何改变执行流的新逻辑，必须调用 `logger.logDebug()` 埋点，以便开发者定位问题。
   */
  private async executeDualTrackDryRun(isManualTest: boolean, text: string) {
    if (this.isDryRunning) {
      console.warn('[ARK_Interceptor] Dry run is already in progress. Ignoring concurrent request.');
      ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_IGNORE_CONCURRENT', false);
      return;
    }

    this.isDryRunning = true;
    ArkEventBus.emit(
      'log:debug',
      `executeDualTrackDryRun_START | isManualTest:${isManualTest} | length:${text.length}`,
      false,
    );

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

      ArkEventBus.emit(
        'log:debug',
        `executeDualTrackDryRun_CONTEXT | hasContext:${!!context} | hasWorldInfoFn:${!!worldInfoFn} | hasGenerateFn:${!!generateFn}`,
        false,
      );

      if (!worldInfoFn) {
        console.warn('[ARK_Interceptor] Required API getWorldInfoPrompt not available.');
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

      // 【防重复冒出修复】：不仅要接收被激活的条目，还要处理酒馆在内部运算中（比如分层扫描 Depth、Keyword、Token 等计算）
      // 可能多次发射 world_info_activated 事件的问题。我们不能仅仅覆盖或者追加，而应当以 uid + world 或 uid + name 的复合键去重。
      let activatedEntries: any[] = [];
      const worldInfoListener = (evt: any) => {
        const raw = evt.detail || evt;
        ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_RAW_ENTRIES_RECEIVED', false);

        if (Array.isArray(raw)) {
          // 由于原逻辑是 `activatedEntries = raw || []`（覆盖），而我们在防线修复中改成了合并（push），
          // 如果某次检测（比如主动检测）在内部循环中引发了多轮 `world_info_activated`（例如：常驻检查一轮、深度检查一轮），
          // 这会导致重复推入。同时，酒馆助手（或Tavern原系统）有时会直接发送之前累积的结果（比如上一次点击或者重试的结果），
          // 这也是为什么 4 个世界书会导致 6 个甚至更多重复内容冒出的原因之一（多轮次累加或者缓存穿透）。

          // 【彻底隔离】因此我们不再盲目追加。我们应当认识到：`world_info_activated` 传递的 `raw` 已经是**本次计算最终的所有激活条目聚合**。
          // 原本 `activatedEntries = raw` 的逻辑其实在处理单轮发射时是对的，
          // 但因为有些酒馆版本/插件可能多次触发它，我们只需要【取出最后一次触发、或者直接用其自带的结构去重】即可。
          // 最安全的做法：每次收到事件时，以当前 `raw` 中的数组为基准覆盖，但对 `raw` 本身进行深度去重，
          // 确保这一批次的数据没有多本同名书籍导入时带来的垃圾副本。

          const uniqueMap = new Map();
          for (const newEntry of raw) {
            // 洗净并映射回标准结构
            const mapped = WorldbookMapper.fromFlattenedNative(newEntry);
            const entryWorld = (newEntry as any).world || 'UnknownWorld';
            // 添加 UI 强相关的辅助字段
            (mapped as any).world = entryWorld;

            // 唯一键组合：所在的Worldbook名 + 本身的UID + (名字或备注防止无ID的特殊条目)
            const newKey = `${entryWorld}_${mapped.uid}_${mapped.name}`;
            if (!uniqueMap.has(newKey)) {
              uniqueMap.set(newKey, mapped);
            }
          }
          activatedEntries = Array.from(uniqueMap.values());
        }

        ArkEventBus.emit('log:debug', `executeDualTrackDryRun_ALL_ENTRIES | count:${activatedEntries.length}`, false);
      };

      const eventTarget = window.parent?.document || document;
      eventTarget.addEventListener('world_info_activated', worldInfoListener);
      // @ts-ignore
      if (typeof eventOn === 'function') eventOn('world_info_activated', worldInfoListener);

      const timeoutError = new Error('DRY_RUN_TIMEOUT');

      // 包装世界书干跑为带超时的 Promise
      const worldInfoPromise = async () => {
        ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_BEFORE_AWAIT_WORLDINFO', false);
        await worldInfoFn(mockChat, 1000000, false);
        ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_AFTER_AWAIT_WORLDINFO', false);
      };

      try {
        await Promise.race([
          worldInfoPromise(),
          new Promise((_, reject) => setTimeout(() => reject(timeoutError), 5000)),
        ]);
      } catch (error) {
        if (error === timeoutError) {
          console.warn('[ARK_Interceptor] World Info dry run timeout after 5s.');
          ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_TIMEOUT_WORLDINFO', false);
        } else {
          console.error('[ARK_Interceptor] World Info dry run failed', error);
          ArkEventBus.emit('log:debug', `executeDualTrackDryRun_ERROR_WORLDINFO: ${error}`, false);
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

        ArkEventBus.emit(
          'log:debug',
          `executeDualTrackDryRun_PROMPT_READY | chatLength:${data.chat?.length} | promptLength:${data.prompt?.length}`,
          false,
        );

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
            ArkEventBus.emit('log:debug', `executeDualTrackDryRun_TOKEN_CALCULATED | count:${tokenCount}`, false);
          } else {
            tokenCount = 'API失效';
          }
        } catch (e) {
          console.error('[ARK_Interceptor] Failed to count tokens', e);
          tokenCount = '计算失败';
        }
      };

      eventTarget.addEventListener('chat_completion_prompt_ready', promptReadyListener);
      // @ts-ignore
      if (typeof eventOn === 'function') eventOn('chat_completion_prompt_ready', promptReadyListener);

      const generatePromise = async () => {
        if (generateFn) {
          ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_BEFORE_AWAIT_GENERATE', false);
          await generateFn('normal', {}, true);
          ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_AFTER_AWAIT_GENERATE', false);
        } else {
          console.warn('[ARK_Interceptor] generate API not available, skipping precise token count.');
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
          console.warn('[ARK_Interceptor] Prompt Token dry run timeout after 8s.');
          tokenCount = '计算超时';
          ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_TIMEOUT_GENERATE', false);
        } else {
          console.error('[ARK_Interceptor] Prompt Token dry run failed', error);
          tokenCount = '干跑失败';
          ArkEventBus.emit('log:debug', `executeDualTrackDryRun_ERROR_GENERATE: ${error}`, false);
        }
      } finally {
        eventTarget.removeEventListener('chat_completion_prompt_ready', promptReadyListener);
        // @ts-ignore
        if (typeof eventOff === 'function') eventOff('chat_completion_prompt_ready', promptReadyListener);
      }

      ArkEventBus.emit(
        'log:debug',
        `executeDualTrackDryRun_END_DISPATCH | finalActivatedCount:${activatedEntries?.length} | tokenCount:${tokenCount}`,
        false,
      );

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
          ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_SILENT_PASS', false);
          this.releaseInterceptAndSend();
        }
      }
    } finally {
      // 无论成功、失败还是超时，永远释放干跑锁
      this.isDryRunning = false;
      ArkEventBus.emit('log:debug', 'executeDualTrackDryRun_FINALLY_UNLOCK', false);
    }
  }
}

export const sendInterceptor = SendInterceptor.getInstance();

import { unref } from 'vue';
import { useArkConfig } from '../../store/config_store';
import { UIWorldbookEntry, useUIStateStore } from '../../store/ui_state_store';
import { WorldbookMapper } from './worldbook_mapper';

/**
 * 拦截与干跑逻辑服务
 * 从原来的 StatusBarManager 中剥离，专门负责截获发送动作、执行双轨干跑。
 */
export class SendInterceptor {
  private static instance: SendInterceptor;
  private isDryRunning: boolean = false;
  private interceptorBound: boolean = false;
  public tempDisabledEntries: { uid: number; world: string }[] = [];

  public addTempDisabledEntry(uid: number, world: string) {
    if (!this.tempDisabledEntries.find(e => e.uid === uid && e.world === world)) {
      this.tempDisabledEntries.push({ uid, world });
    }
  }

  public removeTempDisabledEntry(uid: number, world: string) {
    const idx = this.tempDisabledEntries.findIndex(e => e.uid === uid && e.world === world);
    if (idx !== -1) {
      this.tempDisabledEntries.splice(idx, 1);
    }
  }

  public async toggleEntrySilent(entry: any, targetWorldbook: string) {
    try {
      await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
        const e = wbEntries.find(x => x.uid === entry.uid);
        if (e) e.enabled = entry.enabled;
        return wbEntries;
      });
      document.dispatchEvent(
        new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }),
      );
    } catch (e) {
      console.error('[ARK_Interceptor] Failed to toggle entry silently', e);
    }
  }

  public async cancelSend() {
    if (this.tempDisabledEntries.length > 0) {
      for (const tempInfo of this.tempDisabledEntries) {
        if (tempInfo.world) {
          try {
            await updateWorldbookWith(tempInfo.world, (wbEntries: any[]) => {
              const targetEntry = wbEntries.find(x => x.uid === tempInfo.uid);
              if (targetEntry) {
                targetEntry.enabled = true;
              }
              return wbEntries;
            });
            document.dispatchEvent(
              new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: tempInfo.world } }),
            );
          } catch (e) {
            console.error('[ARK_Interceptor] Failed to restore temp disabled entry on cancel:', e);
          }
        }
      }
      this.tempDisabledEntries = [];
    }
  }

  private constructor() {
    // 监听内部事件：当配置变更导致拦截器开关变化时，自动绑定或解绑
    document.addEventListener('ark:config-interceptor-state-changed', e => {
      if (e.detail.shouldEnable) {
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
   * 记录拦截历史（暴露为单独方法以方便未来改写为 IndexedDB 等落盘机制）
   * @param entriesToLog 触发的世界书条目
   * @param tokenCount 对应的 Token 开销
   */
  public recordInterceptHistory(entriesToLog: UIWorldbookEntry[], tokenCount: number | string = 0) {
    if (!entriesToLog || entriesToLog.length === 0) return;

    const uiStore = useUIStateStore();
    const newLog = {
      timestamp: Date.now(),
      entries: entriesToLog,
      tokenCount: tokenCount,
    };

    uiStore.recentTriggerLogs.unshift(newLog);
    if (uiStore.recentTriggerLogs.length > 20) {
      uiStore.recentTriggerLogs.pop();
    }
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
  public releaseInterceptAndSend(entriesToLog?: UIWorldbookEntry[], tokenCount?: number | string) {
    // 调用统一入口写入历史记录
    if (entriesToLog && entriesToLog.length > 0) {
      this.recordInterceptHistory(entriesToLog, tokenCount);
    }

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
      document.dispatchEvent(
        new CustomEvent('ark:log-debug', {
          detail: { message: 'executeDualTrackDryRun_IGNORE_CONCURRENT', isDryRun: false },
        }),
      );
      return;
    }

    this.isDryRunning = true;
    const currentRunId = Date.now(); // 生成请求流水号，防事件穿透
    const currentConfig = unref(useArkConfig());

    document.dispatchEvent(
      new CustomEvent('ark:log-debug', {
        detail: {
          message: `executeDualTrackDryRun_START | runId:${currentRunId} | isManualTest:${isManualTest} | length:${text.length}`,
          isDryRun: false,
        },
      }),
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

      document.dispatchEvent(
        new CustomEvent('ark:log-debug', {
          detail: {
            message: `executeDualTrackDryRun_CONTEXT | hasContext:${!!context} | hasWorldInfoFn:${!!worldInfoFn} | hasGenerateFn:${!!generateFn}`,
            isDryRun: false,
          },
        }),
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

      let activatedEntries: any[] = [];
      const worldInfoListener = (evt: any) => {
        // 如果我们收到的事件不是本次请求引发的，丢弃它（防穿透）
        if (!this.isDryRunning) return;

        const raw = evt.detail || evt;
        document.dispatchEvent(
          new CustomEvent('ark:log-debug', {
            detail: { message: 'executeDualTrackDryRun_RAW_ENTRIES_RECEIVED', isDryRun: false },
          }),
        );

        if (Array.isArray(raw)) {
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

        document.dispatchEvent(
          new CustomEvent('ark:log-debug', {
            detail: {
              message: `executeDualTrackDryRun_ALL_ENTRIES | count:${activatedEntries.length}`,
              isDryRun: false,
            },
          }),
        );
      };

      const eventTarget = window.parent?.document || document;
      eventTarget.addEventListener('world_info_activated', worldInfoListener);
      // @ts-ignore
      if (typeof eventOn === 'function') eventOn('world_info_activated', worldInfoListener);

      const timeoutError = new Error('DRY_RUN_TIMEOUT');

      // 包装世界书干跑为带超时的 Promise
      const worldInfoPromise = async () => {
        document.dispatchEvent(
          new CustomEvent('ark:log-debug', {
            detail: { message: 'executeDualTrackDryRun_BEFORE_AWAIT_WORLDINFO', isDryRun: false },
          }),
        );
        // CRITICAL FIX: 绑定 context 并补充 globalScanData 避免新版 ST/TT 出现 globalScanData 未定义错误
        // 同时必须传纯字符串数组，否则 ST 内核在调用 .trim() 时会抛出 TypeError
        await worldInfoFn.call(context, mockChat, 1000000, false, { trigger: 'ark_dry_run' });
        document.dispatchEvent(
          new CustomEvent('ark:log-debug', {
            detail: { message: 'executeDualTrackDryRun_AFTER_AWAIT_WORLDINFO', isDryRun: false },
          }),
        );
      };

      try {
        await Promise.race([
          worldInfoPromise(),
          // 第一轨超时拉长到 10s
          new Promise((_, reject) => setTimeout(() => reject(timeoutError), 10000)),
        ]);
      } catch (error) {
        if (error === timeoutError) {
          console.warn(`[ARK_Interceptor] [RunID:${currentRunId}] World Info dry run timeout after 10s.`);
          document.dispatchEvent(
            new CustomEvent('ark:log-debug', {
              detail: { message: 'executeDualTrackDryRun_TIMEOUT_WORLDINFO', isDryRun: false },
            }),
          );
          // 致命错误：超时不可原谅，绝对不能静默放行
          if (typeof toastr !== 'undefined') {
            toastr.error('世界书检测超时，请检查配置或稍后重试。', 'ARK 发送拦截器阻断');
          }
          return; // 终止整个管线，绝不执行 releaseInterceptAndSend
        } else {
          console.error(`[ARK_Interceptor] [RunID:${currentRunId}] World Info dry run failed`, error);
          document.dispatchEvent(
            new CustomEvent('ark:log-debug', {
              detail: { message: `executeDualTrackDryRun_ERROR_WORLDINFO: ${error}`, isDryRun: false },
            }),
          );
          if (typeof toastr !== 'undefined') toastr.error('世界书检测出错，拦截已中止。');
          return;
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

      // 用户可以配置关闭以提升发信体验
      if (currentConfig?.enableTokenCalculator) {
        const promptReadyListener = async (evt: any) => {
          if (!this.isDryRunning) return; // 防穿透

          const data = evt.detail || evt;
          if (!data.dryRun) return;

          document.dispatchEvent(
            new CustomEvent('ark:log-debug', {
              detail: {
                message: `executeDualTrackDryRun_PROMPT_READY | chatLength:${data.chat?.length} | promptLength:${data.prompt?.length}`,
                isDryRun: false,
              },
            }),
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
              document.dispatchEvent(
                new CustomEvent('ark:log-debug', {
                  detail: { message: `executeDualTrackDryRun_TOKEN_CALCULATED | count:${tokenCount}`, isDryRun: false },
                }),
              );
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
            // ==========================================
            // [新老模式并行兼容分支]: 判断当前所处的酒馆版本
            // ==========================================
            // 在 ST 1.18+ / TauriTavern 版本中，原生 generateFn 被包裹成了 `safeGenerate`。
            // 它引入了异步队列和 `waitForIdle()`。在拦截器（事件冻结期）内调用会导致长达 15s 的死锁/假死。
            // 因此，如果是 1.18+，我们采用“模块拼合估算法”（新模式）；如果是 1.16，采用原生干跑（老模式）。
            if (generateFn.name === 'safeGenerate') {
              console.warn('[ARK_Interceptor] 探测到 1.18+ safeGenerate，切换至高速 Token 估算模式以避免死锁。');
              
              let payloadString = '';

              // 1. 尝试抓取系统预设提示词 (排除闲杂项)
              try {
                // @ts-ignore
                if (typeof getPreset === 'function') {
                  // @ts-ignore
                  const preset = getPreset('in_use');
                  if (preset && preset.prompts) {
                    const sysPrompts = preset.prompts.filter((p: any) => p.enabled && ['main', 'nsfw', 'jailbreak', 'enhanceDefinitions'].includes(p.id));
                    payloadString += sysPrompts.map((p: any) => p.content || '').join('\n') + '\n';
                  }
                }
              } catch (e) { console.warn('[ARK_Interceptor] 获取预设失败', e); }

              // 2. 尝试抓取角色卡设定 (注意：不提取 first_messages，因为它已包含在聊天记录中)
              try {
                // @ts-ignore
                if (typeof getCurrentCharacterName === 'function' && typeof getCharacter === 'function') {
                  // @ts-ignore
                  const charName = getCurrentCharacterName();
                  if (charName) {
                    // 补充官方类型文件中遗漏的 V2 属性
                    type STCharacterExt = typeof charName & { personality?: string; scenario?: string; description?: string };
                    // @ts-ignore
                    const char = (await getCharacter(charName)) as STCharacterExt;
                    if (char) {
                      payloadString += (char.description || '') + '\n' + (char.personality || '') + '\n' + (char.scenario || '') + '\n';
                    }
                  }
                }
              } catch (e) { console.warn('[ARK_Interceptor] 获取角色设定失败', e); }

              // 3. 尝试抓取近期聊天记录 (仅抓取最近 8 楼，模拟受限的记忆窗口)
              try {
                // @ts-ignore
                if (typeof getChatMessages === 'function') {
                  // @ts-ignore
                  const msgs = getChatMessages(-8);
                  payloadString += msgs.map((m: { name: string; message: string }) => `${m.name}: ${m.message}`).join('\n') + '\n';
                } else {
                  // 兜底方案：如果没获取到 API，用 mockChat 截取最后 8 行 (注意 mockChat 已经被 reverse 过了)
                  const recentChat = mockChat.slice(0, 8).reverse(); 
                  payloadString += recentChat.join('\n') + '\n';
                }
              } catch (e) { console.warn('[ARK_Interceptor] 获取聊天记录失败', e); }

              // 4. 拼接本次触发的世界书条目与当前用户的文本输入
              payloadString += activatedEntries.map(e => e.content || '').join('\n') + '\n';
              if (text) {
                const userName = typeof SillyTavern !== 'undefined' ? SillyTavern.name1 : 'User';
                payloadString += `${userName}: ${text}\n`;
              }

              console.log(`[ARK_Interceptor] 正在估算 Token，拼接的文本总长度为: ${payloadString.length}`);

              // 5. 调用原生计算器进行文本过秤
              try {
                if (typeof SillyTavern !== 'undefined' && typeof (SillyTavern as any).getTokenCountAsync === 'function') {
                  const count = await (SillyTavern as any).getTokenCountAsync(payloadString);
                  // 经确认，原先 UI 样式自带波浪号且能完美容纳纯数字，
                  // 估算误差在 300-500 左右，可接受，因此直接返回数字即可，不附加额外的前缀。
                  tokenCount = count; 
                  
                  document.dispatchEvent(
                    new CustomEvent('ark:log-debug', {
                      detail: { message: `executeDualTrackDryRun_FAST_ESTIMATE | length:${payloadString.length} | count:${tokenCount}`, isDryRun: false },
                    }),
                  );
                } else {
                  tokenCount = '跳过计算';
                }
              } catch (e) {
                console.error('[ARK_Interceptor] Token 估算失败', e);
                tokenCount = '计算出错';
              }
              
              return; // 新模式在此完成 Track 2，直接返回
            }

            // ==========================================
            // [老模式]: 保留原生的干跑生成（适配 ST 1.16 等无死锁的老版本）
            // ==========================================
            document.dispatchEvent(
              new CustomEvent('ark:log-debug', {
                detail: { message: 'executeDualTrackDryRun_BEFORE_AWAIT_GENERATE', isDryRun: false },
              }),
            );
            await generateFn('normal', {}, true);
            document.dispatchEvent(
              new CustomEvent('ark:log-debug', {
                detail: { message: 'executeDualTrackDryRun_AFTER_AWAIT_GENERATE', isDryRun: false },
              }),
            );
          } else {
            console.warn('[ARK_Interceptor] generate API not available, skipping precise token count.');
            tokenCount = '未获取到API';
          }
        };

        try {
          await Promise.race([
            generatePromise(),
            // 第二轨超时。还原为 15s 以满足老版本原生的长文本等待（新模式瞬间返回，不受此影响）。
            new Promise((_, reject) => setTimeout(() => reject(timeoutError), 15000)),
          ]);
        } catch (error) {
          if (error === timeoutError) {
            console.warn(`[ARK_Interceptor] [RunID:${currentRunId}] Prompt Token dry run timeout after 15s.`);
            tokenCount = '计算超时';
            document.dispatchEvent(
              new CustomEvent('ark:log-debug', {
                detail: { message: 'executeDualTrackDryRun_TIMEOUT_GENERATE', isDryRun: false },
              }),
            );
            // 注意：Token计算超时并不致命，不需要阻断发送，记录状态即可
          } else {
            console.error(`[ARK_Interceptor] [RunID:${currentRunId}] Prompt Token dry run failed`, error);
            tokenCount = '干跑失败';
            document.dispatchEvent(
              new CustomEvent('ark:log-debug', {
                detail: { message: `executeDualTrackDryRun_ERROR_GENERATE: ${error}`, isDryRun: false },
              }),
            );
          }
        } finally {
          eventTarget.removeEventListener('chat_completion_prompt_ready', promptReadyListener);
          // @ts-ignore
          if (typeof eventOff === 'function') eventOff('chat_completion_prompt_ready', promptReadyListener);
        }
      } else {
        tokenCount = '计算已关闭';
      }

      document.dispatchEvent(
        new CustomEvent('ark:log-debug', {
          detail: {
            message: `executeDualTrackDryRun_END_DISPATCH | finalActivatedCount:${activatedEntries?.length} | tokenCount:${tokenCount}`,
            isDryRun: false,
          },
        }),
      );

      // ==========================================
      // 终点：仲裁过滤与统合抛出预警结果 (接管了原先 UI 的工作)
      // ==========================================

      const getEntryType = (entry: any) => {
        if (entry.constant === true) return 'constant';
        if (entry.constant === false) return 'selective';
        return entry.strategy?.type || 'selective';
      };

      // 无论主动检测还是拦截，先洗出需要处理的条目
      let matchedEntries = activatedEntries.map((raw: any) => {
        raw.enabled = raw.enabled !== false;
        if (!raw.strategy) raw.strategy = {};
        return raw;
      });

      // 根据配置，过滤不需要展示预警的常驻条目
      if (!currentConfig?.showConstantEntries) {
        matchedEntries = matchedEntries.filter((entry: any) => getEntryType(entry) !== 'constant');
      }

      if (isManualTest) {
        // 主动检测永远抛出给 UI 展示（即便是空结果）
        const event = new CustomEvent('ark-interceptor-triggered', {
          detail: { entries: matchedEntries, isManualTest: true, tokenCount },
        });
        document.dispatchEvent(event);
      } else {
        if (matchedEntries.length > 0) {
          // 有实质性的拦截预警，交给 UI 处理
          const event = new CustomEvent('ark-interceptor-triggered', {
            detail: { entries: matchedEntries, isManualTest: false, tokenCount },
          });
          document.dispatchEvent(event);
        } else {
          // 【核心控制流】：如果没有触发任何需要预警的词条，由后端主动放行
          document.dispatchEvent(
            new CustomEvent('ark:log-debug', {
              detail: { message: 'executeDualTrackDryRun_SILENT_PASS', isDryRun: false },
            }),
          );
          this.releaseInterceptAndSend(matchedEntries, tokenCount);
        }
      }
    } finally {
      // 无论成功、失败还是超时，永远释放干跑锁
      this.isDryRunning = false;
      document.dispatchEvent(
        new CustomEvent('ark:log-debug', {
          detail: { message: 'executeDualTrackDryRun_FINALLY_UNLOCK', isDryRun: false },
        }),
      );
    }
  }
}

export const sendInterceptor = SendInterceptor.getInstance();

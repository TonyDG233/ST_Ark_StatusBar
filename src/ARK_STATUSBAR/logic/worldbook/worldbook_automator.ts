import { configStore, useArkConfig } from '../../core/config_store';
import { BASELINE_STATE } from '../../data/baseline';
import { normalizeCompare } from './entry_service';

/**
 * 专门负责暗中监听酒馆原生事件并执行状态补偿的自动化组件。
 * 从 StatusBarManager 中剥离，确保门面绝对纯净。
 */
class WorldbookAutomator {
  private eventsBound: boolean = false;

  /**
   * 启动监听器
   * @param getTargetWorldbook 获取当前目标世界书名称的函数
   */
  public startWatching(
    getTargetWorldbook: () => string | null,
    getTempDisabledEntries: () => { uid: number; world: string }[],
    clearTempDisabledEntries: () => void,
  ) {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // 监听生成结束事件：恢复“临时阻断”的世界书条目
    eventOn(tavern_events.GENERATION_ENDED, async () => {
      const tempDisabled = getTempDisabledEntries();
      if (tempDisabled.length > 0) {
        console.info('[ARK_Automator] Restoring temp disabled entries after generation...');
        const entriesToRestore = [...tempDisabled];
        clearTempDisabledEntries(); // 立即清空，防止重入

        try {
          // 根据不同的世界书分类恢复
          const worldGroups = entriesToRestore.reduce(
            (acc, curr) => {
              if (!acc[curr.world]) acc[curr.world] = [];
              acc[curr.world].push(curr.uid);
              return acc;
            },
            {} as Record<string, number[]>,
          );

          let hasFailures = false;
          const failedItems: { world: string; uid: number }[] = [];

          for (const [worldName, uids] of Object.entries(worldGroups)) {
            try {
              await updateWorldbookWith(worldName, wbEntries => {
                for (const uid of uids) {
                  const entry = wbEntries.find(e => e.uid === uid);
                  if (entry) {
                    entry.enabled = true;
                  } else {
                    hasFailures = true;
                    failedItems.push({ world: worldName, uid });
                  }
                }
                return wbEntries;
              });

              // 抛出内部自定义事件：后端主动修改了底层数据，通知 UI 层刷新
              document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: worldName } }));
            } catch (err) {
              hasFailures = true;
              failedItems.push(...uids.map(uid => ({ world: worldName, uid })));
            }
          }

          // 如果还原有失败的（比如世界书被删了或者临时故障），就扔一条 Commit 提醒用户
          if (hasFailures) {
            console.error('[ARK_Automator] Some temp disabled entries failed to restore:', failedItems);
            const currentConfig = useArkConfig().value;
            if (currentConfig) {
              const newCommit = {
                id: Math.random().toString(36).substr(2, 6),
                timestamp: Date.now(),
                description: `[警告] 拦截器单次屏蔽恢复失败`,
                worldbook: 'System',
                changes: failedItems.map(item => ({
                  uid: item.uid,
                  comment: `World: ${item.world}`,
                  from: false,
                  to: false, // 没能开启
                })),
              };
              const commits = [...(currentConfig.commits || []), newCommit];
              configStore.updateConfig({ commits });
            }
          }
        } catch (e) {
          console.error('[ARK_Automator] Failed to process temp disabled entries restoration', e);
        }
      } else {
        // 如果没有临时阻断的条目，也要抛出一个事件以便 UI 能够响应生成结束，比如取消某些 loading 状态
        const targetWorldbook = getTargetWorldbook();
        if (targetWorldbook) {
          document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }));
        }
      }
    });

    // 监听酒馆原生 CHAT_CHANGED 事件（切换聊天或重新加载时）
    eventOn(tavern_events.CHAT_CHANGED, async () => {
      console.info('[ARK_Automator] Chat changed, checking baseline diff and reloading...');

      try {
        const targetWorldbook = getTargetWorldbook();
        if (targetWorldbook) {
          await configStore.loadOrInitConfig(targetWorldbook);
          await this.checkBaselineDiff(targetWorldbook); // 检查当前状态是否偏离了设定的 Baseline
          
          // 等待所有的重度加载和比较工作（await）全部结束之后，
          // 由 Automator 作为唯一的权威来源抛出数据就绪事件，告知 UI 刷新，杜绝竞态。
          document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }));
          document.dispatchEvent(new CustomEvent('ark:system-chat-changed'));
        }
      } catch (error) {
        console.error('[ARK_Automator] Failed to handle chat change', error);
      }
    });
  }

  /**
   * 检查当前世界书状态与 Baseline (基准线) 的差异。
   */
  private async checkBaselineDiff(targetWorldbook: string) {
    if (!targetWorldbook) return;
    try {
      const currentConfig = unref(configStore.state);
      // 如果要求静默下一次警告（如刚恢复 Baseline 后），则跳过并复位标志
      if (currentConfig.suppressNextDiffWarning) {
        console.info('[ARK_Automator] Suppressing diff warning as requested.');
        await configStore.updateConfig({ suppressNextDiffWarning: false });
        return;
      }

      const entries = await getWorldbook(targetWorldbook);
      let hasDiff = false;
      
      for (const [key, baseline] of Object.entries(BASELINE_STATE)) {
        const normalizedKey = normalizeCompare(key);
        const entry = entries.find(e => e.name && normalizeCompare(e.name) === normalizedKey);

        if (entry) {
          const currentType = entry.strategy?.type || 'selective';
          // 只要开关状态或触发类型（蓝/绿灯）有不一致，即认为存在差异
          if (entry.enabled !== baseline.enabled || currentType !== baseline.type) {
            hasDiff = true;
            break;
          }
        }
      }

      // 如果存在差异，通过自定义事件总线分发
      if (hasDiff) {
        document.dispatchEvent(new CustomEvent('ark:worldbook-baseline-diff-detected'));
      }
    } catch (e) {
      console.error('[ARK_Automator] Diff check failed', e);
    }
  }
}

export const worldbookAutomator = new WorldbookAutomator();

import { unref } from 'vue';
import { useArkConfig } from '../../core/config_store';
import { ArkEventBus } from '../../core/event_bus';
import { DEBUG_ENTRY_FULL_NAME } from '../../types/system_config';

class LoggerService {
  private static instance: LoggerService;
  private debugLogQueue: any[] = [];
  private flushTimeout: number | null = null;

  private constructor() {
    // 监听内部日志事件
    ArkEventBus.on('log:debug', (message: string, isDryRun?: boolean) => {
      // 由于之前强依赖了 worldbook 名称，为了解耦，先做全局默认收集
      this.logDebug(message, { isDryRun }, null);
    });
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * 追加调试日志到内存队列，并延迟持久化到世界书
   * 需要传入 targetWorldbook 才能真正落盘到对于的世界书，否则只会存在于 Console
   */
  public logDebug(action: string, data: unknown, targetWorldbook: string | null = null) {
    if (!unref(useArkConfig()).isDebugMode) return;

    // 控制台打印
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
              // 压缩冗长的文本字段
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

    if (targetWorldbook) {
      this.scheduleFlushDebugLogs(targetWorldbook);
    }
  }

  private scheduleFlushDebugLogs(targetWorldbook: string) {
    if (this.flushTimeout) clearTimeout(this.flushTimeout);
    this.flushTimeout = setTimeout(() => {
      this.flushDebugLogsToWorldbook(targetWorldbook);
    }, 2000); // 防抖 2 秒
  }

  private async flushDebugLogsToWorldbook(targetWorldbook: string) {
    if (this.debugLogQueue.length === 0) return;
    try {
      let entries = await getWorldbook(targetWorldbook);
      let debugEntry = entries.find(
        (e) => e.name === DEBUG_ENTRY_FULL_NAME
      );

      const logContent = JSON.stringify(this.debugLogQueue, null, 2);

      if (!debugEntry) {
        await createWorldbookEntries(targetWorldbook, [
          {
            name: DEBUG_ENTRY_FULL_NAME,
            content: logContent,
            enabled: false,
            strategy: {
              type: 'selective',
              keys: [],
              keys_secondary: { logic: 'and_any', keys: [] },
              scan_depth: 'same_as_global'
            },
            position: { type: 'before_character_definition', role: 'system', depth: 0, order: 100 },
            probability: 100,
            recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null },
            effect: { sticky: null, cooldown: null, delay: null }
          }
        ]);
      } else {
        await updateWorldbookWith(targetWorldbook, (wbEntries) => {
          const e = wbEntries.find((x) => x.name === DEBUG_ENTRY_FULL_NAME);
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
}

export const logger = LoggerService.getInstance();

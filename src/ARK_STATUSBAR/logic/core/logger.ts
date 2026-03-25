import { unref } from 'vue';
import { DEBUG_ENTRY_FULL_NAME } from '../../config/system_config';
import { useArkConfig } from './config_store';
import { ArkEventBus } from './event_bus';

class LoggerService {
  private static instance: LoggerService;
  private debugLogQueue: any[] = [];
  private flushTimeout: any = null;

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
  public logDebug(action: string, data: any, targetWorldbook: string | null = null) {
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
        (e: any) => e.name === DEBUG_ENTRY_FULL_NAME || e.comment === DEBUG_ENTRY_FULL_NAME,
      );

      const logContent = JSON.stringify(this.debugLogQueue, null, 2);

      if (!debugEntry) {
        await createWorldbookEntries(targetWorldbook, [
          {
            name: DEBUG_ENTRY_FULL_NAME,
            comment: DEBUG_ENTRY_FULL_NAME,
            content: logContent,
            enabled: false,
            constant: false,
          },
        ] as any);
      } else {
        await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
          const e = wbEntries.find((x: any) => x.name === DEBUG_ENTRY_FULL_NAME || x.comment === DEBUG_ENTRY_FULL_NAME);
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

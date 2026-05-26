import { unref } from 'vue';
import { useArkConfig } from '../../store/config_store';

class LoggerService {
  private static instance: LoggerService;
  private debugLogQueue: any[] = [];

  private constructor() {
    // 监听内部日志事件
    document.addEventListener('ark:log-debug', e => {
      const { message, isDryRun } = e.detail;
      // 由于之前强依赖了 worldbook 名称，为了解耦，先做全局默认收集
      this.logDebug(message, { isDryRun });
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
  public logDebug(action: string, data: unknown) {
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
    if (this.debugLogQueue.length > 200) {
      this.debugLogQueue.splice(0, this.debugLogQueue.length - 200);
    }

    // 取消定期写入世界书的操作，改为用户手动在选项中下载
  }

  /**
   * 提供给前端 UI 手动下载当前积攒的调试日志
   */
  public downloadLogs() {
    if (this.debugLogQueue.length === 0) {
      if (typeof toastr !== 'undefined') toastr.info('当前没有可导出的日志。');
      return;
    }
    try {
      const logContent = JSON.stringify(this.debugLogQueue, null, 2);
      const blob = new Blob([logContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ark_debug_logs_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (typeof toastr !== 'undefined') toastr.success('日志已成功下载！');
    } catch (e) {
      console.error('[ARK_DEBUG] Failed to download logs', e);
      if (typeof toastr !== 'undefined') toastr.error('日志下载失败，请查看控制台。');
    }
  }
}

export const logger = LoggerService.getInstance();

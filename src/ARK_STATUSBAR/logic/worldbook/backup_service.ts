import { configStore } from '../../core/config_store';

const BACKUP_PREFIX_BASE = '[ARK_BACKUP_';

export class BackupService {
  /**
   * 生成统一的备份前缀名称
   * @param worldbookName 原世界书名称
   */
  public generateBackupName(worldbookName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${BACKUP_PREFIX_BASE}${timestamp}]_${worldbookName}`;
  }

  /**
   * 获取所有全量备份的世界书名称列表
   * @param targetWorldbook (可选) 如果提供，则只返回针对该世界书的备份
   */
  public async getAllBackups(targetWorldbook?: string): Promise<string[]> {
    try {
      const allNames: string[] = await getWorldbookNames();
      return allNames.filter((name: string) => {
        if (!name.startsWith(BACKUP_PREFIX_BASE)) return false;
        if (targetWorldbook) {
          // 匹配后缀 _[targetWorldbook]
          return name.endsWith(`_${targetWorldbook}`);
        }
        return true;
      });
    } catch (e) {
      console.error('[ARK_BackupService] 获取备份列表失败:', e);
      return [];
    }
  }

  /**
   * 检查备份数量是否超过全局配置的上限
   * 如果超过，会返回一个警告信息，否则返回 null
   */
  public async checkBackupLimitWarning(): Promise<string | null> {
    const config = configStore.state.value;
    const maxBackups = config.maxTotalBackups || 10;
    const allBackups = await this.getAllBackups();

    if (allBackups.length >= maxBackups) {
      return `当前系统内存在的全量备份数量 (${allBackups.length}) 已达到或超过上限 (${maxBackups})，建议前往管理面板清理旧备份以释放空间。`;
    }
    return null;
  }

  /**
   * 创建一个指定世界书的全量备份
   * @param targetWorldbook 要备份的原世界书名称
   * @param customName (可选) 自定义的备份名称，不填则自动生成
   * @returns 创建好的备份世界书名称
   */
  public async createFullBackup(targetWorldbook: string, customName?: string): Promise<string> {
    const backupName = customName 
      ? `${BACKUP_PREFIX_BASE}${customName}]_${targetWorldbook}`
      : this.generateBackupName(targetWorldbook);
    
    try {
      const originalEntries = await getWorldbook(targetWorldbook);
      // 创建新的世界书实体作为备份，使用 debounce 渲染以提高性能
      await createOrReplaceWorldbook(backupName, originalEntries, { render: 'debounced' });
      return backupName;
    } catch (e) {
      console.error(`[ARK_BackupService] 创建备份失败 (${targetWorldbook} -> ${backupName}):`, e);
      throw e;
    }
  }

  /**
   * 恢复全量备份的数据到目标世界书中
   * @param targetWorldbook 目标世界书
   * @param backupWorldbook 包含备份数据的世界书
   */
  public async restoreFullBackup(targetWorldbook: string, backupWorldbook: string): Promise<void> {
    try {
      const backupEntries = await getWorldbook(backupWorldbook);
      // 完全覆盖原世界书的内容
      await replaceWorldbook(targetWorldbook, backupEntries, { render: 'debounced' });
      
      // 主动触发事件以通知 UI 同步
      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', {
        detail: { worldbookName: targetWorldbook }
      }));
    } catch (e) {
      console.error(`[ARK_BackupService] 恢复备份失败 (${backupWorldbook} -> ${targetWorldbook}):`, e);
      throw e;
    }
  }
}

export const backupService = new BackupService();

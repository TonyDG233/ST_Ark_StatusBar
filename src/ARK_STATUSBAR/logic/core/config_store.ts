import { ref, unref, watch } from 'vue';
import { ArkConfig, CONFIG_ENTRY_PREFIX, DEFAULT_CONFIG } from '../../config/system_config';
import { ArkEventBus } from './event_bus';

/**
 * 唯一的配置响应式存储中心 (Single Source of Truth)
 * 封装并取代了原 StatusBarManager 中关于 Config 的逻辑
 */
class ConfigStore {
  private static instance: ConfigStore;

  // Vue 响应式引用，使得任意 .vue 组件导入后均可直接侦听
  public state = ref<ArkConfig>({ ...DEFAULT_CONFIG });

  private isLoaded = false;

  private constructor() {
    // 监听状态改变并自动持久化
    watch(
      this.state,
      (newVal) => {
        if (this.isLoaded) {
          this.persistConfig(unref(newVal));
        }
      },
      { deep: true }
    );

    // 监听总线历史记录更新事件
    ArkEventBus.on('history:commit_added', (commitData) => {
      const current = unref(this.state);
      this.updateConfig({
        commits: [...current.commits, commitData]
      });
    });

    // 监听请求配置更新事件
    ArkEventBus.on('config:update_requested', (partialConfig) => {
      this.updateConfig(partialConfig);
    });
  }

  static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }

  /**
   * 初始化/加载配置
   * @param targetWorldbook 用于旧版世界书迁移的数据源（如果有）
   */
  public async loadOrInitConfig(targetWorldbook: string | null) {
    const extSettings = SillyTavern.extensionSettings as any;
    
    if (extSettings && extSettings['ark_statusbar_settings']) {
      try {
        this.state.value = { ...DEFAULT_CONFIG, ...extSettings['ark_statusbar_settings'] };
      } catch (e) {
        console.error('[ARK_ConfigStore] 解析新配置失败，使用默认配置:', e);
        this.state.value = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };
      }
    } else {
      console.info('[ARK_ConfigStore] 未找到新配置，尝试从世界书中迁移旧数据...');
      let migrated = false;
      
      if (targetWorldbook) {
        try {
          const entries = await getWorldbook(targetWorldbook);
          const configEntry = entries.find(
            (e: any) =>
              (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) || (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
          );

          if (configEntry) {
            console.info('[ARK_ConfigStore] 发现遗留的世界书配置，正在迁移...');
            let parsed = JSON.parse(configEntry.content);
            this.state.value = { ...DEFAULT_CONFIG, ...parsed };
            migrated = true;

            console.info(`[ARK_ConfigStore] 迁移完成，正在彻底删除原世界书 ${targetWorldbook} 中的系统配置条目...`);
            await deleteWorldbookEntries(targetWorldbook, entry => {
              const anyEntry = entry as any;
              return (
                (anyEntry.name && anyEntry.name.startsWith(CONFIG_ENTRY_PREFIX)) ||
                (anyEntry.comment && anyEntry.comment.startsWith(CONFIG_ENTRY_PREFIX))
              );
            });
          }
        } catch (e) {
          console.error('[ARK_ConfigStore] 数据迁移失败:', e);
        }
      }

      if (!migrated) {
        console.info(`[ARK_ConfigStore] 创建全新的默认配置...`);
        this.state.value = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };
      }
      
      if (extSettings) {
        extSettings['ark_statusbar_settings'] = unref(this.state);
        if (typeof SillyTavern.saveSettingsDebounced === 'function') {
          SillyTavern.saveSettingsDebounced();
        }
      }
    }

    this.isLoaded = true;
    
    // 派发全局事件通知 UI 更新配置 (兼容遗留代码，未来可全转为 Vue reactivity)
    document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: unref(this.state) }));

    this.checkInterceptorState();
  }

  /**
   * 手动更新配置项
   */
  public async updateConfig(partial: Partial<ArkConfig>) {
    this.state.value = { ...unref(this.state), ...partial, lastUpdateTime: Date.now() };
    // 由于加了 deep watcher，这里无需主动调用 persistConfig
  }

  /**
   * 持久化保存
   */
  private persistConfig(configVal: ArkConfig) {
    try {
      const extSettings = SillyTavern.extensionSettings as any;
      if (extSettings) {
        extSettings['ark_statusbar_settings'] = configVal;
        if (typeof SillyTavern.saveSettingsDebounced === 'function') {
          SillyTavern.saveSettingsDebounced();
        }
      }
      document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: configVal }));
      this.checkInterceptorState();
    } catch (error) {
      console.error('[ARK_ConfigStore] Failed to save config:', error);
    }
  }

  private checkInterceptorState() {
    const config = unref(this.state);
    const shouldEnable = config.isSystemEnabled && config.isInterceptorEnabled;
    ArkEventBus.emit('config:interceptor_state_changed', shouldEnable);
  }
}

export const configStore = ConfigStore.getInstance();

/**
 * 暴露给 Vue 设定的组合式 Hook
 */
export function useArkConfig() {
  return configStore.state;
}

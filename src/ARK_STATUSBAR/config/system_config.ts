// src/ARK_STATUSBAR/config/system_config.ts

// 系统配置条目的前缀，用于在世界书中快速定位配置条目（遗留兼容用，迁移完成后仅用于查找旧数据）
export const CONFIG_ENTRY_PREFIX = '[SYS_CONFIG]';
// 系统配置条目的完整名称
export const CONFIG_ENTRY_FULL_NAME = '[SYS_CONFIG]系统配置文件请勿打开';

export const DEBUG_ENTRY_PREFIX = '[SYS_DEBUG]';
export const DEBUG_ENTRY_FULL_NAME = '[SYS_DEBUG]系统调试日志导出';

/**
 * 状态栏的全局配置接口。
 * 原先保存在世界书，现在即将迁移至 SillyTavern.extensionSettings['ark_statusbar_settings']
 */
export interface ArkConfig {
  _desc: string; // 配置文件说明，防止用户误修改
  theme: 'light' | 'dark' | 'transparent'; // 当前 UI 主题
  isSystemEnabled: boolean; // 系统总开关，控制整个状态栏是否启用
  isInterceptorEnabled: boolean; // 拦截器开关，控制是否在发送时拦截预警
  enableEnterToIntercept: boolean; // 是否拦截回车键 (默认关闭)
  showConstantEntries: boolean; // 是否在拦截器和主动检测中显示常驻(蓝灯)条目
  isDebugMode?: boolean; // 是否开启调试模式
  uiWidth: number; // 状态栏 UI 的宽度
  uiFontSize: number; // 状态栏 UI 的基础字体大小
  commits: ArkCommit[]; // 操作历史记录（类似 Git commit）
  lastUpdateTime: number; // 最后一次配置更新的时间戳
  suppressNextDiffWarning?: boolean; // 是否屏蔽下一次的 Baseline 差异警告
  pinnedEntries?: number[]; // 用户置顶偏好的世界书条目 UID 列表
  worldbookInitialStates?: Record<string, Record<string, { enabled: boolean; type: string }>>; // [即将新增] 世界书快照
}

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

// 默认的初始配置
export const DEFAULT_CONFIG: ArkConfig = {
  _desc: '这是ARK_STATUSBAR的自动备份数据，请勿手动修改',
  theme: 'light', // 默认主题为浅色
  isSystemEnabled: true,
  isInterceptorEnabled: true,
  enableEnterToIntercept: false, // 默认关闭回车拦截
  showConstantEntries: false, // 默认隐藏蓝灯条目
  isDebugMode: false,
  uiWidth: 400,
  uiFontSize: 14,
  commits: [],
  lastUpdateTime: 0,
  pinnedEntries: [],
  worldbookInitialStates: {},
};

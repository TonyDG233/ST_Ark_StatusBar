// src/ARK_STATUSBAR/config/system_config.ts

// 系统配置条目的前缀，用于在世界书中快速定位配置条目（遗留兼容用，迁移完成后仅用于查找旧数据）
export const CONFIG_ENTRY_PREFIX = '[SYS_CONFIG]';
// 系统配置条目的完整名称
export const CONFIG_ENTRY_FULL_NAME = '[SYS_CONFIG]系统配置文件请勿打开';

export const DEBUG_ENTRY_PREFIX = '[SYS_DEBUG]';
export const DEBUG_ENTRY_FULL_NAME = '[SYS_DEBUG]系统调试日志导出';

export interface ArkSnapshot {
  id: string;
  name: string; // 拍摄的快照名称
  timestamp: number;
  worldbook: string; // 针对哪本世界书
  states: Record<number, { enabled: boolean; type: string }>; // uid -> state
}

/**
 * 状态栏的全局配置接口。
 * 原先保存在世界书，现在即将迁移至 SillyTavern.extensionSettings['ark_statusbar_settings']
 */
export interface ArkConfig {
  _desc: string; // 配置文件说明，防止用户误修改
  theme: 'light' | 'dark' | 'transparent'; // 当前 UI 主题
  isSystemEnabled: boolean; // 系统总开关，控制整个状态栏是否启用
  isInterceptorEnabled: boolean; // 拦截器开关，控制是否在发送时拦截预警
  enableTokenCalculator: boolean; // 是否在拦截器中执行 Token 假生成计算 (默认开启，低配终端建议关闭)
  enableEnterToIntercept: boolean; // 是否拦截回车键 (默认关闭)
  showConstantEntries: boolean; // 是否在拦截器和主动检测中显示常驻(蓝灯)条目
  isDebugMode?: boolean; // 是否开启调试模式
  uiWidth: number; // 状态栏 UI 的宽度
  uiHeight?: number; // 状态栏 UI 的高度 (仅桌面端非移动端布局下生效)
  uiFontSize: number; // 状态栏 UI 的基础字体大小
  commits: ArkCommit[]; // 操作历史记录（类似 Git commit）
  lastUpdateTime: number; // 最后一次配置更新的时间戳
  suppressNextDiffWarning?: boolean; // 是否屏蔽下一次的 Baseline 差异警告
  pinnedEntries?: number[]; // 用户置顶偏好的世界书条目 UID 列表
  pinnedWorldbooks?: string[]; // 用户置顶偏好的世界书名称列表
  worldbookInitialStates?: Record<string, Record<string, { enabled: boolean; type: string }>>; // [旧快照，将废弃]
  snapshots?: ArkSnapshot[]; // [新版] 世界书快照

  // [新增] 历史记录与备份上限配置
  maxHistoryCommits?: number; // 历史记录队列最大长度 (默认 100)
  maxHeavyHistoryCommits?: number; // 长文本修改等重度历史记录的最大长度 (默认 30)
  maxTotalBackups?: number; // 世界书全量备份的最大数量警戒线 (默认 20)
}

export interface ArkCommitChange {
  uid: number; // 修改的世界书条目 UID (对于 create_worldbook/delete_worldbook 可以传 -1)
  comment: string; // 变动的条目名称/备注
  path?: string; // 修改属性的路径，或特殊动作：'create_worldbook', 'delete_worldbook', 'create_entry', 'delete_entry'。为空默认表示 'enabled' 状态。
  from: any; // 变更前的状态/旧值 (对于新建操作传 null，删除操作则存放原本的数据)
  to?: any; // 变更后的状态/新值 (可选)
}

/**
 * 历史记录（Commit）的结构定义，用于记录对世界书条目状态的修改。
 */
export interface ArkCommit {
  id: string; // 唯一的提交 ID
  timestamp: number; // 提交时间戳
  description: string; // 提交的文字描述
  worldbook?: string; // 该次操作针对的世界书名称
  isPinned?: boolean; // [新增] 是否置顶保护，防止被系统容量驱逐机制自动清理
  isHeavy?: boolean; // [新增] 标识本次提交是否包含大量文本数据（如修改了 content 字段）
  changes: ArkCommitChange[];
}

// 默认的初始配置
export const DEFAULT_CONFIG: ArkConfig = {
  _desc: '这是ARK_STATUSBAR的自动备份数据，请勿手动修改',
  theme: 'light', // 默认主题为浅色
  isSystemEnabled: true,
  isInterceptorEnabled: true,
  enableTokenCalculator: true, // 默认开启 Token 计算
  enableEnterToIntercept: false, // 默认关闭回车拦截
  showConstantEntries: false, // 默认隐藏蓝灯条目
  isDebugMode: false,
  uiWidth: 400,
  uiHeight: 400,
  uiFontSize: 14,
  commits: [],
  lastUpdateTime: 0,
  pinnedEntries: [],
  pinnedWorldbooks: [],
  worldbookInitialStates: {},
  snapshots: [],
  maxHistoryCommits: 100,
  maxHeavyHistoryCommits: 30,
  maxTotalBackups: 20,
};

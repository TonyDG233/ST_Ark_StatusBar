# 项目状态跟踪板 (PROJECT_STATE)

## 当前整体阶段
**Phase 4 (Story Engine V2) 准备与基础重构阶段**

### 历史里程碑
- [x] **Phase 1**: Vue 3 核心 UI 挂载机制跑通，样式 Teleport 隔离。
- [x] **Phase 2**: 世界书管理器基础闭环（Baseline 对比、条目开关、置顶偏好、单字干员规避）。
- [x] **Phase 3**: 防呆拦截器核心逻辑（发送阻断）、配置持久化及操作历史的 `[SYS_CONFIG]` Git-like 撤销机制、离线调试日志记录 (`[SYS_DEBUG]`) 及其假死防护（`Promise.race` 超时锁 + 强清理）。
- [x] **清理 1 月份失败的旧架构**: 已将 `updaters` 和 `mvu` 备份并移除，清理主入口文件，为新架构腾出干净的空间。

---

## 正在进行中的任务 (Phase 4: 双轨驱动剧情引擎 V2 准备)

### 任务总览
在正式开发剧情引擎（节点解析、拦截解耦、次级 API）之前，**必须先完成底层代码的解耦与重构**，解决 3000 行项目规模带来的技术债务。将全局状态迁移至更稳定的 `SillyTavern.extensionSettings`，拆分臃肿的 UI 组件，并实现跨世界书的全局挂载管理。

### 当前重构目标 (Refactor Worldbook & Vue)
- [x] **Step 1: 拆分系统配置 (解耦 statusbar_manager.ts)**
  - 将庞大的 `ArkConfig` 及相关常量抽离至独立的 `config/system_config.ts`。
- [x] **Step 2: 存储引擎平滑迁移**
  - 将基于世界书 `[SYS_CONFIG]` 的存储改为 `SillyTavern.extensionSettings`，实现无损数据迁移。
- [x] **Step 3: 跨世界书检测放开**
  - 允许状态栏拦截器捕获所有世界书的绿灯条目并标注来源。
- [x] **Step 4: 实现全局世界书挂载管理**
  - 实现对所有原生世界书的扫描，并能在 UI 中直接通过 `rebindGlobalWorldbooks` API 控制全局挂载/卸载，并以手风琴抽屉形式渲染。
- [x] **Step 5: 全局快照生命周期管理面板**
  - 补全跨世界书的快照拍摄与回滚删除机制，并将高危操作及操作历史(Git)重置到单独管理区域。
- [ ] **Step 6: 提取全局公共样式与字体防线**
  - 新建 `theme.scss`，统一移动端字体大小，严防宋体灾难和 CSS 污染。
- [ ] **Step 7: 拆分 StartupNavigator.vue**
  - 将设置面板抽离，严格遵循 Vue 的 Props/Emits 单向数据流防线。
- [ ] **Step 8: 拆分 GlobalStatusBar.vue 为容器**
  - 将臃肿的四合一组件拆分为独立的子 Tabs 组件。

### 核心子目标
- [ ] **剧本节点规范化 (The Script Engine)**
  - 将当前社区零散的 YAML 幕间剧本数据转换为结构化的关系图（Node DAG），提取名称、简介与触发条件。
- [ ] **事件拦截解耦 (Event Interceptor)**
  - 在世界书管理器中复用“在发送按键之上设置遮罩”的技术，接管酒馆自带的发送流程。
- [ ] **次级 API 调用与上下文构建 (Sub-API Sniffer)**
  - 实现从聊天楼层中提取最近 3-5 条记录与对应剧本节点，合并至次级 API 提示词中进行请求。
  - 需要在 `src/poc/` 中进行测试以确保稳定性。
- [ ] **UI 审查弹窗 (The Edit Window)**
  - 渲染次级小模型的剧情跳转建议，提供“同意/修改/重试”选项。
- [ ] **变量锚定与幽灵注入 (Injector & Variables)**
  - 确认后，将目标节点 ID 存储于聊天级变量 (Chat Variables)。
  - 利用原生事件（如 `generate_before`）将剧情演绎建议以不可见代码块（配合正则隐藏）临时置于用户消息末端或作者注中。

### 最新讨论结论 (2026-03-21)
- 放弃修改全局预设：所有的主模型扮演引导均利用酒馆的底层机制在每次发送前进行动态注入。
- 放弃 `sys_config` 的存档挂靠：剧情坐标跟随具体聊天绑定，规避切换与回滚的丢失风险。
- 解决插件冲突：通过特定正则排序，在数据库插件解析 HTML 前进行剧情思路字段的隐藏。

---

## 注意事项
1. 在引入次级 API 机制前，**必须先在 `src/poc/` 中建立概念验证脚本 (Proof of Concept)**，确保能够稳定调起酒馆的底层请求能力并且成功捕获输出。
2. 任何影响系统架构层面的大规模调整，必须同步更新 `.kilocode/state/ARCH.md` 和 `.kilocode/state/PRD.md` 的描述。
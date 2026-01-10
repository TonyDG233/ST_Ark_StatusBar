# Phase 1.5: 世界书控制功能 (Worldbook Control)

**Status**: [Completed]
**Date**: 2026-01-10

## 1. 核心目标
彻底实用化“一键开关特定世界书条目”的核心功能。实现智能识别当前角色绑定世界书，并提供完整的前端控制面板。

## 2. 详细需求分解

### 2.1 数据源与配置 (Data Sources)
*   **`references/tools/generate_baseline.mjs`**:
    *   **需求**: 修正“单字干员”识别逻辑。
    *   **逻辑**: 遍历每个 entry 的 `激活策略.关键字` (keys)，若存在长度 < 2 的关键字，则将该 Entry 名称加入单字列表。
    *   **后续**: 运行脚本生成新的 `single_char_entries.ts`，并等待用户人工校对。
*   **`src/ARK_STATUSBAR/config/scenarios.ts`**:
    *   **需求**: 更新文件头部注释。
    *   **动作**: 移植 `[UI] Startup Navigator.md` 中的“数据定义区”注释风格，为贡献者提供详细指南。

### 2.2 后端逻辑 (Backend - `worldbook_manager.ts`)
*   **智能定位 (Smart Targeting)**:
    *   弃用 `DEFAULT_WORLDBOOK_NAME`。
    *   使用 `getCharWorldbookNames('current')` 获取绑定列表。
    *   逻辑: `target = result.primary || result.additional[0]`.
*   **核心功能**:
    *   `applyScenario(swipeId)`:
        1.  **预检查 (Pre-Check)**:
            *   获取当前世界书状态。
            *   **关键逻辑**: 仅检查 `BASELINE_STATE` 中存在的条目 (忽略用户额外添加的条目)。
            *   判断当前状态是否匹配 "Baseline" 或 "Single Char Closed" 两种安全状态之一。
        2.  **警告机制**:
            *   若状态为 "Modified" (即不匹配上述任一安全状态)，弹出警告 (confirm/modal)。
            *   提示: "检测到世界书有非标准修改，继续跳转可能导致状态异常。是否继续？"
            *   用户取消 -> 终止；用户确认 -> 继续。
        3.  **应用增量 (Apply Delta)**:
            *   **不重置** Baseline。
            *   直接在当前基础上:
                *   开启 `linkedWorldInfo` 中的条目。
                *   关闭 `disabledWorldInfo` 中的条目。
    *   `closeSingleCharEntries()`:
        1.  获取目标世界书。
        2.  将 `SINGLE_CHAR_ENTRIES` 列表中存在于当前世界书的条目设为 `enabled = false`。
    *   `resetToBaseline()`:
        1.  获取目标世界书。
        2.  将所有条目的 `enabled` 状态恢复为 `BASELINE_STATE` 中的值。
    *   `getWorldbookStatus()` (新增):
        *   返回当前状态: `'original' | 'single_char_closed' | 'modified'`。
        *   **忽略逻辑**: 仅遍历 `BASELINE_STATE` 中的 Key 进行比对，无视用户新增的额外条目。
        *   'original': 所有 Baseline 条目状态一致。
        *   'single_char_closed': 除单字条目被关闭外，其余 Baseline 条目状态一致。
        *   'modified': 其他情况。

### 2.3 前端界面 (Frontend - `StartupNavigator.vue`)
*   **控制区重构 (Worldbook Control Zone)**:
    *   位置: 替换原“上下文优化插件”区域。
    *   **显示**: 当前状态 (原始 / 单字已关 / 已修改)。
    *   **UI 风格**: 采用 Arknights 风格的 UI (Status Block + Sharp Buttons)。
    *   **按钮**:
        *   [一键关闭单字干员] (调用 `closeSingleCharEntries`)
        *   [一键还原世界书] (调用 `resetToBaseline`)
*   **开局卡片优化**:
    *   在卡片标题下方增加两行装饰性文字 (字体较小，灰色)。
    *   第一行: 显示将**开启**的条目 (linkedWorldInfo)。
    *   第二行: 显示将**关闭**的条目 (disabledWorldInfo)。
    *   目的: 仅作为装饰与提醒，不完全展示所有内容。
*   **移动端适配**:
    *   CSS 修正: `.settings-panel` 宽度从固定 `300px` 改为 `width: 300px; max-width: 85vw;`，防止在小屏手机上完全遮挡背景。

## 3. 开发计划 (Step-by-Step)

1.  **Step 1: 数据源修正** [Completed]
    *   修改 `generate_baseline.mjs`。
    *   运行脚本生成数据。
    *   更新 `scenarios.ts` 注释。

2.  **Step 2: 后端核心实现** [Completed]
    *   修改 `worldbook_manager.ts`，实现智能定位和上述三个核心方法。
    *   实现状态检测逻辑。

3.  **Step 3: 前端 UI 重构** [Completed]
    *   修改 `StartupNavigator.vue`。
    *   实现控制区布局。
    *   添加移动端 CSS 适配。
    *   绑定按钮事件。

4.  **Step 4: 联调与测试** [Completed]
    *   测试开局切换是否正确修改世界书。
    *   测试控制区按钮是否生效。
    *   测试移动端显示效果。

5.  **Step 5: UI Polish (Arknights Aesthetic)** [Completed]
    *   实现了 Arknights 风格的按钮和状态显示。
    *   修正了分割线位置。
    *   修正了状态文本为中文 ("初始状态", "单字屏蔽", "非标修改")。

## 4. 后续优化 (Phase 1.7)
用户反馈移动端体验仍有不足：
1.  侧边栏遮挡底层 UI。
2.  按钮在极窄屏幕下溢出。
3.  需要针对移动端进行极致优化。
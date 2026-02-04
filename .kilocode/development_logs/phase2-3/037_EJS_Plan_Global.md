# Phase 3: EJS 模板规划 - `Global` 模块

**日期**: 2026-01-23

**目的**: 本文档旨在横向规划 `Global` 数据域所涉及的所有 EJS 模板内容，确保其在不同模板中的表现、规则和任务逻辑是统一且符合设计意图的。

---

## 1. 涉及文件与核心逻辑

*   **Schema 定义**: `src/ARK_STATUSBAR/mvu/schemas/global.ts`
*   **设计文档**: [`.kilocode/development_logs/010_Phase2.2_GlobalState_Design.md`](.kilocode/development_logs/010_Phase2.2_GlobalState_Design.md)
*   **EJS 模板**:
    *   `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs`
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs`
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs`

---

## 2. 在 `变量列表.ejs` 中的表现

**职责**: 清晰、准确地向分析师 LLM 展示当前世界的宏观状态。

### 伪代码实现

```ejs
<%
    const global = worldState.global;
%>
[全局状态]
当前时间: <%- global.time %>
当前地点: <%- `${global.location.region}, ${global.location.city}, ${global.location.area}, ${global.location.spot}` %>
天气: <%- global.weather %>
环境: <%- global.environment_status %>
游戏总轮次: <%- global.game_progress.total_turns %>
在场角色: <%- (global.presence.active_chars).join(', ') || '无' %>
附近角色: <%- (global.presence.nearby_chars).join(', ') || '无' %>
```

---

## 3. 在 `[mvu_update]变量更新规则.ejs` 中的规则

**职责**: 定义 `Global` 模块中，可由 LLM 根据剧情自由更新的字段的“物理定律”。

| 字段路径 | `type` 定义 | `check` 规则 |
| :--- | :--- | :--- |
| `global.time` | `format: "YYYY-MM-DD HH:mm:ss"` | `- "根据剧情的逻辑流逝来更新时间，例如：'几分钟后'、'第二天早上'。"` |
| `global.location` | `type: \|-\n  {\n    region: string;\n    city: string;\n    area: string;\n    spot: string;\n  }` | `- "当角色从一个地点移动到另一个地点时，必须更新此变量的所有四个层级。"` |
| `global.weather` | `(string, 省略)` | `- "仅在天气发生显著变化或角色转移到天气不同的地区时更新。"` |
| `global.environment_status` | `(string, 省略)` | `- "当环境发生显著变化时，请用不超过50字的客观描述来更新此项。"` |
| `global.presence` | `type: \|-\n  {\n    active_chars: string[];\n    nearby_chars: string[];\n  }` | `- "【核心感知 - 必须更新】: 通读主LLM的最新回复，识别出所有直接参与对话或行动的角色，将他们的名字填入 'active_chars'。识别出那些在场但未直接参与互动的角色，或有可能出现的角色，填入 'nearby_chars'。"` |
| `global.game_progress` | *(后端管理)* | `- "【严禁修改】: 此字段由后端脚本在每轮结束后自动递增。"` |
| `global.task_queue` | *(后端管理)* | `- "【严禁修改】: 此队列由后端脚本全权管理。"` |

---

## 4. 在 `[mvu_update]任务执行器.ejs` 中的逻辑

**职责**: `Global` 模块本身不产生任务，但 `任务执行器.ejs` 会读取 `global.task_queue` 来处理其他模块（如 `Character`, `Chronicle`）生成的任务。

**结论**: `Global` 模块在 `任务执行器.ejs` 中没有专属的、由 `task.type` 驱动的渲染逻辑。

---

## 5. 分期完成计划

1.  **第一阶段**: 实现 `变量列表.ejs` 中的渲染逻辑。
2.  **第二阶段**: 实现 `[mvu_update]变量更新规则.ejs` 中的所有规则。

---

## 6. 已知问题与规避

*   **问题**: `presence` 字段的准确性完全依赖 LLM 的分析能力，可能出现错漏。
    *   **规避**: 在给额外解析 LLM 的专属破限提示词中，需要用最强的语气强调 `presence` 分析的核心重要性，并提供清晰的判断标准示例。

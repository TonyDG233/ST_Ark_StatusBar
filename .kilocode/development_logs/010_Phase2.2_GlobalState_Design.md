# Phase 2.2: 全局状态设计 (Global State Design)

**目标**: 围绕 `GlobalState` 变量区块，完成从结构定义到提示词设计的完整工作流规划。

---

## 1. 变量结构 (Zod Schema)
* **文件**: `src/ARK_STATUSBAR/mvu/schemas/global.ts`
* **描述**: 定义了游戏世界的基础状态，如时间、地点和在场角色。这是所有其他模块运行的基础。

```typescript
import { z } from 'zod';

export const GlobalStateSchema = z.object({
  // 时间
  time: z.string().regex(/^\d{1,5}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "时间格式: YYYY-MM-DD HH:mm:ss")
    .describe('游戏世界的核心时间，由后端脚本根据AI输出自动推进'),
  
  // 地点
  location: z.object({
    region: z.string().describe('国家/大区'),
    city: z.string().describe('城市'),
    area: z.string().describe('区域'),
    spot: z.string().describe('具体位置')
  }).describe('描述角色当前所在的四维地点'),
  
  // 环境
  weather: z.string().describe('当前天气状况'),
  environment_status: z.string().describe('对周围环境的感官描述'),

  // 在场实体注册表 (由后端脚本维护)
  presence: z.object({
    active_chars: z.array(z.string()).describe('当前在场并参与交互的角色列表'),
    nearby_chars: z.array(z.string()).describe('附近可被感知但未直接交互的角色')
  }).describe('由后端脚本根据AI输出来维护，用于触发角色初始化和离线更新'),

  // 游戏进程计数器 (由后端脚本维护)
  game_progress: z.object({
    total_turns: z.number().int().default(0).describe('总交互轮次，用于触发周期性事件')
  }).describe('由后端脚本在每轮交互后自动递增')
});
```

---

## 2. 初始设置 (InitVar)
* **文件**: 世界书条目 `[initvar]变量初始化勿开`
* **描述**: 为游戏开始时提供一个明确的初始世界状态。

```yaml
global:
  time: "1096-12-23 18:00:00"
  location:
    region: "乌萨斯"
    city: "切尔诺伯格"
    area: "城市废墟"
    spot: "第四中学附近"
  weather: "阴"
  environment_status: "空气中弥漫着灰尘，远处传来建筑倒塌的回响。"
  presence:
    active_chars: ["阿米娅"]
    nearby_chars: []
  game_progress:
    total_turns: 0
```

---

## 3. 更新规则 (Update Rules)
* **文件**: 世界书条目 `[mvu_update]变量更新规则`
* **描述**: 指导 AI 如何根据剧情发展来更新全局状态。

```yaml
---
变量更新规则:
  global:
    time:
      check:
        - "根据剧情的逻辑流逝来更新时间，例如：'几分钟后'、'第二天早上'。必须保持时间的连续性和合理性。"
        - "如果一次性跨越了很长的时间（超过一天），请在剧情中简要说明原因。"
    location:
      type: |-
        {
          region: string;
          city: string;
          area: string;
          spot: string;
        }
      check:
        - "当角色从一个地点移动到另一个地点时，必须更新此变量。"
        - "请同时更新所有四个层级，以确保地点信息的完整性。"
    weather:
      check:
        - "仅在天气发生显著变化时（如天黑、下雨、放晴）或角色转移到天气不同的地区时更新。"
    environment_status:
      check:
        - "当角色进入新环境或当前环境发生显著变化时（如发生爆炸、光线改变），请用不超过50字的客观描述来更新此项。"
```

---

## 4. 后端处理逻辑 (Backend Logic)
* **模块**: `src/ARK_STATUSBAR/logic/updaters/global.ts`
* **核心职责**:
    1.  **回合计数 (Turn Counter)**: 在 `onVariableUpdateEnded` 事件中，无条件地将 `global.game_progress.total_turns` 递增 `1`。这是最优先执行的简单操作。
    2.  **在场角色同步 (Presence Sync)**:
        - **数据源**: 此逻辑严重依赖**额外解析LLM**。该LLM的专属提示词会指示它分析主LLM的回复，并专门抽取出“当前在场角色”和“附近可触发角色”的名单。
        - **执行时机**: 在 `onVariableUpdateEnded` 事件中，脚本获取额外解析LLM更新后的 `global.presence` 变量。
        - **新角色登场**: 脚本对比新旧 `active_chars` 列表。如果发现有新角色，立即触发一个内部的“角色初始化”任务（这是 `Character` 模块的逻辑，但由 `Global` 模块的状态变化触发）。
        - **三阶段上下文管理逻辑**:
            - **阶段一 (Active -> Nearby)**: 脚本会遍历所有 `Character` 档案，检查其内部记录的 `last_update_turn`（最后更新轮次）与当前的 `total_turns`。如果一个在 `active_chars` 列表中的角色，其档案 `last_update_turn` 与当前轮次差距**超过5轮**，脚本会将其从 `active_chars` 移动到 `nearby_chars`。这意味着该角色近期未参与核心互动，其上下文将被降级，只显示基础档案。
            - **阶段二 (Nearby -> Unload)**: 如果一个在 `nearby_chars` 列表中的角色，其 `last_update_turn` 与当前轮次差距**进一步超过10轮**，脚本会将其从 `nearby_chars` 列表中移除。此时，该角色的档案信息除了名称外，将不再注入任何上下文，仅在变量中保留数据。
            - **阶段三 (Re-Activate)**: 如果一个 `nearby_chars` 或已卸载的角色在主LLM的回复中被重新提及并被额外解析LLM识别，脚本会将其重新移回 `active_chars` 列表，并重置其 `last_update_turn` 为当前轮次。
    3.  **时间合法性校验 (Time Validation)**: AI 通过 JSON Patch 更新 `global.time` 后，脚本会再次校验其格式是否严格符合 `YYYY-MM-DD HH:mm:ss`，如果格式错误，则尝试修复或保留旧值，并打印警告日志。

---

## 5. 附录：相关的提示词设计
虽然 `[mvu_update]变量输出格式` 是全局统一的，但可以在**额外解析LLM的专属提示词**中加入引导，以获取更精确的全局状态信息。

*   **引导AI精确解析时间**:
    > **[硬性规则]**：在解析主LLM的回复时，必须优先寻找并提取明确的时间戳（如 "18:05:30" 或 "1096-12-24 08:00:00"）。如果找到，你的时间更新指令必须严格使用该时间戳，不得有任何偏差。只有在没有明确时间戳的情况下，你才能根据上下文（如“几分钟后”、“黄昏时分”）进行估算。

*   **引导AI解析在场角色**:
    > **[硬性规则]**：通读主LLM的最新回复，识别出所有直接参与对话或行动的角色，将他们的名字填入 `global.presence.active_chars` 数组。识别出那些虽然在场但未直接参与互动的角色（例如，在背景中、被提及但未说话），或有可能出现的角色，将他们的名字填入 `global.presence.nearby_chars` 数组。

*   **引导 AI 输出时间流逝**:
    > "请在你的叙述中，自然地体现出时间的流逝。如果事件紧接着发生，可以说‘几分钟后’；如果场景切换，可以说‘次日清晨’或‘黄昏时分’。"
*   **引导 AI 描述环境**:
    > "当角色进入一个新的地点时，请花些笔墨（约50-100字）详细描述周围的环境、氛围和关键特征。"

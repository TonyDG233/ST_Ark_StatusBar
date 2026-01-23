# Phase 3: `变量更新规则` & `变量输出格式` 设计文档 v2

**日期**: 2026-01-22

**目的**: 本文档旨在规划 `[mvu_update]变量更新规则.ejs` 和 `[mvu_update]变量输出格式.ejs` 这两个核心规则文件的内容与实现。它们将基于 `.kilocode/workflows/` 中的标准模板进行构建，并根据项目需求进行微调。

---

## 1. `[mvu_update]变量更新规则.ejs`

### 1.1 核心职责

此文件通过生成一个结构化的 **YAML 提示词**，向 LLM 定义每个变量的类型约束和更新检查点 (`check`)。**颗粒度必须细化到具体字段**，明确数值范围、更新时机和禁忌。

### 1.2 实现思路与案例

为了确保规则的有效性，我们将采用“分模块+细粒度字段”的策略。

**案例示范 (Mood 字段)**:
```yaml
      mood:
        type: number
        range: -100~100
        check:
          - "正值代表积极情绪，负值代表消极情绪，0为平静。"
          - "每轮应根据角色的内心活动和遭遇进行微调，单次变化幅度通常不超过 ±10，除非遭遇重大打击或极度喜悦。"
          - "若长时间无新刺激，数值应缓慢向 0 回归（情绪平复）。"
```

### 1.3 伪代码

```ejs
<%#
======================================================================
 EJS 模板: [mvu_update]变量更新规则.ejs
 职责: 生成结构化的变量更新规则 YAML。
======================================================================
%>
---
变量更新规则:
  global:
    time:
      format: "YYYY-MM-DD HH:mm:ss"
      check:
        - "始终首先计算本轮叙事中流逝的时间。"
        - "如果是连续对话，流逝时间通常为数分钟；如果是场景切换或休息，时间流逝可能较长。"
    location:
      type: |-
        { region: string, city: string, district: string, specific: string }
      check:
        - "仅在场景发生实质性切换时更新。"
        - "确保 specific（具体地点）与当前的剧情描述一致。"
  
  characters:
    type: |-
      { [name: string]: CharacterData }
    # 以下规则适用于所有角色
    data:
      status:
        location:
          check:
            - "必须精确追踪角色的物理位置。如果角色移动，立即更新。"
        action:
          check:
            - "描述角色当前正在进行的动作（如'喝茶', '战斗中', '倚墙而立'）。"
        mood:
          type: number
          range: -100~100
          check:
            - "根据剧情互动更新。-100(极度悲愤/恐惧) ~ 0(平静) ~ 100(极度狂喜)。"
            - "单次变化通常不超过 ±20，除非遭遇重大转折。"
        attire:
          check:
            - "除非剧情明确描述换装，否则保持不变。"
      
      cognition:
        towards_player:
          trust:
            type: number
            range: 0~200
            check:
              - "0(死敌) ~ 50(中立) ~ 100(信赖) ~ 200(灵魂伴侣)。"
              - "仅在发生有意义的互动（如救助、背叛、深入交谈）时更新。"
          attitude:
            check:
              - "用简练的词语描述对玩家的当前态度（如'警惕', '依赖', '冷漠'）。"
      
      profile:
        check:
          - "【严禁修改】: race, gender, background, appearance (除非发生毁容/变异等重大剧情)。"
          - "infection_status: 仅在通过医学检测确认病情变化时更新。"

  player:
    # 玩家规则与角色类似，但需关注 Inventory
    data:
      inventory:
        check:
          - "获得物品时: 添加新条目。"
          - "消耗/丢失物品时: 减少数量或移除条目。"
```

---

## 2. `[mvu_update]变量输出格式.ejs`

### 2.1 核心职责

此文件为 LLM 提供最终的输出协议。它将**严格复制** `.kilocode/workflows/✅变量输出格式.md` 中的原始格式，仅在 `<Analysis>` 中插入一步关于动态任务的指令。

### 2.2 伪代码

```ejs
<%#
======================================================================
 EJS 模板: [mvu_update]变量输出格式.ejs
 职责: 定义分析师 LLM 必须遵守的最终输出格式。
======================================================================
%>
<context>
NOTE: 请新建一个名为 `[mvu_update]变量输出格式` 的 D0 条目 (你也可以按需自己调整深度), 将代码块中的内容复制到该条目中
```yaml
---
变量输出格式:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:
      - replace: replace the value of existing paths
      - delta: update the value of existing number paths by a delta value
      - insert: insert new items into an object or array
      - remove
    - don't update field names starts with `_` as they are readonly, such as `_变量`
  format: |-
    <UpdateVariable>
    <Analysis>$(IN ENGLISH, no more than 80 words)
    - ${calculate time passed: ...}
    - ${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}
    - ${CHECK AND PLAN FOR TASKS: Check '第三部分：本轮行动指令'. If there are specific tasks, plan their execution priority.}
    - ${analyze every variable based on its corresponding `check`, according only to current reply instead of previous plots: ...}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "${/path/to/variable}", "value": "${new_value}" },
      { "op": "delta", "path": "${/path/to/number/variable}", "value": "${positve_or_negative_delta}" },
      { "op": "insert", "path": "${/path/to/object/new_key}", "value": "${new_value}" },
      { "op": "remove", "path": "${/path/to/array/0}" },
      ...
    ]
    </JSONPatch>
    </UpdateVariable>
```
</context>
```

---

## 3. 迭代与反馈机制

### 待办问题与讨论缓存区

*   **[确认 1] 规则的粒度**:
    *   **已解决**: 已将 `characters` 下的 `check` 规则细化到 `mood`, `trust` 等具体字段，并规定了数值范围和更新逻辑。
*   **[确认 2] 动态任务的优先级**:
    *   **策略**: 在 Format 的 `<Analysis>` 中明确插入了 `${CHECK AND PLAN FOR TASKS}` 步骤，确保特定任务被优先处理。

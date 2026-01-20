# Phase 2.1: 变量架构设计草案 (Variable Architecture Draft)

**日期**: 2026-01-16
**状态**: 草案 (Draft) - 待补充 Prompt 设计
**关联规划**: `.kilocode/development_logs/006_Phase2.1_MVU_Integration.md`

---

## 1. 核心设计策略 (Core Strategy)

基于对旧项目痛点（Token膨胀、一致性差）的反思，本架构采用 **“混合数据流 (Hybrid Data Flow)”** 策略。

### 1.1 静态与动态分离
*   **静态数据 (Static)**: 存储于 **Worldbook (YAML)**。
    *   内容: 相对固定的设定（如种族、出身、基础人设、长期人际关系）。
    *   维护: 人工编写/修改，AI 默认只读。
*   **动态数据 (Dynamic)**: 存储于 **MVU 变量 (Zod)**。
    *   内容: 随剧情实时变化的状态（如位置、情绪、短期记忆、物品消耗）。
    *   维护: AI 通过 MVU 系统高频读写。

### 1.2 智能注入机制 (Injection Mechanism)
不再将所有数据堆积在变量中，而是根据 **“是否存在静态档案”** 动态决定注入策略：
1.  **存在静态档案 (Known Character)**:
    *   后端读取 YAML 条目。
    *   仅将 MVU 中的 **动态数据** (Status/Memory) 格式化为文本，**追加注入** 到该条目末尾。
2.  **不存在静态档案 (New/Unknown Character)**:
    *   MVU 变量中存储 **完整档案** (Full Profile + Dynamic Data)。
    *   将 **完整档案** 注入到上下文中。

---

## 2. 变量结构定义 (Zod Schema)

### 2.1 全局状态 (Global)
```typescript
const WorldState = z.object({
  // 强校验时间格式
  time: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "必须是 YYYY-MM-DD HH:mm:ss"),
  location: z.object({
    region: z.string(), // 国家
    place: z.string(),  // 城市
    detail: z.string()  // 细节
  }),
  weather: z.string(),
  // 任务队列 (SystemFlags 复刻)
  tasks: z.object({
    char_init: z.array(z.string()).describe('待初始化的角色名队列'),
    summary_pending: z.boolean().describe('是否需要执行轮总结')
  })
});
```

### 2.2 角色数据 (Character Data)

#### A. 认知/记忆模块 (Cognition & Memory)
参考“粥粥数据库”，构建五维记忆结构：
```typescript
const Cognition = z.object({
  // 认知三维 (由 AI 分析得出)
  known_facts: z.array(z.string()).describe('确信已知的情报'),
  unknown_secrets: z.array(z.string()).describe('意识到的信息盲区/疑问'),
  misconceptions: z.array(z.string()).describe('持有的错误判断/误区'),
  
  // 记忆流
  recent_thoughts: z.array(z.string()).describe('最近 10 轮的短期想法/经历'),
  long_term_memories: z.array(z.object({
    title: z.string().describe('记忆标题'),
    content: z.string().describe('关键记忆内容')
  })).describe('凝练后的长期记忆 (只增不减)')
});
```

#### B. 状态模块 (Status)
```typescript
const Status = z.object({
  physical: z.enum(['健康', '轻伤', '重伤', '濒死', '已死亡']),
  infection: z.object({ 
    stage: z.enum(['非感染者', '潜伏期', '前期', '中期', '末期']),
    monitor_color: z.enum(['Green', 'Yellow', 'Red']).describe('UI 监视器颜色')
  }).optional(),
  posture: z.string(),
  action: z.string(),
  mood: z.number().min(-100).max(100),
  trust: z.number().min(0).max(200)
});
```

### 2.3 玩家档案 (Player)
采用 **混合初始化** 策略，结构包含 `Profile`, `Inventory`, `Skills`, `Social`。

---

## 3. 核心工作流 (Workflows)

### 3.1 记忆总结循环
1.  **积累**: 每轮对话将 AI 的“内心独白”存入 `recent_thoughts`。
2.  **触发**: 当 `recent_thoughts` 达到 10 条时，触发总结任务。
3.  **解析**: 额外 LLM 分析想法，更新 `Cognition` 三维，并提炼 `long_term_memory`。
4.  **清理**: 清空 `recent_thoughts`。

### 3.2 编年史系统
*   暂行方案：在 MVU 变量中保留 `Chronicle` 对象 (Daily/Weekly)。
*   优化路线：先跑通逻辑，待稳定后再做“存入 Worldbook 条目”的优化。

### 3.3 玩家初始化
1.  **UI 引导**: 终端界面弹出“干员入职申请表”。
2.  **AI 补全**: 若玩家跳过，由 AI 自动补全。

---

## 4. 待办事项 (Pending)
*   **Prompt 设计**: 针对额外 LLM 的“破限预设”与“变量提取 Prompt”设计 (明日讨论)。

# shujuku 提示词管线与三大业务环逆向分析报告 (1_4_shujuku提示词管线与三大业务环逆向分析.md)

> **逆向对象**: `D:\LLM\self_programming\shujuku` 核心代码库  
> **分析文件**: `src/shared/defaults-json.js`、`src/service/summary/merge-logic.ts`、`src/service/plot/plot-logic.ts`、`src/service/plot/plot-orchestrator.ts`  
> **逆向结论**: `shujuku` 并不是一个普通的静态数据库存取插件。它的底层本质是一个**以 SQLite 关系型表格为长期记忆体与状态底座的、高度复杂的 Multi-Agent 提示词管线编排器**。

---

## 一、 提示词模型与 DDL/SQL 的底层咬合机制

在 `shujuku` 的 `src/shared/defaults-json.js` 中，定义了四套核心提示词模板，用于指导 AI 如何与关系型表格（SQLite）和 DDL 结构进行交互。

### 1.1 填表提示词的物理对齐 (`DEFAULT_CHAR_CARD_PROMPT_SQL_ACU`)
当插件切换至 SQLite 模式时，主系统提示词（`mainSlot: 'A'`）会物理替换为 SQL 专属填表提示词。其核心结构为：

1.  **资料来源输入（三层漏斗）**：
    *   `<背景设定>`：注入角色人设与静态背景。
    *   `<正文数据>`：上一轮发生的对话故事。
    *   `<当前表格数据>`：注入 SQLite 中所有用户表的 **`CREATE TABLE` 建表语句（DDL）及当前行数据**。
2.  **强制双壳输出结构（严格执行）**：
    AI 必须仅输出 `<thought>` 与 `<content>` 两个标签块：
    *   `<thought>`：进行剧情分析、阅读 Note 约束、确定修改字段。
    *   `<content>`：内部包裹唯一一个 `<tableEdit>` 标签，直接书写标准 SQL 变动。
3.  **SQL 编写硬原则限制**：
    *   **INSERT 禁用主键**：必须显式列出业务列，但**绝对禁止手写 row_id**（如计算 `MAX(row_id)` 或手写主键值），主键必须留空由 SQLite 自动递增分配。
    *   **UPDATE/DELETE 强绑定 WHERE 条件**：绝对禁止无条件全局更新。WHERE 过滤优先级为：DQL 推荐示例 $\rightarrow$ UNIQUE 约束列定位（如 `WHERE name = '阿米娅'`） $\rightarrow$ CHECK 业务列定位 $\rightarrow$ row_id 定位。
    *   **格式要求**：字符串必须用单引号包裹（数字不加引号）。若值内部有单引号，**必须使用两个单引号转义**（如 `'秉持''谁欺负我就打谁''的信念'`）。

### 1.2 严格 JSON 填表协议的分支 (`DEFAULT_CHAR_CARD_PROMPT_SQL_STRICT_JSON_ACU`)
对于不支持自由标签（如 `<tableEdit>`）的次级小模型，`shujuku` 设计了严格 JSON 翻译器 `buildStrictJsonSqlPrompt_ACU()`。
*   它强制抹除 `<thought>` 和 `<tableEdit>`。
*   强制 AI 回复一个 100% 纯净的、无 Markdown 代码块包裹的 JSON 对象：
    `{"format":"table_edit_sql_v1","sql":"INSERT INTO...; UPDATE...;"}`
*   换行符必须物理转义为 `\n`，双引号转义为 `\"`，以确保 `JSON.parse` 能够直接成功执行。

---

## 二、 "天之音" 时间线记忆召回与注入机制逆向 (Pre-Main Call)

### 2.1 业务定位
在主模型运行前执行的**前置同步阻塞调用**。其使命是将数据库中 `chronicle`（纪要表）内存储的 `AMXXXX` 编码与当前剧情进行语义关联，并将其“翻译”为带有自然时间修饰词的记忆碎片注入系统提示词。

### 2.2 核心代码逻辑流（`plot-logic.ts` / `plot-orchestrator.ts`）
1.  **触发拦截**：当玩家在输入框点击发送时，`orchestrateTavernHelperHook_ACU()` 拦截原生发包，标记 `_plot_processed = true`。
2.  **天之音发包**：调用次级 API。传入最近 3 轮对话、背景设定、以及从 SQLite 纪要表中导出的全部 `AMXXXX` 编码大纲。
3.  **约束召回（Hard Gate）**：
    依据 `DEFAULT_TIME_RECALL_PLOT_PRESET_ACU` 指令，天之音必须选出与当前输入最相关的 $N$ 条事件编码。选取的编码数通过公式决定：
    $$\text{required\_count} = \min(\text{zhaohui}, \text{total\_AM\_in\_chronicle})$$
4.  **自然时间修饰词映射（Time-Word Mapping）**：
    召回的 AM 事件在注入主模型前，系统会物理计算其与当前 turn 的发生时间差，并依据内置的时间预设词映射表进行**自然时间翻译**：
    *   发生于 5 分钟内 $\rightarrow$ 映射为 `now` （刚刚|刚才|眼下|此刻|这会儿）
    *   发生于半天内 $\rightarrow$ 映射为 `today` （今天早些时候|今天稍早|白天的时候）
    *   发生于 1-3 天内 $\rightarrow$ 映射为 `days` （这两天|这几天|近几天|前些天）
    *   发生于 1-2 周内 $\rightarrow$ 映射为 `weeks` （前阵子|这阵子|早些时候）
    *   发生于 1 个月内 $\rightarrow$ 映射为 `months` （半个月前|上个月|之前）
    *   发生于 1 个季度内 $\rightarrow$ 映射为 `seasons` （几个月前|小半年前|当时|那阵子）
    *   发生于 1 年内 $\rightarrow$ 映射为 `years` （一年前|去年|前几年）
    *   超过 1 年 $\rightarrow$ 映射为 `old` （很久以前|过去|那阵子）
5.  **幽灵注入**：将时间翻译词与 AM 纪要概要拼接成提示词切片（例如：“*前些天*，你曾与阿米娅在罗德岛走廊商讨无人机零件修复”），动态替换入唯一的占位宏 `{{prompt}}`，实现无痕的前后因果连续性。

---

## 三、 "填表美杜莎" 大纲合并与收缩机制逆向 (Background Compacter)

### 3.1 业务定位
**防止数据与 Token 膨胀的后台主动抗熵机制**。随着 RP 过程推移，原始纪要行在 SQLite 中线性累加。美杜莎引擎在后台定期运行，通过标准 DML 将散乱的历史行合并压缩为单条规范的 `AMXXXX` 纪要。

### 3.2 物理触发与合并逻辑（`merge-logic.ts`）
1.  **触发检查 (`checkAutoMergeTrigger_ACU`)**：
    系统每次交互完毕后，会自动盘点 `chronicle`（纪要/总结表）中未精简的原始行数（排除被标记为 `auto_merged` 或已合并订单的行）：
    $$\text{summaryCount} = \text{未精简行数}$$
    当 $\text{summaryCount} \ge \text{threshold (默认20)} + \text{reserve (留存行数)}$ 时，物理触发自动合并。
2.  **准备数据批次 (`prepareAutoMergeBatches_ACU`)**：
    提取该批次（如 $0 \sim 20$ 行）的纪要正文，拼接成未精简的文本块 `$A$`；同时提取上一条已经被精简过的美杜莎纪要作为基础底稿 `$BASE_DATA$`。
3.  **CoAT (Chain of All-pass Thought) 线性化七步推理**：
    调用 `DEFAULT_MERGE_SUMMARY_PROMPT_SQL_ACU`。美杜莎 AI 必须在 `<thought>` 标签内执行以下步骤：
    *   **Step 1 - Analyze (分析)**：盘点已有精简编码，计算本次新增条目，识别原始数据中的内容重叠。
    *   **Step 2 - Draft (草稿生成)**：生成 2-3 种合并策略草稿。
    *   **Step 3 - Select (策略选择)**：评估策略在字数可控度、信息保留度上的表现，选择 BestStrategy。
    *   **Step 4 - Expand (精简扩写)**：根据策略将多行日志压缩合并为目标单条记录，并分配格式。
    *   **Step 5 - Audit (硬约束审计)**：逐一审查 C1~C8 硬约束：
        *   *C1/C5-编码递增连续*：编码索引必须为连续递增的 `AM0001`、`AM0002`。
        *   *C2-字数红线*：**生成的纪要内容字数必须满足 $\ge 300$ 且 $\le 400$ 个汉字**。
        *   *C3-概要红线*：概要字数必须 $\le 30$ 汉字。
        *   *C8-指令限制*：仅允许输出 SQLite standard INSERT 语句。
    *   **Step 6 - Verify (自评校准)**：
        执行公式计算质量分：
        $$Fg = 0.30 \cdot g1 \text{(约束)} + 0.25 \cdot g2 \text{(保真)} + 0.20 \cdot g3 \text{(精简)} + 0.15 \cdot g4 \text{(时序)} + 0.10 \cdot g5 \text{(通顺)}$$
        只有满足 $Fg \ge 0.80$ 阈值方可进入下一步，否则强行触发内部纠偏。
    *   **Step 7 - Output (DML 输出)**：
        在 `<tableEdit>` 中输出最终的标准 SQL INSERT 语句（向 `chronicle` 表物理追加新生成的精简纪要，标记其为 `auto_merged`，并物理删除原来的 20 条零散明细行）。
4.  **事务提交与落盘**：
    调用 `runTableUpdateCommit_ACU` 启动 SQLite 事务，执行合并 SQL，导出为最新 JSON 快照。随后调用 `updateReadableLorebookEntry_ACU(true)`，将合并结果重新动态水合至酒馆的前台世界书，彻底重置未精简计数器，释放 Token 负担。

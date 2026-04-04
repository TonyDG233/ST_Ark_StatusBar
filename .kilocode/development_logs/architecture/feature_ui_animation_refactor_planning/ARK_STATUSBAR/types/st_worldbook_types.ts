export type WorldbookEntry = {
  /** uid 是相对于世界书内部的, 不要跨世界书使用 */
  uid: number;
  name: string;
  enabled: boolean;

  /** 激活策略: 条目应该何时激活 */
  strategy: {
    /**
     * 激活策略类型:
     * - `'constant'`: 常量🔵, 俗称蓝灯. 只需要满足 "启用"、"激活概率%" 等别的要求即可.
     * - `'selective'`: 可选项🟢, 俗称绿灯. 除了蓝灯条件, 还需要满足 `keys` 扫描条件
     * - `'vectorized'`: 向量化🔗. 一般不使用
     */
    type: 'constant' | 'selective' | 'vectorized';
    /** 主要关键字. 绿灯条目必须在欲扫描文本中扫描到其中任意一个关键字才能激活 */
    keys: (string | RegExp)[];
    /**
     * 次要关键字. 如果次要关键字的 `keys` 数组不为空, 则条目除了在主要关键字中匹配到任意一个关键字外, 还需要满足 `logic`:
     * - `'and_any'`: 次要关键字中任意一个关键字能在欲扫描文本中匹配到
     * - `'and_all'`: 次要关键字中所有关键字都能在欲扫描文本中匹配到
     * - `'not_all'`: 次要关键字中至少有一个关键字没能在欲扫描文本中匹配到
     * - `'not_any'`: 次要关键字中所有关键字都没能欲扫描文本中匹配到
     */
    keys_secondary: { logic: 'and_any' | 'and_all' | 'not_all' | 'not_any'; keys: (string | RegExp)[] };
    /** 扫描深度: 1 为仅扫描最后一个楼层, 2 为扫描最后两个楼层, 以此类推 */
    scan_depth: 'same_as_global' | number;
  };
  /** 插入位置: 如果条目激活应该插入到什么地方 */
  position: {
    /**
     * 位置类型:
     * - `'before_character_definition'`: 角色定义之前
     * - `'after_character_definition'`: 角色定义之后
     * - `'before_example_messages'`: 示例消息之前
     * - `'after_example_messages'`: 示例消息之后
     * - `'before_author_note'`: 作者注释之前
     * - `'after_author_note'`: 作者注释之后
     * - `'at_depth'`: 插入到指定深度
     */
    type:
      | 'before_character_definition'
      | 'after_character_definition'
      | 'before_example_messages'
      | 'after_example_messages'
      | 'before_author_note'
      | 'after_author_note'
      | 'at_depth'
      | 'outlet';
    /** 该条目的消息身份, 仅位置类型为 `'at_depth'` 时有效 */
    role: 'system' | 'assistant' | 'user';
    /** 该条目要插入的深度, 仅位置类型为 `'at_depth'` 时有效 */
    depth: number;
    // TODO: 世界书条目的插入: 文档链接
    order: number;
  };

  content: string;

  probability: number;
  /** 递归表示某世界书条目被激活后, 该条目的提示词又激活了其他条目 */
  recursion: {
    /** 禁止其他条目递归激活本条目 */
    prevent_incoming: boolean;
    /** 禁止本条目递归激活其他条目 */
    prevent_outgoing: boolean;
    /** 延迟到第 n 级递归检查时才能激活本条目 */
    delay_until: null | number;
  };
  effect: {
    /** 黏性: 条目激活后, 在之后 n 条消息内始终激活, 无视激活策略、激活概率% */
    sticky: null | number;
    /** 冷却: 条目激活后, 在之后 n 条消息内不能再激活 */
    cooldown: null | number;
    /** 延迟: 聊天中至少有 n 楼消息时, 才能激活条目 */
    delay: null | number;
  };

  /** 额外字段, 用于为世界书条目绑定额外数据 */
  extra?: Record<string, any>;
};

import type { WorldbookEntry } from '../../types/st_worldbook_types';

/**
 * 核心架构毒瘤切除防线：世界书数据结构转译器
 * 负责在酒馆原生事件底层数据与酒馆助手 API 标准结构之间建立防腐隔离。
 */
export class WorldbookMapper {
  /**
   * 将被动监听（如 world_info_activated, WORLDINFO_UPDATED）获取的原生扁平数据，
   * 安全地清洗并转译为本系统规范的树状 WorldbookEntry。
   *
   * @param raw 酒馆原生事件抛出的脏对象 (FlattenedWorldInfoEntry 或类似物)
   * @returns 纯净的、满足 st_worldbook_types 的标准对象
   */
  public static fromFlattenedNative(raw: SillyTavern.FlattenedWorldInfoEntry): WorldbookEntry {
    if (!raw) {
      throw new Error('[ARK_Mapper] Cannot map empty native object');
    }

    // 防御性拷贝：防止在组装过程中由于浅拷贝导致内存引用污染
    const clonedRaw = { ...raw };

    // 解析 Strategy Type
    // 原生通常使用 constant 和 selective 的布尔组合。
    let strategyType: 'constant' | 'selective' | 'vectorized' = 'selective';
    if (clonedRaw.vectorized) {
      strategyType = 'vectorized';
    } else if (clonedRaw.constant) {
      strategyType = 'constant';
    } else if (clonedRaw.selective) {
      strategyType = 'selective';
    } else {
      // 兜底逻辑
      strategyType = 'constant';
    }

    // 解析 Position Type
    let posType: WorldbookEntry['position']['type'] = 'before_character_definition';
    switch (clonedRaw.position) {
      case 0:
        posType = 'before_character_definition';
        break;
      case 1:
        posType = 'after_character_definition';
        break;
      case 2:
        posType = 'before_example_messages';
        break;
      case 3:
        posType = 'after_example_messages';
        break;
      case 4:
        posType = 'before_author_note';
        break;
      case 5:
        posType = 'after_author_note';
        break;
      case 6:
        posType = 'at_depth';
        break;
    }

    // 解析 Role
    let role: 'system' | 'user' | 'assistant' = 'system';
    if (clonedRaw.role === 1) role = 'user';
    else if (clonedRaw.role === 2) role = 'assistant';

    // 解析 Secondary Logic
    let secLogic: 'and_any' | 'and_all' | 'not_all' | 'not_any' = 'and_any';
    switch (clonedRaw.selectiveLogic) {
      case 0:
        secLogic = 'and_any';
        break;
      case 1:
        secLogic = 'not_all';
        break;
      case 2:
        secLogic = 'not_any';
        break;
      case 3:
        secLogic = 'and_all';
        break;
    }

    return {
      uid: clonedRaw.uid ?? -1,
      name: clonedRaw.comment || '',
      enabled: !clonedRaw.disable,

      strategy: {
        type: strategyType,
        keys: Array.isArray(clonedRaw.key) ? [...clonedRaw.key] : [],
        keys_secondary: {
          logic: secLogic,
          keys: Array.isArray(clonedRaw.keysecondary) ? [...clonedRaw.keysecondary] : [],
        },
        scan_depth: clonedRaw.scanDepth ?? 'same_as_global',
      },

      position: {
        type: posType,
        role: role,
        depth: clonedRaw.depth ?? 0,
        order: clonedRaw.order ?? 100,
      },

      content: clonedRaw.content || '',
      probability: clonedRaw.probability ?? 100,

      recursion: {
        prevent_incoming: !!clonedRaw.preventRecursion, // 注意原生的命名可能没有下划线
        prevent_outgoing: !!clonedRaw.excludeRecursion,
        delay_until: clonedRaw.delayUntilRecursion ? 1 : null, // 简化处理
      },

      effect: {
        sticky: clonedRaw.sticky ?? null,
        cooldown: clonedRaw.cooldown ?? null,
        delay: clonedRaw.delay ?? null,
      },

      extra: clonedRaw.extra ? { ...clonedRaw.extra } : undefined,
    };
  }

}
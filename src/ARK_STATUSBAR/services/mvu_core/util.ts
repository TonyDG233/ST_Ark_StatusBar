import * as jsonpatch from 'fast-json-patch';
import { klona } from 'klona';
import { useDataStore } from './store';
import { isMvuData, MvuData } from './variable_def';

export const saveChatDebounced = _.debounce(SillyTavern.saveChat, 1000);

/**
 * 寻找包含变量信息的最后一个楼层
 * @param end_message_id 从哪一条消息开始倒序搜索(不含那一条)
 */
export function getLastValidMessageId(end_message_id: number): number {
  return _(SillyTavern.chat)
    .slice(0, end_message_id)
    .findLastIndex(chat_message => {
      return isMvuData(_.get(chat_message, ['variables', chat_message.swipe_id ?? 0], {}));
    });
}

export function getLastValidVariable(end_message_id: number): MvuData | undefined {
  const message_id = getLastValidMessageId(end_message_id);
  if (message_id === -1) {
    return undefined;
  }
  return klona(
    _.get(SillyTavern.chat[message_id], ['variables', SillyTavern.chat[message_id].swipe_id ?? 0], {}) as MvuData,
  );
}

export function controlledStoppableEventOn<T extends EventType>(event_type: T, listener: ListenerType[T]) {
  const store = useDataStore();
  const wrapper = (...args: any[]) => {
    if (store.should_enable) {
      return listener(...args);
    }
  };
  eventOn(event_type, wrapper);
  return () => eventRemoveListener(event_type, wrapper);
}

export function isJsonPatch(patch: any): patch is jsonpatch.Operation[] {
  if (!Array.isArray(patch)) {
    return false;
  }
  // An empty array is a valid patch.
  if (patch.length === 0) {
    return true;
  }
  return patch.every(
    op =>
      _.isPlainObject(op) &&
      typeof op.op === 'string' &&
      (typeof op.path === 'string' || (op.op === 'move' && typeof op.to === 'string')),
  );
}

export function showHelpPopup(content: string) {
  SillyTavern.callGenericPopup(content, SillyTavern.POPUP_TYPE.TEXT, '', {
    allowVerticalScrolling: true,
    leftAlign: true,
    wide: true,
  });
}

export function normalizeBaseURL(api_url: string): string {
  api_url = api_url.trim().replace(/\/+$/, '');
  if (!api_url) {
    return '';
  }
  if (api_url.endsWith('/v1')) {
    return api_url;
  }
  if (api_url.endsWith('/models')) {
    return api_url.replace(/\/models$/, '');
  }
  if (api_url.endsWith('/chat/completions')) {
    return api_url.replace(/\/chat\/completions$/, '');
  }
  return `${api_url}/v1`;
}

/**
 * 将当前脚本实例注册到共享的“唯一脚本”命名空间。
 *
 * 当同一脚本被重复加载时，优先实例为：仍存在于 TavernHelper 脚本列表中、
 * 且在注册顺序上最后出现的 script id。
 * 调用方可通过 `listenPreferenceState` 订阅优先实例变化，并仅在
 * `getScriptId()` 与优先实例一致时启用功能。
 */
export function registerAsUniqueScript(id: string): {
  unregister: () => void;
  getPreferredScriptId: () => string | undefined;
  listenPreferenceState: (callback: (perferred_script_id: string) => void) => EventOnReturn;
} {
  // 当前实例在 TavernHelper 中的唯一脚本 ID。
  const script_id = getScriptId();
  // 以业务 id 作为命名空间，避免不同功能之间冲突。
  const path = `th_unique_check.${id}`;

  const getPreferredScriptId = () => {
    // 从共享状态中取出已注册实例集合（跨脚本实例共享在 window.parent）。
    const registered_scripts = _.get(window.parent, path, new Set<string>());
    // 以页面上实际存在的脚本顺序为准，选出“最后一个仍有效”的实例作为优先实例。
    return _($('#tavern_helper').find('div[data-script-id]').toArray())
      .map(element => String($(element).attr('data-script-id')))
      .filter(element => registered_scripts.has(element))
      .last();
  };

  // 将当前实例加入注册集合。不存在的场合创建。
  _.update(window.parent, path, (value: Set<string> | undefined) => {
    if (value === undefined) {
      return new Set([script_id]);
    }
    //避免重复添加
    if (value.has(script_id)) return value;
    value.add(script_id);
    return value;
  });
  // 广播一次当前优先实例，通知监听方更新启用状态。
  eventEmit(path, getPreferredScriptId());

  return {
    unregister: () => {
      // 卸载时从注册集合移除，并重新广播优先实例。
      _.update(window.parent, path, (value: Set<string> | undefined) => {
        if (value !== undefined) {
          value.delete(script_id);
        }
        return value;
      });
      eventEmit(path, getPreferredScriptId());
    },
    getPreferredScriptId,
    // 监听优先实例变化（回调入参是当前优先实例 script id）。
    listenPreferenceState: (callback: (enabled_script_id: string) => void) => {
      const ret = eventOn(path, callback);
      // 广播一次当前优先实例，通知监听方更新启用状态。
      eventEmit(path, getPreferredScriptId());
      return ret;
    },
  };
}

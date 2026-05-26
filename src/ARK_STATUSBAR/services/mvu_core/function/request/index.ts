import { controlledStoppableEventOn } from '../../util';
import { overrideToolRequest, registerFunction } from '../function_call';
import { applyExtraModelRequestOverrides } from './extra_model_request_override';
import { filterEntries } from './filter_entries';
import { filterPrompts } from './filter_prompts';

export function initRequest() {
  const stop_list: Array<() => void> = [];
  stop_list.push(registerFunction());

  stop_list.push(controlledStoppableEventOn('worldinfo_entries_loaded', filterEntries));
  stop_list.push(
    controlledStoppableEventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, applyExtraModelRequestOverrides),
  );
  stop_list.push(controlledStoppableEventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, overrideToolRequest));
  stop_list.push(controlledStoppableEventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, filterPrompts));

  return () => {
    stop_list.forEach(stop => stop());
  };
}

import { is_jest_environment } from '../../jest';

import { controlledStoppableEventOn } from '../../util';
import { handleVariablesInMessage } from '../update_variables';
import { onMessageReceived } from './on_message_received';

export function initResponse() {
    const stop_list: Array<() => void> = [];
    stop_list.push(
        controlledStoppableEventOn(tavern_events.MESSAGE_SENT, handleVariablesInMessage)
    );
    stop_list.push(
        controlledStoppableEventOn(
            tavern_events.MESSAGE_RECEIVED,
            is_jest_environment ? onMessageReceived : _.throttle(onMessageReceived, 3000)
        )
    );
    return () => {
        stop_list.forEach(stop => stop());
    };
}

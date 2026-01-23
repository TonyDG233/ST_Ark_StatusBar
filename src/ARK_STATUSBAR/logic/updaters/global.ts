// @ts-nocheck
import { cloneDeep, get, set } from 'lodash';
import { isCharacterTaskCompleted } from './character';
import { isChronicleTaskCompleted } from './chronicle';
import { isPlayerTaskCompleted } from './player';

const LOG_PREFIX = '[ARK_Global]';

// =======================================================================
// Section 1: Core Logic Modules
// =======================================================================

/**
 * Increments the total turn count.
 * @param {object} variables - The full MVU variables object.
 */
function incrementTurnCounter(variables) {
    const totalTurns = get(variables, 'stat_data.global.game_progress.total_turns', 0);
    set(variables, 'stat_data.global.game_progress.total_turns', totalTurns + 1);
    console.log(`${LOG_PREFIX} Total turns incremented to ${totalTurns + 1}.`);
}

/**
 * Finds and processes tasks that have been completed by the LLM.
 * This is the central hub for task post-processing.
 * @param {object} newVariables - The latest MVU variables.
 * @param {object} oldVariables - The MVU variables from before the update.
 */
async function postProcessCompletedTasks(newVariables, oldVariables) {
    let currentQueue = get(newVariables, 'stat_data.task_queue', []);
    if (currentQueue.length === 0) return;

    console.log(`${LOG_PREFIX} Post-processing ${currentQueue.length} tasks...`);
    
    const tasksToRemove = [];

    for (const task of currentQueue) {
        let isCompleted = false;
        try {
            switch (task.type) {
                case 'init_profile':
                case 'repair_profile':
                case 'summarize_memory':
                    isCompleted = await isCharacterTaskCompleted(task, newVariables, oldVariables);
                    break;
                case 'ten_round_summary':
                case 'daily_summary':
                case 'weekly_summary':
                case 'monthly_summary':
                case 'yearly_summary':
                    isCompleted = await isChronicleTaskCompleted(task, newVariables, oldVariables);
                    break;
                case 'init_player_profile':
                case 'repair_player_profile':
                    isCompleted = await isPlayerTaskCompleted(task, newVariables, oldVariables);
                    break;
                default:
                    console.warn(`${LOG_PREFIX} Unknown task type: ${task.type}`);
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} Error checking task completion for ${task.id}:`, e);
        }

        if (isCompleted) {
            tasksToRemove.push(task.id);
        }
    }

    if (tasksToRemove.length > 0) {
        const updatedQueue = currentQueue.filter(task => !tasksToRemove.includes(task.id));
        set(newVariables, 'stat_data.task_queue', updatedQueue);
        console.log(`${LOG_PREFIX} Removed ${tasksToRemove.length} completed tasks: ${tasksToRemove.join(', ')}.`);
    }
}


// =======================================================================
// Main Event Handler
// =======================================================================

eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async (newVariables, oldVariables) => {
    console.log(`${LOG_PREFIX} VARIABLE_UPDATE_ENDED triggered.`);
    
    const mutableVariables = cloneDeep(newVariables);

    // 1. Increment game turn counter.
    incrementTurnCounter(mutableVariables);
    
    // 2. Process and clean up any completed tasks from the queue.
    await postProcessCompletedTasks(mutableVariables, oldVariables);

    // Replace variables once at the end.
    Mvu.replaceMvuData(mutableVariables);
    
    console.log(`${LOG_PREFIX} Global update cycle finished.`);
});

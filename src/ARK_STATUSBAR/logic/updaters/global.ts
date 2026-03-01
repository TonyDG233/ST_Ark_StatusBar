// @ts-nocheck
import { get, isEqual, set } from 'lodash';
// 导入其他模块的处理函数
import { isCharacterTaskCompleted, processCharacterUpdates } from './character';
import { isChronicleTaskCompleted, processChronicleUpdates } from './chronicle';
import { isPlayerTaskCompleted, processPlayerUpdates } from './player';

const LOG_PREFIX = '[ARK_Global]';

// A module-level flag to ensure event listeners are not registered multiple times.
let isBackendInitialized = false;
let isFirstMessageSent = false;

// Store listener references to be able to remove them later
let variableUpdateListener = null;
let messageSentListener = null;

// =======================================================================
// Section 1: Core Logic Modules
// =======================================================================

/**
 * Checks if the backend logic should proceed based on variable changes.
 * This acts as a "pendulum" to process updates only once per turn (in the 'update' phase).
 * @param {object} newVariables
 * @param {object} oldVariables
 * @returns {boolean}
 */
function shouldProcessUpdates(newVariables, oldVariables) {
  if (isEqual(newVariables, oldVariables)) {
    console.log(`${LOG_PREFIX} No variable changes detected (plot phase). Skipping backend logic.`);
    return false;
  }
  return true;
}

/**
 * Increments the total turn counter.
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

/**
 * Contains the logic from the original global.ts listener.
 */
async function processGlobalUpdates(newVariables, oldVariables) {
  incrementTurnCounter(newVariables);
  await postProcessCompletedTasks(newVariables, oldVariables);
}

// =======================================================================
// Main Entry Point for Backend Logic
// =======================================================================

/**
 * Initializes all backend logic.
 * This is the SINGLE entry point for all backend systems.
 */
export async function initializeBackendLogic() {
  // --- LOGIC ISOLATION ---
  // To prevent Initialization Storm on turn 0, and to isolate failed backend logic
  if (SillyTavern.getContext().turn === 0) {
    console.log(`[ARK_Logic_Global] Turn 0 detected. Skipping backend logic initialization to allow clean MVU init.`);
    return;
  }

  // 1. Cleanup old listeners to ensure a clean state, especially on chat change.
  if (variableUpdateListener) {
    eventRemoveListener(Mvu.events.VARIABLE_UPDATE_ENDED, variableUpdateListener);
    variableUpdateListener = null;
  }
  if (messageSentListener) {
    eventRemove - listener(tavern_events.MESSAGE_SENT, messageSentListener);
    messageSentListener = null;
  }

  // 2. Reset state flags for the new session.
  isFirstMessageSent = false;
  console.log(`${LOG_PREFIX} Backend logic (re)initializing... State flags reset.`);

  try {
    // 3. Wait for MVU to be available.
    await waitGlobalInitialized('Mvu');
    console.log(`${LOG_PREFIX} MVU is ready. Registering new listeners...`);

    // 4. Register the Main Event Loop.
    variableUpdateListener = async (newVariables, oldVariables) => {
      // Pendulum check
      if (!shouldProcessUpdates(newVariables, oldVariables)) {
        return;
      }

      // Set session_started flag on the first valid update after the first message.
      if (isFirstMessageSent && !get(newVariables, 'stat_data.global._internal.session_started', false)) {
        set(newVariables, 'stat_data.global._internal.session_started', true);
        console.log(`${LOG_PREFIX} Session started flag has been set directly within the main loop.`);
        isFirstMessageSent = false; // Consume the flag
      }

      // Main Gate
      if (
        !get(newVariables, 'stat_data.global._internal.session_started', false) ||
        !get(newVariables, 'stat_data.global._internal.backend_logic_enabled', true)
      ) {
        return;
      }

      console.log(`${LOG_PREFIX} Main Backend Loop Triggered.`);

      await processCharacterUpdates(newVariables, oldVariables);
      await processPlayerUpdates(newVariables, oldVariables);
      await processChronicleUpdates(newVariables, oldVariables);
      await processGlobalUpdates(newVariables, oldVariables);

      console.log(`${LOG_PREFIX} Main Backend Loop Finished.`);
    };
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, variableUpdateListener);

    // 5. Register the one-time listener that just flips the flag.
    messageSentListener = () => {
      console.log(`${LOG_PREFIX} First message sent. Flag set.`);
      isFirstMessageSent = true;
      // This listener should only ever fire once per chat session.
      eventRemoveListener(tavern_events.MESSAGE_SENT, messageSentListener);
      messageSentListener = null;
    };
    eventOn(tavern_events.MESSAGE_SENT, messageSentListener);

    console.log(`${LOG_PREFIX} Backend logic initialized and waiting for session start.`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to initialize backend logic:`, err);
  }
}

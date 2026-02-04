// @ts-nocheck
import { get, isEqual } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { PlayerSchema } from '../../mvu/schemas/player';

const LOG_PREFIX = '[ARK_Player]';

// =======================================================================
// Section 1: Task Pushing Logic
// =======================================================================

function pushTask(queue, task) {
  console.log(`${LOG_PREFIX} Pushing new task of type "${task.type}".`);
  
  const taskWithId = { id: uuidv4(), ...task };
  queue.push(taskWithId);
  queue.sort((a, b) => b.priority - a.priority);

  return queue;
}

// =======================================================================
// Section 2: Core Logic Modules
// =======================================================================

function validateAndRepairPlayer(playerData, taskQueue) {
  const validationResult = PlayerSchema.safeParse(playerData);

  if (!validationResult.success) {
    const issues = validationResult.error.issues;
    const missingPaths = issues.map(issue => issue.path.join('.'));

    console.warn(
      `${LOG_PREFIX} Validation failed for Player. Pushing repair task for fields: ${missingPaths.join(', ')}`,
    );

    pushTask(taskQueue, {
      type: 'repair_player_profile',
      priority: 51,
      target_char: 'player',
      payload: { fields: missingPaths },
    });
  }
}

// =======================================================================
// Main Exported Function
// =======================================================================

/**
 * Main processing function for player-related updates.
 * This is called by the global updater.
 * @param {object} newVariables - The new MVU variables (mutable).
 * @param {object} oldVariables - The old MVU variables (read-only).
 */
export async function processPlayerUpdates(newVariables, oldVariables) {
  console.log(`${LOG_PREFIX} Processing player updates...`);

  // Initialize task queue reference (In-Place modification)
  const taskQueue = get(newVariables, 'stat_data.task_queue', []);

  // EJS 模板现在负责处理开局初始化。
  // 后端不再需要检查和推送初始化任务。

  const player = get(newVariables, 'stat_data.player', {});
  const oldPlayer = get(oldVariables, 'stat_data.player', {});

  // 2. Check for changes and run validation
  if (!isEqual(player, oldPlayer)) {
    console.log(`${LOG_PREFIX} Player data changed. Running checks...`);
    validateAndRepairPlayer(player, taskQueue);
  }

  // Note: taskQueue is a reference to the array inside newVariables.
  // No need to explicitly write it back.

  console.log(`${LOG_PREFIX} Player update cycle finished.`);
}

/**
 * Checks if a player-related task has been successfully completed.
 * @param {object} task - The task to check.
 * @param {object} newVariables - The new MVU variables.
 * @param {object} oldVariables - The old MVU variables.
 * @returns {Promise<boolean>} - True if the task is completed, false otherwise.
 */
export async function isPlayerTaskCompleted(task, newVariables, oldVariables) {
  const player = get(newVariables, 'stat_data.player');

  switch (task.type) {
    case 'init_player_profile':
      // Completion criteria: Player object exists in newVariables.
      return !!player;

    case 'repair_player_profile':
      // Completion criteria: Player data passes Zod validation.
      if (!player) return false;
      const validationResult = PlayerSchema.safeParse(player);
      return validationResult.success;
  }
  return false;
}

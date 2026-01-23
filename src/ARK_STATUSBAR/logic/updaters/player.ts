// @ts-nocheck
import { cloneDeep, get, isEqual, set } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Schema as FullSchema } from '../../mvu/index';

const LOG_PREFIX = '[ARK_Player]';

// =======================================================================
// Section 1: Task Pushing Logic
// =======================================================================

function pushTask(task) {
    console.log(`${LOG_PREFIX} Pushing new task of type "${task.type}".`);
    const variables = Mvu.getMvuData();
    const newVariables = cloneDeep(variables);
    const queue = get(newVariables, 'stat_data.task_queue', []);

    const taskWithId = { id: uuidv4(), ...task };
    queue.push(taskWithId);
    queue.sort((a, b) => b.priority - a.priority);

    set(newVariables, 'stat_data.task_queue', queue);
    Mvu.replaceMvuData(newVariables);
    console.log(`${LOG_PREFIX} Player task pushed to global queue.`);
}


// =======================================================================
// Section 2: Core Logic Modules
// =======================================================================

function initializePlayer(variables) {
    const player = get(variables, 'stat_data.player');
    if (!player) {
        console.log(`${LOG_PREFIX} Player data not found. Pushing init task.`);
        pushTask({
            type: 'init_player_profile',
            priority: 101, // Highest priority to ensure player exists
            target_char: 'player',
            payload: {}
        });
        return true; // Return true to signify initialization was triggered
    }
    return false;
}

function validateAndRepairPlayer(playerData) {
    // 注意：这里的 .value 是因为我们 schema 里 player 是 z.record(z.string(), PlayerSchema).value
    const validationResult = FullSchema.shape.player.safeParse(playerData);

    if (!validationResult.success) {
        const issues = validationResult.error.issues;
        const missingPaths = issues.map(issue => issue.path.join('.'));
        
        console.warn(`${LOG_PREFIX} Validation failed for Player. Pushing repair task for fields: ${missingPaths.join(', ')}`);
        
        pushTask({
            type: 'repair_player_profile',
            priority: 51,
            target_char: 'player',
            payload: { fields: missingPaths }
        });
    }
}


// =======================================================================
// Main Event Handler
// =======================================================================

eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (newVariables, oldVariables) => {
    console.log(`${LOG_PREFIX} VARIABLE_UPDATE_ENDED triggered.`);
    
    // 1. Initialize player if not present.
    const wasInitialized = initializePlayer(newVariables);
    if (wasInitialized) {
        console.log(`${LOG_PREFIX} Player initialization task pushed. Skipping further checks this turn.`);
        return;
    }

    const player = get(newVariables, 'stat_data.player', {});
    const oldPlayer = get(oldVariables, 'stat_data.player', {});

    // 2. Check for changes and run validation
    if (!isEqual(player, oldPlayer)) {
        console.log(`${LOG_PREFIX} Player data changed. Running checks...`);
        validateAndRepairPlayer(player);
    }
    
    console.log(`${LOG_PREFIX} Player update cycle finished.`);
});

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
            // Note: FullSchema.shape.player is a Zod schema for the player object.
            const validationResult = FullSchema.shape.player.safeParse(player);
            return validationResult.success;
    }
    return false;
}

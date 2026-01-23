// @ts-nocheck
import { cloneDeep, difference, get, isEqual, set } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Schema as FullSchema } from '../../mvu/index';

const LOG_PREFIX = '[ARK_Character]';

// =======================================================================
// Section 1: Task Pushing Logic
// =======================================================================

function pushTask(task) {
    console.log(`${LOG_PREFIX} Pushing new task of type "${task.type}" for target "${task.target_char}".`);
    const variables = Mvu.getMvuData();
    const newVariables = cloneDeep(variables);
    const queue = get(newVariables, 'stat_data.task_queue', []);

    const taskWithId = { id: uuidv4(), ...task };
    queue.push(taskWithId);
    queue.sort((a, b) => b.priority - a.priority);

    set(newVariables, 'stat_data.task_queue', queue);
    Mvu.replaceMvuData(newVariables);
    console.log(`${LOG_PREFIX} Global task queue updated.`);
}


// =======================================================================
// Section 2: Core Logic Modules
// =======================================================================

function initializeNewCharacters(variables) {
    const { active_chars = [], nearby_chars = [] } = get(variables, 'stat_data.global.presence', {});
    const existingChars = Object.keys(get(variables, 'stat_data.characters', {}));
    const allPresentChars = [...new Set([...active_chars, ...nearby_chars])];
    const newChars = difference(allPresentChars, existingChars);

    if (newChars.length > 0) {
        console.log(`${LOG_PREFIX} New characters detected: ${newChars.join(', ')}. Pushing init tasks.`);
        newChars.forEach(charName => {
            pushTask({
                type: 'init_profile',
                priority: 100, // Highest priority to get basic data
                target_char: charName,
                payload: {}
            });
        });
    }
}

function validateAndRepairCharacter(charName, characterData) {
    const validationResult = FullSchema.shape.characters.value.safeParse(characterData);

    if (!validationResult.success) {
        const issues = validationResult.error.issues;
        const missingPaths = issues.map(issue => issue.path.join('.'));
        
        console.warn(`${LOG_PREFIX} Validation failed for ${charName}. Pushing repair task for fields: ${missingPaths.join(', ')}`);
        
        pushTask({
            type: 'repair_profile',
            priority: 50,
            target_char: charName,
            payload: { fields: missingPaths }
        });
    }
}

function checkMemoryAndPushTask(charName, characterData) {
    const shortTermMemory = get(characterData, 'data.memory.short_term_buffer', []);
    if (shortTermMemory.length >= 12) {
        console.log(`${LOG_PREFIX} Memory buffer for ${charName} is full. Pushing memory summary task.`);
        const memoriesToSummarize = shortTermMemory.slice(0, 6);
        pushTask({
            type: 'summarize_memory',
            priority: 5, // Low priority task
            target_char: charName,
            payload: { memories: memoriesToSummarize }
        });
    }
}

/**
 * Manages the lifecycle state of characters based on their update activity.
 * Specifically, it updates the `_internal.turns_since_last_update` counter.
 * 
 * @param {object} newVariables - The new MVU variables after update.
 * @param {object} oldVariables - The old MVU variables before update.
 */
function manageCharacterLifecycle(newVariables, oldVariables) {
    console.log(`${LOG_PREFIX} Checking character lifecycle updates...`);
    const newChars = get(newVariables, 'stat_data.characters', {});
    const oldChars = get(oldVariables, 'stat_data.characters', {});
    
    // Iterate through all currently existing characters
    for (const charName in newChars) {
        const newCharData = newChars[charName];
        const oldCharData = oldChars[charName];

        if (!oldCharData) {
            // New character, counter defaults to 0 (defined in Schema), no action needed
            console.log(`${LOG_PREFIX} New character detected: ${charName}`);
            continue; 
        }

        // Compare current data with old data
        // We exclude _internal from comparison to avoid infinite loops if we were updating it here (though we are updating newVariables directly)
        // actually, we should compare the 'data' part mainly.
        const newDataContent = newCharData.data;
        const oldDataContent = oldCharData.data;

        if (isEqual(newDataContent, oldDataContent)) {
            // Data hasn't changed, increment the counter
            const currentTurns = get(newCharData, '_internal.turns_since_last_update', 0);
            set(newVariables, `stat_data.characters.${charName}._internal.turns_since_last_update`, currentTurns + 1);
            // console.log(`${LOG_PREFIX} ${charName} inactive. Counter: ${currentTurns} -> ${currentTurns + 1}`);
        } else {
            // Data has changed, reset the counter
            set(newVariables, `stat_data.characters.${charName}._internal.turns_since_last_update`, 0);
            console.log(`${LOG_PREFIX} ${charName} updated. Counter reset to 0.`);
        }
    }
}


// =======================================================================
// Main Event Handler
// =======================================================================

eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (newVariables, oldVariables) => {
    console.log(`${LOG_PREFIX} VARIABLE_UPDATE_ENDED triggered.`);
    
    // 1. Initialize any new characters that have appeared.
    initializeNewCharacters(newVariables);

    // 2. Manage lifecycle counters
    manageCharacterLifecycle(newVariables, oldVariables);

    const characters = get(newVariables, 'stat_data.characters', {});
    const oldCharacters = get(oldVariables, 'stat_data.characters', {});

    // 2. Loop through characters to run checks
    for (const charName in characters) {
        if (!isEqual(characters[charName], oldCharacters[charName])) {
            console.log(`${LOG_PREFIX} Data changed for ${charName}. Running checks...`);
            
            // a. Validate profile and create repair tasks if needed
            validateAndRepairCharacter(charName, characters[charName]);

            // b. Check memory buffer and create summary task if needed
            checkMemoryAndPushTask(charName, characters[charName]);
        }
    }
    
    // Context lifecycle management logic will be handled in the Global updater.
    console.log(`${LOG_PREFIX} Character update cycle finished.`);
});

/**
 * Checks if a character-related task has been successfully completed.
 * @param {object} task - The task to check.
 * @param {object} newVariables - The new MVU variables.
 * @param {object} oldVariables - The old MVU variables.
 * @returns {Promise<boolean>} - True if the task is completed, false otherwise.
 */
export async function isCharacterTaskCompleted(task, newVariables, oldVariables) {
    const charName = task.target_char;
    const newChar = get(newVariables, `stat_data.characters.${charName}`);
    const oldChar = get(oldVariables, `stat_data.characters.${charName}`);

    switch (task.type) {
        case 'init_profile':
            // Completion criteria: Character object exists in newVariables.
            return !!newChar;
            
        case 'repair_profile':
            // Completion criteria: Character data passes Zod validation.
            if (!newChar) return false;
            const validationResult = FullSchema.shape.characters.value.safeParse(newChar);
            return validationResult.success;
            
        case 'summarize_memory':
            // Completion criteria: long_term memory count increased.
            if (!newChar || !oldChar) return false;
            const oldMemCount = get(oldChar, 'data.memory.long_term', []).length;
            const newMemCount = get(newChar, 'data.memory.long_term', []).length;
            return newMemCount > oldMemCount;
    }
    return false;
}

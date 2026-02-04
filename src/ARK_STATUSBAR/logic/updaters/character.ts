// @ts-nocheck
import { difference, get, isEqual, set } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { CharacterSchema } from '../../mvu/schemas/character';

const LOG_PREFIX = '[ARK_Character]';

// =======================================================================
// Section 1: Task Pushing Logic
// =======================================================================

function pushTask(queue, task) {
  console.log(`${LOG_PREFIX} Pushing new task of type "${task.type}" for target "${task.target_char}".`);

  const taskWithId = { id: uuidv4(), ...task };
  queue.push(taskWithId);
  queue.sort((a, b) => b.priority - a.priority);

  return queue;
}

// =======================================================================
// Section 2: Core Logic Modules
// =======================================================================

/**
 * Pushes `init_profile` tasks for characters that need it.
 * Adheres to the `turn <= 2` rule for robust initialization at the start of a session.
 * Also handles new characters appearing mid-game.
 * @param {object} variables - The full MVU variables object (mutable).
 * @param {Array} taskQueue - The task queue array (mutable).
 */
function initializeNewCharacters(variables, taskQueue) {
  const { active_chars = [], nearby_chars = [] } = get(variables, 'stat_data.global.presence', {});
  const allPresentChars = [...new Set([...active_chars, ...nearby_chars])];
  const existingCharsData = get(variables, 'stat_data.characters', {});

  // EJS 模板现在负责处理开局初始化。
  // 此函数仅负责检测游戏进行中新出现的角色。

  const existingCharNames = Object.keys(existingCharsData);
  const newChars = difference(allPresentChars, existingCharNames);

  if (newChars.length > 0) {
    const finalTargets = [...new Set(newChars)];
    console.log(`${LOG_PREFIX} New characters detected: ${finalTargets.join(', ')}. Pushing init tasks.`);

    finalTargets.forEach(charName => {
      if (!existingCharsData[charName]) {
        pushTask(taskQueue, {
          type: 'init_profile',
          priority: 100,
          target_char: charName,
          payload: {},
        });
      }
    });
  }
}

function validateAndRepairCharacter(charName, characterData, taskQueue) {
  const validationResult = CharacterSchema.safeParse(characterData);

  if (!validationResult.success) {
    const issues = validationResult.error.issues;
    const missingPaths = issues.map(issue => issue.path.join('.'));

    console.warn(
      `${LOG_PREFIX} Validation failed for ${charName}. Pushing repair task for fields: ${missingPaths.join(', ')}`,
    );

    pushTask(taskQueue, {
      type: 'repair_profile',
      priority: 50,
      target_char: charName,
      payload: { fields: missingPaths },
    });
  }
}

function checkMemoryAndPushTask(charName, characterData, taskQueue) {
  const shortTermMemory = get(characterData, 'data.memory.short_term_buffer', []);
  if (shortTermMemory.length >= 12) {
    console.log(`${LOG_PREFIX} Memory buffer for ${charName} is full. Pushing memory summary task.`);
    const memoriesToSummarize = shortTermMemory.slice(0, 6);
    pushTask(taskQueue, {
      type: 'summarize_memory',
      priority: 5, // Low priority task
      target_char: charName,
      payload: { memories: memoriesToSummarize },
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
    const newDataContent = newCharData.data;
    const oldDataContent = oldCharData.data;

    if (isEqual(newDataContent, oldDataContent)) {
      // Data hasn't changed, increment the counter
      const currentTurns = get(newCharData, '_internal.turns_since_last_update', 0);
      set(newVariables, `stat_data.characters.${charName}._internal.turns_since_last_update`, currentTurns + 1);
    } else {
      // Data has changed, reset the counter
      set(newVariables, `stat_data.characters.${charName}._internal.turns_since_last_update`, 0);
      console.log(`${LOG_PREFIX} ${charName} updated. Counter reset to 0.`);
    }
  }
}

// =======================================================================
// Main Exported Function
// =======================================================================

/**
 * Main processing function for character-related updates.
 * This is called by the global updater.
 * @param {object} newVariables - The new MVU variables (mutable).
 * @param {object} oldVariables - The old MVU variables (read-only).
 */
export async function processCharacterUpdates(newVariables, oldVariables) {
  console.log(`${LOG_PREFIX} Processing character updates...`);

  // Initialize task queue reference (In-Place modification)
  const taskQueue = get(newVariables, 'stat_data.task_queue', []);

  // 1. Handle post-processing for any newly created characters this turn.
  // This sets the `has_static_profile` flag by checking against worldbooks.
  await postProcessNewCharacters(newVariables, oldVariables);

  // 2. Push initialization tasks if needed (both for game start and mid-game new chars).
  initializeNewCharacters(newVariables, taskQueue);

  // 3. Manage lifecycle counters for all existing characters.
  manageCharacterLifecycle(newVariables, oldVariables);

  // 4. Loop through characters to run validation and other checks, but only if they have changed.
  const characters = get(newVariables, 'stat_data.characters', {});
  const oldCharacters = get(oldVariables, 'stat_data.characters', {});

  for (const charName in characters) {
    if (!isEqual(characters[charName], oldCharacters[charName])) {
      console.log(`${LOG_PREFIX} Data changed for ${charName}. Running checks...`);

      // a. Validate profile and create repair tasks if needed
      validateAndRepairCharacter(charName, characters[charName], taskQueue);

      // b. Check memory buffer and create summary task if needed
      checkMemoryAndPushTask(charName, characters[charName], taskQueue);
    }
  }

  // Note: taskQueue is a reference to the array inside newVariables.
  // No need to explicitly write it back.

  console.log(`${LOG_PREFIX} Character update cycle finished.`);
}

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
      const validationResult = CharacterSchema.safeParse(newChar);
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

// =======================================================================
// Section 3: Static Character Lookup (No Cache)
// =======================================================================

/**
 * Helper function to find a character's worldbook entry.
 * It searches through all currently bound worldbooks.
 * @param {string} charName - The name of the character to find.
 * @returns {Promise<{worldbookName: string, uid: number} | null>}
 */
async function findStaticCharacterEntry(charName) {
  if (!charName) return null;
  const targetKey = charName.toLowerCase();

  // Get worldbooks bound to the current character card
  const charBooks = getCharWorldbookNames('current');
  const bookNames = [...new Set([charBooks.primary, ...charBooks.additional].filter(Boolean))];

  for (const bookName of bookNames) {
    try {
      const entries = await getWorldbook(bookName);

      for (const entry of entries) {
        // Correctly access strategy keys based on @types/function/worldbook.d.ts
        const keys = entry.strategy?.keys || [];

        // Filter out disabled entries and templates
        if (!entry.enabled || keys.some(k => typeof k === 'string' && k.includes('_TEMPLATE_'))) {
          continue;
        }

        // Check if any key matches the character name
        const isMatch = keys.some(k => typeof k === 'string' && k.toLowerCase() === targetKey);
        if (isMatch) {
          return { worldbookName: bookName, uid: entry.uid };
        }
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} Could not get character worldbook "${bookName}":`, error);
    }
  }
  return null;
}

// =======================================================================
// Section 4: Character Initialization & Post-Processing
// =======================================================================

/**
 * Handles post-processing for newly created characters.
 * Specifically, it sets the `has_static_profile` flag by checking against worldbooks.
 * @param {object} newVariables - The new MVU variables (mutable).
 * @param {object} oldVariables - The old MVU variables (read-only).
 */
async function postProcessNewCharacters(newVariables, oldVariables) {
  const newChars = get(newVariables, 'stat_data.characters', {});
  const oldChars = get(oldVariables, 'stat_data.characters', {});

  // Find characters that are newly created in this turn
  const newlyCreatedCharNames = Object.keys(newChars).filter(name => !oldChars[name]);

  if (newlyCreatedCharNames.length === 0) return;

  console.log(`${LOG_PREFIX} Processing newly created characters: ${newlyCreatedCharNames.join(', ')}`);

  for (const charName of newlyCreatedCharNames) {
    // Check if this character has a static worldbook entry
    const entryInfo = await findStaticCharacterEntry(charName);

    if (entryInfo) {
      console.log(`${LOG_PREFIX} New character ${charName} is a static character. Setting flag.`);
      set(newVariables, `stat_data.characters.${charName}.has_static_profile`, true);
    }
  }
}

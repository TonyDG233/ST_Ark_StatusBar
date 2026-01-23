// @ts-nocheck
import { cloneDeep, get, set } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

const LOG_PREFIX = '[ARK_Chronicle]';

/**
 * Pushes a new task to the global task queue.
 * @param {object} task - The task object to push.
 */
function pushTask(task) {
  console.log(`${LOG_PREFIX} Pushing new task of type "${task.type}" with priority ${task.priority}.`);
  const variables = Mvu.getMvuData();
  const newVariables = cloneDeep(variables);
  const queue = get(newVariables, 'stat_data.task_queue', []);

  const taskWithId = { id: uuidv4(), target_char: 'chronicle', ...task };
  queue.push(taskWithId);

  queue.sort((a, b) => b.priority - a.priority);

  set(newVariables, 'stat_data.task_queue', queue);
  Mvu.replaceMvuData(newVariables);
  console.log(`${LOG_PREFIX} Task pushed and variables updated.`);
}

// Helper function to parse dates, robust against format variations.
function parseDate(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  try {
    const datePart = timeStr.split(' ')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { year, month, day };
  } catch (e) {
    console.error(`${LOG_PREFIX} Error parsing date from time string: "${timeStr}"`, e);
    return null;
  }
}

/**
 * Checks for various time-based summary triggers.
 * @param {object} chronicle - The chronicle part of the stat_data.
 * @param {string} globalTime - The current global time string.
 * @returns {{taskType: string | null, payload: object | null}}
 */
function checkTimeTriggers(chronicle, globalTime) {
  const globalDate = parseDate(globalTime);
  if (!globalDate) return { taskType: null, payload: null };

  // Check for yearly change
  const yearlyBuffer = chronicle.yearly_summary_buffer;
  if (yearlyBuffer.length > 0) {
    const lastYear = yearlyBuffer[yearlyBuffer.length - 1].year;
    if (globalDate.year > lastYear) {
      return { taskType: 'yearly_summary', payload: { source_ids: chronicle.monthly_summary_buffer.map(s => s.id) } };
    }
  }

  // Check for monthly change
  const monthlyBuffer = chronicle.monthly_summary_buffer;
  if (monthlyBuffer.length > 0) {
    const lastMonthDate = parseDate(monthlyBuffer[monthlyBuffer.length - 1].month + '-01');
    if (lastMonthDate && (globalDate.year > lastMonthDate.year || globalDate.month > lastMonthDate.month)) {
      return { taskType: 'monthly_summary', payload: { source_ids: chronicle.weekly_summary_buffer.map(s => s.id) } };
    }
  }

  // Check for weekly change (simplified: every 7 daily summaries)
  if (chronicle.daily_summary_buffer.length >= 7) {
    return {
      taskType: 'weekly_summary',
      payload: { source_ids: chronicle.daily_summary_buffer.slice(0, 7).map(s => s.id) },
    };
  }

  // Check for daily change
  if (chronicle.round_buffer.length > 0) {
    const lastRoundDate = parseDate(chronicle.round_buffer[chronicle.round_buffer.length - 1].time);
    if (
      lastRoundDate &&
      (globalDate.year > lastRoundDate.year ||
        globalDate.month > lastRoundDate.month ||
        globalDate.day > lastRoundDate.day)
    ) {
      return { taskType: 'daily_summary', payload: { source_ids: chronicle.round_buffer.map(r => r.id) } };
    }
  }

  return { taskType: null, payload: null };
}

/**
 * The main scheduler function for the Chronicle module.
 */
function scheduleTasks() {
  console.log(`${LOG_PREFIX} Scheduler invoked.`);
  const variables = Mvu.getMvuData();
  const chronicle = get(variables, 'stat_data.chronicle');
  const globalTime = get(variables, 'stat_data.global.time');
  const taskQueue = get(variables, 'stat_data.task_queue', []);

  if (!chronicle || !globalTime) {
    console.warn(`${LOG_PREFIX} Missing chronicle or global time data. Aborting.`);
    return;
  }

  if (taskQueue.some(task => task.target_char === 'chronicle')) {
    console.log(`${LOG_PREFIX} Chronicle task already in queue, skipping scheduling.`);
    return;
  }

  // Check Time-based Triggers (Yearly, Monthly, Weekly, Daily)
  const timeTrigger = checkTimeTriggers(chronicle, globalTime);
  if (timeTrigger.taskType) {
    let priority = 0;
    switch (timeTrigger.taskType) {
      case 'yearly_summary':
        priority = 40;
        break;
      case 'monthly_summary':
        priority = 30;
        break;
      case 'weekly_summary':
        priority = 25;
        break;
      case 'daily_summary':
        priority = 20;
        break;
    }
    pushTask({ type: timeTrigger.taskType, priority, payload: timeTrigger.payload });
    return;
  }

  // Check buffer-based Triggers (Ten-Round)
  if (chronicle.round_buffer.length >= 10) {
    console.log(`${LOG_PREFIX} 10+ rounds in buffer. Pushing ten-round summary task.`);
    pushTask({
      type: 'ten_round_summary',
      priority: 10,
      payload: { source_ids: chronicle.round_buffer.slice(0, 10).map(r => r.id) },
    });
    return;
  }

  console.log(`${LOG_PREFIX} No new tasks to schedule.`);
}

// Main entry point
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
  console.log(`${LOG_PREFIX} VARIABLE_UPDATE_ENDED triggered.`);
  scheduleTasks();
});

/**
 * Checks if a chronicle-related task has been successfully completed.
 * @param {object} task - The task to check.
 * @param {object} newVariables - The new MVU variables.
 * @param {object} oldVariables - The old MVU variables.
 * @returns {Promise<boolean>} - True if the task is completed, false otherwise.
 */
export async function isChronicleTaskCompleted(task, newVariables, oldVariables) {
  const targetBuffer = task.payload.target_buffer;
  if (!targetBuffer) return false;

  const oldBuffer = get(oldVariables, `stat_data.chronicle.${targetBuffer}`, []);
  const newBuffer = get(newVariables, `stat_data.chronicle.${targetBuffer}`, []);

  // Acceptance criteria: The target buffer length has increased.
  return newBuffer.length > oldBuffer.length;
}

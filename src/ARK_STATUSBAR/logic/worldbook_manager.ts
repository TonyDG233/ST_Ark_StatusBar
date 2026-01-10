import { BASELINE_STATE } from '../config/baseline';
import { DEFAULT_WORLDBOOK_NAME, STARTUP_SCENARIOS } from '../config/scenarios';
import { SINGLE_CHAR_ENTRIES } from '../config/single_char_entries';

// Helper to get safe access to APIs (in case they are not ready)
// We assume global functions from @types/function/worldbook.d.ts are available at runtime.
// Since this runs in Tavern Helper environment (Frontend), these should be global.
// Wait, @types/function is for Backend (Slash Runner). @types/iframe is for Frontend.
// The user said: "Use Tavern Helper's own functions".
// If this is running in Frontend (Iframe), we might need to use `SillyTavern.getContext()...` or trigger slash commands?
// BUT, the user pointed to `@types/function/worldbook.d.ts` which are typically Server-Side/Plugin functions.
// IF this code runs in the Frontend (Vue), it cannot directly call Server functions unless exposed.
// However, Tavern Helper scripts often run in a context where they can access specific APIs.
// User said: "Check @types/function/worldbook.d.ts... not your imagination".
// This implies these functions ARE available to me.
// I will assume they are globally available or I need to import them?
// Typically these are global in the scripting environment.

export const WorldbookManager = {
  /**
   * Reset Worldbook to its baseline state (defined in config/baseline.ts)
   */
  async resetToBaseline(): Promise<void> {
    console.info('[ARK_Manager] Resetting Worldbook to Baseline...');
    try {
      await updateWorldbookWith(DEFAULT_WORLDBOOK_NAME, (entries) => {
        entries.forEach(entry => {
          if (entry.name && BASELINE_STATE.hasOwnProperty(entry.name)) {
            entry.enabled = BASELINE_STATE[entry.name];
          }
        });
        return entries;
      });
      toastr.success('世界书已重置为初始状态');
    } catch (error) {
      console.error('[ARK_Manager] Reset failed:', error);
      toastr.error('世界书重置失败: ' + (error as Error).message);
    }
  },

  /**
   * Apply a specific scenario: Reset -> Apply Delta (Open Linked, Close Disabled)
   */
  async applyScenario(swipeId: number): Promise<void> {
    const scenario = STARTUP_SCENARIOS.find(s => s.swipeId === swipeId);
    if (!scenario) {
      console.error(`[ARK_Manager] Scenario #${swipeId} not found.`);
      return;
    }

    console.info(`[ARK_Manager] Applying Scenario: ${scenario.title}`);
    toastr.info(`正在应用开局设置: ${scenario.title}...`);

    try {
      // Single Atomic Update: Calculate Baseline + Delta
      await updateWorldbookWith(DEFAULT_WORLDBOOK_NAME, (entries) => {
        entries.forEach(entry => {
          const name = entry.name;
          if (!name) return;

          // 1. Reset to Baseline (if exists in baseline)
          if (BASELINE_STATE.hasOwnProperty(name)) {
            entry.enabled = BASELINE_STATE[name];
          }

          // 2. Apply Enable Delta
          if (scenario.linkedWorldInfo.includes(name)) {
            entry.enabled = true;
          }

          // 3. Apply Disable Delta
          if (scenario.disabledWorldInfo && scenario.disabledWorldInfo.includes(name)) {
            entry.enabled = false;
          }
        });
        return entries;
      });
      
      toastr.success(`开局设置应用成功`);
      console.info('[ARK_Manager] Scenario applied successfully.');

    } catch (error) {
      console.error('[ARK_Manager] Apply Scenario failed:', error);
      toastr.error('应用开局失败: ' + (error as Error).message);
    }
  },

  /**
   * Close all single-character entries (Bulk Action)
   */
  async closeSingleCharEntries(): Promise<void> {
    console.info('[ARK_Manager] Closing all single-character entries...');
    try {
      await updateWorldbookWith(DEFAULT_WORLDBOOK_NAME, (entries) => {
        entries.forEach(entry => {
          if (entry.name && SINGLE_CHAR_ENTRIES.includes(entry.name)) {
            entry.enabled = false;
          }
        });
        return entries;
      });
      toastr.success('已关闭所有单字条目');
    } catch (error) {
      console.error('[ARK_Manager] Bulk close failed:', error);
      toastr.error('操作失败: ' + (error as Error).message);
    }
  }
};
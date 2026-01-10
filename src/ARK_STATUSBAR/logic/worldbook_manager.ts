import { BASELINE_STATE } from '../config/baseline';
import { STARTUP_SCENARIOS } from '../config/scenarios';
import { SINGLE_CHAR_ENTRIES } from '../config/single_char_entries';

// Helper to find the current character's worldbook
async function getTargetWorldbookName(): Promise<string> {
  try {
    const result = await getCharWorldbookNames('current');
    if (result.primary) return result.primary;
    if (result.additional && result.additional.length > 0) return result.additional[0];
    throw new Error('未找到当前角色绑定的世界书');
  } catch (error) {
    console.error('[ARK_Manager] Failed to get target worldbook:', error);
    throw error;
  }
}

export type WorldbookStatus = 'original' | 'single_char_closed' | 'modified';

export const WorldbookManager = {
  /**
   * Get the current status of the Worldbook compared to Baseline
   */
  async getWorldbookStatus(): Promise<WorldbookStatus> {
    try {
      const targetBook = await getTargetWorldbookName();
      const entries = await getWorldbook(targetBook);

      let isOriginal = true;
      let isSingleCharClosed = true;

      // Iterate only over keys present in BASELINE_STATE (Ignore user added entries)
      for (const key of Object.keys(BASELINE_STATE)) {
        const entry = entries.find(e => e.name === key);
        if (!entry) continue; // Skip if entry missing in current book (shouldn't happen often)

        const baselineEnabled = BASELINE_STATE[key];
        const currentEnabled = entry.enabled;

        // Check for 'original' mismatch
        if (currentEnabled !== baselineEnabled) {
          isOriginal = false;
        }

        // Check for 'single_char_closed' logic
        const isSingleChar = SINGLE_CHAR_ENTRIES.includes(key);
        if (isSingleChar) {
          // For single char closed state, this MUST be false
          if (currentEnabled !== false) {
            isSingleCharClosed = false;
          }
        } else {
          // For non-single char, it MUST match baseline
          if (currentEnabled !== baselineEnabled) {
            isSingleCharClosed = false;
          }
        }
      }

      if (isOriginal) return 'original';
      if (isSingleCharClosed) return 'single_char_closed';
      return 'modified';
    } catch (error) {
      console.error('[ARK_Manager] Get Status failed:', error);
      return 'modified'; // Default to modified on error for safety
    }
  },

  /**
   * Reset Worldbook to its baseline state
   */
  async resetToBaseline(): Promise<void> {
    console.info('[ARK_Manager] Resetting Worldbook to Baseline...');
    try {
      const targetBook = await getTargetWorldbookName();
      await updateWorldbookWith(targetBook, entries => {
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
   * Apply a specific scenario
   * Warning: This throws an error if status is 'modified', caller must handle confirmation.
   */
  async applyScenario(swipeId: number, force: boolean = false): Promise<void> {
    if (!force) {
      const status = await this.getWorldbookStatus();
      if (status === 'modified') {
        throw new Error('STATUS_MODIFIED');
      }
    }

    const scenario = STARTUP_SCENARIOS.find(s => s.swipeId === swipeId);
    if (!scenario) {
      console.error(`[ARK_Manager] Scenario #${swipeId} not found.`);
      return;
    }

    console.info(`[ARK_Manager] Applying Scenario: ${scenario.title}`);
    toastr.info(`正在应用开局设置: ${scenario.title}...`);

    try {
      const targetBook = await getTargetWorldbookName();
      await updateWorldbookWith(targetBook, entries => {
        entries.forEach(entry => {
          const name = entry.name;
          if (!name) return;

          // Note: We DO NOT reset to baseline here. We only apply deltas.

          // 1. Apply Enable Delta
          if (scenario.linkedWorldInfo.includes(name)) {
            entry.enabled = true;
          }

          // 2. Apply Disable Delta
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
      throw error;
    }
  },

  /**
   * Close all single-character entries
   */
  async closeSingleCharEntries(): Promise<void> {
    console.info('[ARK_Manager] Closing all single-character entries...');
    try {
      const targetBook = await getTargetWorldbookName();
      await updateWorldbookWith(targetBook, entries => {
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
  },
};

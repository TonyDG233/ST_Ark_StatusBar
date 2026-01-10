import { createApp } from 'vue';
import { deteleportStyle, teleportStyle } from '../util/script';
import ReturnButton from './components/ReturnButton.vue';
import StartupNavigator from './components/StartupNavigator.vue';

// Global styles
import './components/StartupNavigator.vue';

const MOUNT_INTERVAL_MS = 500;
const STARTUP_CONTAINER_CLASS = 'ark-startup-mount-point';
const RETURN_BTN_CONTAINER_CLASS = 'ark-return-btn-mount-point';

/**
 * Main mounting logic loop
 */
const startMountingLoop = () => {
  setInterval(() => {
    try {
      if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
        return; // Not ready
      }

      // 1. Target First Message
      // We use jQuery because it's available and easy for legacy DOM access
      const $message0 = $('#chat > .mes[mesid="0"]');
      if ($message0.length === 0) return;

      const isUser = $message0.attr('is_user') === 'true';
      if (isUser) return; // Only AI messages for Startup/Return

      const $mesText = $message0.find('.mes_text');
      if ($mesText.length === 0) return;

      // 2. Check Swipe ID
      // SillyTavern.chat[0] source of truth
      const firstMessage = SillyTavern.chat[0];
      const swipeId = firstMessage.swipe_id || 0;

      // 3. Mount Logic
      if (swipeId === 0) {
        // --- STARTUP MODE ---
        // Ensure Return Button is NOT present (cleanup if needed? DOM is usually wiped on swipe change, but safe to check)
        if ($mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).length > 0) {
          $mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).remove();
        }

        // Check if Startup is already mounted
        if ($mesText.find(`.${STARTUP_CONTAINER_CLASS}`).length === 0) {
          console.info('[ARK_STATUSBAR] Mounting Startup Navigator...');

          // Clean up existing content (backup html) before mounting
          $mesText.empty();

          const mountPoint = document.createElement('div');
          mountPoint.className = STARTUP_CONTAINER_CLASS;
          $mesText.append(mountPoint);
          createApp(StartupNavigator).mount(mountPoint);
        }
      } else {
        // --- STORY MODE (Return Button) ---
        // Ensure Startup is NOT present
        if ($mesText.find(`.${STARTUP_CONTAINER_CLASS}`).length > 0) {
          // We generally assume that if we are switching modes, the message content will be refreshed by the backend/reload
          // But if we are just hot-swapping:
          $mesText.find(`.${STARTUP_CONTAINER_CLASS}`).remove();
        }

        // Check if Return Button is already mounted
        if ($mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).length === 0) {
          console.info('[ARK_STATUSBAR] Mounting Return Button...');

          // Return Button should APPEND to existing content, NOT overwrite it.
          // Only Startup Navigator overwrites the content.

          const mountPoint = document.createElement('div');
          mountPoint.className = RETURN_BTN_CONTAINER_CLASS;
          $mesText.append(mountPoint);
          createApp(ReturnButton).mount(mountPoint);
        }
      }
    } catch (error) {
      console.error('[ARK_STATUSBAR] Mounting loop error:', error);
    }
  }, MOUNT_INTERVAL_MS);
};

// Start the loop when the script loads
$(() => {
  console.info('[ARK_STATUSBAR] Module Loaded. Starting mount loop...');

  // Fix: Teleport styles from iframe to main window
  teleportStyle();

  startMountingLoop();
});

// Cleanup on unload
$(window).on('pagehide', () => {
  deteleportStyle();
});

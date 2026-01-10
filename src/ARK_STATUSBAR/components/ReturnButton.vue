<template>
  <a class="director-return-button" @click="handleReturn">
    返回开局
  </a>
</template>

<script setup lang="ts">
const handleReturn = async () => {
  try {
    if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
      throw new Error('SillyTavern environment not found.');
    }

    const firstMessage = SillyTavern.chat[0];
    const targetSwipeId = 0;

    // Verify swipe 0 exists
    if (!firstMessage || !firstMessage.swipes || typeof firstMessage.swipes[targetSwipeId] !== 'string') {
      throw new Error(`Startup swipe #${targetSwipeId} not found.`);
    }

    console.info('[ReturnButton] Returning to Startup (Swipe #0)...');

    // Update message content
    firstMessage.swipe_id = targetSwipeId;
    firstMessage.mes = firstMessage.swipes[targetSwipeId];

    // Save and Reload
    await SillyTavern.saveChat();
    await SillyTavern.reloadCurrentChat();

  } catch (error) {
    console.error('[ReturnButton] Failed to return to startup:', error);
    toastr.error('返回开局失败: ' + (error as Error).message);
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;700&display=swap');

.director-return-button {
  display: block;
  width: 120px;
  margin: 20px auto 10px auto;
  padding: 8px 12px;
  background-color: rgba(40, 40, 40, 0.8);
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  font-family: 'Noto Serif SC', serif;
  transition: background-color 0.3s;
  text-decoration: none; /* In case global styles affect <a> */
}

.director-return-button:hover {
  background-color: rgba(60, 60, 60, 0.9);
}
</style>
<template>
  <a class="director-return-button" @click="handleReturn"> 返回开局 </a>
</template>

<script setup lang="ts">
/**
 * “返回开局”按钮组件
 * 该组件通常会被注入到某些需要一键重置剧本进度的场景中，
 * 允许用户直接跳回第一条消息(Greeting)的 Swipe 0，也就是主界面。
 */
const handleReturn = async () => {
  try {
    // 确保当前环境确实是在 SillyTavern 中且存在 chat 数据
    if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
      throw new Error('SillyTavern environment not found.');
    }

    // 酒馆的第 0 条消息即为开场白 (Greeting)
    const firstMessage = SillyTavern.chat[0];
    const targetSwipeId = 0; // 默认 Swipe 0 为引导界面的开局语

    // 验证目标开局语是否存在
    if (!firstMessage || !firstMessage.swipes || typeof firstMessage.swipes[targetSwipeId] !== 'string') {
      throw new Error(`Startup swipe #${targetSwipeId} not found.`);
    }

    console.info('[ReturnButton] Returning to Startup (Swipe #0)...');

    // 修改当前第 0 条消息的指针和内容为目标开局语
    firstMessage.swipe_id = targetSwipeId;
    firstMessage.mes = firstMessage.swipes[targetSwipeId];

    // 强制保存并重载聊天以应用修改
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

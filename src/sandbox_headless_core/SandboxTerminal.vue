<template>
  <div class="sandbox-terminal">
    <div class="terminal-header">
      <h3>Headless Core Sandbox - 物理分离独立前端测试基座</h3>
    </div>
    
    <div class="terminal-config">
      <select v-model="provider" class="provider-select">
        <option value="openai">OpenAI 兼容格式 (Kimi/DS/GLM 等)</option>
        <option value="claude">Anthropic Claude</option>
        <option value="gemini">Google Gemini</option>
      </select>
      <input v-model="modelName" placeholder="Model (如: gemini-1.5-pro, gpt-4o)" class="model-input" />
    </div>
    <div class="terminal-config">
      <input v-model="apiEndpoint" placeholder="API Endpoint (如: http://127.0.0.1:8889/v1/chat/completions)" />
      <input v-model="apiKey" type="password" placeholder="API Key" />
    </div>

    <div class="terminal-output" ref="outputArea">
      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <strong>{{ msg.role === 'user' ? 'Dr.' : 'Amiya' }}:</strong>
        <p style="white-space: pre-wrap; margin: 0;">{{ msg.content }}</p>
      </div>
      <div v-if="isGenerating" class="message assistant streaming">
        <strong>Amiya (Generating...):</strong>
        <p style="white-space: pre-wrap; margin: 0;">{{ currentStreamText }}<span class="cursor">_</span></p>
      </div>
    </div>

    <div class="terminal-input">
      <textarea 
        v-model="inputText" 
        @keydown.enter.prevent="sendMessage"
        placeholder="输入测试消息，按 Enter 发送..."
      ></textarea>
      <button @click="sendMessage" :disabled="isGenerating || !apiEndpoint">发送</button>
      <button @click="abortGeneration" :disabled="!isGenerating" class="abort-btn">中断</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { OpenAIAdapter } from './api/OpenAIAdapter';
import { ClaudeAdapter } from './api/ClaudeAdapter';
import { GeminiAdapter } from './api/GeminiAdapter';
import type { LLMMessage, LLMClientBase } from './api/LLMClientBase';

const provider = ref('openai');
const modelName = ref('');
const apiEndpoint = ref('http://127.0.0.1:8889/v1/chat/completions');
const apiKey = ref('');
const inputText = ref('');

const messages = ref<LLMMessage[]>([
  { role: 'system', content: '你是阿米娅，罗德岛的公开领袖。在接下来的对话中，请完全扮演阿米娅，以她的口吻和性格与博士对话。' }
]);

const currentStreamText = ref('');
const isGenerating = ref(false);
let abortController: AbortController | null = null;
const outputArea = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (outputArea.value) {
      outputArea.value.scrollTop = outputArea.value.scrollHeight;
    }
  });
};

const sendMessage = async () => {
  if (!inputText.value.trim() || !apiEndpoint.value || isGenerating.value) return;

  const userMsg: LLMMessage = { role: 'user', content: inputText.value };
  messages.value.push(userMsg);
  inputText.value = '';
  scrollToBottom();

  isGenerating.value = true;
  currentStreamText.value = '';
  abortController = new AbortController();

  let adapter: LLMClientBase;
  if (provider.value === 'claude') {
    adapter = new ClaudeAdapter();
  } else if (provider.value === 'gemini') {
    adapter = new GeminiAdapter();
  } else {
    adapter = new OpenAIAdapter();
  }

  try {
    await adapter.generate({
      endpoint: apiEndpoint.value,
      apiKey: apiKey.value,
      model: modelName.value,
      messages: messages.value,
      stream: true,
      signal: abortController.signal
    }, {
      onChunk: (text) => {
        currentStreamText.value += text;
        scrollToBottom();
      },
      onComplete: (fullText) => {
        messages.value.push({ role: 'assistant', content: fullText });
        isGenerating.value = false;
        currentStreamText.value = '';
        scrollToBottom();
      },
      onError: (err) => {
        console.error("生成失败:", err);
        messages.value.push({ role: 'assistant', content: `[系统错误] ${err.message}` });
        isGenerating.value = false;
        currentStreamText.value = '';
      }
    });

  } catch (err: any) {
    if (err.name === 'AbortError') {
      messages.value.push({ role: 'assistant', content: currentStreamText.value + " [已中断]" });
      isGenerating.value = false;
      currentStreamText.value = '';
    }
  }
};

const abortGeneration = () => {
  if (abortController) {
    abortController.abort();
  }
};
</script>

<style scoped>
.sandbox-terminal {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 650px;
  width: 100%;
  max-width: 800px;
  background-color: rgba(20, 20, 20, 0.95);
  border: 1px solid #444;
  color: #e0e0e0;
  font-family: 'Consolas', monospace;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  border-radius: 8px;
  overflow: hidden;
}

.terminal-header {
  padding: 10px 15px;
  background: #333;
  border-bottom: 1px solid #555;
}
.terminal-header h3 { margin: 0; font-size: 14px; color: #fff; }

.terminal-config {
  display: flex;
  padding: 10px 10px 0 10px;
  gap: 10px;
  background: #222;
}
.terminal-config:nth-child(3) {
  padding-bottom: 10px;
  border-bottom: 1px solid #333;
}
.terminal-config input, .provider-select {
  flex: 1;
  background: #111;
  border: 1px solid #444;
  color: #fff;
  padding: 5px;
}
.provider-select { flex: 0.5; }
.model-input { flex: 0.5; }

.terminal-output {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message.system { color: #888; font-style: italic; }
.message.user strong { color: #4fc3f7; }
.message.assistant strong { color: #ffb74d; }

.terminal-input {
  display: flex;
  padding: 10px;
  border-top: 1px solid #444;
  background: #222;
  gap: 10px;
}
.terminal-input textarea {
  flex: 1;
  background: #111;
  color: #fff;
  border: 1px solid #555;
  resize: none;
  height: 40px;
  padding: 5px;
}
.terminal-input button {
  background: #444;
  color: #fff;
  border: 1px solid #666;
  cursor: pointer;
  padding: 0 15px;
}
.terminal-input button:hover { background: #555; }
.terminal-input button:disabled { opacity: 0.5; cursor: not-allowed; }
.abort-btn { background: #5a2a2a !important; border-color: #8a3a3a !important; }

.cursor { animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
</style>

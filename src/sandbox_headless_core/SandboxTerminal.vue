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
      <input v-model="apiEndpoint" placeholder="API Base URL (如: http://127.0.0.1:8889/v1 或 default)" />
      <input v-model="apiKey" type="password" placeholder="API Key" />
    </div>

    <div class="terminal-output" ref="outputArea">
      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <strong>{{ msg.role === 'user' ? 'Dr.' : 'Amiya' }}:</strong>
        <details v-if="msg.thinking" class="thinking-details">
          <summary>思考过程</summary>
          <p style="white-space: pre-wrap; margin: 5px 0 0 0; color: #aaa; font-size: 0.9em;">{{ msg.thinking }}</p>
        </details>
        <p style="white-space: pre-wrap; margin: 0;">{{ msg.content }}</p>
      </div>
      <div v-if="isGenerating" class="message assistant streaming">
        <strong>Amiya (Generating...):</strong>
        <details v-if="currentThinkingText" open class="thinking-details">
          <summary>思考过程 (实时)</summary>
          <p style="white-space: pre-wrap; margin: 5px 0 0 0; color: #aaa; font-size: 0.9em;">{{ currentThinkingText }}</p>
        </details>
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
import { AgentEngine } from './api/AgentEngine';
import { parse } from 'yaml';
import rawConfig from './config.yaml?raw';

export interface SandboxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  thinking?: string;
}

const parsedConfig = rawConfig ? parse(rawConfig) : {};

const provider = ref(parsedConfig.provider || 'openai');
const modelName = ref(parsedConfig.modelName || '');
const apiEndpoint = ref(parsedConfig.apiEndpoint || 'http://127.0.0.1:8889/v1');
const apiKey = ref(parsedConfig.apiKey || '');
const inputText = ref('');

const messages = ref<SandboxMessage[]>([
  { role: 'system', content: '你是阿米娅，罗德岛的公开领袖。在接下来的对话中，请完全扮演阿米娅，以她的口吻和性格与博士对话。' }
]);

const currentStreamText = ref('');
const currentThinkingText = ref('');
const isGenerating = ref(false);
let abortController: AbortController | null = null;
const outputArea = ref<HTMLElement | null>(null);

const engine = new AgentEngine();

const scrollToBottom = () => {
  nextTick(() => {
    if (outputArea.value) {
      outputArea.value.scrollTop = outputArea.value.scrollHeight;
    }
  });
};

const sendMessage = async () => {
  if (!inputText.value.trim() || isGenerating.value) return;

  const userMsg: SandboxMessage = { role: 'user', content: inputText.value };
  messages.value.push(userMsg);
  inputText.value = '';
  scrollToBottom();

  isGenerating.value = true;
  currentStreamText.value = '';
  currentThinkingText.value = '';
  abortController = new AbortController();

  try {
    await engine.generateStream(
      provider.value,
      modelName.value || 'gpt-3.5-turbo',
      apiKey.value,
      apiEndpoint.value,
      messages.value,
      abortController.signal,
      {
        onTextDelta: (text) => {
          currentStreamText.value += text;
          scrollToBottom();
        },
        onThinkingDelta: (text) => {
          currentThinkingText.value += text;
          scrollToBottom();
        },
        onComplete: (fullMessage) => {
          let finalContent = "";
          let finalThinking = "";
          for (const block of fullMessage.content) {
             if (block.type === 'text') finalContent += block.text;
             if (block.type === 'thinking') finalThinking += block.thinking;
          }
          messages.value.push({ role: 'assistant', content: finalContent, thinking: finalThinking });
          isGenerating.value = false;
          currentStreamText.value = '';
          currentThinkingText.value = '';
          scrollToBottom();
        },
        onError: (err) => {
          console.error("生成失败:", err);
          messages.value.push({ role: 'assistant', content: `[系统错误] ${err.message}` });
          isGenerating.value = false;
          currentStreamText.value = '';
          currentThinkingText.value = '';
        }
      }
    );

  } catch (err: any) {
    if (err.name === 'AbortError') {
      messages.value.push({ role: 'assistant', content: currentStreamText.value + " [已中断]" });
      isGenerating.value = false;
      currentStreamText.value = '';
      currentThinkingText.value = '';
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

.thinking-details {
  margin: 5px 0 10px 0;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-left: 3px solid #666;
  border-radius: 4px;
}
.thinking-details summary {
  cursor: pointer;
  color: #888;
  font-size: 0.85em;
  user-select: none;
}
.thinking-details summary:hover {
  color: #aaa;
}
</style>

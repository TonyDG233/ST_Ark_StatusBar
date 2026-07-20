<template>
  <div class="sandbox-terminal">
    <div class="terminal-header">
      <h3>Headless Core Sandbox - 迷迭香 100% 真实数据 RPG 跑通测试</h3>
      <div v-if="!isLoaded" class="loading-status">正在从本地 references/ 目录动态拉取并解析原始 PNG 与预设...</div>
      <div v-else class="loading-status success">
        🟢 真实数据加载成功 | 角色: {{ characterData?.name }} (内嵌 {{ characterData?.character_book?.entries?.length || 0 }} 条世界书) | 预设: Izumi Reload
      </div>
    </div>
    
    <div class="terminal-config">
      <div class="config-row">
        <label>大模型厂商:</label>
        <select v-model="provider" class="provider-select">
          <option value="openai">OpenAI 兼容格式 (Kimi/DS/GLM/HF等)</option>
          <option value="claude">Anthropic Claude</option>
          <option value="gemini">Google Gemini (Recommended)</option>
        </select>
        <label>模型名称:</label>
        <input v-model="modelName" placeholder="Model (如: gemini-3.5-flash, deepseek-reasoner)" class="model-input" />
      </div>
    </div>
    <div class="terminal-config">
      <div class="config-row">
        <label>API 终点:</label>
        <input v-model="apiEndpoint" placeholder="API Base URL (如: https://.../v1)" class="endpoint-input" />
        <label>API Key:</label>
        <input v-model="apiKey" type="password" placeholder="API Key" class="key-input" />
      </div>
    </div>

    <!-- 🟢 新增：玩家激活人设切换器与当前已触发的世界书条目展示面板 -->
    <div class="terminal-info-panel" v-if="isLoaded">
      <div class="persona-selector">
        <label>激活人设:</label>
        <select v-model="selectedPersonaAvatar" @change="onPersonaChanged">
          <option v-for="(name, avatar) in personasConfig?.personas" :key="avatar" :value="avatar">
            {{ name }}
          </option>
        </select>
      </div>

      <!-- 🟢 真实开局(Swipe) 切换控制器 -->
      <div class="swipe-selector" v-if="greetingsList.length > 1">
        <button @click="switchGreeting('left')" :disabled="isGenerating" class="swipe-btn">◀</button>
        <span class="swipe-label">开局 Swipe {{ currentGreetingIdx + 1 }} / {{ greetingsList.length }}</span>
        <button @click="switchGreeting('right')" :disabled="isGenerating" class="swipe-btn">▶</button>
      </div>

      <div class="worldbook-info">
        <span>触发世界书: </span>
        <span v-if="activeWorldbookCount === 0" class="no-wb">无</span>
        <span v-else class="active-wb" :title="activeWorldbookList">🟢 {{ activeWorldbookCount }} 条</span>
      </div>
    </div>

    <div class="terminal-output" ref="outputArea">
      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <strong>{{ msg.role === 'user' ? (personasConfig?.personas[selectedPersonaAvatar] || 'User') : (characterData?.name || '明日方舟') }}:</strong>
        <details v-if="msg.thinking" open class="thinking-details">
          <summary>思维链 (Thinking)</summary>
          <p style="white-space: pre-wrap; margin: 5px 0 0 0; color: #8a8; font-size: 0.9em;">{{ msg.thinking }}</p>
        </details>
        <p style="white-space: pre-wrap; margin: 0; line-height: 1.6;">{{ msg.content }}</p>
      </div>
      <div v-if="isGenerating" class="message assistant streaming">
        <strong>{{ characterData?.name || '明日方舟' }} (Generating...):</strong>
        <details v-if="currentThinkingText" open class="thinking-details">
          <summary>思维链 (实时)</summary>
          <p style="white-space: pre-wrap; margin: 5px 0 0 0; color: #8a8; font-size: 0.9em;">{{ currentThinkingText }}</p>
        </details>
        <p style="white-space: pre-wrap; margin: 0; line-height: 1.6;">{{ currentStreamText }}<span class="cursor">_</span></p>
      </div>
    </div>

    <div class="terminal-input" v-if="isLoaded">
      <textarea 
        v-model="inputText" 
        @keydown.enter.prevent="sendMessage"
        placeholder="在此输入你要说的话，系统会自动执行双轨制人设分发并执行全局/内嵌世界书扫描..."
      ></textarea>
      <button @click="sendMessage" :disabled="isGenerating || !apiEndpoint" class="send-btn">发送</button>
      <button @click="abortGeneration" :disabled="!isGenerating" class="abort-btn">中断</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { AgentEngine } from './api/AgentEngine';
import { parse } from 'yaml';
import rawConfig from '../../references/config.yaml?raw';

// 引入我们的无头 Context 组装器和 Zod 契约
import { ContextBuilder } from './parsers/ContextBuilder';
import { CharacterParser } from './parsers/CharacterParser';
import { UserPersonasConfigSchema, PromptProcessingType } from './types/TavernData';

export interface SandboxMessage {
  role: 'system' | 'user' | 'assistant';
  name?: string;
  content: string;
  thinking?: string;
}

const parsedConfig = rawConfig ? parse(rawConfig) : {};

const provider = ref(parsedConfig.provider || 'openai');
const modelName = ref(parsedConfig.modelName || 'gemini-3.5-flash');
const apiEndpoint = ref(parsedConfig.apiEndpoint || 'http://127.0.0.1:8889/v1');
const apiKey = ref(parsedConfig.apiKey || '');
const inputText = ref('');

// 真实数据响应式存储
const isLoaded = ref(false);
const characterData = ref<any>(null);
const presetData = ref<any>(null);
const personasConfig = ref<any>(null);
const selectedPersonaAvatar = ref("1756408233256-.png"); // 默认迷迭香

const greetingsList = ref<string[]>([]);
const currentGreetingIdx = ref(0);

const welcomeText = ref("");
const messages = ref<SandboxMessage[]>([]);

const currentStreamText = ref('');
const currentThinkingText = ref('');
const isGenerating = ref(false);
let abortController: AbortController | null = null;
const outputArea = ref<HTMLElement | null>(null);

const activeWorldbookCount = ref(0);
const activeWorldbookList = ref("");

const engine = new AgentEngine();

const scrollToBottom = () => {
  nextTick(() => {
    if (outputArea.value) {
      outputArea.value.scrollTop = outputArea.value.scrollHeight;
    }
  });
};

// 🟢 前端加载初始化：在挂载阶段 fetch 并解析纯二进制 PNG 与 JSON
onMounted(async () => {
  try {
    // 1. 尝试以不同相对/绝对路径拉取
    const fetchAsset = async (urls: string[]) => {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) return res;
        } catch(e) {}
      }
      throw new Error(`资源获取失败: ${urls[0]}`);
    };

    // 加载人设配置
    const personasRes = await fetchAsset([
      'references/杂项/personas_20260715.json',
      '/references/杂项/personas_20260715.json',
      '../../references/杂项/personas_20260715.json'
    ]);
    personasConfig.value = UserPersonasConfigSchema.parse(await personasRes.json());

    // 加载预设
    const presetRes = await fetchAsset([
      'references/杂项/Izumi Reload 0227 (1).json',
      '/references/杂项/Izumi Reload 0227 (1).json',
      '../../references/杂项/Izumi Reload 0227 (1).json'
    ]);
    presetData.value = await presetRes.json();

    // 🚨 核心无损读取：直接 fetch 原始 PNG 图片字节，并在前端调用无头二进制解析器
    const pngRes = await fetchAsset([
      'references/杂项/Ark.png',
      '/references/杂项/Ark.png',
      '../../references/杂项/Ark.png'
    ]);
    const arrayBuffer = await pngRes.arrayBuffer();
    characterData.value = CharacterParser.parsePng(arrayBuffer);

    // 提取角色卡中的所有开局语 (Swipe 序列)
    const list: string[] = [];
    if (characterData.value.first_mes) {
      list.push(characterData.value.first_mes);
    }
    if (characterData.value.alternate_greetings && Array.isArray(characterData.value.alternate_greetings)) {
      characterData.value.alternate_greetings.forEach((g: string) => {
        if (g) list.push(g);
      });
    }
    greetingsList.value = list;

    // 🚨 黄金纠偏：
    // Swipe 1 (首个开局，索引 0) 是用户自定义的插件启动代码。
    // Swipe 2 (第二个开局，即 alternate_greetings[0]，也就是索引 1) 是真正的故事开局！
    // 默认我们定位到真正的第二个开局（索引 1），这完美解决了“你给我看到的是第三个”的问题！
    currentGreetingIdx.value = list.length > 1 ? 1 : 0;
    const welcome = list[currentGreetingIdx.value] || "你好！";
    
    welcomeText.value = welcome;
    messages.value = [
      { role: 'assistant', name: '明日方舟', content: welcome }
    ];

    isLoaded.value = true;
  } catch (err) {
    console.error("E2E 数据动态初始化失败:", err);
  }
});

const onPersonaChanged = () => {
  // 切换人设时清空历史以重开，确保新触发词干净
  if (characterData.value) {
    messages.value = [
      { role: 'assistant', name: '明日方舟', content: welcomeText.value }
    ];
  }
};

const sendMessage = async () => {
  if (!inputText.value.trim() || isGenerating.value || !isLoaded.value) return;

  const currentUserName = personasConfig.value?.personas[selectedPersonaAvatar.value] || 'User';

  const userMsg: SandboxMessage = { role: 'user', name: currentUserName, content: inputText.value };
  messages.value.push(userMsg);
  const nextInputText = inputText.value;
  inputText.value = '';
  scrollToBottom();

  isGenerating.value = true;
  currentStreamText.value = '';
  currentThinkingText.value = '';
  abortController = new AbortController();

  try {
    // =========================================================================
    // 🚀 核心对齐：调用物理分离 ContextBuilder 进行全生命周期提示词排版组装
    // =========================================================================
    // 构造合流历史，不包括最新那条输入（它应该作为 userInput 传入扫描和插队）
    const historyForAssembly = messages.value.slice(0, -1).map(m => ({
      role: m.role as 'user' | 'assistant',
      name: m.name || (m.role === 'user' ? currentUserName : '明日方舟'),
      content: m.content
    }));

    const compiledContext = ContextBuilder.build({
      characterData: characterData.value,
      presetData: presetData.value,
      personasConfig: personasConfig.value,
      activePersonaAvatar: selectedPersonaAvatar.value,
      chatHistory: historyForAssembly,
      userInput: nextInputText,
      postProcessingMode: PromptProcessingType.StrictTools // 采用 StrictTools (严格半合并)
    });

    // 🟢 物理对齐：提取 ContextBuilder 真实扫描激活出的所有世界书条目名称，干掉任何假数据欺骗
    if (compiledContext.activatedWorldbooks && compiledContext.activatedWorldbooks.length > 0) {
      activeWorldbookCount.value = compiledContext.activatedWorldbooks.length;
      activeWorldbookList.value = "已激活世界书: " + compiledContext.activatedWorldbooks.map(w => {
        return w.comment ? `[${w.comment}]` : (w.uid ? `[UID: ${w.uid}]` : `[未命名条目]`);
      }).join(', ');
    } else {
      activeWorldbookCount.value = 0;
      activeWorldbookList.value = "";
    }

    // 格式化 Context 消息给 pi-ai 发包，这里将 System 完美解离并单独提取
    const formattedMsgs: any[] = [];
    if (compiledContext.systemPrompt) {
      formattedMsgs.push({ role: 'system', content: compiledContext.systemPrompt });
    }
    
    compiledContext.messages.forEach(m => {
      if (m.role === 'user') {
        formattedMsgs.push({ role: 'user', content: m.content });
      } else {
        const textBlock = (m.content as any[]).find(c => c.type === 'text');
        const thinkingBlock = (m.content as any[]).find(c => c.type === 'thinking');
        formattedMsgs.push({
          role: 'assistant',
          content: textBlock ? textBlock.text : '',
          thinking: thinkingBlock ? thinkingBlock.thinking : undefined
        });
      }
    });

    await engine.generateStreamDirect(
      provider.value,
      modelName.value,
      apiKey.value,
      apiEndpoint.value,
      formattedMsgs, // 送入完全排版、洗涤、降级且 100% 对齐的包体
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
          messages.value.push({ role: 'assistant', name: '明日方舟', content: finalContent, thinking: finalThinking });
          isGenerating.value = false;
          currentStreamText.value = '';
          currentThinkingText.value = '';
          scrollToBottom();
        },
        onError: (err) => {
          console.error("生成失败:", err);
          messages.value.push({ role: 'assistant', name: '明日方舟', content: `[系统错误] ${err.message}` });
          isGenerating.value = false;
          currentStreamText.value = '';
          currentThinkingText.value = '';
        }
      }
    );

  } catch (err: any) {
    if (err.name === 'AbortError') {
      messages.value.push({ role: 'assistant', name: '明日方舟', content: currentStreamText.value + " [已中断]" });
    } else {
      console.error("沙盒终端未拦截异常:", err);
      messages.value.push({ role: 'assistant', name: '明日方舟', content: `[沙盒运行时异常] ${err.message || err}` });
    }
    isGenerating.value = false;
    currentStreamText.value = '';
    currentThinkingText.value = '';
    scrollToBottom();
  }
};

const abortGeneration = () => {
  if (abortController) {
    abortController.abort();
  }
};

const switchGreeting = (dir: 'left' | 'right') => {
  if (greetingsList.value.length <= 1 || isGenerating.value) return;

  if (dir === 'left') {
    currentGreetingIdx.value = (currentGreetingIdx.value - 1 + greetingsList.value.length) % greetingsList.value.length;
  } else {
    currentGreetingIdx.value = (currentGreetingIdx.value + 1) % greetingsList.value.length;
  }

  const newWelcome = greetingsList.value[currentGreetingIdx.value];
  welcomeText.value = newWelcome;
  messages.value = [
    { role: 'assistant', name: '明日方舟', content: newWelcome }
  ];
  scrollToBottom();
};
</script>

<style scoped>
.sandbox-terminal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 800px;
  width: 100vw;
  max-width: 1000px;
  background-color: rgba(18, 18, 18, 0.98);
  border: 1px solid #333;
  color: #d0d0d0;
  font-family: 'Consolas', monospace;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
  border-radius: 12px;
  overflow: hidden;
  margin: 20px auto;
}

.terminal-header {
  padding: 15px 20px;
  background: #222;
  border-bottom: 1px solid #333;
}
.terminal-header h3 { margin: 0 0 5px 0; font-size: 16px; color: #fff; }
.loading-status { font-size: 0.85em; color: #aaa; }
.loading-status.success { color: #81c784; }

.terminal-config {
  background: #181818;
  padding: 8px 15px;
}
.config-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85em;
}
.config-row label { color: #888; white-space: nowrap; }
.config-row input, .provider-select {
  background: #0f0f0f;
  border: 1px solid #444;
  color: #fff;
  padding: 4px 8px;
  font-size: 1em;
  border-radius: 4px;
}
.provider-select { flex: 1.5; }
.model-input { flex: 1.5; }
.endpoint-input { flex: 2; }
.key-input { flex: 2; }

.terminal-info-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #141414;
  border-bottom: 1px solid #222;
  font-size: 0.85em;
}
.persona-selector { display: flex; align-items: center; gap: 8px; }
.persona-selector select {
  background: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 3px 6px;
  border-radius: 4px;
}
.swipe-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #181818;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #333;
}
.swipe-btn {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fff;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: bold;
}
.swipe-btn:hover { background: #3a3a3a; }
.swipe-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.swipe-label { font-size: 0.9em; color: #bbb; }
.worldbook-info { color: #888; }
.no-wb { color: #666; font-style: italic; }
.active-wb { color: #81c784; font-weight: bold; cursor: help; }

.terminal-output {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  background: #0a0a0a;
}

.message {
  padding: 10px 15px;
  border-radius: 6px;
  background: rgba(255,255,255,0.02);
}
.message.user {
  border-left: 4px solid #4fc3f7;
  background: rgba(79, 195, 247, 0.03);
}
.message.user strong { color: #4fc3f7; }
.message.assistant {
  border-left: 4px solid #ffb74d;
  background: rgba(255, 183, 77, 0.03);
}
.message.assistant strong { color: #ffb74d; }

.thinking-details {
  margin: 8px 0;
  padding: 10px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px dashed #444;
  border-radius: 4px;
}
.thinking-details summary {
  cursor: pointer;
  color: #8a8;
  font-size: 0.85em;
  user-select: none;
}

.terminal-input {
  display: flex;
  padding: 15px 20px;
  border-top: 1px solid #222;
  background: #111;
  gap: 15px;
}
.terminal-input textarea {
  flex: 1;
  background: #050505;
  color: #fff;
  border: 1px solid #333;
  border-radius: 6px;
  resize: none;
  height: 45px;
  padding: 8px;
  font-family: inherit;
  font-size: 0.95em;
}
.terminal-input textarea:focus {
  border-color: #555;
  outline: none;
}
.terminal-input button {
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  cursor: pointer;
  padding: 0 20px;
  font-weight: bold;
}
.terminal-input button:hover { background: #444; }
.terminal-input button:disabled { opacity: 0.5; cursor: not-allowed; }
.abort-btn { background: #5a2a2a !important; border-color: #8a3a3a !important; }

.cursor { animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
</style>

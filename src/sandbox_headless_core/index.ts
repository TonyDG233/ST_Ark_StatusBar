import { createApp } from "vue";
import SandboxTerminal from "./SandboxTerminal.vue";

console.log("[Headless Sandbox] Booting as standalone web app...");

// 独立网页模式，直接挂载到 index.html 的 #app 节点上
// 彻底抛弃酒馆的 iframe 注入逻辑
const app = createApp(SandboxTerminal);
app.mount('#app');

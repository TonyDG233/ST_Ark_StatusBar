import * as fs from 'fs';
import * as path from 'path';
import { CharacterParser } from '../parsers/CharacterParser';
import { ContextBuilder, SessionConfig } from '../parsers/ContextBuilder';
import { UserPersonasConfigSchema, PromptProcessingType } from '../types/TavernData';

async function runE2E() {
  console.log('================================================================');
  console.log('🧪 启动大一统 ContextBuilder E2E 终极集成测试');
  console.log('================================================================\n');

  const charPngPath = path.resolve(process.cwd(), 'references/杂项/Ark.png');
  const presetJsonPath = path.resolve(process.cwd(), 'references/杂项/Izumi Reload 0227 (1).json');
  const personasJsonPath = path.resolve(process.cwd(), 'references/杂项/personas_20260715.json');

  if (!fs.existsSync(charPngPath) || !fs.existsSync(presetJsonPath) || !fs.existsSync(personasJsonPath)) {
    console.error('❌ 关键测试资源缺失，请检查 references/杂项/ 下的 Ark.png, Izumi 预设与 personas_20260715.json 文件！');
    process.exit(1);
  }

  // 1. 读取并校验人设数据
  const personasRaw = JSON.parse(fs.readFileSync(personasJsonPath, 'utf-8'));
  const personasConfig = UserPersonasConfigSchema.parse(personasRaw);
  const activePersonaAvatar = "1756408233256-.png"; // 迷迭香

  // 2. 解码角色卡以提取第二个滑动分支 (Swipe 2) 作为开局消息
  const charData = CharacterParser.parsePng(charPngPath);
  const swipe2 = (charData.alternate_greetings && charData.alternate_greetings.length > 1)
    ? charData.alternate_greetings[1]
    : charData.first_mes;

  console.log(`- 成功加载角色卡: ${charData.name}`);
  console.log(`- 成功提取第二个问候分支 (Swipe 2), 长度: ${swipe2.length} 字符`);

  // 3. 构建历史消息（开局以阿米娅的 Swipe 2 作为第一条消息）
  const chatHistory = [
    { role: 'assistant' as const, name: charData.name, content: swipe2 }
  ];

  // 4. 模拟玩家输入（触及迷迭香的名字以触发世界书与人设插队，特意融入 {{user}} 与 {{char}} 常用宏测试其洗涤健壮性）
  const userInput = "迷迭香，你还记得我吗？我是你的{{user}}。罗德岛的大家都在等你。凯尔希医生说我们今天要与{{char}}进行联合突围。";

  // 5. 配置 E2E 运行参数
  const config: SessionConfig = {
    characterPngPath: charPngPath,
    presetJsonPath: presetJsonPath,
    personasConfig,
    activePersonaAvatar,
    chatHistory,
    userInput,
    postProcessingMode: PromptProcessingType.StrictTools // 采用 StrictTools (严格半合并)
  };

  console.log('\n👉 正在执行 ContextBuilder.build() 管线生命周期...');
  const startTime = Date.now();
  const context = ContextBuilder.build(config);
  const endTime = Date.now();
  console.log(`- 管线组装完成，耗时 ${endTime - startTime}ms`);

  // =========================================================================
  // 6. 编纂并输出 TXT 报告 (供指挥官在酒馆中进行比对测试)
  // =========================================================================
  const reportPath = path.resolve(process.cwd(), 'references/杂项/final_payload_e2e.txt');
  let reportContent = '';

  reportContent += `================================================================\n`;
  reportContent += `📄 HEADLESS TAVERN CORE - FINAL PAYLOAD REPORT (ESM/E2E)\n`;
  reportContent += `================================================================\n`;
  reportContent += `- 生成时间: ${new Date().toLocaleString()}\n`;
  reportContent += `- 角色卡: ${charData.name}\n`;
  reportContent += `- 预设文件: Izumi Reload 0227 (1).json\n`;
  reportContent += `- 玩家激活人设: 迷迭香 (${activePersonaAvatar})\n`;
  reportContent += `- 后处理模式: Strict (with tools)\n`;
  reportContent += `================================================================\n\n`;

  if (context.systemPrompt) {
    reportContent += `================================================================\n`;
    reportContent += `👑 SYSTEM PROMPT (系统指令区)\n`;
    reportContent += `================================================================\n`;
    reportContent += `${context.systemPrompt}\n`;
    reportContent += `================================================================\n\n`;
  } else {
    reportContent += `👑 SYSTEM PROMPT: (空 - 已被合并降级为 User 消息)\n\n`;
  }

  reportContent += `================================================================\n`;
  reportContent += `💬 CHAT MESSAGES (历史对话与深度插队混合区)\n`;
  reportContent += `================================================================\n`;

  context.messages.forEach((msg, idx) => {
    reportContent += `----------------------------------------------------------------\n`;
    reportContent += `[Message ${idx + 1} | Role: ${msg.role}]\n`;
    reportContent += `----------------------------------------------------------------\n`;
    if (msg.role === 'user') {
      reportContent += `${msg.content}\n`;
    } else {
      const textBlock = (msg.content as any[]).find(c => c.type === 'text');
      reportContent += `${textBlock ? textBlock.text : JSON.stringify(msg.content)}\n`;
    }
  });
  reportContent += `================================================================\n`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`\n✅ E2E Payload 报告已成功写入磁盘：\n   ${reportPath}`);
  console.log('\n--- 最终生成的 Context 概要 ──-');
  console.log(`- System Prompt 字符数: ${context.systemPrompt?.length || 0}`);
  console.log(`- 消息数组节点数: ${context.messages.length}`);
}

runE2E().catch(console.error);

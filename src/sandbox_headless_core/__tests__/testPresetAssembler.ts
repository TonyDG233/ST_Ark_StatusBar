import * as fs from 'fs';
import * as path from 'path';
import { ExportedPresetSchema } from '../types/TavernData';
import { PresetAssembler } from '../parsers/PresetAssembler';

async function main() {
  const filePath = path.resolve(process.cwd(), 'references/杂项/TGbreak😺V1.0.2版 (1).json');
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const parsed = ExportedPresetSchema.parse(rawData);

  const context = PresetAssembler.assemble({
    preset: parsed,
    chatHistory: [
      { role: 'user', content: '<player_input>\nWhat is our first destination?\n</player_input>' }
    ],
    placeholders: {
      charDescription: "[角色设定] 阿米娅是罗德岛的公开领袖。",
      scenario: "[场景设定] 罗德岛本舰，舰桥。",
      worldInfoBefore: "[世界书_前] 泰拉世界饱受天灾肆虐...",
      worldInfoAfter: "[世界书_后] 源石技艺是这里的核心力量。",
      dialogueExamples: "[对话示例]\nUser: 阿米娅\nAssistant: 博士，有什么我可以帮您的吗？"
    }
  });

  console.log('============= 最终组装的完整 Payload (模拟发给大模型) =============\n');
  if (context.systemPrompt) {
    console.log('>>> systemInstruction (System Prompt) <<<');
    console.log(context.systemPrompt);
    console.log('--------------------------------------------------\n');
  } else {
    console.log('>>> systemInstruction (System Prompt) <<<');
    console.log('(Empty - Due to use_sysprompt=false or squashing)');
    console.log('--------------------------------------------------\n');
  }

  console.log('>>> contents (Chat History) <<<');
  context.messages.forEach((msg, idx) => {
    console.log(`[Message ${idx} | Role: ${msg.role}]`);
    if (msg.role === 'user') {
      console.log(msg.content);
    } else {
      const textBlock = (msg.content as any[]).find(c => c.type === 'text');
      console.log(textBlock ? textBlock.text : JSON.stringify(msg.content));
    }
    console.log('--------------------------------------------------');
  });
}

main().catch(console.error);

import * as fs from 'fs';
import * as path from 'path';
import { ExportedPresetSchema } from '../types/TavernData';
import { PresetAssembler } from '../parsers/PresetAssembler';

async function main() {
  const filePath = path.resolve(process.cwd(), 'references/杂项/Izumi Reload 0227 (1).json');
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const parsed = ExportedPresetSchema.parse(rawData);

  const context = PresetAssembler.assemble({
    preset: parsed,
    chatHistory: [
      { role: 'user', content: '<player_input>\n测试\n</player_input>' }
    ],
    placeholders: {
      charDescription: "[charDescription] Amiya is the leader.",
      scenario: "[scenario] Rhodes Island bridge.",
      worldInfoBefore: "[worldInfoBefore] Terra is plagued by catastrophes.",
      worldInfoAfter: "[worldInfoAfter] Originium Arts are the core power.",
      dialogueExamples: "[dialogueExamples]\nUser: Amiya\nAssistant: Doctor?"
    }
  });

  console.log('============= 最终组装的完整 Payload (Izumi 预设) =============\n');
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
      const text = textBlock ? textBlock.text : JSON.stringify(msg.content);
      console.log(text);
    }
    console.log('--------------------------------------------------');
  });
}

main().catch(console.error);
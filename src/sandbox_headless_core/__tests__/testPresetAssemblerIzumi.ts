import * as fs from 'fs';
import * as path from 'path';
import { ExportedPresetSchema } from '../types/TavernData';
import { PresetAssembler } from '../parsers/PresetAssembler';

async function main() {
  const filePath = path.resolve(process.cwd(), 'references/杂项/Izumi Reload 0227 (1).json');
  if (!fs.existsSync(filePath)) {
    console.log('跳过旧测试');
    return;
  }
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

  console.log('Izumi skeleton elements count:', context.length);
  context.forEach((msg, idx) => {
    console.log(`--- [${idx}] Role: ${msg.role}, Name: ${msg.name || 'None'} ---`);
    console.log(msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : ''));
  });
}

main().catch(console.error);

import * as fs from 'fs';
import * as path from 'path';
import { ExportedPresetSchema } from '../types/TavernData';
import { PresetAssembler } from '../parsers/PresetAssembler';

async function main() {
  const filePath = path.resolve(process.cwd(), 'references/杂项/Default.json');
  if (!fs.existsSync(filePath)) {
    console.log('跳过旧测试');
    return;
  }
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const parsed = ExportedPresetSchema.parse(rawData);

  const context = PresetAssembler.assemble({
    preset: parsed,
    chatHistory: [
      { role: 'user', content: 'hello' }
    ],
    placeholders: {
      charDescription: "Amiya is the leader of Rhodes Island.",
      scenario: "Rhodes Island bridge.",
      worldInfoBefore: "Before prompt content.",
      worldInfoAfter: "After prompt content.",
      dialogueExamples: "User: Hello\nAssistant: Hi!"
    }
  });

  console.log('Preset assemble raw items total:', context.length);
}

main().catch(console.error);

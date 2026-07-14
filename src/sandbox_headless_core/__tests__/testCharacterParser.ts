import * as path from 'path';
import { CharacterParser } from '../parsers/CharacterParser';

async function main() {
  const filePath = path.resolve(process.cwd(), 'references/杂项/Ark.png');
  console.log(`Reading character card from: ${filePath}`);

  try {
    const charData = CharacterParser.parsePng(filePath);
    
    console.log('\n✅ 角色卡解析与 Zod 契约校验成功！\n');
    console.log('============= 角色卡基础信息 =============');
    console.log(`名字: ${charData.name}`);
    console.log(`版本: ${charData.character_version || 'N/A'}`);
    console.log(`创建者: ${charData.creator}`);
    console.log(`包含标签: ${charData.tags.join(', ')}`);
    
    console.log('\n============= 长度统计 =============');
    console.log(`角色设定 (Description) 长度: ${charData.description.length} 字符`);
    console.log(`性格设定 (Personality) 长度: ${charData.personality.length} 字符`);
    console.log(`场景设定 (Scenario) 长度: ${charData.scenario.length} 字符`);
    console.log(`首次问候 (First Mes) 长度: ${charData.first_mes.length} 字符`);
    console.log(`对话示例 (Mes Example) 长度: ${charData.mes_example.length} 字符`);

    console.log('\n============= 高级扩展信息 (Extensions) =============');
    const ext = charData.extensions;
    if (ext) {
      console.log(`世界设定 (World): ${ext.world || 'None'}`);
      console.log(`Depth Prompt 是否存在: ${ext.depth_prompt ? '是 (Depth: ' + ext.depth_prompt.depth + ')' : '否'}`);
      console.log(`外置正则 (Regex Scripts) 数量: ${ext.regex_scripts?.length || 0}`);
    }

    console.log('\n============= 内嵌世界书 (Worldbook) =============');
    const wb = charData.character_book;
    if (wb) {
      console.log(`世界书名称: ${wb.name}`);
      const entriesArray = wb.entries as any[];
      console.log(`包含条目总数: ${entriesArray.length}`);
      if (entriesArray.length > 0) {
         console.log(`\n抽样前 3 个条目的触发词 (Keys):`);
         entriesArray.slice(0, 3).forEach((entry, idx) => {
            console.log(`- 条目 [${entry.id || idx}]: Keys=[${entry.keys.join(', ')}]`);
         });
      }
    } else {
      console.log(`内嵌世界书: 无`);
    }

    // 验证 Swipe (Alternate Greetings)
    console.log('\n============= 滑动分支 (Alternate Greetings/Swipes) =============');
    if (charData.alternate_greetings && charData.alternate_greetings.length > 0) {
      console.log(`包含分支总数: ${charData.alternate_greetings.length}`);
      console.log(`抽样分支 1 长度: ${charData.alternate_greetings[0].length} 字符`);
      if (charData.alternate_greetings.length > 1) {
        console.log(`抽样分支 2 长度: ${charData.alternate_greetings[1].length} 字符`);
      }
    } else {
      console.log('无滑动分支数据。');
    }

  } catch (err: any) {
    console.error('\n❌ 角色卡解析失败！发现了未捕获的脏数据或格式异常：');
    // 如果是 ZodError，打印具体字段报错
    if (err.errors) {
       console.error(JSON.stringify(err.errors, null, 2));
    } else {
       console.error(err.message || err);
    }
  }
}

main().catch(console.error);

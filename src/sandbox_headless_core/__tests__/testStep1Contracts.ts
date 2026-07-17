import { UserPersonasConfigSchema, PromptProcessingType } from '../types/TavernData';

function runStep1Test() {
    console.log('================================================================');
    console.log('🧪 开始运行 步骤 1: Zod 契约验证测试 (testStep1Contracts)');
    console.log('================================================================\n');

    // 模拟玩家提供的真实人设 JSON 数据片
    const rawPersonaJson = {
      "personas": {
        "1694074289622.png": "Little Chen",
        "1746291893260-.png": "*穿越者*",
        "1746543411676-.png": "穿越者",
        "1756408233256-.png": "迷迭香"
      },
      "persona_descriptions": {
        "1694074289622.png": {
          "description": "Little Chen's description.",
          "position": 1
        },
        "1746291893260-.png": {
          "description": "说明：{{user}}为来自现代社会的穿越者...",
          "position": 0,
          "depth": 2,
          "role": 0,
          "lorebook": ""
        },
        "1756408233256-.png": {
          "description": "<Rosmontis_Core>...",
          "position": 0,
          "depth": 2,
          "role": 0,
          "lorebook": "",
          "title": "来自罗德岛的精英干员穿越者"
        }
      },
      "default_persona": null
    };

    const parsed = UserPersonasConfigSchema.parse(rawPersonaJson);

    // 1. 断言：Zod 成功吞吐且保留了所有非 Zod 规范下的额外字段 (通过 passthrough 验证)
    const rosemary = parsed.persona_descriptions["1756408233256-.png"];
    const isTitleCorrect = rosemary?.title === "来自罗德岛的精英干员穿越者";
    const isDepthCorrect = rosemary?.depth === 2;
    const isRoleCorrect = rosemary?.role === 0;

    console.log(`- 迷迭香人设 title 是否正确解析: ${isTitleCorrect ? '✅' : '❌'}`);
    console.log(`- 穿越者人设 depth 默认/解析值是否为 2: ${isDepthCorrect ? '✅' : '❌'}`);
    console.log(`- 穿越者人设 role 是否为 0 (System): ${isRoleCorrect ? '✅' : '❌'}`);

    // 2. 验证枚举
    const testEnumVal = PromptProcessingType.StrictTools;
    const isEnumCorrect = testEnumVal === 6;
    console.log(`- 提示词后处理 PromptProcessingType 映射是否正确 (StrictTools === 6): ${isEnumCorrect ? '✅' : '❌'}`);

    if (isTitleCorrect && isDepthCorrect && isRoleCorrect && isEnumCorrect) {
        console.log(`\n🎉 步骤 1 契约防腐测试成功！`);
    } else {
        throw new Error('步骤 1 契约验证失败，存在不一致的字段映射');
    }
}

try {
    runStep1Test();
} catch (e) {
    console.error('测试运行失败: ', e);
    process.exit(1);
}

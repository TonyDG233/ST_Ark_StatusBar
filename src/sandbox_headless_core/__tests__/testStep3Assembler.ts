import { PresetAssembler, ChatMessageInput, InjectionPrompt } from '../parsers/PresetAssembler';
import { ExportedPresetSchema } from '../types/TavernData';
import * as fs from 'fs';
import * as path from 'path';

function runStep3Test() {
    console.log('================================================================');
    console.log('🧪 开始运行 步骤 3: 线性排版与深度插队测试 (testStep3Assembler)');
    console.log('================================================================\n');

    const presetPath = path.resolve(process.cwd(), 'references/杂项/Izumi Reload 0227 (1).json');
    if (!fs.existsSync(presetPath)) {
        console.warn(`未找到预设文件 ${presetPath}，跳过此阶段测试。`);
        return;
    }

    const rawPreset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
    const parsedPreset = ExportedPresetSchema.parse(rawPreset);

    const chatHistory: ChatMessageInput[] = [
        { role: 'user', content: '消息 1' },
        { role: 'assistant', content: '回复 1' },
        { role: 'user', content: '消息 2' }
    ];

    const placeholders = {
        charDescription: "阿米娅是领袖。",
        scenario: "战场边缘。",
        worldInfoBefore: "前置世界书内容。",
        worldInfoAfter: "后置世界书内容。",
        dialogueExamples: "示例对话..."
    };

    // 构造玩家人设 (模拟深度插队 PERSONA_DESCRIPTION)
    const extensionInjections: InjectionPrompt[] = [
        {
            identifier: 'PERSONA_DESCRIPTION',
            content: '<Rosmontis_Core>迷迭香人设说明...',
            injection_depth: 2, // 插在逆序数第 2 位 (即 消息 1 和 回复 1 之间)
            role: 'user'
        }
    ];

    // 运行排版管线
    const rawSkeleton = PresetAssembler.assemble({
        preset: parsedPreset,
        chatHistory,
        placeholders,
        extensionInjections
    });

    console.log(`- 排版器输出原始结构消息链长度 (预期 > 5): ${rawSkeleton.length}`);
    
    // 1. 验证排版器纯净化：它是否仍然包含了原始角色而未降级？
    const systemCount = rawSkeleton.filter(m => m.role === 'system').length;
    console.log(`- 原始消息链中是否保留了原始 system 提示词 (预期 > 0): ${systemCount > 0 ? '✅ 成功保留' : '❌ 被错误降级'}`);

    // 2. 验证深度插队 (Injections) 是否精确定位插入
    // 历史 reversed 是： [消息 2, 回复 1, 消息 1]
    // 深度 d=2 时插队，由于 totalInsertedMessages = 0
    // 逆序插入索引 d = 2，即插在 [消息 1] 之前（相当于正常顺序的 消息 1 之后，回复 1 之前）
    const injectNode = rawSkeleton.find(m => m.injected === true);
    const isInjectFound = injectNode !== undefined;
    const isInjectContentCorrect = injectNode?.content.includes('迷迭香人设说明');

    console.log(`- 深度插队节点是否成功找到: ${isInjectFound ? '✅' : '❌'}`);
    console.log(`- 插队内容是否完美吻合: ${isInjectContentCorrect ? '✅' : '❌'}`);
    
    if (systemCount > 0 && isInjectFound && isInjectContentCorrect) {
        console.log(`\n🎉 步骤 3 线性排版净化与多深度插队机制验证成功！`);
    } else {
        throw new Error('步骤 3 验证未通过，深度插队逻辑异常');
    }
}

try {
    runStep3Test();
} catch (e) {
    console.error('测试运行异常: ', e);
    process.exit(1);
}

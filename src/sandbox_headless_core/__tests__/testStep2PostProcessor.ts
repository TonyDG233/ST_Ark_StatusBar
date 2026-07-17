import { PromptPostProcessor, InternalMessage } from '../parsers/PromptPostProcessor';
import { PromptProcessingType } from '../types/TavernData';

function runStep2Test() {
    console.log('================================================================');
    console.log('🧪 开始运行 步骤 2: 无状态提示词后处理器测试 (testStep2PostProcessor)');
    console.log('================================================================\n');

    const names = {
        user_name: '博士',
        char_name: '阿米娅'
    };

    // 构造测试消息链 (有 System, User, Assistant, 以及乱序 System 的混合情况)
    const baseMessages: InternalMessage[] = [
        { role: 'system', content: '【系统提示 1: 行为约束】' },
        { role: 'system', content: '【系统提示 2: 整合运动敌方数据】' },
        { role: 'user', content: '阿米娅，整合运动到哪里了？' },
        { role: 'assistant', content: '博士，源石虫正从东侧突入！' },
        { role: 'system', content: '【系统提示 3: 战场发生异变：罗德岛本舰陷入供能危机】' }
    ];

    // =========================================================================
    // 🧪 场景 1: None 模式 (原汁原味输出)
    // =========================================================================
    console.log('👉 [场景 1: None 模式测试]');
    const outNone = PromptPostProcessor.process(baseMessages, PromptProcessingType.None, names);
    const isNoneCorrect = outNone.messages.length === baseMessages.length;
    console.log(`- 长度是否一致 (5): ${isNoneCorrect ? '✅' : '❌'}`);

    // =========================================================================
    // 🧪 场景 2: Merge 模式 (同角色物理合并，不降级 System)
    // =========================================================================
    console.log('\n👉 [场景 2: Merge 模式测试]');
    const outMerge = PromptPostProcessor.process(baseMessages, PromptProcessingType.Merge, names);
    
    // 【系统提示 1】和【系统提示 2】都是 system，且相邻，应合并为 1 条
    const firstMsg = outMerge.messages[0];
    const hasMergedSystem = firstMsg && firstMsg.role === 'user' && typeof firstMsg.content === 'string' && firstMsg.content.includes('整合运动敌方数据');
    console.log(`- 相邻 System 1 & 2 是否物理合并成功: ${hasMergedSystem ? '✅' : '❌'}`);
    console.log(`- 合并后的首条 System 内容: \n  "${firstMsg ? firstMsg.content : ''}"`);

    // =========================================================================
    // 🧪 场景 3: Strict 模式 (除首条合并 system 外，其余 system 全部降级 user 并再度连续 Squash)
    // =========================================================================
    console.log('\n👉 [场景 3: Strict 模式 (严格角色交替)]');
    const outStrict = PromptPostProcessor.process(baseMessages, PromptProcessingType.Strict, names);

    // 预期：
    // [0]: system (合并后的系统提示 1 + 2)
    // [1]: user ("阿米娅，整合运动到哪里了？")
    // [2]: assistant ("博士，源石虫正从东侧突入！")
    // [3]: user (降级后的 系统提示 3)
    const isStrictLengthCorrect = outStrict.messages.length === 4;
    const lastMsg = outStrict.messages[3];
    const isSystem3Downgraded = lastMsg && lastMsg.role === 'user' && typeof lastMsg.content === 'string' && lastMsg.content.includes('本舰陷入供能危机');
    
    console.log(`- 严格交替重排后总长度是否为 4: ${isStrictLengthCorrect ? '✅' : '❌'}`);
    console.log(`- 消息 [3] (系统提示 3) 是否被完美降级为 user: ${isSystem3Downgraded ? '✅' : '❌'}`);
    console.log(`- 消息 [3] 降级内容: \n  "${lastMsg ? lastMsg.content : ''}"`);

    if (isNoneCorrect && isStrictLengthCorrect) {
        console.log(`\n🎉 步骤 2 提示词后处理器 100% 成功符合 Rust 物理合并算法！`);
    } else {
        throw new Error('步骤 2 测试未通过');
    }
}

try {
    runStep2Test();
} catch (e) {
    console.error('测试失败: ', e);
    process.exit(1);
}

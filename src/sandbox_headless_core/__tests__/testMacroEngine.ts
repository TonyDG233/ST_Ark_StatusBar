import { MacroEngine, MacroContext } from '../parsers/MacroEngine';

function runTest() {
    const engine = new MacroEngine();

    const ctx: MacroContext = {
        user: '玩家',
        char: '阿米娅',
        localVariables: {
            'hp': '100',
            'gold': '500'
        },
        globalVariables: {},
        lastUserMessage: '罗德岛准备行动',
    };

    console.log('============= 宏引擎 (Macro Engine) 测试 =============\n');

    // 1. 基础环境测试
    const text1 = '你好，<USER>！我是{{char}}。你刚刚说的是："{{lastUserMessage}}"？';
    console.log('[测试 1: 基础环境与旧语法]');
    console.log(`输入: ${text1}`);
    console.log(`输出: ${engine.evaluate(text1, ctx)}\n`);

    // 2. 乱数测试
    const text2 = '投掷伤害: {{roll::2d6}}，随机获得: {{pick::源石::龙门币::合成玉}}，幸运数字: {{random::1::100}}';
    console.log('[测试 2: 随机数发生器]');
    console.log(`输入: ${text2}`);
    console.log(`输出: ${engine.evaluate(text2, ctx)}\n`);

    // 3. 变量测试 (来自 Izumi 的高频用法)
    const text3 = '{{setvar::mood::开心}}当前心情: {{getvar::mood}}，当前HP: {{getvar::hp}}，吃药后...{{addvar::hp::50}}现在HP: {{getvar::hp}}。是否有护盾? {{hasvar::shield}}。';
    console.log('[测试 3: 内部状态机变量赋值与提取]');
    console.log(`输入: ${text3}`);
    console.log(`输出: ${engine.evaluate(text3, ctx)}\n`);

    // 4. 注释与UI占位符
    const text4 = '这是正文。{{// 这是一个超长的注释\n里面包含了设定的机密信息\n不会被输出 }}这是被跳过的输入: [{{input}}]。';
    console.log('[测试 4: 格式清洗与 UI 毒瘤屏蔽]');
    console.log(`输入: ${text4}`);
    console.log(`输出: ${engine.evaluate(text4, ctx)}\n`);
}

runTest();

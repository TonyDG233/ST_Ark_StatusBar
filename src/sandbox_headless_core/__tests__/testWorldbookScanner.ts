import * as path from 'path';
import { CharacterParser } from '../parsers/CharacterParser';
import { ScannerEntry, WorldbookScanner } from '../parsers/WorldbookScanner';
import { WorldbookScannerInput } from '../types/TavernData';

async function runTest() {
    const pngPath = path.resolve(__dirname, '../../../references/杂项/Ark.png');
    const charData = CharacterParser.parsePng(pngPath);
    
    if (!charData.character_book || !charData.character_book.entries) {
        console.error('未找到内嵌世界书');
        return;
    }
    
    // Stage 0: 模拟 Scope 过滤，扁平化世界书
    // 把 Ark.png 内嵌的世界书抽出来，打上 world=Ark 标记
    const entries: ScannerEntry[] = charData.character_book.entries.map((e: any) => ({
        ...e,
        world: 'Ark'
    }));
    
    console.log(`✅ 成功加载测试数据：提取世界书条目 ${entries.length} 个`);

    const scanner = new WorldbookScanner();

    const charName = charData.name || '明日方舟';
    // 提取第二条滑动分支 (Swipe 2，索引为 1)
    const swipe2 = (charData.alternate_greetings && charData.alternate_greetings.length > 1) 
        ? charData.alternate_greetings[1] 
        : charData.first_mes;

    // 编纂一段包含高频词汇的玩家输入
    const userMessage = "干员们，准备突围。阿米娅，报告敌方整合运动装甲部队的位置！不能让源石虫靠近防线。凯尔希医生有什么指示吗？";

    console.log(`\n============= 构造测试对话 =============`);
    console.log(`[${charName} (Swipe 2 截取前 50 字)]: ${swipe2.substring(0, 50)}...`);
    console.log(`[User]: ${userMessage}`);

    // 伪造测试用的全局环境与设定
    const input: WorldbookScannerInput = {
        entries,
        chatHistory: [
            { name: charName, mes: swipe2, is_system: false },
            { name: 'User', mes: userMessage, is_system: false }
        ],
        timedEffects: {
            sticky: {},
            cooldown: {},
            delay: {}
        },
        settings: {
            world_info_include_names: true, // 开启名字扫描
            world_info_case_sensitive: false,
            world_info_match_whole_words: false,
            world_info_use_group_scoring: false
        },
        globalScanData: {
            trigger: 'normal'
        }
    };

    console.log('\n============= 运行扫描器 (Worldbook Scanner) =============');
    const startTime = Date.now();
    const output = scanner.scan(input);
    const endTime = Date.now();

    console.log(`扫描完成，耗时 ${endTime - startTime}ms`);
    console.log('--- 阵地分发结果 ---');
    let totalTriggered = 0;
    for (const [pos, list] of Object.entries(output.activated)) {
        if (list.length > 0) {
            totalTriggered += list.length;
            console.log(`\n[阵地: ${pos}] 命中 ${list.length} 个条目:`);
            // 打印所有抽样条目的名称以便核对
            list.forEach((e: any, idx: number) => {
                console.log(`   ${idx + 1}. ${e.comment || e.id}`);
            });
        }
    }
    console.log(`\n✅ 扫描管线总计命中条目数: ${totalTriggered}`);
}

runTest().catch(console.error);

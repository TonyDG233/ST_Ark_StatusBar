const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'prts_parser_readable.js');
const outputDir = path.join(__dirname, 'legacy_cases');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 1. 读取并进行终极清理（处理残留的字面量转义符）
let rawText = fs.readFileSync(inputFile, 'utf-8');
// 将字符串中的 "\\n" 替换为真实的换行，"\\t" 替换为真实 Tab
rawText = rawText.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

// 2. 提取 switch 块内容
// 寻找 switch (m1) 的起点
const switchStartMatch = rawText.match(/switch\s*\(\s*m1\s*\)\s*\{/);
if (!switchStartMatch) {
    console.error("Failed to find 'switch (m1)' in the file.");
    process.exit(1);
}

const startIndex = switchStartMatch.index + switchStartMatch[0].length;
const switchContent = rawText.substring(startIndex);

// 3. 使用正则分割各个 case
// 匹配 case "xxxxx":  (注意捕获组提取命令名)
const caseRegex = /case\s+["']([^"']+)["']\s*:/g;
let match;
let cases = [];

while ((match = caseRegex.exec(switchContent)) !== null) {
    cases.push({
        command: match[1],
        index: match.index
    });
}

console.log(`Found ${cases.length} cases. Starting extraction...`);

// 4. 切片并保存
for (let i = 0; i < cases.length; i++) {
    const currentCase = cases[i];
    const nextCase = cases[i + 1];
    
    const startIdx = currentCase.index;
    const endIdx = nextCase ? nextCase.index : switchContent.length;
    
    let caseBody = switchContent.substring(startIdx, endIdx);
    
    // 清理尾部：遇到可能属于 switch 结尾的 default 或多余的右括号等
    // 为了防止截取过多，在下一个 case 前结束，但最后一个 case 可能会包含 switch 的闭合大括号。
    if (!nextCase) {
        // 对于最后一个case，去掉 switch 最后那个不属于 case 的大括号
        const lastBraceIndex = caseBody.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
             caseBody = caseBody.substring(0, lastBraceIndex);
        }
    }
    
    // 基础的空行和首尾空白清理
    caseBody = caseBody.trim();
    
    // 可选：利用简单的正则做一次缩进美化，去除多余的空行
    caseBody = caseBody.replace(/\n{3,}/g, '\n\n'); 

    const outputFile = path.join(outputDir, `${currentCase.command}.js`);
    fs.writeFileSync(outputFile, caseBody, 'utf-8');
    console.log(`Extracted: ${currentCase.command}.js`);
}

console.log("Extraction completed successfully!");

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * -----------------------------------------------------------------------------
 *  KiloCode Bulk Replace Tool
 * -----------------------------------------------------------------------------
 *  此脚本用于跨文件批量正则替换。
 *  建议通过在 `.kilocode/skills/bulk-replace/run.mjs` 中预先配置好
 *  具体的 target_dir, regex, replacement 后再执行本底层脚本，
 *  或者直接从命令行传参执行。
 */

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('用法: node bulk_replace.mjs <directory> <regex_pattern> <replacement_string> [extensions...]');
  process.exit(1);
}

const targetDir = args[0];
const patternStr = args[1];
const replacement = args[2];
const extensions = args.slice(3).length > 0 ? args.slice(3) : ['.ts', '.vue', '.js', '.scss', '.md'];

let regex;
try {
  regex = new RegExp(patternStr, 'g');
} catch (e) {
  console.error(`无效的正则表达式: ${patternStr}`, e);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  console.error(`目标目录不存在: ${targetDir}`);
  process.exit(1);
}

let modifiedCount = 0;
let fileCount = 0;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  content = content.replace(regex, replacement);

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Updated] ${filePath}`);
    modifiedCount++;
  }
}

function walkDir(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      // 跳过 node_modules 和 dist 等常见无关目录
      if (!['node_modules', 'dist', '.git'].includes(file)) {
         walkDir(fullPath);
      }
    } else {
      if (extensions.some(ext => fullPath.endsWith(ext))) {
        fileCount++;
        processFile(fullPath);
      }
    }
  }
}


console.log(`Starting bulk replace in ${targetDir}...`);
console.log(`Pattern: ${regex}`);
console.log(`Replacement: "${replacement}"`);
console.log(`Extensions: ${extensions.join(', ')}`);
console.log('---------------------------------------------------');

walkDir(targetDir);

console.log('---------------------------------------------------');
console.log(`Bulk replace complete. Scanned ${fileCount} files. Modified ${modifiedCount} files.`);
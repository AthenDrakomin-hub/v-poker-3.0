/**
 * svg-cards.svg 拆分脚本
 * 将 940KB 的 SVG sprite 拆分为 53 张独立优化 SVG 文件
 * 递归解析 <use href="#id"> 依赖，只包含被引用的定义
 *
 * 用法: node scripts/split-cards.js
 */
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const INPUT_SVG = path.join(__dirname, '..', 'svg-cards.svg');
const OUTPUT_DIR = path.join(__dirname, '..', 'static', 'images', 'cards');

// 后端 label → SVG ID 映射
// label 格式: {rank}{suit}, 如 As, Kh, 10d, Qc, back
const RANK_TO_SVG = {
  'A': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'jack', 'Q': 'queen', 'K': 'king'
};
const SUIT_TO_SVG = { 's': 'spade', 'h': 'heart', 'd': 'diamond', 'c': 'club' };

// 生成所有需要的卡牌
function generateCardList() {
  const cards = [];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['s','h','d','c'];
  for (const s of suits) {
    for (const r of ranks) {
      const label = r + s;
      const svgId = `${SUIT_TO_SVG[s]}_${RANK_TO_SVG[r]}`;
      cards.push({ label, svgId, fileName: `${label}.svg` });
    }
  }
  // 牌背
  cards.push({ label: 'back', svgId: 'back', fileName: 'back.svg' });
  return cards;
}

// ========== SVG 解析 ==========

/**
 * 从 XML 字符串中提取所有带 id 的元素（处理嵌套）
 * 返回 { id: elementXml }
 */
function extractElementsWithIds(xml) {
  const elements = {};
  const stack = [];
  let i = 0;
  const len = xml.length;

  while (i < len) {
    // 跳过注释
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      i = end > 0 ? end + 3 : len;
      continue;
    }

    // 匹配开始标签: <tagname attrs>
    const tagMatch = xml.substring(i).match(/^<([a-zA-Z_][\w.-]*)([^>]*?)(\/?)>/);
    if (tagMatch) {
      const tagName = tagMatch[1];
      const attrs = tagMatch[2];
      const selfClosing = tagMatch[3] === '/';
      const fullMatch = tagMatch[0];

      const idMatch = attrs.match(/\bid="([^"]+)"/);

      if (!selfClosing) {
        stack.push({
          tag: tagName,
          id: idMatch ? idMatch[1] : null,
          start: i
        });
      } else if (idMatch) {
        // 自闭合元素
        elements[idMatch[1]] = fullMatch;
      }
      i += fullMatch.length;
      continue;
    }

    // 匹配结束标签: </tagname>
    const endMatch = xml.substring(i).match(/^<\/([a-zA-Z_][\w.-]*)>/);
    if (endMatch) {
      const top = stack.pop();
      if (top && top.id) {
        elements[top.id] = xml.substring(top.start, i + endMatch[0].length);
      }
      i += endMatch[0].length;
      continue;
    }

    i++;
  }

  return elements;
}

/**
 * 递归收集元素及其所有 <use href="#id"> 依赖
 */
function collectDependencies(elementId, elements, visited = new Set()) {
  if (visited.has(elementId)) return [];
  if (!elements[elementId]) return [];

  visited.add(elementId);
  const deps = [elementId];

  const el = elements[elementId];
  // 匹配 href="#id" 或 xlink:href="#id"
  const hrefRegex = /(?:xlink:)?href="#([^"']+)"/g;
  let match;
  while ((match = hrefRegex.exec(el)) !== null) {
    const refId = match[1];
    const subDeps = collectDependencies(refId, elements, visited);
    deps.push(...subDeps);
  }

  return [...new Set(deps)];
}

/**
 * 生成单张卡牌的独立 SVG
 */
function generateCardSvg(cardId, elements) {
  const deps = collectDependencies(cardId, elements);
  const defsPieces = [];

  for (const depId of deps) {
    if (elements[depId]) {
      defsPieces.push(elements[depId]);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 169.075 244.640" width="169.075" height="244.640">
<defs>
${defsPieces.join('\n')}
</defs>
<use xlink:href="#${cardId}"/>
</svg>`;
}

// ========== 主流程 ==========
function main() {
  console.log('📖 读取 svg-cards.svg ...');
  const svgContent = fs.readFileSync(INPUT_SVG, 'utf-8');
  console.log(`   文件大小: ${(svgContent.length / 1024).toFixed(1)} KB`);

  // 提取 defs 内容
  const defsMatch = svgContent.match(/<defs>([\s\S]*?)<\/defs>/);
  if (!defsMatch) {
    console.error('❌ 未找到 <defs> 节点');
    process.exit(1);
  }
  const defsContent = defsMatch[1];
  console.log(`   defs 大小: ${(defsContent.length / 1024).toFixed(1)} KB`);

  // 解析所有带 id 的元素
  console.log('🔍 解析 SVG 元素 ...');
  const elements = extractElementsWithIds(defsContent);
  const elementCount = Object.keys(elements).length;
  console.log(`   找到 ${elementCount} 个带 id 的元素`);

  // 创建输出目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 生成卡牌列表
  const cards = generateCardList();
  console.log(`\n🎴 开始生成 ${cards.length} 张卡牌 ...`);

  let totalSize = 0;
  let successCount = 0;

  for (const card of cards) {
    if (!elements[card.svgId]) {
      console.warn(`   ⚠️  未找到 SVG ID: ${card.svgId} (${card.label})`);
      continue;
    }

    const svg = generateCardSvg(card.svgId, elements);
    const outputPath = path.join(OUTPUT_DIR, card.fileName);
    fs.writeFileSync(outputPath, svg, 'utf-8');

    const sizeKB = Buffer.byteLength(svg) / 1024;
    totalSize += sizeKB;
    successCount++;

    console.log(`   ✅ ${card.label.padEnd(6)} → ${card.fileName.padEnd(12)} (${sizeKB.toFixed(1)} KB)`);
  }

  console.log(`\n📊 完成统计:`);
  console.log(`   成功生成: ${successCount} / ${cards.length}`);
  console.log(`   总大小: ${totalSize.toFixed(1)} KB (${(totalSize / 1024).toFixed(2)} MB)`);
  console.log(`   输出目录: ${OUTPUT_DIR}`);
  console.log(`   相比原文件节省: ${(100 - totalSize / (svgContent.length / 1024) * 100).toFixed(1)}%`);
}

main();

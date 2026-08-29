/**
 * V-Poker 字体子集化脚本
 * 扫描项目中所有中文字符，用 fontmin 生成子集字体
 * 仅处理中文字体（MaShanZheng, ZCOOLXiaoWei），英文字体保持不变
 */
const fs = require('fs')
const path = require('path')
const Fontmin = require('fontmin')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const FONTS_DIR = path.join(PROJECT_ROOT, 'static', 'fonts')

// 需要子集化的中文字体
const CHINESE_FONTS = [
  'MaShanZheng-Regular.ttf',
  'ZCOOLXiaoWei-Regular.ttf'
]

// 扫描目录（排除 node_modules, unpackage, scripts, .git）
const SCAN_DIRS = ['pages', 'components', 'api', 'socket', 'store', 'utils', 'styles', 'themes']
const SCAN_EXTENSIONS = ['.vue', '.js', '.json', '.scss', '.css']

// 额外包含的常用字符（数字、英文、标点、符号）
const EXTRA_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  ' .,;:!?\'"()-_[]{}<>/\\|@#$%^&*+=~`' +
  '，。、；：？！“”‘’（）—…·《》【】' +
  '💰🎮🔐📱📋ℹ️📄💬⚙️🔄✓✕←→↑↓★☆♥♠♦♣'

/**
 * 递归扫描目录，收集所有文件内容中的字符
 */
function collectChars(dir, charSet) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'unpackage', '.git', '.hbuilderx'].includes(entry.name)) continue
      collectChars(fullPath, charSet)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (SCAN_EXTENSIONS.includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          // 提取中文字符
          const chineseChars = content.match(/[\u4e00-\u9fff]/g)
          if (chineseChars) {
            chineseChars.forEach(c => charSet.add(c))
          }
          // 提取中文标点
          const chinesePunct = content.match(/[\u3000-\u303f\uff00-\uffef]/g)
          if (chinesePunct) {
            chinesePunct.forEach(c => charSet.add(c))
          }
        } catch (e) {
          // 跳过无法读取的文件
        }
      }
    }
  }
}

/**
 * 子集化单个字体
 */
function subsetFont(fontName, text) {
  return new Promise((resolve, reject) => {
    const srcPath = path.join(FONTS_DIR, fontName)
    const originalSize = fs.statSync(srcPath).size

    const fontmin = new Fontmin()
      .src(srcPath)
      .use(Fontmin.glyph({ text: text, hinting: false }))
      .use(Fontmin.ttf2woff2()) // 同时生成 woff2

    fontmin.run((err, files) => {
      if (err) {
        reject(err)
        return
      }

      // 找到 ttf 文件（fontmin 可能输出多个文件）
      const ttfFile = files.find(f => f.path.endsWith('.ttf'))
      if (!ttfFile) {
        reject(new Error('未找到生成的 ttf 文件'))
        return
      }

      // 写回原文件
      fs.writeFileSync(srcPath, ttfFile.contents)
      const newSize = fs.statSync(srcPath).size

      // 如果生成了 woff2，也保存
      const woff2File = files.find(f => f.path.endsWith('.woff2'))
      if (woff2File) {
        const woff2Path = srcPath.replace('.ttf', '.woff2')
        fs.writeFileSync(woff2Path, woff2File.contents)
      }

      resolve({
        fontName,
        originalSize,
        newSize,
        reduction: ((1 - newSize / originalSize) * 100).toFixed(1)
      })
    })
  })
}

async function main() {
  console.log('=== V-Poker 字体子集化 ===\n')

  // 1. 收集所有字符
  console.log('[1/3] 扫描项目字符...')
  const charSet = new Set()
  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(PROJECT_ROOT, dir)
    if (fs.existsSync(fullDir)) {
      collectChars(fullDir, charSet)
    }
  }
  // 也扫描根目录的配置文件
  const rootFiles = ['App.vue', 'main.js', 'manifest.json', 'pages.json', 'uni.scss']
  for (const file of rootFiles) {
    const filePath = path.join(PROJECT_ROOT, file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const chineseChars = content.match(/[\u4e00-\u9fff]/g)
      if (chineseChars) chineseChars.forEach(c => charSet.add(c))
      const chinesePunct = content.match(/[\u3000-\u303f\uff00-\uffef]/g)
      if (chinesePunct) chinesePunct.forEach(c => charSet.add(c))
    }
  }

  // 合并额外字符
  const allChars = Array.from(charSet).join('') + EXTRA_CHARS
  console.log(`  收集到 ${charSet.size} 个唯一中文字符`)
  console.log(`  总字符数（含ASCII/标点）: ${allChars.length}\n`)

  // 2. 备份原字体
  console.log('[2/3] 备份原字体...')
  const backupDir = path.join(FONTS_DIR, '_backup')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  for (const font of CHINESE_FONTS) {
    const src = path.join(FONTS_DIR, font)
    const dst = path.join(backupDir, font)
    fs.copyFileSync(src, dst)
    console.log(`  备份: ${font}`)
  }
  console.log()

  // 3. 子集化
  console.log('[3/3] 子集化字体...\n')
  let totalOriginal = 0
  let totalNew = 0

  for (const font of CHINESE_FONTS) {
    try {
      const result = await subsetFont(font, allChars)
      totalOriginal += result.originalSize
      totalNew += result.newSize
      console.log(`  ✅ ${result.fontName}`)
      console.log(`     原始: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`     子集: ${(result.newSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`     缩减: ${result.reduction}%\n`)
    } catch (err) {
      console.error(`  ❌ ${font} 子集化失败:`, err.message)
      // 恢复备份
      const backupPath = path.join(backupDir, font)
      const origPath = path.join(FONTS_DIR, font)
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, origPath)
        console.log(`     已从备份恢复\n`)
      }
    }
  }

  console.log('=== 汇总 ===')
  console.log(`  原始大小: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  子集大小: ${(totalNew / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  总缩减: ${((1 - totalNew / totalOriginal) * 100).toFixed(1)}%`)
  console.log(`\n  原字体备份在: static/fonts/_backup/`)
  console.log(`  验证无误后可删除备份目录`)
}

main().catch(err => {
  console.error('字体子集化失败:', err)
  process.exit(1)
})

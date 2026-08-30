/**
 * V-Poker 音频格式转换脚本
 * 将 static/sounds/ 下的 WAV 文件转换为 AAC(.m4a) 格式
 * 大幅减小包体积（WAV 21.67MB → AAC 约3-4MB）
 *
 * 前置要求：安装 ffmpeg 并加入 PATH
 *   Windows: winget install ffmpeg 或从 https://ffmpeg.org/download.html 下载
 *   Mac: brew install ffmpeg
 *
 * 用法：node convert-audio.js
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SOUNDS_DIR = path.join(PROJECT_ROOT, 'static', 'sounds')

// 检查 ffmpeg 是否可用
function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' })
    return true
  } catch (e) {
    return false
  }
}

// 递归获取所有 wav 文件
function getWavFiles(dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getWavFiles(fullPath))
    } else if (entry.name.toLowerCase().endsWith('.wav')) {
      files.push(fullPath)
    }
  }
  return files
}

// 转换单个文件
function convertFile(wavPath) {
  const m4aPath = wavPath.replace(/\.wav$/i, '.m4a')
  const wavSize = fs.statSync(wavPath).size

  // AAC 128kbps，适合游戏音效
  const cmd = `ffmpeg -y -i "${wavPath}" -c:a aac -b:a 128k -movflags +faststart "${m4aPath}"`
  execSync(cmd, { stdio: 'pipe' })

  const m4aSize = fs.statSync(m4aPath).size
  return {
    wavPath,
    m4aPath,
    wavSize,
    m4aSize,
    reduction: ((1 - m4aSize / wavSize) * 100).toFixed(1)
  }
}

function main() {
  console.log('=== V-Poker 音频格式转换 (WAV → AAC) ===\n')

  if (!checkFfmpeg()) {
    console.error('❌ 未检测到 ffmpeg，请先安装：')
    console.error('   Windows: winget install Gyan.FFmpeg')
    console.error('   或下载: https://ffmpeg.org/download.html')
    console.error('\n   安装后重新运行: node convert-audio.js')
    process.exit(1)
  }

  console.log('✅ ffmpeg 已就绪\n')

  const wavFiles = getWavFiles(SOUNDS_DIR)
  console.log(`找到 ${wavFiles.length} 个 WAV 文件\n`)

  let totalWav = 0
  let totalM4a = 0
  let success = 0
  let failed = 0

  for (const wavPath of wavFiles) {
    const relPath = path.relative(PROJECT_ROOT, wavPath)
    try {
      const result = convertFile(wavPath)
      totalWav += result.wavSize
      totalM4a += result.m4aSize
      success++
      console.log(`  ✅ ${relPath}`)
      console.log(`     ${(result.wavSize / 1024).toFixed(0)}KB → ${(result.m4aSize / 1024).toFixed(0)}KB (${result.reduction}%)`)
    } catch (err) {
      failed++
      console.error(`  ❌ ${relPath}: ${err.message}`)
    }
  }

  console.log('\n=== 转换完成 ===')
  console.log(`  成功: ${success}/${wavFiles.length}`)
  if (failed > 0) console.log(`  失败: ${failed}`)
  console.log(`  原始大小: ${(totalWav / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  转换大小: ${(totalM4a / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  总缩减: ${((1 - totalM4a / totalWav) * 100).toFixed(1)}%`)

  console.log('\n⚠️  下一步：')
  console.log('  1. 验证 .m4a 文件可正常播放')
  console.log('  2. 修改 utils/sound.js 中 THEME_SOUND_MAP 的文件扩展名为 .m4a')
  console.log('  3. 确认无误后删除原 .wav 文件')
  console.log('  4. 重新上传静态资源到 Cloudflare R2')
}

main()

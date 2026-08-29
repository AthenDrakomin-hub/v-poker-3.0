#!/bin/bash
# V-Poker 音频批量优化脚本
# 功能：将 static/sounds/ 下的 wav 转为 mp3（压缩比约 10:1）
# 依赖：ffmpeg
# 用法：在项目根目录执行 bash scripts/optimize-audio.sh

set -e

SOUNDS_DIR="static/sounds"
CONVERTED=0
SKIPPED=0
TOTAL_ORIGINAL=0
TOTAL_COMPRESSED=0

echo "=== V-Poker 音频优化 ==="
echo "目录: $SOUNDS_DIR"
echo ""

# 检查 ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "错误：未安装 ffmpeg"
    echo "安装："
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Windows: choco install ffmpeg"
    exit 1
fi

# 遍历所有 wav 文件
find "$SOUNDS_DIR" -name "*.wav" -type f | while read wav_file; do
    mp3_file="${wav_file%.wav}.mp3"

    # 如果 mp3 已存在且较新，跳过
    if [ -f "$mp3_file" ] && [ "$mp3_file" -nt "$wav_file" ]; then
        echo "跳过(已存在): $mp3_file"
        continue
    fi

    orig_size=$(stat -f%z "$wav_file" 2>/dev/null || stat -c%s "$wav_file" 2>/dev/null || echo 0)

    echo "转换: $(basename "$wav_file") ..."

    # 转换为 128kbps mp3（游戏音效足够）
    ffmpeg -y -i "$wav_file" -codec:a libmp3lame -b:a 128k -ar 44100 -ac 1 "$mp3_file" 2>/dev/null

    if [ -f "$mp3_file" ]; then
        comp_size=$(stat -f%z "$mp3_file" 2>/dev/null || stat -c%s "$mp3_file" 2>/dev/null || echo 0)
        ratio=$(( (orig_size - comp_size) * 100 / orig_size ))
        echo "  完成: $((orig_size/1024))KB -> $((comp_size/1024))KB (节省 ${ratio}%)"
    else
        echo "  失败: $wav_file"
    fi
done

echo ""
echo "=== 优化完成 ==="
echo "提示：转换后请更新代码中引用 .wav 的路径为 .mp3"
echo "      建议删除原始 .wav 文件以减小包体积"

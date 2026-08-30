#!/bin/bash
# V-Poker 字体子集化脚本
# 功能：从完整字体中提取项目中实际使用的字符，大幅减小字体文件体积
# 依赖：fonttools (pip install fonttools brotli)
# 用法：在项目根目录执行 bash scripts/subset-fonts.sh

set -e

FONTS_DIR="static/fonts"
SRC_DIRS="pages components utils api store"
OUTPUT_DIR="static/fonts/subset"

echo "=== V-Poker 字体子集化 ==="
echo ""

# 检查 fonttools
if ! command -v pyftsubset &> /dev/null; then
    echo "错误：未安装 fonttools"
    echo "安装：pip install fonttools brotli"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# 收集项目中所有使用的字符
echo "扫描项目字符..."
ALL_CHARS=$(find $SRC_DIRS -name "*.vue" -o -name "*.js" -o -name "*.json" | xargs cat 2>/dev/null | grep -oP '[^\x00-\x7F]' | sort -u | tr -d '\n')

# 加上常用字符（数字、英文、标点）
COMMON_CHARS="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ !\"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~"
UNICODE_CHARS="${ALL_CHARS}${COMMON_CHARS}"

echo "收集到 $(echo -n "$ALL_CHARS" | wc -c) 个中文字符"
echo ""

# 遍历字体文件
for font_file in "$FONTS_DIR"/*.ttf "$FONTS_DIR"/*.otf; do
    [ -f "$font_file" ] || continue

    font_name=$(basename "$font_file")
    ext="${font_name##*.}"
    base="${font_name%.*}"
    output="$OUTPUT_DIR/${base}-subset.${ext}"

    orig_size=$(stat -f%z "$font_file" 2>/dev/null || stat -c%s "$font_file" 2>/dev/null || echo 0)

    echo "子集化: $font_name ($((orig_size/1024))KB)..."

    pyftsubset "$font_file" \
        --text="$UNICODE_CHARS" \
        --output-file="$output" \
        --flavor="${ext}" \
        --no-hinting \
        --desubroutinize \
        --drop-tables+=DSIG 2>/dev/null

    if [ -f "$output" ]; then
        comp_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null || echo 0)
        ratio=$(( (orig_size - comp_size) * 100 / orig_size ))
        echo "  完成: $((orig_size/1024))KB -> $((comp_size/1024))KB (节省 ${ratio}%)"
    else
        echo "  失败"
    fi
done

echo ""
echo "=== 子集化完成 ==="
echo "输出目录: $OUTPUT_DIR"
echo "提示：请将 CSS 中的字体路径更新为 subset/ 目录下的文件"

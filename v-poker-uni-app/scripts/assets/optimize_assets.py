#!/usr/bin/env python3
"""
V-Poker 静态资源优化脚本
- WAV -> MP3 (ffmpeg)
- 字体子集化 (fonttools)
"""
import os
import sys
import subprocess
import json
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(r"C:\Users\88903\Desktop\v-poker-uni-app")
SOUNDS_DIR = PROJECT_ROOT / "static" / "sounds"
FONTS_DIR = PROJECT_ROOT / "static" / "fonts"

# ffmpeg 路径（imageio-ffmpeg）
try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = "ffmpeg"

def convert_wav_to_mp3():
    """转换所有 WAV 为 MP3"""
    print("\n" + "="*60)
    print("【1/2】WAV -> MP3 转换")
    print("="*60)

    wav_files = list(SOUNDS_DIR.rglob("*.wav"))
    if not wav_files:
        print("未找到 WAV 文件")
        return 0, 0

    total_orig = 0
    total_comp = 0
    converted = 0

    for wav_path in wav_files:
        mp3_path = wav_path.with_suffix(".mp3")
        orig_size = wav_path.stat().st_size
        total_orig += orig_size

        # 已存在且较新则跳过
        if mp3_path.exists() and mp3_path.stat().st_mtime > wav_path.stat().st_mtime:
            comp_size = mp3_path.stat().st_size
            total_comp += comp_size
            print(f"  跳过(已存在): {wav_path.name}")
            converted += 1
            continue

        print(f"  转换: {wav_path.name} ({orig_size//1024}KB) ...", end=" ")

        # ffmpeg 转换：128kbps mono mp3
        cmd = [
            FFMPEG, "-y", "-i", str(wav_path),
            "-codec:a", "libmp3lame", "-b:a", "128k",
            "-ar", "44100", "-ac", "1",
            str(mp3_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if mp3_path.exists():
            comp_size = mp3_path.stat().st_size
            total_comp += comp_size
            ratio = (1 - comp_size/orig_size) * 100
            print(f"-> {comp_size//1024}KB (节省{ratio:.0f}%)")
            converted += 1
        else:
            print(f"失败!")
            print(f"    stderr: {result.stderr[-200:]}")

    print(f"\n转换完成: {converted}/{len(wav_files)}")
    print(f"原始: {total_orig/1024/1024:.1f}MB -> 压缩: {total_comp/1024/1024:.1f}MB")
    print(f"节省: {(total_orig-total_comp)/1024/1024:.1f}MB ({(1-total_comp/total_orig)*100:.0f}%)")
    return total_orig, total_comp


def collect_used_chars():
    """扫描项目中所有使用的字符"""
    src_dirs = ["pages", "components", "utils", "api", "store"]
    chars = set()

    for src_dir in src_dirs:
        dir_path = PROJECT_ROOT / src_dir
        if not dir_path.exists():
            continue
        for ext in ["*.vue", "*.js", "*.json"]:
            for f in dir_path.rglob(ext):
                try:
                    text = f.read_text(encoding="utf-8", errors="ignore")
                    # 收集非ASCII字符（中文等）
                    for ch in text:
                        if ord(ch) > 127:
                            chars.add(ch)
                except:
                    pass

    # 常用 ASCII 字符
    common = set("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")
    chars.update(common)

    return "".join(sorted(chars))


def subset_fonts():
    """字体子集化"""
    print("\n" + "="*60)
    print("【2/2】字体子集化")
    print("="*60)

    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options

    font_files = list(FONTS_DIR.glob("*.ttf")) + list(FONTS_DIR.glob("*.otf"))
    if not font_files:
        print("未找到字体文件")
        return 0, 0

    # 收集使用的字符
    print("扫描项目字符...")
    used_chars = collect_used_chars()
    print(f"收集到 {len(used_chars)} 个字符 (含ASCII)")

    output_dir = FONTS_DIR / "subset"
    output_dir.mkdir(exist_ok=True)

    total_orig = 0
    total_comp = 0

    for font_path in font_files:
        orig_size = font_path.stat().st_size
        total_orig += orig_size

        output_path = output_dir / f"{font_path.stem}-subset{font_path.suffix}"

        print(f"  子集化: {font_path.name} ({orig_size//1024}KB) ...", end=" ")

        try:
            font = TTFont(str(font_path))
            subsetter = Subsetter()
            options = Options()
            options.notdef_outline = True
            options.recommended_glyphs = True

            subsetter.populate(text=used_chars)
            subsetter.subset(font)

            font.save(str(output_path))
            font.close()

            comp_size = output_path.stat().st_size
            total_comp += comp_size
            ratio = (1 - comp_size/orig_size) * 100
            print(f"-> {comp_size//1024}KB (节省{ratio:.0f}%)")
        except Exception as e:
            print(f"失败: {e}")

    print(f"\n子集化完成")
    print(f"原始: {total_orig/1024/1024:.1f}MB -> 子集: {total_comp/1024/1024:.1f}MB")
    print(f"节省: {(total_orig-total_comp)/1024/1024:.1f}MB ({(1-total_comp/total_orig)*100:.0f}%)")
    print(f"\n输出目录: {output_dir}")
    return total_orig, total_comp


def main():
    print("V-Poker 静态资源优化")
    print(f"项目: {PROJECT_ROOT}")
    print(f"ffmpeg: {FFMPEG}")

    wav_orig, wav_comp = convert_wav_to_mp3()
    font_orig, font_comp = subset_fonts()

    print("\n" + "="*60)
    print("优化总结")
    print("="*60)
    total_orig = wav_orig + font_orig
    total_comp = wav_comp + font_comp
    print(f"音频: {wav_orig/1024/1024:.1f}MB -> {wav_comp/1024/1024:.1f}MB")
    print(f"字体: {font_orig/1024/1024:.1f}MB -> {font_comp/1024/1024:.1f}MB")
    print(f"总计: {total_orig/1024/1024:.1f}MB -> {total_comp/1024/1024:.1f}MB")
    print(f"节省: {(total_orig-total_comp)/1024/1024:.1f}MB ({(1-total_comp/total_orig)*100:.0f}%)")
    print("\n后续步骤:")
    print("  1. 验证 mp3 播放正常后，可删除原始 .wav 文件")
    print("  2. 将 CSS 中字体路径更新为 static/fonts/subset/ 目录")


if __name__ == "__main__":
    main()

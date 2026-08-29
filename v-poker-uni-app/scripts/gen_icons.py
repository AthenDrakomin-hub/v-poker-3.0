# -*- coding: utf-8 -*-
"""
V-Poker 应用图标批量生成工具
从 static/apptubiao.png (1024x1024) 生成 manifest.json 中引用的全部图标尺寸
输出到 unpackage/res/icons/
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "static", "apptubiao.png")
OUT_DIR = os.path.join(ROOT, "unpackage", "res", "icons")

# manifest.json 中引用的全部图标尺寸 (去重)
ICON_SIZES = [
    20,   # iPad notification
    29,   # iPad settings
    40,   # iPad notification@2x / iPhone notification@2x / iPad spotlight
    58,   # iPad settings@2x / iPhone settings@2x
    60,   # iPhone notification@3x
    72,   # Android hdpi
    76,   # iPad app
    80,   # iPad spotlight@2x / iPhone spotlight@2x
    87,   # iPhone settings@3x
    96,   # Android xhdpi
    120,  # iPhone app@2x / iPhone spotlight@3x
    144,  # Android xxhdpi
    152,  # iPad app@2x
    167,  # iPad pro app@2x
    180,  # iPhone app@3x
    192,  # Android xxxhdpi
    1024, # App Store
]


def main():
    if not os.path.exists(SRC):
        print(f"[ERROR] 源图标不存在: {SRC}")
        return

    os.makedirs(OUT_DIR, exist_ok=True)

    src_img = Image.open(SRC).convert("RGBA")
    print(f"[INFO] 源图标: {SRC}  尺寸: {src_img.size[0]}x{src_img.size[1]}")
    print(f"[INFO] 输出目录: {OUT_DIR}")
    print("-" * 50)

    success = 0
    for size in ICON_SIZES:
        try:
            # LANCZOS 高质量缩放
            resized = src_img.resize((size, size), Image.LANCZOS)
            out_path = os.path.join(OUT_DIR, f"{size}x{size}.png")
            resized.save(out_path, "PNG", optimize=True)
            file_size = os.path.getsize(out_path)
            print(f"[OK] {size}x{size:<5d} -> {file_size/1024:7.1f}KB")
            success += 1
        except Exception as e:
            print(f"[FAIL] {size}x{size}: {e}")

    print("-" * 50)
    print(f"[DONE] 成功生成 {success}/{len(ICON_SIZES)} 个图标")


if __name__ == "__main__":
    main()

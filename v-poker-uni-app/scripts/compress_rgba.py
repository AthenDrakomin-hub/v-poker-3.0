# -*- coding: utf-8 -*-
"""
V-Poker RGBA 图片压缩修复
使用 FASTOCTREE 方法量化带透明通道的 PNG
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

total_before = 0
total_after = 0


def compress_rgba_png(path, colors=256):
    """RGBA PNG 量化压缩（FASTOCTREE 支持透明通道）"""
    global total_before, total_after
    before = os.path.getsize(path)
    try:
        img = Image.open(path)
        if img.mode in ('RGBA', 'LA', 'PA'):
            # FASTOCTREE (method=2) 支持 RGBA 量化
            quantized = img.quantize(colors=colors, method=Image.FASTOCTREE,
                                      dither=Image.FLOYDSTEINBERG)
        else:
            img = img.convert('RGB')
            quantized = img.quantize(colors=colors, method=Image.MEDIANCUT)
        quantized.save(path, 'PNG', optimize=True)
        after = os.path.getsize(path)
        total_before += before
        total_after += after
        ratio = (1 - after / before) * 100 if before > 0 else 0
        print(f"  [OK] {os.path.basename(path):40s} {before/1024:7.1f}KB -> {after/1024:7.1f}KB  (-{ratio:.1f}%)")
        return True
    except Exception as e:
        print(f"  [FAIL] {path}: {e}")
        return False


def main():
    print("=" * 70)
    print("V-Poker RGBA 图片压缩修复（FASTOCTREE）")
    print("=" * 70)

    # 1. static/splash.png
    print("\n[1] 通用启动图")
    compress_rgba_png("static/splash.png", colors=128)

    # 2. static/images/ui/1024x1024.png
    print("\n[2] UI 大图片")
    ui_path = "static/images/ui/1024x1024.png"
    if os.path.exists(ui_path):
        compress_rgba_png(ui_path, colors=256)

    # 3. unpackage/res/icons/ 应用图标
    print("\n[3] 应用图标")
    icons_dir = "unpackage/res/icons"
    if os.path.exists(icons_dir):
        icon_files = sorted([f for f in os.listdir(icons_dir) if f.endswith('.png')])
        for f in icon_files:
            compress_rgba_png(os.path.join(icons_dir, f), colors=256)

    # 总结
    print("\n" + "=" * 70)
    saved = total_before - total_after
    print(f"  压缩前: {total_before / 1024 / 1024:.2f} MB")
    print(f"  压缩后: {total_after / 1024 / 1024:.2f} MB")
    print(f"  节省:   {saved / 1024 / 1024:.2f} MB ({(saved / total_before * 100) if total_before > 0 else 0:.1f}%)")


if __name__ == "__main__":
    main()

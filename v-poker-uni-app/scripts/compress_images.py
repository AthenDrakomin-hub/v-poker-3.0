# -*- coding: utf-8 -*-
"""
V-Poker 图片资源压缩工具
1. PNG 量化压缩（启动图/图标等必须保持 PNG 的文件）
2. PNG 转 JPG（照片类背景图，大幅压缩）
3. 删除未引用资源
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

total_before = 0
total_after = 0


def get_size(path):
    return os.path.getsize(path) if os.path.exists(path) else 0


def compress_png_quantize(path, colors=256):
    """PNG 量化压缩：减少颜色数，保持 PNG 格式"""
    global total_before, total_after
    before = get_size(path)
    try:
        img = Image.open(path)
        # 处理透明通道
        if img.mode in ('RGBA', 'LA', 'PA'):
            # 保留透明通道的量化
            quantized = img.quantize(colors=colors, method=Image.MEDIANCUT,
                                      dither=Image.FLOYDSTEINBERG)
        else:
            img = img.convert('RGB')
            quantized = img.quantize(colors=colors, method=Image.MEDIANCUT,
                                      dither=Image.FLOYDSTEINBERG)
        quantized.save(path, 'PNG', optimize=True)
        after = get_size(path)
        total_before += before
        total_after += after
        ratio = (1 - after / before) * 100 if before > 0 else 0
        print(f"  [PNG量化] {os.path.basename(path):40s} {before/1024:7.1f}KB -> {after/1024:7.1f}KB  (-{ratio:.1f}%)")
        return True
    except Exception as e:
        print(f"  [FAIL] {path}: {e}")
        return False


def png_to_jpg(png_path, jpg_path, quality=85):
    """PNG 转 JPG（照片类图片）"""
    global total_before, total_after
    before = get_size(png_path)
    try:
        img = Image.open(png_path)
        # JPG 不支持透明，转 RGB
        if img.mode in ('RGBA', 'LA', 'PA'):
            background = Image.new('RGB', img.size, (10, 10, 10))
            if img.mode == 'PA':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else img.split()[1])
            img = background
        else:
            img = img.convert('RGB')
        img.save(jpg_path, 'JPEG', quality=quality, optimize=True)
        after = get_size(jpg_path)
        # 删除原 PNG
        os.remove(png_path)
        total_before += before
        total_after += after
        ratio = (1 - after / before) * 100 if before > 0 else 0
        print(f"  [PNG->JPG] {os.path.basename(png_path):40s} {before/1024:7.1f}KB -> {after/1024:7.1f}KB  (-{ratio:.1f}%)")
        return True
    except Exception as e:
        print(f"  [FAIL] {png_path}: {e}")
        return False


def delete_file(path):
    """删除未引用文件"""
    global total_before
    before = get_size(path)
    if os.path.exists(path):
        os.remove(path)
        total_before += before
        print(f"  [删除] {os.path.basename(path):40s} {before/1024:7.1f}KB")
        return True
    return False


def main():
    print("=" * 70)
    print("V-Poker 图片资源压缩")
    print("=" * 70)

    # === 1. 删除未引用资源 ===
    print("\n[1/4] 删除未引用资源")
    delete_file("static/images/ui/shouyebeijing.png")

    # === 2. PNG 转 JPG（照片类背景图）===
    print("\n[2/4] PNG 转 JPG（照片类背景图，质量 85）")
    png_to_jpg("static/login-background.png", "static/login-background.jpg", quality=85)
    png_to_jpg("static/images/cs-avatar.png", "static/images/cs-avatar.jpg", quality=85)

    # === 3. PNG 量化压缩（必须保持 PNG 格式）===
    print("\n[3/4] PNG 量化压缩（启动图/图标，256色）")

    # 启动图（11 个规格）
    splash_dir = "static/splash"
    splash_files = sorted([f for f in os.listdir(splash_dir) if f.endswith('.png')])
    print(f"  --- 启动图 ({len(splash_files)} 个) ---")
    for f in splash_files:
        compress_png_quantize(os.path.join(splash_dir, f), colors=128)

    # 通用启动图和源图
    print(f"  --- 通用启动图/源图 ---")
    compress_png_quantize("static/splash.png", colors=128)
    compress_png_quantize("static/qidongtu.png", colors=128)

    # 应用图标源
    print(f"  --- 应用图标 ---")
    compress_png_quantize("static/apptubiao.png", colors=256)

    # UI 目录下的大 PNG
    ui_dir = "static/images/ui"
    if os.path.exists(ui_dir):
        ui_pngs = [f for f in os.listdir(ui_dir) if f.endswith('.png') and os.path.getsize(os.path.join(ui_dir, f)) > 100 * 1024]
        if ui_pngs:
            print(f"  --- UI 大图片 ({len(ui_pngs)} 个) ---")
            for f in sorted(ui_pngs):
                compress_png_quantize(os.path.join(ui_dir, f), colors=256)

    # unpackage 图标（应用图标，保持高质量）
    icons_dir = "unpackage/res/icons"
    if os.path.exists(icons_dir):
        icon_pngs = sorted([f for f in os.listdir(icons_dir) if f.endswith('.png')])
        print(f"  --- 应用图标 ({len(icon_pngs)} 个，256色) ---")
        for f in icon_pngs:
            compress_png_quantize(os.path.join(icons_dir, f), colors=256)

    # === 4. 总结 ===
    print("\n" + "=" * 70)
    print("压缩总结")
    print("=" * 70)
    saved = total_before - total_after
    print(f"  压缩前总计: {total_before / 1024 / 1024:.2f} MB")
    print(f"  压缩后总计: {total_after / 1024 / 1024:.2f} MB")
    print(f"  节省空间:   {saved / 1024 / 1024:.2f} MB ({(saved / total_before * 100) if total_before > 0 else 0:.1f}%)")


if __name__ == "__main__":
    main()

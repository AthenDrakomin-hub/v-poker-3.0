# -*- coding: utf-8 -*-
"""
V-Poker 横屏启动图批量生成工具
基于 static/qidongtu.png 源图，cover 居中裁剪到各 iOS 横屏规格
输出 PNG（无损）+ JPG（质量90）到 static/splash/
"""
import os
from PIL import Image

# 项目根目录
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "static", "qidongtu.png")
OUT_DIR = os.path.join(ROOT, "static", "splash")

# iOS 横屏启动图规格 (manifest.json 中配置的全部规格)
# 格式: (输出文件名前缀, 宽度, 高度)
SPECS = [
    ("landscape-480h",     960,  640),   # iPhone 3.5寸 @2x 横屏
    ("landscape-568h",    1136,  640),   # iPhone 4寸 横屏
    ("landscape-667h",    1334,  750),   # iPhone 4.7寸 横屏
    ("landscape-736h",    2208, 1242),   # iPhone 5.5寸 横屏
    ("landscape-812h@3x", 2436, 1125),   # iPhone X/XS/11Pro 横屏
    ("landscape-844h",    2532, 1170),   # iPhone 12/12Pro/13/14 横屏
    ("landscape-852h",    2556, 1179),   # iPhone 14Pro/15/16 横屏
    ("landscape-896h@2x", 1792,  828),   # iPhone XR/11 横屏
    ("landscape-896h@3x", 2688, 1242),   # iPhone XS Max/11Pro Max 横屏
    ("landscape-926h",    2778, 1284),   # iPhone 12Pro Max/13Pro Max/14Plus 横屏
    ("landscape-932h",    2796, 1290),   # iPhone 14Pro Max/15Plus/16Plus 横屏
]

JPG_QUALITY = 90


def cover_resize(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """
    cover 模式：等比缩放铺满目标区域，居中裁剪多余部分
    保证 Logo（居中）始终完整可见
    """
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    dst_ratio = target_w / target_h

    if src_ratio > dst_ratio:
        # 源图更宽 → 按高度缩放，裁剪左右
        scale = target_h / src_h
        new_w = int(src_w * scale)
        new_h = target_h
    else:
        # 源图更窄/等高 → 按宽度缩放，裁剪上下
        scale = target_w / src_w
        new_w = target_w
        new_h = int(src_h * scale)

    # 高质量缩放
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # 居中裁剪
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    right = left + target_w
    bottom = top + target_h

    return resized.crop((left, top, right, bottom))


def main():
    if not os.path.exists(SRC):
        print(f"[ERROR] 源图不存在: {SRC}")
        return

    os.makedirs(OUT_DIR, exist_ok=True)

    src_img = Image.open(SRC).convert("RGB")
    print(f"[INFO] 源图: {SRC}  尺寸: {src_img.size[0]}x{src_img.size[1]}")
    print(f"[INFO] 输出目录: {OUT_DIR}")
    print("-" * 60)

    success = 0
    for name, w, h in SPECS:
        try:
            result = cover_resize(src_img, w, h)

            png_path = os.path.join(OUT_DIR, f"{name}.png")
            jpg_path = os.path.join(OUT_DIR, f"{name}.jpg")

            result.save(png_path, "PNG", optimize=True)
            result.save(jpg_path, "JPEG", quality=JPG_QUALITY, optimize=True)

            png_size = os.path.getsize(png_path)
            jpg_size = os.path.getsize(jpg_path)
            print(f"[OK] {name:24s} {w}x{h:<5d}  PNG={png_size/1024:7.1f}KB  JPG={jpg_size/1024:7.1f}KB")
            success += 1
        except Exception as e:
            print(f"[FAIL] {name}: {e}")

    print("-" * 60)
    print(f"[DONE] 成功生成 {success}/{len(SPECS)} 组启动图 (每组 PNG+JPG)")


if __name__ == "__main__":
    main()

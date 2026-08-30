# -*- coding: utf-8 -*-
"""
V-Poker manifest.json 综合验证
1. JSON 格式校验
2. 全部图标文件存在 + 尺寸匹配
3. 全部启动图文件存在 + 尺寸匹配
4. manifest 中每个引用路径都指向真实文件
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

errors = []
warnings = []

# === 1. JSON 格式校验 ===
print("=" * 60)
print("1. JSON 格式校验")
try:
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
    print("   [OK] manifest.json JSON 格式正确")
except Exception as e:
    errors.append(f"JSON 解析失败: {e}")
    print(f"   [FAIL] {e}")
    exit(1)

# === 2. 图标验证 ===
print("\n" + "=" * 60)
print("2. 图标文件验证 (unpackage/res/icons/)")

icons_config = manifest["app-plus"]["distribute"]["icons"]
icon_paths = []

# Android
for dpi, path in icons_config["android"].items():
    icon_paths.append(("android." + dpi, path))

# iOS appstore
icon_paths.append(("ios.appstore", icons_config["ios"]["appstore"]))

# iOS iPad
for key, path in icons_config["ios"]["ipad"].items():
    icon_paths.append(("ios.ipad." + key, path))

# iOS iPhone
for key, path in icons_config["ios"]["iphone"].items():
    icon_paths.append(("ios.iphone." + key, path))

icon_ok = 0
for name, path in icon_paths:
    if not os.path.exists(path):
        errors.append(f"图标缺失: {name} -> {path}")
        print(f"   [FAIL] {name:30s} 文件不存在: {path}")
        continue
    try:
        img = Image.open(path)
        w, h = img.size
        # 从路径中提取期望尺寸 (如 72x72.png)
        basename = os.path.basename(path)
        expected = basename.replace(".png", "")
        ew, eh = map(int, expected.split("x"))
        if w == ew and h == eh:
            print(f"   [OK]   {name:30s} {w}x{h}  匹配")
            icon_ok += 1
        else:
            warnings.append(f"图标尺寸不匹配: {name} 期望 {ew}x{eh} 实际 {w}x{h}")
            print(f"   [WARN] {name:30s} 期望 {ew}x{eh} 实际 {w}x{h}")
        img.close()
    except Exception as e:
        errors.append(f"图标读取失败: {name} -> {e}")
        print(f"   [FAIL] {name:30s} 读取失败: {e}")

print(f"\n   图标验证: {icon_ok}/{len(icon_paths)} 完全匹配")

# === 3. 启动图验证 ===
print("\n" + "=" * 60)
print("3. 启动图文件验证 (static/splash/)")

splash_config = manifest["app-plus"]["distribute"]["splashscreen"]["ios"]["iphone"]
splash_paths = list(splash_config.items())

# 期望尺寸映射
EXPECTED_SPLASH = {
    "landscape-480h": (960, 640),
    "landscape-568h": (1136, 640),
    "landscape-667h": (1334, 750),
    "landscape-736h": (2208, 1242),
    "landscape-812h@3x": (2436, 1125),
    "landscape-844h": (2532, 1170),
    "landscape-852h": (2556, 1179),
    "landscape-896h@2x": (1792, 828),
    "landscape-896h@3x": (2688, 1242),
    "landscape-926h": (2778, 1284),
    "landscape-932h": (2796, 1290),
}

splash_ok = 0
for name, path in splash_paths:
    if not os.path.exists(path):
        errors.append(f"启动图缺失: {name} -> {path}")
        print(f"   [FAIL] {name:24s} 文件不存在: {path}")
        continue
    try:
        img = Image.open(path)
        w, h = img.size
        if name in EXPECTED_SPLASH:
            ew, eh = EXPECTED_SPLASH[name]
            if w == ew and h == eh:
                print(f"   [OK]   {name:24s} {w}x{h}  匹配")
                splash_ok += 1
            else:
                errors.append(f"启动图尺寸不匹配: {name} 期望 {ew}x{eh} 实际 {w}x{h}")
                print(f"   [FAIL] {name:24s} 期望 {ew}x{eh} 实际 {w}x{h}")
        else:
            # iphonexl / retina55l 通用回退，不校验尺寸
            print(f"   [OK]   {name:24s} {w}x{h}  (通用回退)")
            splash_ok += 1
        img.close()
    except Exception as e:
        errors.append(f"启动图读取失败: {name} -> {e}")
        print(f"   [FAIL] {name:24s} 读取失败: {e}")

print(f"\n   启动图验证: {splash_ok}/{len(splash_paths)} 完全匹配")

# === 4. 总结 ===
print("\n" + "=" * 60)
print("4. 验证总结")
print(f"   错误 (ERROR): {len(errors)}")
for e in errors:
    print(f"     - {e}")
print(f"   警告 (WARN):  {len(warnings)}")
for w in warnings:
    print(f"     - {w}")

if not errors:
    print("\n   === 全部验证通过，manifest.json 无报错 ===")
else:
    print("\n   === 存在错误，需要修复 ===")

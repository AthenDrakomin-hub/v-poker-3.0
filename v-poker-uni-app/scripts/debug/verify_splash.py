# -*- coding: utf-8 -*-
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "splash")

expected = {
    "landscape-480h.png": (960, 640),
    "landscape-568h.png": (1136, 640),
    "landscape-667h.png": (1334, 750),
    "landscape-736h.png": (2208, 1242),
    "landscape-812h@3x.png": (2436, 1125),
    "landscape-844h.png": (2532, 1170),
    "landscape-852h.png": (2556, 1179),
    "landscape-896h@2x.png": (1792, 828),
    "landscape-896h@3x.png": (2688, 1242),
    "landscape-926h.png": (2778, 1284),
    "landscape-932h.png": (2796, 1290),
}

all_ok = True
print("=== PNG 尺寸验证 ===")
for name, (ew, eh) in expected.items():
    p = os.path.join(OUT, name)
    if not os.path.exists(p):
        print(f"  MISSING: {name}")
        all_ok = False
        continue
    img = Image.open(p)
    aw, ah = img.size
    ok = (aw == ew and ah == eh)
    if not ok:
        all_ok = False
    status = "OK" if ok else f"FAIL (expected {ew}x{eh})"
    print(f"  {name:28s} {aw}x{ah}  {status}")
    img.close()

print("\n=== JPG 存在性验证 ===")
for name in expected:
    jpg_name = name.replace(".png", ".jpg")
    p = os.path.join(OUT, jpg_name)
    exists = os.path.exists(p)
    size_kb = os.path.getsize(p) // 1024 if exists else 0
    print(f"  {jpg_name:28s} {'exists' if exists else 'MISSING':8s} {size_kb}KB")

print("\n" + ("=== 全部验证通过 ===" if all_ok else "=== 存在尺寸不匹配 ==="))

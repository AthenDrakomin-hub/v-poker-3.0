# -*- coding: utf-8 -*-
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

with open("manifest.json", "r", encoding="utf-8") as f:
    m = json.load(f)

iphone = m["app-plus"]["distribute"]["splashscreen"]["ios"]["iphone"]

print("=== manifest.json 启动图引用验证 ===")
all_ok = True
for key, path in iphone.items():
    exists = os.path.exists(path)
    size = os.path.getsize(path) // 1024 if exists else 0
    if not exists:
        all_ok = False
    status = "OK" if exists else "MISSING"
    print(f"  {key:24s} -> {path:55s} {status} ({size}KB)")

print()
if all_ok:
    print("=== 全部引用有效 ===")
else:
    print("=== 存在缺失文件 ===")

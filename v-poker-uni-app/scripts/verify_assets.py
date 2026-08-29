#!/usr/bin/env python3
"""验证 manifest.json 中引用的图标和启动图实际尺寸"""
from PIL import Image
import os, json

root = r'C:\Users\88903\Desktop\v-poker-uni-app'
manifest = json.load(open(os.path.join(root, 'manifest.json'), 'r', encoding='utf-8'))
errors = []

print('=== 图标尺寸验证 ===')
icons = manifest['app-plus']['distribute']['icons']

# Android icons
android_expected = {'hdpi': (72,72), 'xhdpi': (96,96), 'xxhdpi': (144,144), 'xxxhdpi': (192,192)}
for key, expected in android_expected.items():
    path = os.path.join(root, icons['android'][key])
    if os.path.exists(path):
        img = Image.open(path)
        w,h = img.size
        ok = (w,h) == expected
        if not ok: errors.append('android/%s: %dx%d != %s' % (key, w, h, expected))
        print('  android/%s: %dx%d %s' % (key, w, h, 'OK' if ok else 'MISMATCH'))
    else:
        print('  android/%s: MISSING' % key)
        errors.append('android/%s: MISSING' % key)

# iOS appstore
path = os.path.join(root, icons['ios']['appstore'])
img = Image.open(path)
ok = img.size == (1024,1024)
if not ok: errors.append('appstore: %s' % str(img.size))
print('  ios/appstore: %dx%d %s' % (img.size[0], img.size[1], 'OK' if ok else 'MISMATCH'))

# iOS iphone icons
iphone_expected = {
    'app@2x': (120,120), 'app@3x': (180,180),
    'notification@2x': (40,40), 'notification@3x': (60,60),
    'settings@2x': (58,58), 'settings@3x': (87,87),
    'spotlight@2x': (80,80), 'spotlight@3x': (120,120)
}
for key, expected in iphone_expected.items():
    path = os.path.join(root, icons['ios']['iphone'][key])
    img = Image.open(path)
    ok = img.size == expected
    if not ok: errors.append('iphone/%s: %s != %s' % (key, img.size, expected))
    print('  ios/iphone/%s: %dx%d %s' % (key, img.size[0], img.size[1], 'OK' if ok else 'MISMATCH'))

# iOS ipad icons
ipad_expected = {
    'app': (76,76), 'app@2x': (152,152),
    'notification': (20,20), 'notification@2x': (40,40),
    'proapp@2x': (167,167),
    'settings': (29,29), 'settings@2x': (58,58),
    'spotlight': (40,40), 'spotlight@2x': (80,80)
}
for key, expected in ipad_expected.items():
    path = os.path.join(root, icons['ios']['ipad'][key])
    img = Image.open(path)
    ok = img.size == expected
    if not ok: errors.append('ipad/%s: %s != %s' % (key, img.size, expected))
    print('  ios/ipad/%s: %dx%d %s' % (key, img.size[0], img.size[1], 'OK' if ok else 'MISMATCH'))

print()
print('=== 横屏启动图尺寸验证 ===')
splash = manifest['app-plus']['distribute']['splashscreen']['ios']['iphone']
splash_expected = {
    'landscape-480h': (960,640),
    'landscape-568h': (1136,640),
    'landscape-667h': (1334,750),
    'landscape-736h': (2208,1242),
    'landscape-812h@3x': (2436,1125),
    'landscape-896h@2x': (1792,828),
    'landscape-896h@3x': (2688,1242),
    'landscape-844h': (2532,1170),
    'landscape-926h': (2778,1284),
    'landscape-852h': (2556,1179),
    'landscape-932h': (2796,1290),
}
for key, expected in splash_expected.items():
    path = os.path.join(root, splash[key])
    if os.path.exists(path):
        img = Image.open(path)
        w,h = img.size
        is_landscape = w > h
        ok = (w,h) == expected and is_landscape
        if (w,h) != expected: errors.append('splash/%s: %dx%d != %s' % (key, w, h, expected))
        if not is_landscape: errors.append('splash/%s: NOT landscape!' % key)
        print('  %s: %dx%d %s' % (key, w, h, 'OK' if ok else 'CHECK'))
    else:
        print('  %s: MISSING' % key)
        errors.append('splash/%s: MISSING' % key)

print()
if errors:
    print('=== 发现 %d 个问题 ===' % len(errors))
    for e in errors:
        print('  - %s' % e)
else:
    print('=== 全部尺寸验证通过 ===')

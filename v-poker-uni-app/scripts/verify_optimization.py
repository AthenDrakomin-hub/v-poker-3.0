# -*- coding: utf-8 -*-
"""
V-Poker 优化最终验证
1. 检查是否有代码引用了已删除/已重命名的文件
2. 统计 static/ 目录优化前后体积
3. 输出优化报告
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# 已删除/已重命名的文件检查
DELETED_FILES = [
    "store/room.js",
    "utils/icons-base64.js",
    "utils/animation.js",
    "api/app.js",
    "api/assets.js",
    "api/common.js",
    "static/icons/",
    "static/images/banners/",
    "static/images/game-icons/",
    "static/images/ui/shouyebeijing.png",
    "static/login-background.png",  # 已转 jpg
    "static/images/cs-avatar.png",   # 已删除(CDN资源)
    "static/images/cs-avatar.jpg",   # 已删除(未引用)
]

RENAMED_FILES = {
    "static/login-background.png": "static/login-background.jpg",
}

SOURCE_EXTS = {'.vue', '.js', '.json', '.css', '.scss'}
EXCLUDE_DIRS = {'node_modules', 'unpackage', '.hbuilderx', '.git', 'scripts/node_modules', 'fonts-source', 'screenshots'}


def scan_source_files():
    source_files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in SOURCE_EXTS:
                source_files.append(os.path.join(dirpath, f))
    return source_files


def check_deleted_references(source_files):
    """检查是否有代码引用了已删除的文件"""
    issues = []
    for sf in source_files:
        try:
            with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            rel_path = os.path.relpath(sf, ROOT).replace('\\', '/')

            for deleted in DELETED_FILES:
                if deleted.endswith('/'):
                    # 目录检查
                    if deleted in content:
                        issues.append(f"{rel_path}: 引用了已删除目录 {deleted}")
                else:
                    basename = os.path.basename(deleted)
                    if basename in content and deleted.replace('/', '\\') not in sf:
                        # 更精确的检查
                        if f"/{basename}" in content or f"\\{basename}" in content or f"'{basename}'" in content or f'"{basename}"' in content:
                            issues.append(f"{rel_path}: 可能引用了已删除文件 {basename}")
        except Exception:
            pass
    return issues


def check_renamed_references(source_files):
    """检查是否有代码还在引用旧文件名"""
    issues = []
    for sf in source_files:
        try:
            with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            rel_path = os.path.relpath(sf, ROOT).replace('\\', '/')
            for old, new in RENAMED_FILES.items():
                old_basename = os.path.basename(old)
                if old_basename in content:
                    issues.append(f"{rel_path}: 仍引用旧文件名 {old_basename} (应改为 {os.path.basename(new)})")
        except Exception:
            pass
    return issues


def get_dir_size(path):
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total += os.path.getsize(fp)
    return total


def main():
    print("=" * 70)
    print("V-Poker 优化最终验证")
    print("=" * 70)

    # 1. 扫描源码
    source_files = scan_source_files()
    print(f"\n[1] 扫描到 {len(source_files)} 个源码文件")

    # 2. 检查已删除文件引用
    print("\n[2] 检查已删除文件引用...")
    deleted_issues = check_deleted_references(source_files)
    if deleted_issues:
        print(f"  发现 {len(deleted_issues)} 个潜在问题:")
        for issue in deleted_issues:
            print(f"    - {issue}")
    else:
        print("  ✅ 未发现已删除文件的引用")

    # 3. 检查重命名文件引用
    print("\n[3] 检查重命名文件引用...")
    renamed_issues = check_renamed_references(source_files)
    if renamed_issues:
        print(f"  发现 {len(renamed_issues)} 个问题:")
        for issue in renamed_issues:
            print(f"    - {issue}")
    else:
        print("  ✅ 所有引用已更新为新文件名")

    # 4. 体积统计
    print("\n[4] static/ 目录体积统计")
    static_size = get_dir_size("static")
    print(f"  当前 static/ 总计: {static_size / 1024 / 1024:.2f} MB")

    # 子目录统计
    for d in sorted(os.listdir("static")):
        dp = os.path.join("static", d)
        if os.path.isdir(dp):
            size = get_dir_size(dp)
            print(f"    {d:20s} {size / 1024 / 1024:6.2f} MB")
        else:
            size = os.path.getsize(dp)
            print(f"    {d:20s} {size / 1024 / 1024:6.2f} MB")

    # 5. 关键文件验证
    print("\n[5] 关键文件存在性验证")
    key_files = [
        "static/login-background.jpg",
        "static/splash/landscape-932h.png",
        "static/splash/landscape-480h.png",
        "static/apptubiao.png",
        "static/qidongtu.png",
        "static/splash.png",
        "unpackage/res/icons/1024x1024.png",
        "manifest.json",
        "pages/login/login.vue",
        "pages/register/register.vue",
    ]
    all_exist = True
    for f in key_files:
        exists = os.path.exists(f)
        if not exists:
            all_exist = False
        size = os.path.getsize(f) / 1024 if exists else 0
        print(f"  {'✅' if exists else '❌'} {f:50s} {size:7.1f} KB")

    # 总结
    print("\n" + "=" * 70)
    print("验证总结")
    print("=" * 70)
    total_issues = len(deleted_issues) + len(renamed_issues)
    if total_issues == 0 and all_exist:
        print("  ✅ 全部验证通过，无引用断裂，关键文件齐全")
    else:
        print(f"  ⚠️  发现 {total_issues} 个问题需要处理")
        if not all_exist:
            print("  ⚠️  有关键文件缺失")


if __name__ == "__main__":
    main()

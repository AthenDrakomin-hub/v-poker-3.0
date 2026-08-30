# -*- coding: utf-8 -*-
"""
V-Poker 资源引用与死代码分析工具
1. 扫描 static/ 下所有文件
2. 扫描源码中所有 static/ 路径引用
3. 对比找出未被引用的静态资源
4. 扫描模块 import 关系，找出未被引用的代码模块
"""
import os
import re
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# 源码文件扩展名
SOURCE_EXTS = {'.vue', '.js', '.json', '.css', '.scss', '.ts'}
# 排除目录
EXCLUDE_DIRS = {'node_modules', 'unpackage', '.hbuilderx', '.git', 'scripts/node_modules', 'fonts-source', 'screenshots'}

# 静态资源扩展名
STATIC_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.mp3', '.wav', '.ogg', '.ttf', '.woff', '.woff2', '.mp4', '.webm'}


def scan_static_files():
    """扫描 static/ 下所有静态资源文件"""
    static_files = {}
    static_dir = os.path.join(ROOT, 'static')
    for dirpath, dirnames, filenames in os.walk(static_dir):
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in STATIC_EXTS:
                full_path = os.path.join(dirpath, f)
                rel_path = os.path.relpath(full_path, ROOT).replace('\\', '/')
                size = os.path.getsize(full_path)
                static_files[rel_path] = size
    return static_files


def scan_source_files():
    """扫描所有源码文件"""
    source_files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # 排除目录
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in SOURCE_EXTS:
                full_path = os.path.join(dirpath, f)
                rel_path = os.path.relpath(full_path, ROOT).replace('\\', '/')
                source_files.append(rel_path)
    return source_files


def extract_static_references(source_files):
    """从源码中提取所有 static/ 路径引用"""
    references = set()
    # 匹配 static/xxx 或 /static/xxx 或 @/static/xxx 或 ~@/static/xxx
    patterns = [
        re.compile(r'["\']((?:@/|~@/|/)?static/[^"\'\s?#]+)["\']'),
        re.compile(r'url\(["\']?((?:@/|~@/|/)?static/[^)"\'\s?#]+)'),
        re.compile(r'\$cdn\(["\']([^"\']+)["\']'),
    ]

    for sf in source_files:
        try:
            with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            for pattern in patterns:
                for match in pattern.finditer(content):
                    ref = match.group(1)
                    # 规范化路径
                    if ref.startswith('@/'):
                        ref = ref[2:]
                    elif ref.startswith('~@/'):
                        ref = ref[3:]
                    elif ref.startswith('/'):
                        ref = ref[1:]
                    references.add(ref)
        except Exception as e:
            pass

    return references


def find_unreferenced_static(static_files, references):
    """找出未被引用的静态资源"""
    unreferenced = []
    for path, size in static_files.items():
        # 检查是否被直接引用
        if path in references:
            continue
        # 检查是否被目录引用（如 static/images/ 被拼接路径使用）
        dir_path = os.path.dirname(path) + '/'
        if any(ref.startswith(dir_path) for ref in references):
            continue
        # 检查文件名是否被动态拼接（如 cards/ + rank + suit + .svg）
        basename = os.path.basename(path)
        if any(basename in ref for ref in references):
            continue
        unreferenced.append((path, size))
    return sorted(unreferenced, key=lambda x: x[1], reverse=True)


def scan_module_imports(source_files):
    """扫描模块 import 关系"""
    # 收集所有可导入的模块
    all_modules = {}
    for sf in source_files:
        if sf.endswith(('.js', '.vue', '.ts')):
            module_path = sf.replace('\\', '/')
            all_modules[module_path] = True

    # 收集所有 import 引用
    imported = set()
    import_patterns = [
        re.compile(r'import\s+.*?from\s+["\']([^"\']+)["\']'),
        re.compile(r'require\(["\']([^"\']+)["\']\)'),
        re.compile(r'import\(["\']([^"\']+)["\']\)'),
    ]

    for sf in source_files:
        try:
            with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            for pattern in import_patterns:
                for match in pattern.finditer(content):
                    ref = match.group(1)
                    if ref.startswith('@/'):
                        ref = ref[2:]
                    elif ref.startswith('./') or ref.startswith('../'):
                        # 解析相对路径
                        base_dir = os.path.dirname(sf)
                        resolved = os.path.normpath(os.path.join(base_dir, ref))
                        ref = os.path.relpath(resolved, ROOT).replace('\\', '/')
                    if not ref.startswith('.') and '/' in ref:
                        imported.add(ref)
        except Exception:
            pass

    return all_modules, imported


def find_unreferenced_modules(all_modules, imported):
    """找出未被引用的模块"""
    unreferenced = []
    # 入口文件不算未引用
    entry_files = {'main.js', 'App.vue', 'pages.json', 'manifest.json', 'uni.scss'}
    for module in all_modules:
        if module in entry_files:
            continue
        # pages/ 下的文件由 pages.json 路由引用，不算未引用
        if module.startswith('pages/'):
            continue
        # 检查是否被 import
        module_no_ext = os.path.splitext(module)[0]
        if module in imported or module_no_ext in imported:
            continue
        # 检查是否被其他模块的路径包含
        if any(module in imp or module_no_ext in imp for imp in imported):
            continue
        unreferenced.append(module)
    return sorted(unreferenced)


def main():
    print("=" * 70)
    print("V-Poker 资源引用与死代码分析")
    print("=" * 70)

    # 1. 扫描静态资源
    print("\n[1/4] 扫描静态资源文件...")
    static_files = scan_static_files()
    total_static_size = sum(static_files.values())
    print(f"  找到 {len(static_files)} 个静态资源文件，总计 {total_static_size/1024/1024:.2f} MB")

    # 2. 扫描源码文件
    print("\n[2/4] 扫描源码文件...")
    source_files = scan_source_files()
    print(f"  找到 {len(source_files)} 个源码文件")

    # 3. 提取引用并对比
    print("\n[3/4] 分析静态资源引用关系...")
    references = extract_static_references(source_files)
    print(f"  找到 {len(references)} 个静态资源引用")

    unreferenced_static = find_unreferenced_static(static_files, references)
    unreferenced_size = sum(s for _, s in unreferenced_static)

    print(f"\n  未被引用的静态资源: {len(unreferenced_static)} 个，总计 {unreferenced_size/1024/1024:.2f} MB")
    print("  " + "-" * 60)
    for path, size in unreferenced_static:
        print(f"  {size/1024:8.1f} KB  {path}")

    # 4. 模块引用分析
    print("\n[4/4] 分析代码模块引用关系...")
    all_modules, imported = scan_module_imports(source_files)
    unreferenced_modules = find_unreferenced_modules(all_modules, imported)

    print(f"\n  可能未被引用的代码模块: {len(unreferenced_modules)} 个")
    print("  " + "-" * 60)
    for module in unreferenced_modules:
        print(f"  {module}")

    # 总结
    print("\n" + "=" * 70)
    print("分析总结")
    print("=" * 70)
    print(f"  静态资源总数: {len(static_files)} 个 / {total_static_size/1024/1024:.2f} MB")
    print(f"  未引用静态资源: {len(unreferenced_static)} 个 / {unreferenced_size/1024/1024:.2f} MB")
    print(f"  可能未引用模块: {len(unreferenced_modules)} 个")
    print(f"\n  可清理空间: 约 {unreferenced_size/1024/1024:.2f} MB (仅未引用资源)")


if __name__ == "__main__":
    main()

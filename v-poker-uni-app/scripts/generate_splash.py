#!/usr/bin/env python3
"""
V-Poker iOS 横屏启动图批量生成器
生成所有 iPhone 横屏尺寸的启动图，黑金风格
"""
from PIL import Image, ImageDraw, ImageFont
import os

# 输出目录
OUTPUT_DIR = r"C:\Users\88903\Desktop\v-poker-uni-app\unpackage\res\splash"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 颜色定义
BG_COLOR = (10, 10, 10)           # 深黑
GOLD = (255, 200, 50)             # 金色
GOLD_DIM = (180, 140, 30)         # 暗金
WHITE = (230, 230, 230)           # 白色
GRID_COLOR = (30, 25, 15)          # 网格线颜色

# iOS 横屏启动图规格 (宽 x 高)
# key: manifest.json 中的键名, value: (width, height)
SPLASH_SIZES = {
    # 经典机型
    "landscape-480h":    (960, 640),    # iPhone 3GS/4
    "landscape-568h":    (1136, 640),    # iPhone 5/5s/SE1
    "landscape-667h":    (1334, 750),    # iPhone 6/6s/7/8/SE2/SE3
    "landscape-736h":    (2208, 1242),   # iPhone 6+/7+/8+
    # 刘海屏
    "landscape-812h@3x": (2436, 1125),   # iPhone X/XS/11 Pro (5.8")
    "landscape-896h@2x": (1792, 828),    # iPhone XR/11 (6.1")
    "landscape-896h@3x": (2688, 1242),   # iPhone XS Max/11 Pro Max (6.5")
    # 全面屏 (12系列及以后)
    "landscape-844h":    (2532, 1170),   # iPhone 12/13/14 (6.1")
    "landscape-926h":    (2778, 1284),   # iPhone 12 Pro Max/13 Pro Max/14 Plus (6.7")
    "landscape-852h":    (2556, 1179),   # iPhone 14 Pro/15/15 Pro (6.1")
    "landscape-932h":    (2796, 1290),   # iPhone 14 Pro Max/15 Pro Max (6.7")
}


def get_font(size, bold=False):
    """获取字体，优先使用系统字体"""
    font_paths = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return ImageFont.load_default()


def draw_grid(draw, width, height, spacing):
    """绘制网格背景"""
    # 垂直线
    for x in range(0, width, spacing):
        draw.line([(x, 0), (x, height)], fill=GRID_COLOR, width=1)
    # 水平线
    for y in range(0, height, spacing):
        draw.line([(0, y), (width, y)], fill=GRID_COLOR, width=1)


def draw_glow(draw, center_x, center_y, radius, color, alpha=40):
    """绘制光晕效果"""
    for r in range(radius, 0, -radius // 10):
        c = tuple(min(255, int(v * (1 - r/radius) + 10)) for v in color)
        draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            fill=c + (alpha,) if len(c) == 3 else c
        )


def generate_splash(width, height, filename):
    """生成单张启动图"""
    # 创建图像 (RGBA 支持透明)
    img = Image.new('RGB', (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img, 'RGBA')

    # 1. 网格背景
    grid_spacing = max(width, height) // 20
    draw_grid(draw, width, height, grid_spacing)

    # 2. 中心光晕
    center_x, center_y = width // 2, height // 2
    glow_radius = min(width, height) // 3
    draw_glow(draw, center_x, center_y, glow_radius, GOLD, alpha=25)

    # 3. V-Poker 主标题
    title_size = int(min(width, height) * 0.18)
    title_font = get_font(title_size, bold=True)
    title_text = "V-Poker"
    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), title_text, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    title_x = (width - tw) // 2
    title_y = (height - th) // 2 - int(height * 0.05)

    # 文字阴影
    draw.text((title_x + 3, title_y + 3), title_text, font=title_font, fill=(0, 0, 0, 180))
    # 金色文字
    draw.text((title_x, title_y), title_text, font=title_font, fill=GOLD)

    # 4. 副标题
    subtitle_size = int(min(width, height) * 0.05)
    subtitle_font = get_font(subtitle_size, bold=False)
    subtitle_text = "POKER  ARENA"
    bbox2 = draw.textbbox((0, 0), subtitle_text, font=subtitle_font)
    sw, sh = bbox2[2] - bbox2[0], bbox2[3] - bbox2[1]
    sub_x = (width - sw) // 2
    sub_y = title_y + th + int(height * 0.03)
    draw.text((sub_x, sub_y), subtitle_text, font=subtitle_font, fill=GOLD_DIM)

    # 5. 底部装饰线
    line_y = int(height * 0.82)
    line_width = int(width * 0.15)
    line_x = (width - line_width) // 2
    draw.line([(line_x, line_y), (line_x + line_width, line_y)], fill=GOLD, width=2)

    # 6. 底部加载提示
    loading_size = int(min(width, height) * 0.03)
    loading_font = get_font(loading_size, bold=False)
    loading_text = "Loading..."
    bbox3 = draw.textbbox((0, 0), loading_text, font=loading_font)
    lw, lh = bbox3[2] - bbox3[0], bbox3[3] - bbox3[1]
    load_x = (width - lw) // 2
    load_y = line_y + int(height * 0.03)
    draw.text((load_x, load_y), loading_text, font=loading_font, fill=(150, 150, 150, 200))

    # 保存
    output_path = os.path.join(OUTPUT_DIR, filename)
    img.save(output_path, 'PNG', optimize=True)
    file_size = os.path.getsize(output_path)
    print(f"  {filename}: {width}x{height} ({file_size//1024}KB)")
    return output_path


def main():
    print("=" * 60)
    print("V-Poker iOS 横屏启动图生成")
    print("=" * 60)
    print(f"输出目录: {OUTPUT_DIR}")
    print()

    generated = []
    for key, (w, h) in SPLASH_SIZES.items():
        filename = f"{key}.png"
        path = generate_splash(w, h, filename)
        generated.append((key, w, h, path))

    print()
    print(f"生成完成: {len(generated)} 张启动图")
    print()
    print("manifest.json 配置参考:")
    print('  "splashscreen": {')
    print('    "iosStyle": "common",')
    print('    "ios": {')
    print('      "iphone": {')
    for i, (key, w, h, _) in enumerate(generated):
        comma = "," if i < len(generated) - 1 else ""
        print(f'        "{key}": "unpackage/res/splash/{key}.png"{comma}')
    print('      }')
    print('    }')
    print('  }')


if __name__ == "__main__":
    main()

"""
生成快捷语真人语音包（edge-tts，免费微软在线语音）
- 11条快捷语，6种声音/方言，骚气+特色
- 输出到 public/audio/quick/ 目录
"""
import asyncio
import os
import edge_tts

# 快捷语列表（与 src/lib/chat.ts QUICK_PHRASES 保持一致）
PHRASES = [
    "大家好，多多关照！",
    "快点啦，等到花儿都谢了",
    "手气不错哦～",
    "不要走，决战到天亮！",
    "哇，你太厉害了！",
    "我这牌怎么这么烂",
    "再来一局，翻本！",
    "先走一步，下次再玩",
    "稍等一下，马上回来",
    "全下！搏一搏",
]

# 每条快捷语分配的声音（骚气+方言混搭）
# zh-CN-XiaoyiNeural: 普通话活泼女声（骚气）
# zh-CN-YunxiNeural: 普通话阳光男声
# zh-HK-HiuMaanNeural: 粤语女声（骚气+港味）
# zh-HK-WanLungNeural: 粤语男声
# zh-TW-HsiaoChenNeural: 台湾国语女声（嗲+骚气）
# zh-TW-YunJheNeural: 台湾国语男声
VOICE_MAP = [
    "zh-TW-HsiaoChenNeural",   # 0 大家好 - 台湾嗲妹
    "zh-HK-HiuMaanNeural",      # 1 快点啦 - 粤语港妹
    "zh-CN-XiaoyiNeural",       # 2 手气不错 - 普通话活泼妹
    "zh-CN-YunxiNeural",        # 3 不要走 - 阳光男声
    "zh-TW-HsiaoChenNeural",    # 4 哇你太厉害 - 台湾嗲妹
    "zh-HK-WanLungNeural",      # 5 牌怎么这么烂 - 粤语男声
    "zh-HK-WanLungNeural",      # 6 再来一局翻本 - 粤语男声
    "zh-TW-YunJheNeural",       # 7 先走一步 - 台湾男声
    "zh-CN-XiaoyiNeural",       # 8 稍等一下 - 活泼妹
    "zh-CN-YunxiNeural",        # 9 全下搏一搏 - 阳光男声
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "quick")

async def generate():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for i, (text, voice) in enumerate(zip(PHRASES, VOICE_MAP)):
        out_path = os.path.join(OUTPUT_DIR, f"q{i}.mp3")
        if os.path.exists(out_path):
            print(f"[skip] q{i}.mp3 already exists")
            continue
        print(f"[gen ] q{i}.mp3 [{voice}] {text}")
        communicate = edge_tts.Communicate(text, voice, rate="+5%", pitch="+2Hz")
        await communicate.save(out_path)
        print(f"[done] q{i}.mp3 ({os.path.getsize(out_path)} bytes)")
    print("\nAll done!")

if __name__ == "__main__":
    asyncio.run(generate())

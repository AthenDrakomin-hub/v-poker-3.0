import io

file_path = r"C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\pages\room\room.vue"
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = ".host-action.danger { color: #fca5a5; background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.4); gap: 0.5vh; }"

new = """.host-action.danger { color: #fca5a5; background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.4); gap: 0.5vh; }
.host-action.primary { background: var(--color-gold); color: #1a1a1a; font-weight: 700; }

.player-ready-bar {
  position: absolute;
  z-index: 30;
  bottom: 18vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
}
.player-ready-btn {
  padding: 1.5vh 6vh;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3vh;
  background: linear-gradient(135deg, var(--color-gold), #e6a800);
  color: #1a1a1a;
  font-size: var(--text-base, 2vh);
  font-weight: 700;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
}
.player-ready-btn.ready {
  background: rgba(255,255,255,0.15);
  color: var(--color-gold);
  border: 2px solid var(--color-gold);
  box-shadow: none;
}"""

if old in content:
    content = content.replace(old, new, 1)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("REPLACED")
else:
    print("NOT FOUND")

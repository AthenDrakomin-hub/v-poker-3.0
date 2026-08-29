import io

file_path = r"C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\pages\room\room.vue"
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """      if (attempt >= 15) {
        uni.showToast({ title: '请关闭方向锁定后重试', icon: 'none', duration: 3000 })
        return
      }"""

new = """      if (attempt >= 15) {
        // 横屏检测超时（H5端方向检测可能不可靠），仍加载房间数据
        this.canvasW = sys.windowWidth
        this.canvasH = sys.windowHeight
        this.isLandscapeReady = true
        this.initRoom()
        return
      }"""

if old in content:
    content = content.replace(old, new, 1)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("REPLACED")
else:
    print("NOT FOUND")

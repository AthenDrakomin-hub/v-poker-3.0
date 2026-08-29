import io

file_path = r"C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\pages\lobby\lobby.vue"
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """    availableTemplates() {
      const points = this.userState.points || 0
      return (this.roomTemplates || [])
        .filter(t => t.isActive !== false && points >= (t.creditRequirement || 0))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    },"""

new = """    availableTemplates() {
      // 代理/管理员开房：不按自身筹码过滤模板（门槛是给玩家的，不是限制开房者）
      return (this.roomTemplates || [])
        .filter(t => t.isActive !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    },"""

if old in content:
    content = content.replace(old, new, 1)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("REPLACED")
else:
    print("NOT FOUND")

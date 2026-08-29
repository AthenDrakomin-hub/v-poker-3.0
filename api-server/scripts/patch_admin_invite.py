import io

file_path = r"C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\components\admin\AdminOperationsDesk.vue"
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """<view><text class="primary-text">{{ user.nickname || user.account }}</text><text class="secondary-text">ID {{ user.id || user.userId }} · {{ user.account }}</text></view>"""

new = """<view><text class="primary-text">{{ user.nickname || user.account }}</text><text class="secondary-text">ID {{ user.id || user.userId }} · {{ user.account }} · 邀请码 {{ user.inviteCode || user.invite_code || '-' }}</text></view>"""

if old in content:
    content = content.replace(old, new, 1)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("REPLACED")
else:
    print("NOT FOUND")

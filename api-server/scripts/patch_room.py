import io

file_path = r"C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\pages\room\room.vue"
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """    </view>

    <!-- 独立倒计时"""

new = """    </view>

    <!-- 玩家准备按钮 -->
    <view v-if="(isWaitingState || roomStatus === 'waiting_continue') && !isHost" class="player-ready-bar">
      <view class="player-ready-btn" :class="{ ready: amIReady }" @click="toggleReady">
        <text>{{ amIReady ? '已准备（点击取消）' : (roomStatus === 'waiting_continue' ? '准备下一局' : '准备') }}</text>
      </view>
    </view>

    <!-- 独立倒计时"""

if old in content:
    content = content.replace(old, new, 1)
    with io.open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("REPLACED")
else:
    # try with \r\n
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in content:
        content = content.replace(old_crlf, new_crlf, 1)
        with io.open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("REPLACED CRLF")
    else:
        print("NOT FOUND")

$file = "C:\Users\88903\Desktop\V-poker-2.0\v-poker-uni-app\pages\room\room.vue"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$old = @"
    </view>

    <!-- 独立倒计时
"@

$new = @"
    </view>

    <!-- 玩家准备按钮 -->
    <view v-if="(isWaitingState || roomStatus === 'waiting_continue') && !isHost" class="player-ready-bar">
      <view class="player-ready-btn" :class="{ ready: amIReady }" @click="toggleReady">
        <text>{{ amIReady ? '已准备（点击取消）' : (roomStatus === 'waiting_continue' ? '准备下一局' : '准备') }}</text>
      </view>
    </view>

    <!-- 独立倒计时
"@

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
    Write-Output "REPLACED"
} else {
    $old2 = $old -replace "`r`n", "`n"
    $new2 = $new -replace "`r`n", "`n"
    if ($content.Contains($old2)) {
        $content = $content.Replace($old2, $new2)
        [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
        Write-Output "REPLACED LF"
    } else {
        Write-Output "NOT FOUND"
    }
}

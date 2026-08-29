<template>
  <ImmersivePage :show-header="false" page-class="join-page">
    <!-- 背景装饰 -->
    <template #background>
      <view class="bg-decoration">
        <view class="bg-gradient"></view>
        <view class="bg-grid"></view>
        <view class="bg-glow"></view>
        <view class="bg-particles">
          <view v-for="i in 12" :key="i" class="particle" :style="particleStyle(i)"></view>
        </view>
      </view>
    </template>

    <!-- 主内容 -->
    <view class="join-content">
      <!-- 品牌Logo -->
      <view class="brand-logo">
        <image class="logo-image" :src="$cdn('/static/logo.png')" mode="aspectFit"></image>
      </view>

      <!-- 加载卡片 -->
      <view class="join-card glass">
        <!-- 加载动画 -->
        <view class="loading-animation">
          <view class="loading-ring ring-1"></view>
          <view class="loading-ring ring-2"></view>
          <view class="loading-ring ring-3"></view>
          <view class="loading-icon">
            <VIcon name="cards" :size="6" color="var(--color-gold)" />
          </view>
        </view>

        <text class="join-title">正在加入房间</text>
        <text class="join-message">{{ message }}</text>

        <!-- 进度条 -->
        <view class="progress-bar">
          <view class="progress-fill" :class="{ error: error }"></view>
        </view>

        <!-- 返回按钮（错误时显示） -->
        <view v-if="error" class="join-back" @click="goLobby">
          <VIcon name="back" :size="3" color="var(--color-bg-card)" />
          <text>返回大厅</text>
        </view>
      </view>

      <!-- 底部提示 -->
      <text class="join-tip">V-Poker 巅峰对决，见证新王的诞生</text>
    </view>
  </ImmersivePage>
</template>

<script>
import VIcon from '../../components/ui/VIcon.vue'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import { joinRoomByToken } from '../../api/rooms.js'

export default {
  name: 'JoinPage',
  components: { VIcon, ImmersivePage },
  data() { return { message: '正在验证邀请凭据', error: false } },
  onLoad(options) { this.joinByToken(options.token) },
  methods: {
    particleStyle(i) {
      const left = (i * 8 + Math.random() * 5) + '%'
      const delay = (i * 0.3) + 's'
      const duration = (3 + Math.random() * 2) + 's'
      const size = (0.5 + Math.random() * 1) + 'vh'
      return { left, animationDelay: delay, animationDuration: duration, width: size, height: size }
    },
    async joinByToken(token) {
      if (!token) { this.message = '邀请凭据缺失'; this.error = true; return }
      try {
        const data = await joinRoomByToken(token)
        const room = data.room || data
        this.message = data.message || '加入成功，正在进入房间'
        setTimeout(() => uni.reLaunch({ url: `/pages/room/room?id=${room.id || room.roomId}` }), 600)
      } catch (e) {
        this.message = e.error || e.message || '邀请凭据无效或已过期'
        this.error = true
      }
    },
    goLobby() { uni.reLaunch({ url: '/pages/lobby/lobby' }) }
  }
}
</script>

<style lang="scss" scoped>
.join-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  overflow: hidden;
  position: relative;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: radial-gradient(ellipse at center, rgba(255, 215, 0, 0.05) 0%, transparent 60%),
              radial-gradient(ellipse at top right, rgba(139, 92, 246, 0.08) 0%, transparent 50%);
}

.bg-grid {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-image:
    linear-gradient(rgba(255, 215, 0, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 215, 0, 0.03) 1px, transparent 1px);
  background-size: 5vh 5vh;
}

.bg-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 60vh; height: 60vh;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
  animation: glowPulse 3s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1); }
}

.bg-particles {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}

.particle {
  position: absolute;
  bottom: -2vh;
  background: rgba(255, 215, 0, 0.4);
  border-radius: 50%;
  animation: particleFloat 4s linear infinite;
}

@keyframes particleFloat {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
}

/* 主内容 */
.join-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3vh;
}

/* 品牌Logo */
.brand-logo {
  margin-bottom: 1vh;
}

.logo-image {
  height: 12vh;
  width: auto;
}

/* 加载卡片 */
.join-card {
  width: min(72vw, 55vh);
  padding: 5vh 4vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  border: 0.15vh solid rgba(255, 215, 0, 0.25);
  border-radius: 2vh;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(20px);
  box-shadow: 0 2vh 6vh rgba(0, 0, 0, 0.5),
              0 0 3vh rgba(255, 215, 0, 0.1);
}

/* 加载动画 */
.loading-animation {
  position: relative;
  width: 12vh;
  height: 12vh;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1vh;
}

.loading-ring {
  position: absolute;
  border-radius: 50%;
  border: 0.3vh solid transparent;
}

.ring-1 {
  width: 12vh; height: 12vh;
  border-top-color: var(--color-gold);
  animation: spin 1s linear infinite;
}

.ring-2 {
  width: 9vh; height: 9vh;
  border-top-color: rgba(255, 215, 0, 0.6);
  animation: spin 1.5s linear infinite reverse;
}

.ring-3 {
  width: 6vh; height: 6vh;
  border-top-color: rgba(255, 215, 0, 0.3);
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-icon {
  position: relative;
  z-index: 1;
  animation: iconPulse 1.5s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.join-title {
  color: #fff;
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: 0.1vh;
}

.join-message {
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--text-base);
  text-align: center;
  min-height: 3vh;
}

/* 进度条 */
.progress-bar {
  width: 100%;
  height: 0.6vh;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.3vh;
  overflow: hidden;
  margin-top: 1vh;
}

.progress-fill {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--color-gold), var(--color-gold-dark));
  border-radius: 0.3vh;
  animation: progressIndeterminate 1.5s ease-in-out infinite;
}

.progress-fill.error {
  background: linear-gradient(90deg, var(--color-danger), #EE5A5A);
  animation: none;
}

@keyframes progressIndeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 返回按钮 */
.join-back {
  margin-top: 2vh;
  padding: 1.5vh 3vh;
  border-radius: 1vh;
  color: var(--color-bg-card);
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  font-size: var(--text-base);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1vh;
  box-shadow: 0 0.5vh 1.5vh rgba(255, 215, 0, 0.3);
}

/* 底部提示 */
.join-tip {
  color: rgba(255, 255, 255, 0.3);
  font-size: var(--text-sm);
  letter-spacing: 0.2vh;
  margin-top: 2vh;
}
</style>

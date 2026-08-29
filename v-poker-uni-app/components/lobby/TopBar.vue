<template>
  <view class="top-bar">
    <!-- 左侧：Logo -->
    <view class="top-left" @click="$emit('logo')">
      <image class="logo-image" :src="$cdn('/static/logo-horizontal.png')" mode="aspectFit" />
    </view>

    <!-- 右侧：筹码 + 头像 + 设置 -->
    <view class="top-right">
      <!-- 筹码余额 -->
      <view class="chips-display" @click="$emit('wallet')">
        <view class="chips-icon">
          <VIcon name="coin" :size="7.8" color="var(--color-gold)" />
        </view>
        <view class="chips-text-wrap">
          <text class="chips-label">筹码</text>
          <text class="chips-value">{{ formattedPoints }}</text>
        </view>
      </view>

      <!-- 设置按钮 -->
      <view class="top-btn" @click="$emit('setting')">
        <VIcon name="gear" :size="8.4" color="var(--color-text)" />
      </view>

      <!-- 用户头像 -->
      <view class="top-avatar" @click="$emit('avatar')">
        <image class="avatar-image" :src="avatarImage" mode="aspectFill" />
        <view class="avatar-ring"></view>
      </view>
    </view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'
import { formatPoints } from '../../utils/format.js'
import { getAvatarImage } from '../../utils/avatar.js'

export default {
  name: 'TopBar',
  components: { VIcon },
  props: {
    nickname: {
      type: String,
      default: ''
    },
    avatar: {
      type: [String, Number],
      default: ''
    },
    points: {
      type: Number,
      default: 0
    }
  },
  computed: {
    formattedPoints() {
      return formatPoints(this.points)
    },
    avatarImage() {
      return getAvatarImage(this.avatar)
    }
  }
}
</script>

<style lang="scss" scoped>
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--lobby-header-height, 9vh);
  min-height: var(--lobby-header-height, 52px);
  padding-top: env(safe-area-inset-top);
  padding-left: calc(4vh + var(--safe-left));
  padding-right: calc(4vh + var(--safe-right));
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 120;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
  pointer-events: none;
}

.top-left,
.top-right {
  display: flex;
  align-items: center;
  gap: 2vh;
  pointer-events: auto;
}

/* Logo (600x338, ratio 1.78) */
.logo-image {
  height: 11.25vh;
  width: 20vh;
}

/* 筹码显示 */
.chips-display {
  display: flex;
  align-items: center;
  gap: 1vh;
  padding: 1.2vh 2.5vh;
  background: rgba(30, 30, 30, 0.85);
  border: 0.1vh solid rgba(255, 215, 0, 0.25);
  border-radius: 3vh;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  min-height: 6vh;

  &:active {
    transform: scale(0.95);
    background: rgba(255, 215, 0, 0.15);
  }
}

.chips-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.chips-text-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}
.chips-label {
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  font-weight: 500;
  margin-bottom: 2px;
}
.chips-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-gold);
  min-width: auto;
  text-align: left;
}

/* 顶部按钮 */
.top-btn {
  width: max(7vh, 48px);
  height: max(7vh, 48px);
  min-width: 48px;
  min-height: 48px;
  border-radius: 50%;
  background: rgba(30, 30, 30, 0.85);
  border: 0.1vh solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.88);
    background: rgba(255, 215, 0, 0.15);
  }
}

/* 头像 - 不变 */
.top-avatar {
  position: relative;
  width: 10vh;
  height: 10vh;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;

  &:active {
    transform: scale(0.92);
  }
}

.avatar-image {
  width: 9vh;
  height: 9vh;
  border-radius: 50%;
  border: 0.5vh solid rgba(255, 215, 0, 0.6);
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.avatar-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 10vh;
  height: 10vh;
  border-radius: 50%;
  border: 0.4vh solid transparent;
  border-top-color: var(--color-gold);
  animation: ring-rotate 3s linear infinite;
}

@keyframes ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

<template>
  <view class="right-float-group">
    <!-- 快捷加入 -->
    <view v-if="isVisible('join')" class="float-btn join-btn" @click="$emit('click', 'join')">
      <VIcon name="search" :size="5.5" color="var(--color-gold)" />
      <text class="float-label join-label">加入</text>
    </view>
    <view v-if="isVisible('service')" class="float-btn" @click="$emit('click', 'service')">
      <VIcon name="headset" :size="5.5" color="var(--color-text)" />
      <view v-if="csUnreadCount > 0" class="service-dot">{{ csUnreadCount > 99 ? '99+' : csUnreadCount }}</view>
      <text class="float-label">客服</text>
    </view>
    <view v-if="isVisible('help')" class="float-btn" @click="$emit('click', 'help')">
      <VIcon name="help" :size="5.5" color="var(--color-text)" />
      <text class="float-label">帮助</text>
    </view>
    <view v-if="isVisible('notify')" class="float-btn" @click="$emit('click', 'notify')">
      <VIcon name="warning" :size="5.5" color="var(--color-text)" />
      <view v-if="hasNotify" class="notify-dot"></view>
      <text class="float-label">消息</text>
    </view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'

export default {
  name: 'RightFloatButtons',
  components: { VIcon },
  props: {
    hasNotify: {
      type: Boolean,
      default: false
    },
    csUnreadCount: {
      type: Number,
      default: 0
    },
    // 可见的按钮 key 列表，如 ['join','service','notify']；不传则全部显示
    visibleButtons: {
      type: Array,
      default: null
    }
  },
  methods: {
    isVisible(key) {
      if (this.visibleButtons === null) return true
      return this.visibleButtons.includes(key)
    }
  }
}
</script>

<style lang="scss" scoped>
.right-float-group {
  position: fixed;
  right: calc(2.5vh + var(--safe-right));
  top: 48%;
  transform: translateY(-50%);
  padding-bottom: 1vh;
  display: flex;
  flex-direction: column;
  gap: 2.2vh;
  z-index: 90;
}

.float-btn {
  position: relative;
  width: max(11vh, 48px);
  height: max(11vh, 48px);
  border-radius: 50%;
  background: rgba(30, 30, 30, 0.85);
  border: 0.15vh solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5vh;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.9);
    background: rgba(255, 215, 0, 0.15);
    border-color: rgba(255, 215, 0, 0.4);
  }
}

.float-label {
  font-size: calc(2.4vh * var(--font-scale));
  color: rgba(255, 255, 255, 0.6);
}

.join-btn {
  background: rgba(255, 215, 0, 0.12);
  border-color: rgba(255, 215, 0, 0.3);

  &:active {
    background: rgba(255, 215, 0, 0.25);
    border-color: rgba(255, 215, 0, 0.5);
  }
}

.join-label {
  color: var(--color-gold);
  font-weight: 600;
}

.notify-dot {
  position: absolute;
  top: 1.5vh;
  right: 1.5vh;
  width: 2.4vh;
  height: 2.4vh;
  border-radius: 50%;
  background: var(--color-danger);
  border: 0.4vh solid var(--color-bg-card);
}

.service-dot {
  position: absolute;
  top: 0.8vh;
  right: 0.8vh;
  min-width: 3.8vh;
  height: 3.8vh;
  padding: 0 0.9vh;
  background: var(--color-danger);
  border-radius: 2vh;
  border: 0.3vh solid var(--color-bg-card);
  font-size: var(--text-base);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
</style>

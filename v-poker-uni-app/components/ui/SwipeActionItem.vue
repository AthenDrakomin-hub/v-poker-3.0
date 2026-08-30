<template>
  <view class="swipe-item" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <view class="swipe-content" :style="{ transform: `translateX(${offsetX}px)` }">
      <slot />
    </view>
    <view class="swipe-actions" :style="{ width: actionWidth + 'px', right: -actionWidth + offsetX + 'px' }">
      <view
        v-for="action in actions"
        :key="action.key"
        class="swipe-btn touch-target touch-active"
        :style="{ background: action.color || '#ef4444' }"
        @click.stop="onAction(action)"
      >
        <text class="swipe-btn-text touch-active">{{ action.label }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'SwipeActionItem',
  props: {
    actions: { type: Array, default: () => [] }
  },
  data() {
    return {
      offsetX: 0,
      startX: 0,
      startY: 0,
      swiping: false,
      actionWidth: 0
    }
  },
  mounted() {
    this.actionWidth = this.actions.length * 64
  },
  methods: {
    onTouchStart(e) {
      this.startX = e.touches[0].clientX
      this.startY = e.touches[0].clientY
      this.swiping = false
    },
    onTouchMove(e) {
      const dx = e.touches[0].clientX - this.startX
      const dy = e.touches[0].clientY - this.startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
        this.swiping = true
      }
      if (this.swiping && dx < 0) {
        this.offsetX = Math.max(dx, -this.actionWidth)
      } else if (this.swiping && dx > 0 && this.offsetX < 0) {
        this.offsetX = Math.min(0, this.offsetX + dx * 0.3)
      }
    },
    onTouchEnd() {
      if (this.offsetX < -this.actionWidth / 2) {
        this.offsetX = -this.actionWidth
      } else {
        this.offsetX = 0
      }
    },
    close() {
      this.offsetX = 0
    },
    onAction(action) {
      uni.vibrateShort && uni.vibrateShort({ type: 'medium' })
      this.$emit('action', action.key)
      this.offsetX = 0
    }
  }
}
</script>

<style lang="scss" scoped>
.swipe-item {
  position: relative;
  overflow: hidden;
}
.swipe-content {
  position: relative;
  z-index: 1;
  background: var(--color-bg, #0a0a0a);
  transition: transform 0.2s ease;
}
.swipe-actions {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  z-index: 0;
}
.swipe-btn {
  width: 64px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.swipe-btn-text {
  color: #fff;
  font-size: 2.2vh;
  white-space: nowrap;
}
</style>

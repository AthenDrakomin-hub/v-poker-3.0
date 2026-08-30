<template>
  <view v-if="visible" class="sheet-mask" @click="onMaskClick">
    <view class="sheet-panel" :class="{ 'sheet-visible': showPanel }" @click.stop>
      <view v-if="title" class="sheet-header">
        <text class="sheet-title">{{ title }}</text>
        <text v-if="showClose" class="sheet-close" @click="close">✕</text>
      </view>
      <view class="sheet-content" :style="{ maxHeight: maxHeight }">
        <slot />
      </view>
      <view v-if="$slots.footer" class="sheet-footer safe-bottom">
        <slot name="footer" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BottomSheet',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    showClose: { type: Boolean, default: true },
    maskClosable: { type: Boolean, default: true },
    maxHeight: { type: String, default: '70vh' }
  },
  data() {
    return { showPanel: false }
  },
  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => { this.showPanel = true })
      } else {
        this.showPanel = false
      }
    }
  },
  methods: {
    onMaskClick() {
      if (this.maskClosable) this.close()
    },
    close() {
      this.showPanel = false
      setTimeout(() => { this.$emit('update:visible', false) }, 200)
    }
  }
}
</script>

<style lang="scss" scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 998;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-end;
}
.sheet-panel {
  width: 100%;
  background: var(--color-bg-card, #1A1A2E);
  border-radius: 16px 16px 0 0;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.sheet-visible {
  transform: translateY(0);
}
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  padding: 0 4vw;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sheet-title {
  font-weight: 600;
  color: var(--color-text, #E8E8E8);
  font-size: 2.8vh;
}
.sheet-close {
  color: var(--color-text-muted, rgba(255,255,255,0.6));
  font-size: 2.6vh;
  padding: 8px;
}
.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 2vh 4vw;
}
.sheet-footer {
  padding: 2vh 4vw;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.safe-bottom {
  padding-bottom: calc(2vh + env(safe-area-inset-bottom));
}
</style>

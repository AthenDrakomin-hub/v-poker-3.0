<template>
  <scroll-view class="segment-scroll" scroll-x :show-scrollbar="false">
    <view class="segment-track">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="segment-item touch-target"
        :class="{ active: active === tab.key }"
        @click="onTap(tab)"
      >
        <text class="segment-label">{{ tab.label }}</text>
        <view v-if="active === tab.key" class="segment-indicator" />
      </view>
    </view>
  </scroll-view>
</template>

<script>
export default {
  name: 'SegmentControl',
  props: {
    tabs: { type: Array, required: true },
    active: { type: String, default: '' }
  },
  methods: {
    onTap(tab) {
      if (tab.key !== this.active) {
        uni.vibrateShort && uni.vibrateShort({ type: 'light' })
        this.$emit('change', tab.key)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.segment-scroll {
  white-space: nowrap;
  background: var(--color-bg, #0a0a0a);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.segment-track {
  display: inline-flex;
  padding: 0 2vw;
}
.segment-item {
  position: relative;
  min-width: 18vw;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4vw;
}
.segment-label {
  font-size: 2.6vh;
  color: var(--color-text-muted, rgba(255,255,255,0.6));
  white-space: nowrap;
}
.segment-item.active .segment-label {
  color: var(--color-gold, #FFD700);
  font-weight: 600;
}
.segment-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 6vw;
  height: 3px;
  border-radius: 2px;
  background: var(--color-gold, #FFD700);
}
</style>

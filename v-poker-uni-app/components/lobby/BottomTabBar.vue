<template>
  <view class="bottom-tab-bar">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: active === tab.key }"
      @click="$emit('change', tab.key)"
    >
      <view class="tab-icon">
        <VIcon :name="tab.icon" :size="7.5" :color="active === tab.key ? 'var(--color-gold)' : 'var(--color-text-muted)'" />
      </view>
      <text class="tab-label" :class="{ active: active === tab.key }">{{ tab.label }}</text>
    </view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'

export default {
  name: 'BottomTabBar',
  components: { VIcon },
  props: {
    tabs: {
      type: Array,
      required: true
    },
    active: {
      type: String,
      default: ''
    }
  }
}
</script>

<style lang="scss" scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--lobby-footer-height, 8vh);
  min-height: var(--lobby-footer-height, 56px);
  padding-bottom: calc(0.5vh + env(safe-area-inset-bottom));
  padding-left: calc(2vw + var(--safe-left));
  padding-right: calc(2vw + var(--safe-right));
  background: rgba(10, 10, 10, 0.92);
  border-top: 0.1vh solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: max(4vh, 32px);
  z-index: 100;
  backdrop-filter: blur(20px);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 64px;
  height: 100%;
  min-height: 6vh;
  gap: 0.3vh;
  transition: transform 0.2s ease;

  &:active {
    transform: scale(0.92);
  }
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  transition: color 0.2s ease;

  &.active {
    color: var(--color-gold);
    font-weight: 600;
  }
}
</style>

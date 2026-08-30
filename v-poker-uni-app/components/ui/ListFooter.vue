<template>
  <view class="list-footer">
    <view v-if="loading" class="footer-loading">
      <view class="loading-spinner" />
      <text class="footer-text">加载中...</text>
    </view>
    <text v-else-if="noMore && hasData" class="footer-text">— 没有更多了 —</text>
    <text v-else-if="error" class="footer-text error" @click="onRetry">加载失败，点击重试</text>
  </view>
</template>

<script>
export default {
  name: 'ListFooter',
  props: {
    loading: { type: Boolean, default: false },
    noMore: { type: Boolean, default: false },
    hasData: { type: Boolean, default: true },
    error: { type: Boolean, default: false }
  },
  methods: {
    onRetry() {
      uni.vibrateShort && uni.vibrateShort({ type: 'light' })
      this.$emit('retry')
    }
  }
}
</script>

<style lang="scss" scoped>
.list-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 2vh 0;
}
.footer-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,215,0,0.2);
  border-top-color: var(--color-gold, #FFD700);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.footer-text {
  font-size: 2.2vh;
  color: var(--color-text-muted, rgba(255,255,255,0.6));
}
.footer-text.error {
  color: var(--color-danger, #FF6B6B);
}
</style>

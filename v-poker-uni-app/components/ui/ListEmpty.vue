<template>
  <view class="list-empty touch-target" @click="onRetry">
    <view class="empty-icon">
      <VIcon :name="icon" :size="3" color="rgba(255,255,255,0.2)" />
    </view>
    <text class="empty-text">{{ text }}</text>
    <text v-if="retryText" class="empty-retry">{{ retryText }}</text>
  </view>
</template>

<script>
export default {
  name: 'ListEmpty',
  props: {
    text: { type: String, default: '暂无数据' },
    icon: { type: String, default: 'inbox' },
    retryText: { type: String, default: '' }
  },
  methods: {
    onRetry() {
      if (this.retryText) {
        uni.vibrateShort && uni.vibrateShort({ type: 'light' })
        this.$emit('retry')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8vh 4vw;
}
.empty-icon {
  margin-bottom: 2vh;
}
.empty-text {
  font-size: 2.6vh;
  color: var(--color-text-muted, rgba(255,255,255,0.6));
}
.empty-retry {
  margin-top: 2vh;
  font-size: 2.4vh;
  color: var(--color-gold, #FFD700);
  padding: 8px 24px;
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: 20px;
}
</style>

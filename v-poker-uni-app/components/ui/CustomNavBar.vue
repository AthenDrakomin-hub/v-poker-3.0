<template>
  <view class="custom-nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-content">
      <view class="nav-left touch-target" @click="onBack">
        <VIcon v-if="showBack" name="chevron-left" :size="1.6" color="#fff" />
        <text v-if="backText" class="nav-back-text">{{ backText }}</text>
      </view>
      <view class="nav-title">
        <text class="nav-title-text">{{ title }}</text>
      </view>
      <view class="nav-right touch-target" @click="onRight">
        <VIcon v-if="rightIcon" :name="rightIcon" :size="1.6" color="#fff" />
        <text v-if="rightText" class="nav-right-text">{{ rightText }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CustomNavBar',
  props: {
    title: { type: String, default: '' },
    showBack: { type: Boolean, default: true },
    backText: { type: String, default: '' },
    rightIcon: { type: String, default: '' },
    rightText: { type: String, default: '' }
  },
  data() {
    return { statusBarHeight: 20 }
  },
  created() {
    try {
      const sys = uni.getSystemInfoSync()
      this.statusBarHeight = sys.statusBarHeight || 20
    } catch (e) {}
  },
  methods: {
    onBack() {
      if (!this.showBack) return
      uni.vibrateShort && uni.vibrateShort({ type: 'light' })
      this.$emit('back')
      const pages = getCurrentPages()
      if (pages.length > 1) uni.navigateBack()
    },
    onRight() {
      if (!this.rightIcon && !this.rightText) return
      uni.vibrateShort && uni.vibrateShort({ type: 'light' })
      this.$emit('right')
    }
  }
}
</script>

<style lang="scss" scoped>
.custom-nav-bar {
  background: var(--color-bg, #0a0a0a);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.nav-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 2vw;
}
.nav-left, .nav-right {
  min-width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-title {
  flex: 1;
  text-align: center;
}
.nav-title-text {
  font-size: 2.8vh;
  font-weight: 600;
  color: var(--color-text, #E8E8E8);
}
.nav-back-text, .nav-right-text {
  font-size: 2.4vh;
  color: var(--color-text, #E8E8E8);
  margin-left: 2px;
}
</style>

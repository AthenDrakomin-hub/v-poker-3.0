<template>
  <view class="immersive-page" :class="[pageClass, { 'reduce-motion': reduceMotion }]" :style="pageStyle">
    <!-- 背景层（可由外部传入背景组件，或用默认渐变） -->
    <view class="ip-bg">
      <slot name="background">
        <view class="ip-bg-default"></view>
      </slot>
    </view>

    <!-- 顶部栏（可选，有内容时显示） -->
    <view v-if="$slots.header || showHeader" class="ip-header">
      <slot name="header">
        <view class="ip-header-default">
          <view class="ip-header-left">
            <slot name="header-left"></slot>
          </view>
          <view class="ip-header-center">
            <slot name="header-center">
              <text v-if="title" class="ip-title">{{ title }}</text>
            </slot>
          </view>
          <view class="ip-header-right">
            <slot name="header-right"></slot>
          </view>
        </view>
      </slot>
    </view>

    <!-- 内容区（可滚动，由 scrollable 控制） -->
    <scroll-view
      v-if="scrollable"
      class="ip-content ip-content-scroll"
      scroll-y
      :show-scrollbar="false"
    >
      <slot></slot>
    </scroll-view>
    <view v-else class="ip-content">
      <slot></slot>
    </view>

    <slot name="modal"></slot>

    <!-- 底部栏（可选） -->
    <view v-if="$slots.footer" class="ip-footer">
      <slot name="footer"></slot>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ImmersivePage',
  props: {
    // 页面标题（默认头部居中显示）
    title: {
      type: String,
      default: ''
    },
    // 是否显示默认头部
    showHeader: {
      type: Boolean,
      default: false
    },
    // 内容区是否可滚动
    scrollable: {
      type: Boolean,
      default: false
    },
    // 页面自定义 class
    pageClass: {
      type: String,
      default: ''
    },
    // 页面自定义 style（用于传递 CSS 变量等）
    pageStyle: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      reduceMotion: false
    }
  },
  created() {
    // 检测 iOS 辅助功能：减弱动态效果（仅 H5 端支持 matchMedia，App 端静默跳过）
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        this.reduceMotion = mq.matches
        if (mq.addEventListener) {
          mq.addEventListener('change', (e) => {
            this.reduceMotion = e.matches
          })
        }
      }
    } catch (e) {
      // 静默失败，不影响正常功能
    }
  }
}
</script>

<style lang="scss" scoped>
.immersive-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--color-bg, var(--color-bg));
}

/* 背景层 */
.ip-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.ip-bg-default {
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at 20% 30%, rgba(255, 215, 0, 0.04) 0%, transparent 40%),
              radial-gradient(ellipse at 80% 70%, rgba(107, 70, 193, 0.03) 0%, transparent 40%),
              linear-gradient(180deg, var(--color-bg) 0%, #111 100%);
}

/* 顶部栏 */
.ip-header {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  padding-left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  padding-right: calc(var(--content-padding-h, 3vw) + var(--safe-right, 0px));
  padding-top: var(--safe-top, 0px);
  height: var(--header-height, 7vh);
  min-height: var(--header-height, 7vh);
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.1));
}

.ip-header-default {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ip-header-left,
.ip-header-right {
  display: flex;
  align-items: center;
  gap: var(--gap-sm, 1.5vh);
  min-width: 20%;
}

.ip-header-right {
  justify-content: flex-end;
}

.ip-header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ip-title {
  font-size: var(--text-base, 2.2vh);
  font-weight: 700;
  color: var(--color-text, var(--color-text));
}

/* 内容区 */
.ip-content {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  padding-right: calc(var(--content-padding-h, 3vw) + var(--safe-right, 0px));
  padding-top: var(--content-padding-v, 2vh);
  padding-bottom: var(--content-padding-v, 2vh);
}

.ip-content-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.ip-content-scroll::-webkit-scrollbar {
  display: none;
}

/* 底部栏 */
.ip-footer {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  padding-left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  padding-right: calc(var(--content-padding-h, 3vw) + var(--safe-right, 0px));
  padding-bottom: calc(var(--gap-sm, 1.5vh) + var(--safe-bottom, 0px));
  padding-top: var(--gap-sm, 1.5vh);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--color-border, rgba(255,255,255,0.1));
}

/* 减弱动态效果 */
.reduce-motion * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
</style>

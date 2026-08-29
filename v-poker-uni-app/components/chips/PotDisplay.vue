<template>
  <view class="pot-display" :class="potSize">
    <!-- 底池标签 -->
    <view class="pot-label">
      <text class="label-text">底池</text>
    </view>
    <!-- 底池金额 -->
    <view class="pot-amount">
      <text class="amount-number" :class="{ 'amount-updating': isUpdating }">{{ displayValue }}</text>
    </view>
    <!-- 筹码装饰 -->
    <view v-if="showChips" class="pot-chips">
      <ChipStack :value="value" size="sm" />
    </view>
  </view>
</template>

<script>
import ChipStack from '../chips/ChipStack.vue'
import { formatPoints } from '../../utils/format.js'

export default {
  name: 'PotDisplay',
  components: {
    ChipStack
  },
  props: {
    // 底池金额
    value: {
      type: Number,
      default: 0
    },
    // 尺寸：sm/md/lg
    size: {
      type: String,
      default: 'md'
    },
    // 是否显示筹码装饰
    showChips: {
      type: Boolean,
      default: false
    },
    // 是否启用数字滚动动画
    animate: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      displayValue: 0,
      isUpdating: false,
      animationTimer: null
    }
  },
  computed: {
    potSize() {
      return 'size-' + this.size
    }
  },
  watch: {
    value(newVal, oldVal) {
      if (this.animate && newVal !== oldVal) {
        this.animateValue(oldVal || 0, newVal)
      } else {
        this.displayValue = newVal
      }
    }
  },
  mounted() {
    this.displayValue = this.value
  },
  beforeUnmount() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer)
    }
  },
  methods: {
    formatPoints,
    // 数字滚动动画
    animateValue(from, to) {
      this.isUpdating = true
      const duration = 500
      const startTime = Date.now()
      const diff = to - from

      if (this.animationTimer) {
        clearInterval(this.animationTimer)
      }

      this.animationTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease-Out 曲线
        const eased = 1 - Math.pow(1 - progress, 3)
        this.displayValue = Math.round(from + diff * eased)

        if (progress >= 1) {
          clearInterval(this.animationTimer)
          this.animationTimer = null
          this.displayValue = to
          setTimeout(() => {
            this.isUpdating = false
          }, 100)
        }
      }, 16)
    }
  }
}
</script>

<style lang="scss" scoped>
.pot-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.size-sm {
  .pot-label .label-text { font-size: var(--text-lg); }
  .amount-number { font-size: var(--text-2xl); }
}

.size-md {
  .pot-label .label-text { font-size: var(--text-lg); }
  .amount-number { font-size: var(--text-3xl); }
}

.size-lg {
  .pot-label .label-text { font-size: var(--text-xl); }
  .amount-number { font-size: var(--text-3xl); }
}

/* 底池标签 */
.pot-label {
  background: rgba(0, 0, 0, 0.5);
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.label-text {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 4rpx;
}

/* 底池金额 */
.pot-amount {
  background: rgba(255, 215, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 16rpx;
  padding: 8rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(255, 215, 0, 0.15), inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.amount-number {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 300;
  color: var(--color-gold);
  letter-spacing: -2rpx;
  text-shadow: 0 0 20rpx rgba(255, 215, 0, 0.5);
  transition: transform 0.1s ease;
}

.amount-updating {
  animation: amountPulse3D 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes amountPulse3D {
  0% { transform: perspective(600px) translateZ(0) scale(1); }
  40% { transform: perspective(600px) translateZ(20px) scale(1.15); text-shadow: 0 0 30rpx rgba(255, 215, 0, 0.8); }
  100% { transform: perspective(600px) translateZ(0) scale(1); }
}

/* 筹码装饰 */
.pot-chips {
  margin-top: 4rpx;
}
</style>

<template>
  <view class="chip-stack" :class="chipSize" :style="stackStyle">
    <view
      v-for="(chip, index) in visibleChips"
      :key="index"
      class="chip"
      :class="chip.color"
      :style="getChipStyle(index)"
    >
      <!-- 筹码图片纹理叠加 -->
      <image class="chip-texture" :src="$cdn('/static/images/chips/chip_set.jpg')" mode="aspectFill"></image>
      <view class="chip-inner">
        <text class="chip-value">{{ chip.value }}</text>
      </view>
    </view>
    <!-- 金额标签 -->
    <view v-if="showLabel" class="chip-label">
      <text class="label-text">{{ formatPoints(totalValue) }}</text>
    </view>
  </view>
</template>

<script>
import { formatPoints } from '../../utils/format.js'

export default {
  name: 'ChipStack',
  props: {
    // 总金额
    value: {
      type: Number,
      default: 0
    },
    // 筹码堆最大层数
    maxStack: {
      type: Number,
      default: 5
    },
    // 尺寸：sm/md/lg
    size: {
      type: String,
      default: 'md'
    },
    // 是否显示金额标签
    showLabel: {
      type: Boolean,
      default: false
    },
    // 是否播放入场动画
    animate: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    chipSize() {
      return 'size-' + this.size
    },
    // 根据总金额计算筹码组合
    chipComposition() {
      let remaining = this.value
      const chips = []
      const denominations = [
        { value: 1000, color: 'chip-black' },
        { value: 500, color: 'chip-purple' },
        { value: 100, color: 'chip-green' },
        { value: 50, color: 'chip-blue' },
        { value: 25, color: 'chip-red' },
        { value: 10, color: 'chip-yellow' },
        { value: 5, color: 'chip-white' },
        { value: 1, color: 'chip-gray' }
      ]

      for (const denom of denominations) {
        while (remaining >= denom.value && chips.length < this.maxStack * 2) {
          chips.push({ ...denom })
          remaining -= denom.value
        }
      }

      // 如果还有剩余且没满，用最小筹码
      while (remaining > 0 && chips.length < this.maxStack * 2) {
        chips.push({ value: 1, color: 'chip-gray' })
        remaining -= 1
      }

      return chips
    },
    // 可见筹码（分层显示）
    visibleChips() {
      // 最多显示maxStack层，每层代表多个筹码
      const total = this.chipComposition.length
      if (total <= this.maxStack) {
        return this.chipComposition
      }
      // 压缩显示
      const perLayer = Math.ceil(total / this.maxStack)
      const result = []
      for (let i = 0; i < this.maxStack; i++) {
        const start = i * perLayer
        if (start < total) {
          result.push(this.chipComposition[start])
        }
      }
      return result
    },
    totalValue() {
      return this.value
    },
    stackStyle() {
      const style = {}
      if (this.animate) {
        style.animation = 'stackIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both'
      }
      return style
    }
  },
  methods: {
    formatPoints,
    getChipStyle(index) {
      const total = this.visibleChips.length
      // 上层筹码略大（近大远小，3D 透视感）
      const scale = 1 + (index / Math.max(total, 1)) * 0.06
      return {
        bottom: index * 5 + 'rpx',
        zIndex: index,
        transform: `translateX(-50%) scale(${scale})`,
        animationDelay: this.animate ? (index * 50) + 'ms' : '0ms'
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.chip-stack {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  perspective: 600px;
}

.size-sm { width: 50rpx; height: 50rpx; }
.size-md { width: 70rpx; height: 70rpx; }
.size-lg { width: 90rpx; height: 90rpx; }

.chip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 3D 厚度：多层阴影模拟筹码侧边 */
  box-shadow:
    0 2rpx 4rpx rgba(0, 0, 0, 0.4),
    0 4rpx 0 rgba(0, 0, 0, 0.2),
    0 6rpx 0 rgba(0, 0, 0, 0.15),
    inset 0 1rpx 2rpx rgba(255, 255, 255, 0.4),
    inset 0 -2rpx 4rpx rgba(0, 0, 0, 0.2);
  overflow: hidden;
  transform-style: preserve-3d;
}

.chip-texture {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.18;
  border-radius: 50%;
  pointer-events: none;
}

.size-sm .chip { width: 40rpx; height: 40rpx; }
.size-md .chip { width: 56rpx; height: 56rpx; }
.size-lg .chip { width: 72rpx; height: 72rpx; }

.chip-inner {
  width: 70%;
  height: 70%;
  border-radius: 50%;
  border: 2rpx dashed rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.size-sm .chip-value { font-size: var(--text-sm); }
.size-md .chip-value { font-size: var(--text-lg); }
.size-lg .chip-value { font-size: var(--text-lg); }

.chip-value {
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.5);
}

/* 筹码颜色 */
.chip-black { background: linear-gradient(145deg, #2d2d2d, var(--color-bg-card)); border: 2rpx solid #444; }
.chip-purple { background: linear-gradient(145deg, #9333ea, #7e22ce); border: 2rpx solid #a855f7; }
.chip-green { background: linear-gradient(145deg, var(--color-success), #15803d); border: 2rpx solid var(--color-success); }
.chip-blue { background: linear-gradient(145deg, #2563eb, #1d4ed8); border: 2rpx solid var(--color-info); }
.chip-red { background: linear-gradient(145deg, #dc2626, #b91c1c); border: 2rpx solid #ef4444; }
.chip-yellow { background: linear-gradient(145deg, #eab308, #ca8a04); border: 2rpx solid #facc15; }
.chip-white { background: linear-gradient(145deg, #f8fafc, var(--color-border)); border: 2rpx solid #fff; }
.chip-white .chip-value { color: #333; text-shadow: none; }
.chip-gray { background: linear-gradient(145deg, var(--color-text-muted), #4b5563); border: 2rpx solid var(--color-text-muted); }

/* 金额标签 */
.chip-label {
  position: absolute;
  bottom: -28rpx;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

.label-text {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-gold);
  text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.8);
}

/* 入场动画 */
@keyframes stackIn {
  0% {
    transform: scale(0) translateY(-50rpx);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.chip {
  animation: chipIn3D 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes chipIn3D {
  0% {
    transform: translateX(-50%) perspective(600px) translateZ(-40px) scale(0.5);
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>

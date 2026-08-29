<template>
  <view class="pyramid-distribution" :class="{ 'pyramid-active': active }">
    <!-- 倒金字塔主体 -->
    <view class="pyramid-container">
      <!-- 塔尖：抽水总额 -->
      <view class="pyramid-tip">
        <view class="tip-amount" :class="{ 'tip-glow': active }">
          <text class="tip-label">抽水</text>
          <text class="tip-value gold-text">{{ totalRake }}</text>
        </view>
        <!-- 金色光球 -->
        <view v-if="active" class="gold-orb" :class="{ 'orb-fall': phase >= 1 }"></view>
      </view>

      <!-- 塔身 -->
      <view class="pyramid-body">
        <!-- 金色流体 -->
        <view v-if="active && phase >= 1" class="gold-flow" :class="{ 'flow-split': phase >= 2 }">
          <view class="flow-main"></view>
          <view v-if="phase >= 2" class="flow-branch branch-1"></view>
          <view v-if="phase >= 2" class="flow-branch branch-2"></view>
          <view v-if="phase >= 2" class="flow-branch branch-3"></view>
        </view>

        <!-- 分流节点 -->
        <view v-if="active && phase >= 2" class="split-node">
          <view class="split-glow"></view>
        </view>

        <!-- 金字塔轮廓 -->
        <view class="pyramid-outline"></view>
      </view>

      <!-- 底部：三个分配容器 -->
      <view class="pyramid-base">
        <view
          v-for="(item, index) in displayItems"
          :key="item.id"
          class="distribution-card glass-card"
          :class="{ 'card-active': active && phase >= 3, 'card-platform': item.isPlatform }"
          :style="{ animationDelay: (index * 150) + 'ms' }"
        >
          <!-- 流体注入效果 -->
          <view v-if="active && phase >= 3" class="card-inflow" :style="{ background: item.color }"></view>

          <view class="card-header">
            <view class="card-dot" :style="{ background: item.color }"></view>
            <text class="card-name">{{ item.name }}</text>
          </view>

          <view class="card-amount">
            <text class="amount-value" :style="{ color: item.color }">{{ item.displayAmount }}</text>
            <text class="amount-percent">{{ item.percentage }}%</text>
          </view>

          <!-- 继承标识 -->
          <view v-if="item.inherited" class="card-badge">
            <text class="badge-text">含下级份额</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 守恒等式 -->
    <view v-if="showEquation && active && phase >= 4" class="conservation-equation">
      <text class="equation-text">{{ equation }}</text>
    </view>
  </view>
</template>

<script>
import { calculateRakeDistribution, formatDistributionForDisplay } from '../../utils/economy.js'

export default {
  name: 'PyramidDistribution',
  props: {
    // 底池总额
    totalPot: {
      type: Number,
      default: 0
    },
    // 层级信息
    hierarchy: {
      type: Object,
      default: () => ({})
    },
    // 是否激活动画
    active: {
      type: Boolean,
      default: false
    },
    // 是否显示守恒等式
    showEquation: {
      type: Boolean,
      default: true
    },
  },
  data() {
    return {
      phase: 0, // 0:静止 1:光球下落 2:分流 3:注入容器 4:显示等式
      phaseTimers: [],
      displayAmounts: {},
    }
  },
  computed: {
    // 分配结果
    distributionResult() {
      return calculateRakeDistribution(this.totalPot, this.hierarchy)
    },
    // 抽水总额
    totalRake() {
      return this.distributionResult.rakeAmount
    },
    // 显示用数据
    displayItems() {
      const formatted = formatDistributionForDisplay(this.distributionResult)
      return formatted.items.map(item => ({
        ...item,
        displayAmount: this.displayAmounts[item.id] !== undefined ? this.displayAmounts[item.id] : 0,
      }))
    },
    // 守恒等式
    equation() {
      return this.distributionResult.conservationEquation
    },
  },
  watch: {
    active(newVal) {
      if (newVal) {
        this.startAnimation()
      } else {
        this.resetAnimation()
      }
    },
  },
  beforeUnmount() {
    this.clearTimers()
  },
  methods: {
    // 开始动画
    startAnimation() {
      this.clearTimers()
      this.phase = 0
      this.displayAmounts = {}

      // 阶段1：光球下落（0.4s）
      this.phaseTimers.push(setTimeout(() => {
        this.phase = 1
      }, 100))

      // 阶段2：分流（0.7s）
      this.phaseTimers.push(setTimeout(() => {
        this.phase = 2
      }, 500))

      // 阶段3：注入容器+数字滚动（1.2s）
      this.phaseTimers.push(setTimeout(() => {
        this.phase = 3
        this.animateAmounts()
      }, 900))

      // 阶段4：显示守恒等式（1.8s）
      this.phaseTimers.push(setTimeout(() => {
        this.phase = 4
      }, 1500))
    },

    // 数字滚动动画
    animateAmounts() {
      const items = formatDistributionForDisplay(this.distributionResult).items

      items.forEach((item, index) => {
        const targetAmount = item.amount
        const duration = 600
        const startTime = Date.now() + index * 100

        const animate = () => {
          const now = Date.now()
          if (now < startTime) {
            requestAnimationFrame(animate)
            return
          }

          const elapsed = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          // Ease-Out
          const eased = 1 - Math.pow(1 - progress, 3)
          const current = Math.floor(targetAmount * eased)

          this.$set(this.displayAmounts, item.id, current)

          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            this.$set(this.displayAmounts, item.id, targetAmount)
          }
        }

        requestAnimationFrame(animate)
      })
    },

    // 重置动画
    resetAnimation() {
      this.clearTimers()
      this.phase = 0
      this.displayAmounts = {}
    },

    // 清除定时器
    clearTimers() {
      this.phaseTimers.forEach(timer => clearTimeout(timer))
      this.phaseTimers = []
    },
  },
}
</script>

<style lang="scss" scoped>
.pyramid-distribution {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 0;
}

.pyramid-container {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  perspective: 800px;
}

/* 塔尖 */
.pyramid-tip {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 10rpx;
}

.tip-amount {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 32rpx;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 12rpx;
  transition: all 0.3s ease;
}

.tip-glow {
  box-shadow: 0 0 30rpx rgba(255, 215, 0, 0.6);
  background: rgba(255, 215, 0, 0.2);
}

.tip-label {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 4rpx;
}

.tip-value {
  font-size: var(--text-3xl);
  font-weight: 700;
  font-family: Georgia, serif;
}

/* 金色光球 */
.gold-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40rpx;
  height: 40rpx;
  background: radial-gradient(circle, var(--color-gold) 0%, var(--color-gold-dark) 50%, transparent 100%);
  border-radius: 50%;
  box-shadow: 0 0 20rpx rgba(255, 215, 0, 0.8);
  opacity: 0;
  z-index: 10;
}

.orb-fall {
  animation: orbFall 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes orbFall {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) perspective(800px) translateZ(40px) scale(1.3);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 200rpx) perspective(800px) translateZ(-20px) scale(0.4);
  }
}

/* 塔身 */
.pyramid-body {
  position: relative;
  width: 200rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
}

.pyramid-outline {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 100rpx solid transparent;
  border-right: 100rpx solid transparent;
  border-top: 120rpx solid rgba(255, 215, 0, 0.1);
  filter: drop-shadow(0 0 10rpx rgba(255, 215, 0, 0.3));
  transform: rotateX(15deg);
  transform-origin: center top;
}

/* 金色流体 */
.gold-flow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  z-index: 5;
}

.flow-main {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 12rpx;
  height: 60%;
  background: linear-gradient(180deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  border-radius: 6rpx;
  box-shadow: 0 0 15rpx rgba(255, 215, 0, 0.8);
  animation: flowDown 0.4s ease-out forwards;
}

@keyframes flowDown {
  0% { height: 0; opacity: 0; }
  100% { height: 60%; opacity: 1; }
}

/* 分流 */
.flow-split .flow-main {
  height: 40%;
}

.flow-branch {
  position: absolute;
  top: 40%;
  width: 8rpx;
  height: 60%;
  background: linear-gradient(180deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  border-radius: 4rpx;
  box-shadow: 0 0 10rpx rgba(255, 215, 0, 0.6);
  animation: branchFlow 0.3s ease-out forwards;
  opacity: 0;
}

.branch-1 {
  left: 25%;
  transform: rotate(-20deg);
  transform-origin: top center;
  animation-delay: 0.1s;
}

.branch-2 {
  left: 50%;
  transform: translateX(-50%);
  animation-delay: 0.15s;
}

.branch-3 {
  right: 25%;
  transform: rotate(20deg);
  transform-origin: top center;
  animation-delay: 0.2s;
}

@keyframes branchFlow {
  0% { height: 0; opacity: 0; }
  100% { height: 60%; opacity: 1; }
}

/* 分流节点 */
.split-node {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30rpx;
  height: 30rpx;
  z-index: 6;
}

.split-glow {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, var(--color-gold) 0%, transparent 70%);
  border-radius: 50%;
  animation: splitPulse 0.5s ease-out;
}

@keyframes splitPulse {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(3); opacity: 0; }
}

/* 底部容器 */
.pyramid-base {
  display: flex;
  gap: 16rpx;
  margin-top: 10rpx;
  width: 100%;
  justify-content: center;
}

.distribution-card {
  position: relative;
  flex: 1;
  max-width: 180rpx;
  padding: 16rpx 12rpx;
  border-radius: 12rpx;
  overflow: hidden;
  opacity: 0;
  transform: translateY(20rpx);
  transition: all 0.3s ease;
}

.card-active {
  animation: cardAppear3D 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes cardAppear3D {
  0% {
    opacity: 0;
    transform: perspective(800px) rotateX(-60deg) translateY(30rpx) scale(0.8);
  }
  60% {
    transform: perspective(800px) rotateX(8deg) translateY(-5rpx) scale(1.03);
  }
  100% {
    opacity: 1;
    transform: perspective(800px) rotateX(0) translateY(0) scale(1);
  }
}

.card-inflow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.15;
  animation: inflow 0.6s ease-out;
}

@keyframes inflow {
  0% { transform: translateY(-100%); opacity: 0.5; }
  100% { transform: translateY(0); opacity: 0.15; }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.card-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  box-shadow: 0 0 8rpx currentColor;
}

.card-name {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.card-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.amount-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  font-family: Georgia, serif;
}

.amount-percent {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.5);
}

.card-badge {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  padding: 2rpx 8rpx;
  background: rgba(255, 215, 0, 0.2);
  border-radius: 6rpx;
}

.badge-text {
  font-size: var(--text-sm);
  color: var(--color-gold);
}

/* 守恒等式 */
.conservation-equation {
  margin-top: 20rpx;
  padding: 12rpx 24rpx;
  animation: equationFade 2s ease-in-out;
}

@keyframes equationFade {
  0% { opacity: 0; transform: translateY(10rpx); }
  20% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; }
  100% { opacity: 0.6; }
}

.equation-text {
  font-size: var(--text-xl);
  color: rgba(255, 215, 0, 0.7);
  font-family: "STKaiti", "KaiTi", serif;
  letter-spacing: 2rpx;
  text-shadow: 0 0 10rpx rgba(255, 215, 0, 0.3);
}

/* 金色文字 */
.gold-text {
  background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 毛玻璃 */
.glass-card {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>

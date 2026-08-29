<template>
  <view v-if="visible" class="settlement-panel" :class="{ 'panel-enter': visible }">
    <!-- 背景遮罩 -->
    <view class="panel-overlay" @click="handleOverlayClick"></view>

    <!-- 面板内容 -->
    <view class="panel-content">
      <!-- 标题 -->
      <view class="panel-header">
        <view class="header-line"></view>
        <text class="header-title gold-text">{{ isFinal ? '总结算' : '本局结算' }}</text>
        <view class="header-line"></view>
      </view>

      <!-- 总结算：累计数据 -->
      <view v-if="isFinal && summary" class="summary-section">
        <view class="summary-row">
          <view class="summary-item">
            <text class="summary-label">局数</text>
            <text class="summary-value">{{ summary.roundNo }} / {{ summary.totalRounds }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">总流水</text>
            <text class="summary-value gold">{{ formatAmount(summary.totalFlow) }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">总抽水</text>
            <text class="summary-value">{{ formatAmount(summary.totalRake) }}</text>
          </view>
        </view>
      </view>

      <!-- 玩家结算结果 -->
      <view class="results-section">
        <view
          v-for="(result, index) in results"
          :key="index"
          class="result-item"
          :class="{ 'result-winner': result.isWinner, 'result-loser': !result.isWinner && result.amount < 0 }"
          :style="{ animationDelay: (index * 80 + 200) + 'ms' }"
        >
          <view class="result-player">
            <view class="player-avatar" :style="{ background: getAvatarColor(result.name) }">
              <text class="avatar-text">{{ result.name?.charAt(0) || '?' }}</text>
            </view>
            <view class="player-info">
              <text class="player-name">{{ result.name }}</text>
              <text class="player-hand">{{ result.handName || '—' }}</text>
            </view>
            <view v-if="result.isWinner" class="winner-badge">
              <text>👑</text>
            </view>
          </view>
          <view class="result-amount">
            <text class="amount-text" :class="result.amount > 0 ? 'amount-win' : (result.amount < 0 ? 'amount-lose' : 'amount-draw')">
              {{ result.amount > 0 ? '+' : '' }}{{ formatAmount(result.amount) }}
            </text>
            <text class="amount-label">{{ isFinal ? '净输赢' : '本局输赢' }}</text>
          </view>
        </view>
      </view>

      <!-- 抽水分配仅房主在总结算时可见 -->
      <view v-if="isFinal && isHost" class="divider">
        <view class="divider-line"></view>
        <text class="divider-text">抽水分配</text>
        <view class="divider-line"></view>
      </view>

      <view v-if="isFinal && isHost" class="pyramid-section">
        <PyramidDistribution
          :total-pot="totalPot"
          :hierarchy="hierarchy"
          :active="pyramidActive"
          :show-equation="true"
        />
      </view>

      <!-- 底部操作 -->
      <view class="panel-footer">
        <button v-if="isFinal && isHost" class="btn-continue btn-final" @click="handleContinue">
          <text>续开房间</text>
        </button>
        <button v-else-if="isFinal && !isHost" class="btn-continue btn-wait" disabled>
          <text>等待房主续开...</text>
        </button>
        <button v-else class="btn-continue" @click="handleContinue">
          <text>继续游戏</text>
        </button>
        <button v-if="isFinal" class="btn-exit" @click="handleExit">
          <text>退出房间</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import PyramidDistribution from './PyramidDistribution.vue'

export default {
  name: 'SettlementPanel',
  components: {
    PyramidDistribution
  },
  props: {
    // 是否显示
    visible: {
      type: Boolean,
      default: false
    },
    // 玩家结算结果
    results: {
      type: Array,
      default: () => []
    },
    // 底池总额
    totalPot: {
      type: Number,
      default: 0
    },
    // 层级信息（用于抽水分配）
    hierarchy: {
      type: Object,
      default: () => ({})
    },
    // 是否点击遮罩关闭
    closeOnOverlay: {
      type: Boolean,
      default: false
    },
    // 是否总结算（最后一局）
    isFinal: {
      type: Boolean,
      default: false
    },
    // 总结算累计数据
    summary: {
      type: Object,
      default: () => ({})
    },
    // 当前用户是否房主（总结算时显示续开按钮）
    isHost: {
      type: Boolean,
      default: false
    },
  },
  data() {
    return {
      pyramidActive: false,
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // 延迟启动金字塔动画
        setTimeout(() => {
          this.pyramidActive = true
        }, 500)
      } else {
        this.pyramidActive = false
      }
    },
  },
  methods: {
    // 继续游戏
    handleContinue() {
      this.$emit('continue')
    },
    // 退出房间
    handleExit() {
      this.$emit('exit')
    },
    // 格式化金额，保留2位小数
    formatAmount(val) {
      const num = Number(val) || 0
      return Number(num.toFixed(2)).toString()
    },
    // 遮罩点击
    handleOverlayClick() {
      if (this.closeOnOverlay) {
        this.$emit('close')
      }
    },
    // 获取头像颜色
    getAvatarColor(name) {
      const colors = [
        'linear-gradient(135deg, var(--theme-primary), #764ba2)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #43e97b, var(--color-info))',
        'linear-gradient(135deg, #fa709a, var(--color-gold))',
        'linear-gradient(135deg, #30cfd0, #330867)',
      ]
      let hash = 0
      for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
      }
      return colors[Math.abs(hash) % colors.length]
    },
  },
}
</script>

<style lang="scss" scoped>
.settlement-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2vh;
  padding-left: calc(2vh + env(safe-area-inset-left));
  padding-right: calc(2vh + env(safe-area-inset-right));
  padding-top: calc(2vh + env(safe-area-inset-top));
  padding-bottom: calc(2vh + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.panel-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
}

.panel-content {
  position: relative;
  width: 90%;
  max-width: 700rpx;
  max-height: 90vh;
  background: linear-gradient(180deg, rgba(20, 20, 30, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 0 60rpx rgba(255, 215, 0, 0.15), 0 20rpx 60rpx rgba(0, 0, 0, 0.5);
  overflow-y: auto;
  transform-style: preserve-3d;
  animation: panelEnter3D 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes panelEnter3D {
  0% {
    opacity: 0;
    transform: perspective(1000px) rotateX(-80deg) translateY(60rpx) scale(0.9);
  }
  60% {
    opacity: 1;
    transform: perspective(1000px) rotateX(5deg) translateY(-10rpx) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: perspective(1000px) rotateX(0) translateY(0) scale(1);
  }
}

/* 标题 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.header-line {
  flex: 1;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.5), transparent);
}

.header-title {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: 8rpx;
  white-space: nowrap;
}

/* 玩家结果 */
.results-section {
  margin-bottom: 24rpx;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  margin-bottom: 8rpx;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12rpx;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  opacity: 0;
  animation: resultItemIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes resultItemIn {
  0% {
    opacity: 0;
    transform: perspective(800px) rotateX(-45deg) translateX(-40rpx);
  }
  100% {
    opacity: 1;
    transform: perspective(800px) rotateX(0) translateX(0);
  }
}

.result-winner {
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.3);
}

.result-loser {
  opacity: 0.7;
}

.result-player {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.player-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: var(--text-lg);
  font-weight: 700;
  color: #fff;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.player-name {
  font-size: var(--text-xl);
  color: var(--color-text);
  font-weight: 600;
  max-width: 200rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-hand {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  max-width: 200rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.winner-badge {
  font-size: var(--text-xl);
  animation: winnerBounce 1s ease-in-out infinite;
}

@keyframes winnerBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4rpx); }
}

.result-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.amount-text {
  font-size: var(--text-2xl);
  font-weight: 700;
  font-family: Georgia, serif;
}

.amount-win {
  color: var(--color-success);
  text-shadow: 0 0 10rpx rgba(74, 222, 128, 0.5);
}

.amount-lose {
  color: var(--color-danger);
}

.amount-label {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.4);
}

/* 分割线 */
.divider {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 20rpx 0;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  background: rgba(255, 255, 255, 0.1);
}

.divider-text {
  font-size: var(--text-lg);
  color: rgba(255, 215, 0, 0.7);
  letter-spacing: 4rpx;
}

/* 金字塔区域 */
.pyramid-section {
  margin-bottom: 24rpx;
  padding: 16rpx;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16rpx;
}

/* 底部 */
.panel-footer {
  display: flex;
  justify-content: center;
  padding-top: 16rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-exit {
      margin-top: 1.5vh;
      background: rgba(220, 38, 38, 0.2);
      border: 0.2vh solid rgba(220, 38, 38, 0.5);
      color: #fca5a5;
      font-size: var(--text-sm);
      padding: 1.2vh 4vh;
      border-radius: 1vh;
      width: 100%;
    }
    .btn-exit:active {
      background: rgba(220, 38, 38, 0.4);
    }
    .btn-continue {
  width: 240rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  color: var(--color-bg-card);
  font-size: var(--text-2xl);
  font-weight: 700;
  border-radius: 36rpx;
  border: none;
  box-shadow: 0 4rpx 20rpx rgba(255, 215, 0, 0.4);
  transition: all 0.2s ease;
}

.btn-continue:active {
  transform: scale(0.95);
}

/* 金色文字 */
.gold-text {
  background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 总结算累计数据 */
.summary-section {
  margin-bottom: 20rpx;
  padding: 20rpx;
  background: rgba(255, 215, 0, 0.06);
  border: 1rpx solid rgba(255, 215, 0, 0.15);
  border-radius: 12rpx;
}
.summary-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
}
.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.summary-label {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.5);
}
.summary-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: #fff;
}
.summary-value.gold {
  color: var(--color-gold);
}

/* 总结算按钮变体 */
.btn-final {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark)) !important;
  color: var(--color-bg-card) !important;
}
.btn-wait {
  background: rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.5) !important;
  opacity: 0.7;
}
</style>

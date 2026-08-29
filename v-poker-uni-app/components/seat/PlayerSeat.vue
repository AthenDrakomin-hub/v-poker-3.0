<template>
  <view
    class="player-seat"
    :class="[seatPosition, { 'seat-active': isActive, 'seat-folded': isFolded, 'seat-empty': !player, 'seat-compact': compact, 'seat-winner': isWinner }]"
    :style="seatStyle"
  >
    <!-- 呼吸光晕（行动期） -->
    <view v-if="isActive" class="breathing-halo"></view>

    <!-- 座位主体 -->
    <view class="seat-body">
      <!-- 头像 -->
      <view class="seat-avatar" :class="{ 'avatar-active': isActive }">
        <view v-if="player" class="avatar-circle">
          <image class="avatar-image" :src="avatarUrl" mode="aspectFill"></image>
        </view>
        <view v-else class="avatar-empty">
          <text class="empty-icon">+</text>
        </view>
        <!-- 在线状态点 -->
        <view v-if="player" class="status-dot" :class="player.isOnline ? 'online' : 'offline'"></view>
      </view>

      <!-- 玩家信息（紧凑模式隐藏） -->
      <view v-if="player && !compact" class="seat-info">
        <text class="player-name">{{ player.nickname || player.account }}</text>
        <view class="player-points">
          <text class="points-icon">💰</text>
          <text class="points-value">{{ formatPoints(player.points || 0) }}</text>
        </view>
      </view>

      <!-- 手牌区域 -->
      <view v-if="player && showCards" class="seat-cards">
        <SVGCard
          v-for="(card, index) in playerCards"
          :key="index"
          :label="getCardLabel(card)"
          :face-up="isMe || showAllCards"
          size="sm"
          :is-dealt="cardsDealt"
          :deal-delay="index * 80"
          :style="{ marginLeft: index > 0 ? '-1.5vh' : '0', zIndex: index }"
        />
      </view>

      <!-- 下注筹码 -->
      <view v-if="player && player.bet > 0" class="seat-bet">
        <ChipStack :value="player.bet" size="sm" :animate="true" />
      </view>

      <!-- 状态标签 -->
      <view v-if="player" class="seat-status">
        <view v-if="isActive" class="status-tag status-thinking">
          <text>思考中</text>
        </view>
        <view v-else-if="isFolded" class="status-tag status-folded">
          <text>弃牌</text>
        </view>
        <view v-else-if="isAllIn" class="status-tag status-allin">
          <text>ALL IN</text>
        </view>
        <view v-else-if="isWinner" class="status-tag status-winner">
          <text>赢家</text>
        </view>
      </view>

      <!-- 庄家标识 -->
      <view v-if="isDealer" class="dealer-button">
        <text>庄</text>
      </view>

      <!-- 挂机标识（通比牛牛） -->
      <view v-if="autoPlay" class="autoplay-tag">
        <text>🤖 挂机</text>
      </view>
    </view>
  </view>
</template>

<script>
import SVGCard from '../poker/SVGCard.vue'
import ChipStack from '../chips/ChipStack.vue'
import { formatPoints } from '../../utils/format.js'
import { getAvatarImage } from '../../utils/avatar.js'

export default {
  name: 'PlayerSeat',
  components: {
    SVGCard,
    ChipStack
  },
  props: {
    // 玩家数据
    player: {
      type: Object,
      default: null
    },
    // 座位位置：top-left/top/top-right/bottom-left/bottom/bottom-right/left/right
    position: {
      type: String,
      default: 'bottom'
    },
    // 是否是当前行动玩家
    isActive: {
      type: Boolean,
      default: false
    },
    // 是否是我自己
    isMe: {
      type: Boolean,
      default: false
    },
    // 是否显示手牌
    showCards: {
      type: Boolean,
      default: true
    },
    // 是否显示所有牌（摊牌时）
    showAllCards: {
      type: Boolean,
      default: false
    },
    // 玩家手牌
    playerCards: {
      type: Array,
      default: () => []
    },
    // 牌是否已发
    cardsDealt: {
      type: Boolean,
      default: false
    },
    // 是否弃牌
    isFolded: {
      type: Boolean,
      default: false
    },
    // 是否ALL IN
    isAllIn: {
      type: Boolean,
      default: false
    },
    // 是否是赢家
    isWinner: {
      type: Boolean,
      default: false
    },
    // 是否是庄家
    isDealer: {
      type: Boolean,
      default: false
    },
    // 自定义样式
    customStyle: {
      type: Object,
      default: () => ({})
    },
    // 紧凑模式（仅显示头像，隐藏名字和筹码，用于横屏两侧座位）
    compact: {
      type: Boolean,
      default: false
    },
    // 挂机中（通比牛牛 autoPlay）
    autoPlay: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    seatPosition() {
      return 'pos-' + this.position
    },
    seatStyle() {
      return { ...this.customStyle }
    },
    avatarUrl() {
      if (this.player && this.player.avatar) {
        return getAvatarImage(this.player.avatar)
      }
      // 回退：按座位索引选择默认头像
      const index = this.player ? (this.player.seatIndex || 0) : 0
      const avatarIndex = (index % 5) + 1
      return `/static/avatars/vip-${avatarIndex}.png`
    }
  },
  methods: {
    formatPoints,
    getCardLabel(card) {
      if (!card) return 'back'
      if (typeof card === 'string') return card
      if (typeof card === 'object') return card.label || card.card || card.code || 'back'
      return 'back'
    }
  }
}
</script>

<style lang="scss" scoped>
.player-seat {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12vh;
  min-height: 12vh;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, filter 0.3s ease;
  perspective: 800px;
  pointer-events: auto;
}

.seat-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4vh;
  transform-style: preserve-3d;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
}

/* 激活时 3D 凸起 */
.seat-active .seat-body {
  transform: perspective(800px) translateZ(15px) scale(1.05);
}

/* 赢家 3D 弹出 */
.seat-winner .seat-body {
  transform: perspective(800px) translateZ(25px) scale(1.1);
}

/* 弃牌 3D 后倾 */
.seat-folded .seat-body {
  transform: perspective(800px) rotateX(15deg) translateZ(-10px);
  filter: grayscale(0.4);
}

/* 呼吸光晕 */
.breathing-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10vh;
  height: 10vh;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%);
  animation: breathing 0.667s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes breathing {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(0.9);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* 头像 */
.seat-avatar {
  position: relative;
  z-index: 1;
}

.avatar-circle {
  width: 5.5vh;
  height: 5.5vh;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 0.25vh solid rgba(255,255,255,0.15);
  transition: all 0.3s ease;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}

/* 头像状态边框体系 */
.avatar-active .avatar-circle {
  border-color: var(--color-gold);
  box-shadow: 0 0 1.5vh rgba(255, 215, 0, 0.6), inset 0 0 0.5vh rgba(255,215,0,0.2);
  animation: avatarPulse 1.5s ease infinite;
}

@keyframes avatarPulse {
  0%, 100% { box-shadow: 0 0 1vh rgba(255, 215, 0, 0.5); }
  50% { box-shadow: 0 0 2vh rgba(255, 215, 0, 0.8); }
}

.avatar-folded .avatar-circle {
  border-color: rgba(255,255,255,0.2);
  filter: grayscale(0.7) brightness(0.6);
  opacity: 0.7;
}

.avatar-allin .avatar-circle {
  border-color: var(--color-danger);
  box-shadow: 0 0 1.5vh rgba(220, 38, 38, 0.6);
  animation: allinPulse 0.8s ease infinite;
}

@keyframes allinPulse {
  0%, 100% { box-shadow: 0 0 1vh rgba(220, 38, 38, 0.5); }
  50% { box-shadow: 0 0 2vh rgba(220, 38, 38, 0.8); }
}

.avatar-winner .avatar-circle {
  border-color: var(--color-gold);
  box-shadow: 0 0 2vh rgba(255, 215, 0, 0.8), 0 0 4vh rgba(255,215,0,0.4);
  animation: winnerGlow 1s ease infinite alternate;
}

@keyframes winnerGlow {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}

.avatar-empty {
  width: 5.5vh;
  height: 5.5vh;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 0.2vh dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.3);
}

/* 在线状态 */
.status-dot {
  position: absolute;
  bottom: 0.2vh;
  right: 0.2vh;
  width: 1.4vh;
  height: 1.4vh;
  border-radius: 50%;
  border: 0.2vh solid var(--color-bg);
}

.status-dot.online {
  background: var(--color-success);
}

.status-dot.offline {
  background: var(--color-text-muted);
}

/* 玩家信息 */
.seat-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2vh;
  max-width: 100%;
}

.player-name {
  font-size: var(--text-xs);
  color: var(--color-text);
  max-width: 9vh;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 0.1vh 0.2vh rgba(0, 0, 0, 0.8);
}

.player-points {
  display: flex;
  align-items: center;
  gap: 0.3vh;
  background: rgba(0, 0, 0, 0.5);
  padding: 0.2vh 0.8vh;
  border-radius: 1vh;
}

.points-icon {
  font-size: var(--text-xs);
}

.points-value {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-gold);
  text-shadow: 0 0.1vh 0.2vh rgba(0,0,0,0.5);
  transition: color 0.3s ease, transform 0.3s ease;
}

/* 筹码变化动画 */
.points-value.points-increase {
  color: var(--color-success);
  animation: pointsBounce 0.5s ease;
}
.points-value.points-decrease {
  color: var(--color-danger);
  animation: pointsBounce 0.5s ease;
}
@keyframes pointsBounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* 手牌区域 */
.seat-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.3vh;
}

/* 下注筹码 */
.seat-bet {
  position: absolute;
  bottom: -2.5vh;
  left: 50%;
  transform: translateX(-50%);
}

/* 状态标签 */
.seat-status {
  position: absolute;
  top: -1vh;
  left: 50%;
  transform: translateX(-50%);
}

.status-tag {
  padding: 0.3vh 1vh;
  border-radius: 0.6vh;
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.status-thinking {
  background: rgba(255, 215, 0, 0.9);
  color: var(--color-bg-card);
  animation: pulse 0.667s ease-in-out infinite;
}

.status-folded {
  background: rgba(107, 114, 128, 0.8);
  color: var(--color-text);
}

.status-allin {
  background: rgba(220, 38, 38, 0.9);
  color: #fff;
}

.status-winner {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  box-shadow: 0 0 12rpx rgba(255, 215, 0, 0.6);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 庄家标识 */
.dealer-button {
  position: absolute;
  top: -0.8vh;
  right: -0.8vh;
  width: 2.5vh;
  height: 2.5vh;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff, #e0e0e0);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0.2vh 0.6vh rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.dealer-button text {
  font-size: var(--text-xs);
  font-weight: 900;
  color: var(--color-bg-card);
}

/* 弃牌状态 */
.seat-folded {
  opacity: 0.5;
}

.seat-folded .avatar-circle {
  filter: grayscale(0.5);
}

/* 空座位 */
.seat-empty {
  opacity: 0.6;
}

/* 紧凑模式（横屏两侧座位）：小头像，无信息区 */
.seat-compact {
  width: 8vh;
  min-height: 8vh;
}

.seat-compact .avatar-circle {
  width: 4.5vh;
  height: 4.5vh;
}

.seat-compact .avatar-empty {
  width: 4.5vh;
  height: 4.5vh;
}

.seat-compact .breathing-halo {
  width: 7vh;
  height: 7vh;
}

.seat-compact .seat-status {
  top: -0.8vh;
}

.seat-compact .dealer-button {
  width: 2vh;
  height: 2vh;
}

.seat-compact .dealer-button text {
  font-size: var(--text-xs);
}

/* compact模式筹码色环（根据筹码量显示不同颜色） */
.seat-compact .avatar-circle {
  position: relative;
}
.seat-compact .avatar-circle::after {
  content: '';
  position: absolute;
  top: -0.3vh; left: -0.3vh; right: -0.3vh; bottom: -0.3vh;
  border-radius: 50%;
  border: 0.2vh solid var(--chip-color, var(--color-gold));
  pointer-events: none;
  opacity: 0.8;
}

/* compact模式临时气泡（下注/弃牌/全下时显示） */
.seat-compact .action-bubble {
  position: absolute;
  top: -3vh;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.3vh 0.8vh;
  background: rgba(0,0,0,0.85);
  border-radius: 0.6vh;
  font-size: 1.4vh;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  pointer-events: none;
  animation: bubbleIn 0.3s ease-out;
  z-index: 10;
}
.seat-compact .action-bubble::after {
  content: '';
  position: absolute;
  bottom: -0.6vh;
  left: 50%;
  transform: translateX(-50%);
  border-left: 0.5vh solid transparent;
  border-right: 0.5vh solid transparent;
  border-top: 0.6vh solid rgba(0,0,0,0.85);
}
@keyframes bubbleIn {
  from { opacity: 0; transform: translateX(-50%) translateY(1vh); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 挂机标签 */
.autoplay-tag {
  position: absolute;
  top: -1vh;
  right: -1vh;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: var(--text-xs);
  padding: 0.3vh 1vh;
  border-radius: 2vh;
  white-space: nowrap;
  z-index: 5;
  box-shadow: 0 0.2vh 0.8vh rgba(99, 102, 241, 0.5);
  animation: autoplay-pulse 2s ease-in-out infinite;
}
@keyframes autoplay-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>

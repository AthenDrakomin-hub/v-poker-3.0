<template>
  <view v-if="visible" class="compare-panel" @click.self="$emit('close')">
    <view class="compare-card glass">
      <view class="compare-header">
        <text class="compare-title">比牌对决</text>
        <view class="compare-close" @click="$emit('close')"><text>✕</text></view>
      </view>
      <view class="compare-body">
        <view class="compare-player" :class="{ winner: winnerId === challenger?.userId, loser: winnerId && winnerId !== challenger?.userId }">
          <view class="player-avatar">
            <image :src="challengerAvatar" mode="aspectFill" class="avatar-img" />
            <view v-if="winnerId === challenger?.userId" class="winner-crown">👑</view>
          </view>
          <text class="player-name">{{ challenger?.nickname || challenger?.account || '玩家' }}</text>
          <view class="player-cards">
            <view v-for="(card, idx) in challengerCards" :key="idx" class="card-item" :style="{ animationDelay: (idx * 150) + 'ms' }">
              <text class="card-back" v-if="!revealAll && !isChallengerRevealed">🂠</text>
              <text class="card-face" v-else :class="getCardColor(card)">{{ formatCard(card) }}</text>
            </view>
          </view>
          <view v-if="challengerHand" class="hand-type">{{ challengerHand }}</view>
        </view>
        <view class="compare-vs">
          <view class="vs-circle"><text class="vs-text">VS</text></view>
          <view v-if="countdown > 0" class="vs-countdown" :class="{ warning: countdown <= 3 }"><text>{{ countdown }}</text></view>
          <view v-else-if="resultReady" class="vs-result"><text class="result-icon">⚔️</text></view>
        </view>
        <view class="compare-player" :class="{ winner: winnerId === defender?.userId, loser: winnerId && winnerId !== defender?.userId }">
          <view class="player-avatar">
            <image :src="defenderAvatar" mode="aspectFill" class="avatar-img" />
            <view v-if="winnerId === defender?.userId" class="winner-crown">👑</view>
          </view>
          <text class="player-name">{{ defender?.nickname || defender?.account || '玩家' }}</text>
          <view class="player-cards">
            <view v-for="(card, idx) in defenderCards" :key="idx" class="card-item" :style="{ animationDelay: (idx * 150) + 'ms' }">
              <text class="card-back" v-if="!revealAll && !isDefenderRevealed">🂠</text>
              <text class="card-face" v-else :class="getCardColor(card)">{{ formatCard(card) }}</text>
            </view>
          </view>
          <view v-if="defenderHand" class="hand-type">{{ defenderHand }}</view>
        </view>
      </view>
      <view v-if="resultReady" class="compare-result">
        <view class="result-info">
          <text class="result-winner">{{ winnerName }} 获胜</text>
          <text class="result-amount" :class="winnerId === currentUserId ? 'win' : 'lose'">{{ winnerId === currentUserId ? '+' : '-' }}{{ winAmount }} 筹码</text>
        </view>
        <view class="result-btn" @click="$emit('close')"><text>确认</text></view>
      </view>
      <view v-else class="compare-loading"><text class="loading-text">比牌中...</text></view>
    </view>
  </view>
</template>

<script>
import { getAvatarImage } from '../../utils/avatar.js'

export default {
  name: 'ComparePanel',
  props: {
    visible: { type: Boolean, default: false },
    challenger: { type: Object, default: null },
    defender: { type: Object, default: null },
    challengerCards: { type: Array, default: () => [] },
    defenderCards: { type: Array, default: () => [] },
    challengerHand: { type: String, default: '' },
    defenderHand: { type: String, default: '' },
    winnerId: { type: [Number, String], default: null },
    winAmount: { type: Number, default: 0 },
    countdown: { type: Number, default: 0 },
    revealAll: { type: Boolean, default: false },
    isChallengerRevealed: { type: Boolean, default: false },
    isDefenderRevealed: { type: Boolean, default: false },
    currentUserId: { type: [Number, String], default: null }
  },
  emits: ['close'],
  computed: {
    resultReady() { return this.winnerId !== null && this.countdown <= 0 },
    winnerName() {
      if (this.winnerId === this.challenger?.userId) return this.challenger?.nickname || this.challenger?.account
      if (this.winnerId === this.defender?.userId) return this.defender?.nickname || this.defender?.account
      return '未知'
    },
    challengerAvatar() { return getAvatarImage(this.challenger?.avatar) },
    defenderAvatar() { return getAvatarImage(this.defender?.avatar) }
  },
  methods: {
    formatCard(card) {
      if (!card) return '?'
      if (typeof card === 'string') {
        const rank = card.slice(0, -1), suit = card.slice(-1)
        const suitMap = { s: '♠', h: '♥', d: '♦', c: '♣' }
        return rank + (suitMap[suit] || suit)
      }
      return card?.label || card?.code || '?'
    },
    getCardColor(card) {
      if (!card) return ''
      const suit = typeof card === 'string' ? card.slice(-1) : card?.suit
      return (suit === 'h' || suit === 'd') ? 'card-red' : 'card-black'
    }
  }
}
</script>

<style lang="scss" scoped>
.compare-panel {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 2vh; box-sizing: border-box;
}
.compare-card { width: 85vw; max-width: 900px; border-radius: 2vh; padding: 3vh 2vw; position: relative; }
.compare-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2vh; }
.compare-title { font-size: var(--text-xl); font-weight: 700; color: var(--color-gold); text-shadow: 0 0 2vh rgba(255, 215, 0, 0.5); }
.compare-close { width: 4vh; height: 4vh; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 50%; color: rgba(255,255,255,0.6); font-size: var(--text-lg); }
.compare-body { display: flex; align-items: center; justify-content: space-between; gap: 2vw; padding: 2vh 0; }
.compare-player {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1vh; transition: all 0.3s ease;
  &.winner { transform: scale(1.08); .player-avatar { box-shadow: 0 0 3vh rgba(255, 215, 0, 0.8); } .player-name { color: var(--color-gold); } }
  &.loser { opacity: 0.5; filter: grayscale(0.6); }
}
.player-avatar { width: 8vh; height: 8vh; border-radius: 50%; overflow: hidden; position: relative; border: 0.3vh solid rgba(255,255,255,0.2); transition: all 0.3s ease; }
.avatar-img { width: 100%; height: 100%; background: linear-gradient(135deg, #667eea, #764ba2); }
.winner-crown { position: absolute; top: -2vh; left: 50%; transform: translateX(-50%); font-size: 3vh; animation: crownBounce 0.6s ease infinite alternate; }
@keyframes crownBounce { from { transform: translateX(-50%) translateY(0); } to { transform: translateX(-50%) translateY(-0.5vh); } }
.player-name { font-size: var(--text-base); font-weight: 600; color: var(--color-text); max-width: 15vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-cards { display: flex; gap: 0.8vh; justify-content: center; }
.card-item { width: 5vh; height: 7vh; background: linear-gradient(145deg, #fff, #f0f0f0); border-radius: 0.6vh; display: flex; align-items: center; justify-content: center; box-shadow: 0 0.3vh 0.8vh rgba(0,0,0,0.3); animation: cardDeal 0.4s ease backwards; border: 0.15vh solid rgba(0,0,0,0.1); }
@keyframes cardDeal { from { opacity: 0; transform: translateY(-3vh) rotate(-10deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
.card-back { font-size: 3vh; color: #1a237e; }
.card-face { font-size: 2vh; font-weight: 700; }
.card-red { color: #c62828; } .card-black { color: #1a1a1a; }
.hand-type { font-size: var(--text-sm); font-weight: 600; color: var(--color-gold); background: rgba(255, 215, 0, 0.15); padding: 0.4vh 1.2vh; border-radius: 0.6vh; border: 0.1vh solid rgba(255, 215, 0, 0.3); }
.compare-vs { display: flex; flex-direction: column; align-items: center; gap: 1vh; flex-shrink: 0; }
.vs-circle { width: 7vh; height: 7vh; border-radius: 50%; background: linear-gradient(145deg, var(--color-danger), #b91c1c); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 2vh rgba(220, 38, 38, 0.6); animation: vsPulse 1s ease infinite; }
@keyframes vsPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.vs-text { font-size: var(--text-xl); font-weight: 900; color: #fff; text-shadow: 0 0.2vh 0.4vh rgba(0,0,0,0.5); }
.vs-countdown { width: 4.5vh; height: 4.5vh; border-radius: 50%; background: rgba(255, 215, 0, 0.2); border: 0.2vh solid var(--color-gold); display: flex; align-items: center; justify-content: center; text { font-size: var(--text-lg); font-weight: 700; color: var(--color-gold); } &.warning { background: rgba(220, 38, 38, 0.3); border-color: var(--color-danger); animation: countdownWarning 0.5s ease infinite alternate; text { color: var(--color-danger); } } }
@keyframes countdownWarning { from { transform: scale(1); } to { transform: scale(1.15); } }
.vs-result { font-size: 4vh; animation: resultShake 0.3s ease; }
@keyframes resultShake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-10deg); } 75% { transform: rotate(10deg); } }
.compare-result { margin-top: 2vh; padding-top: 2vh; border-top: 0.1vh solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; }
.result-info { display: flex; flex-direction: column; gap: 0.5vh; }
.result-winner { font-size: var(--text-lg); font-weight: 700; color: var(--color-gold); }
.result-amount { font-size: var(--text-xl); font-weight: 900; &.win { color: var(--color-success); } &.lose { color: var(--color-danger); } }
.result-btn { padding: 1.2vh 4vh; background: linear-gradient(145deg, var(--color-gold), var(--color-gold-dark)); border-radius: 1vh; box-shadow: 0 0.4vh 1vh rgba(255, 215, 0, 0.4); text { font-size: var(--text-lg); font-weight: 700; color: var(--color-bg-card); } }
.compare-loading { margin-top: 2vh; text-align: center; }
.loading-text { font-size: var(--text-base); color: rgba(255,255,255,0.6); animation: loadingPulse 1s ease infinite; }
@keyframes loadingPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
</style>

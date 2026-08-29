<template>
  <view class="wallet-panel">
    <view class="panel-header">
      <view>
        <text class="panel-title">我的钱包</text>
        <text class="panel-subtitle">虚拟筹码钱柜</text>
      </view>
      <view class="panel-close" @click="$emit('close')">
        <VIcon name="close" :size="2.2" color="var(--color-text-muted)" />
      </view>
    </view>

    <view class="wallet-summary">
      <view class="summary-item">
        <text class="summary-label">可用筹码</text>
        <view class="summary-value-row">
          <VIcon name="coin" :size="2.6" color="var(--color-gold)" />
          <text class="summary-value gold">{{ formatPoints(balance) }}</text>
        </view>
        <text class="summary-hint">可用于加入房间和游戏内操作</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-label">钱柜余额</text>
        <view class="summary-value-row">
          <VIcon name="coin" :size="2.6" color="var(--color-info)" />
          <text class="summary-value">{{ formatPoints(safeBalance) }}</text>
        </view>
        <text class="summary-hint">存放中的筹码不会用于游戏</text>
      </view>
    </view>

    <view class="wallet-tabs">
      <view class="wallet-tab" :class="{ active: activeTab === 'vault' }" @click="activeTab = 'vault'">钱柜</view>
      <view class="wallet-tab" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">账变记录</view>
      <view class="wallet-tab" :class="{ active: activeTab === 'guide' }" @click="activeTab = 'guide'">筹码说明</view>
    </view>

    <scroll-view class="panel-body" scroll-y>
      <view v-if="activeTab === 'vault'" class="vault-content">
        <view class="action-row">
          <view class="vault-action deposit" @click="$emit('deposit')">
            <VIcon name="coin" :size="2.4" color="var(--color-success)" />
            <view><text class="action-title">存入钱柜</text><text class="action-desc">从可用筹码转入</text></view>
          </view>
          <view class="vault-action withdraw" @click="$emit('withdraw')">
            <VIcon name="coin" :size="2.4" color="var(--color-info)" />
            <view><text class="action-title">取出筹码</text><text class="action-desc">转回可用筹码</text></view>
          </view>
        </view>

        <view class="section-heading"><text>钱柜转存记录</text><text class="section-meta">保留最近 50 条</text></view>
        <view v-for="record in safeRecords" :key="record.id" class="record-item">
          <view class="record-mark" :class="record.type"></view>
          <view class="record-main">
            <text class="record-title">{{ record.type === 'deposit' ? '存入钱柜' : '从钱柜取出' }}</text>
            <text class="record-time">{{ record.time || record.createdAt || '-' }}</text>
          </view>
          <view class="record-side">
            <text class="record-amount" :class="record.type">{{ record.type === 'deposit' ? '+' : '-' }}{{ formatPoints(record.amount || 0) }}</text>
            <text class="record-balance">柜内 {{ formatPoints(record.balance || 0) }}</text>
          </view>
        </view>
        <view v-if="safeRecords.length === 0" class="empty-state"><VIcon name="coin" :size="4" color="rgba(255,255,255,0.15)" /><text>暂无钱柜转存记录</text></view>
      </view>

      <view v-else-if="activeTab === 'history'" class="history-content">
        <view class="section-heading"><text>筹码账变</text><text class="refresh-link" @click="$emit('refresh')">刷新</text></view>
        <view v-if="historyLoading" class="empty-state"><VIcon name="refresh" :size="4" color="rgba(255,255,255,0.15)" /><text>正在加载账变记录</text></view>
        <view v-else v-for="(record, index) in chipRecords" :key="record.id || index" class="record-item">
          <view class="record-mark platform"></view>
          <view class="record-main">
            <text class="record-title">{{ record.remark || record.description || record.type || '筹码变动' }}</text>
            <text class="record-time">{{ record.createdAt || record.time || '-' }}</text>
          </view>
          <view class="record-side">
            <text class="record-amount" :class="recordAmount(record) < 0 ? 'withdraw' : 'deposit'">{{ formatRecordAmount(record) }}</text>
            <text class="record-balance" v-if="record.balance !== undefined">余额 {{ formatPoints(record.balance) }}</text>
          </view>
        </view>
        <view v-if="!historyLoading && chipRecords.length === 0" class="empty-state"><VIcon name="coin" :size="4" color="rgba(255,255,255,0.15)" /><text>暂无平台账变记录</text></view>
      </view>

      <view v-else class="guide-content">
        <view class="guide-card"><text class="guide-title">筹码如何获得</text><text class="guide-text">筹码可来自平台活动、任务奖励、游戏结算或平台授权的发放。具体规则以活动页面和房间说明为准。</text></view>
        <view class="guide-card"><text class="guide-title">筹码如何使用</text><text class="guide-text">可用筹码用于加入房间及游戏内操作。存入钱柜后不会参与游戏，取出后才会回到可用余额。</text></view>
        <view class="guide-card safety"><text class="guide-title">安全提示</text><text class="guide-text">筹码仅限平台内虚拟用途，不提供现金兑换。请勿向他人透露账号、密码或验证码；任何索要转账、验证码或私下交易的信息都应先联系官方客服核验。</text></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'
import { formatPoints } from '../../utils/format.js'

export default {
  name: 'WalletPanel',
  components: { VIcon },
  props: {
    balance: { type: Number, default: 0 },
    safeBalance: { type: Number, default: 0 },
    safeRecords: { type: Array, default: () => [] },
    chipRecords: { type: Array, default: () => [] },
    historyLoading: { type: Boolean, default: false }
  },
  data() {
    return { activeTab: 'vault' }
  },
  methods: {
    formatPoints,
    recordAmount(record) {
      return Number(record.amount ?? record.change ?? record.delta ?? 0)
    },
    formatRecordAmount(record) {
      const amount = this.recordAmount(record)
      return `${amount > 0 ? '+' : ''}${formatPoints(amount)}`
    }
  }
}
</script>

<style lang="scss" scoped>
.wallet-panel { width: min(80vw, 640px); max-width: 100%; height: min(78vh, 560px); min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: rgba(18, 20, 24, 0.98); border: 0.1vh solid rgba(255,255,255,0.12); border-radius: 1.2vh; backdrop-filter: blur(20px); }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1.8vh 2.5vh; border-bottom: 0.1vh solid rgba(255,255,255,0.08); flex-shrink: 0; }
.panel-title { display: block; font-size: var(--text-lg); font-weight: 700; color: #fff; }
.panel-subtitle { display: block; margin-top: 0.3vh; font-size: var(--text-xs); color: rgba(255,255,255,0.45); }
.panel-close { width: max(4.5vh, 44px); height: max(4.5vh, 44px); min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.panel-close:active { background: rgba(255,255,255,0.1); }
.wallet-summary { display: flex; align-items: stretch; margin: 1.8vh 2.5vh 1.2vh; padding: 1.6vh 2vh; background: linear-gradient(110deg, rgba(255,215,0,0.12), rgba(96,165,250,0.1)); border: 0.1vh solid rgba(255,215,0,0.18); border-radius: 1vh; flex-shrink: 0; }
.summary-item { flex: 1; min-width: 0; }
.summary-label, .summary-hint { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.52); }
.summary-hint { margin-top: 0.4vh; color: rgba(255,255,255,0.35); }
.summary-value-row { display: flex; align-items: center; gap: 0.8vh; margin-top: 0.5vh; }
.summary-value { font-size: calc(3.1vh * var(--font-scale)); font-weight: 700; color: var(--color-text); white-space: nowrap; }
.summary-value.gold { color: var(--color-gold); }
.summary-divider { width: 0.1vh; margin: 0 2vh; background: rgba(255,255,255,0.12); }
.wallet-tabs { display: flex; margin: 0 2.5vh; border-bottom: 0.1vh solid rgba(255,255,255,0.1); flex-shrink: 0; }
.wallet-tab { flex: 1; padding: 1vh 0; color: rgba(255,255,255,0.45); text-align: center; font-size: var(--text-sm); }
.wallet-tab.active { color: var(--color-gold); border-bottom: 0.25vh solid var(--color-gold); font-weight: 600; }
.panel-body { flex: 1; min-height: 0; padding: 1.5vh 2.5vh 2vh; box-sizing: border-box; }
.action-row { display: flex; gap: 1.2vh; }
.vault-action { flex: 1; min-width: 0; display: flex; align-items: center; gap: 1.2vh; padding: 1.4vh 1.6vh; border-radius: 0.9vh; border: 0.1vh solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); }
.vault-action.deposit { border-color: rgba(74,222,128,0.25); }
.vault-action.withdraw { border-color: rgba(96,165,250,0.25); }
.vault-action:active { background: rgba(255,215,0,0.1); }
.action-title, .action-desc { display: block; }
.action-title { font-size: var(--text-sm); color: #fff; font-weight: 600; }
.action-desc { margin-top: 0.25vh; font-size: var(--text-xs); color: rgba(255,255,255,0.45); }
.section-heading { display: flex; justify-content: space-between; align-items: center; margin: 1.8vh 0 0.8vh; color: rgba(255,255,255,0.72); font-size: var(--text-sm); }
.section-meta, .refresh-link { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }
.refresh-link { color: var(--color-gold); min-height: 44px; min-width: 56px; display: flex; align-items: center; justify-content: center; padding: 0 12px; }
.record-item { display: flex; align-items: center; min-height: 5.8vh; border-bottom: 0.1vh solid rgba(255,255,255,0.06); }
.record-mark { width: 0.7vh; height: 0.7vh; margin-right: 1.2vh; border-radius: 50%; background: var(--color-success); flex-shrink: 0; }
.record-mark.withdraw { background: var(--color-info); }
.record-mark.platform { background: var(--color-gold); }
.record-main { flex: 1; min-width: 0; }
.record-title, .record-time, .record-amount, .record-balance { display: block; }
.record-title { color: rgba(255,255,255,0.85); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-time, .record-balance { margin-top: 0.25vh; color: rgba(255,255,255,0.35); font-size: var(--text-xs); }
.record-side { min-width: 14vh; text-align: right; }
.record-amount { font-size: var(--text-sm); font-weight: 600; color: var(--color-success); }
.record-amount.withdraw { color: var(--color-info); }
.empty-state { padding: 5vh 0; color: rgba(255,255,255,0.35); text-align: center; font-size: var(--text-sm); display: flex; flex-direction: column; align-items: center; gap: 1.2vh; }
.guide-content { display: flex; flex-direction: column; gap: 1vh; }
.guide-card { padding: 1.4vh 1.6vh; border-radius: 0.8vh; background: rgba(255,255,255,0.045); border: 0.1vh solid rgba(255,255,255,0.08); }
.guide-card.safety { background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.25); }
.guide-title, .guide-text { display: block; }
.guide-title { color: #fff; font-size: var(--text-sm); font-weight: 600; }
.guide-text { margin-top: 0.5vh; color: rgba(255,255,255,0.55); font-size: var(--text-xs); line-height: 1.5; }
@media (max-width: 500px) { .wallet-panel { width: 100%; height: min(84vh, 560px); } .wallet-summary { margin-left: 1.5vh; margin-right: 1.5vh; padding: 1.2vh; } .panel-header, .panel-body { padding-left: 1.5vh; padding-right: 1.5vh; } .wallet-tabs { margin-left: 1.5vh; margin-right: 1.5vh; } .action-row { flex-direction: column; } }
</style>

<template>
  <ImmersivePage title="代理工作台" :show-header="true" :scrollable="true" page-class="theme-agent" :page-style="{ '--font-scale': fontScale }">
    <template #header-left>
      <view class="back-btn touch-active" @click="goBack">
        <VIcon name="back" :size="3.3" color="var(--color-text)" />
      </view>
    </template>
    <template #header-right>
      <view class="user-points glass">
        <VIcon name="coin" :size="2.7" color="var(--color-gold)" />
        <text class="points-value">{{ formatPoints(userState.points) }}</text>
      </view>
    </template>

    <!-- 工作台分栏布局 -->
    <view class="workbench-grid">
      <!-- 左侧：收益概览 -->
      <view class="workbench-left">
    <!-- 收益概览 -->
    <view v-if="isTopAgent" class="section">
      <view class="section-header">
        <view class="header-left-group">
          <text class="section-title">收益概览</text>
          <text class="section-subtitle">今日数据</text>
        </view>
      </view>
      <view class="stats-grid">
        <view class="stat-card glass" v-for="(stat, index) in statsData" :key="index">
          <view class="stat-icon" :style="{ background: stat.color }">
            <VIcon :name="stat.iconName" :size="3.3" color="#fff" />
          </view>
          <view class="stat-info">
            <text class="stat-value">{{ stat.value }}</text>
            <text class="stat-label">{{ stat.label }}</text>
          </view>
          <view v-if="stat.trend" class="stat-trend" :class="stat.trend > 0 ? 'trend-up' : 'trend-down'">
            <text>{{ stat.trend > 0 ? '↑' : '↓' }} {{ Math.abs(stat.trend) }}%</text>
          </view>
        </view>
      </view>
    </view>
      </view>

      <!-- 右侧：玩家管理 + 流水记录 -->
      <view class="workbench-right">

    <!-- 玩家管理 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">下线管理</text>
        <view class="header-actions">
          <view class="search-box">
            <VIcon name="search" :size="1.6" color="rgba(255,255,255,0.4)" />
            <input class="search-input" v-model="searchKeyword" placeholder="搜索下线" placeholder-class="search-placeholder" @confirm="searchPlayers" />
          </view>
          <view v-if="canCreateAgent" class="invite-btn touch-active" @click="openCreateAccount('agent')">
            <text>{{ createAgentLabel }}</text>
          </view>
          <view v-if="canCreatePlayer" class="invite-btn touch-active" @click="openCreateAccount('player')">
            <text>新增玩家</text>
          </view>
          <view class="invite-btn touch-active" @click="showInviteCode = true">
            <text>邀请码</text>
          </view>
        </view>
      </view>
      <view class="player-list">
        <view v-for="player in filteredPlayers" :key="player.id" class="player-card glass" @click="showPlayerDetail(player)">
          <view class="player-avatar" :style="{ background: getAvatarColor(player.nickname) }">
            <text class="avatar-text">{{ (player.nickname || player.account || '?').charAt(0) }}</text>
          </view>
          <view class="player-info">
            <text class="player-name">{{ player.nickname || player.account }}</text>
            <text class="player-account">{{ player.account }}</text>
          </view>
          <view class="player-stats">
            <view class="stat-item">
              <text class="stat-num">{{ formatPoints(player.points || 0) }}</text>
              <text class="stat-desc">筹码</text>
            </view>
          </view>
          <view class="player-actions">
            <view v-if="isAdjustableTarget(player)" class="action-btn action-adjust touch-active" @click.stop="adjustPoints(player)">
              <text>调整</text>
            </view>
            <view v-if="isTopAgent && player.role === 'player'" class="action-btn action-promote touch-active" @click.stop="promotePlayer(player)">
              <text>升级</text>
            </view>
            <view v-if="canGenerateInviteCode(player)" class="action-btn action-adjust touch-active" @click.stop="generateInviteForAgent(player)">
              <text>{{ generatingInviteId === player.id ? '生成中...' : '邀请码' }}</text>
            </view>
          </view>
        </view>
        <view v-if="filteredPlayers.length === 0 && !isLoading" class="empty-state">
          <VIcon name="user" :size="5" color="rgba(255,255,255,0.2)" />
          <text class="empty-text">暂无玩家</text>
        </view>
      </view>
    </view>

    <!-- 流水记录 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">流水记录</text>
        <text class="section-link" @click="loadTransactions">刷新</text>
      </view>
      <view class="transaction-list">
        <view v-for="(tx, index) in transactions" :key="tx.id || index" class="transaction-item glass">
          <view class="tx-icon" :class="tx.amount > 0 ? 'in' : 'out'">
            <VIcon :name="tx.amount > 0 ? 'coin' : 'arrow-down'" :size="2.7" :color="tx.amount > 0 ? 'var(--color-success)' : 'var(--color-danger)'" />
          </view>
          <view class="tx-info">
            <text class="tx-title">{{ tx.note || tx.type }}</text>
            <text class="tx-time">{{ tx.time || tx.createdAt }}</text>
          </view>
          <view class="tx-amount" :class="tx.amount > 0 ? 'amount-in' : 'amount-out'">
            <text>{{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}</text>
          </view>
        </view>
        <view v-if="transactions.length === 0 && !isLoading" class="empty-state">
          <VIcon name="coin" :size="5" color="rgba(255,255,255,0.2)" />
          <text class="empty-text">暂无流水记录</text>
        </view>
      </view>
    </view>
      </view>
    </view>

    <view class="bottom-spacing"></view>

    <template #modal>
    <!-- 邀请码弹窗 -->
    <view v-if="showInviteCode" class="modal-overlay" @click="showInviteCode = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">我的邀请码</text>
          <view class="modal-close-btn touch-active" @click="showInviteCode = false">
            <VIcon name="close" :size="2" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="invite-code-display">
          <text class="invite-code">{{ inviteCode || '加载中...' }}</text>
          <view class="copy-btn touch-active" @click="copyInviteCode">
            <text>复制</text>
          </view>
          <view v-if="userRole !== 'admin'" class="copy-btn touch-active" :class="{ disabled: isRegenerating }" @click="regenerateInviteCode">
            <text>{{ isRegenerating ? '生成中...' : '重新生成' }}</text>
          </view>
        </view>
        <view class="invite-tip">
          <text>分享邀请码给玩家，玩家注册后自动成为您的下线</text>
        </view>
      </view>
    </view>

    <!-- 创建下级账号弹窗 -->
    <view v-if="showCreateAccountModal" class="modal-overlay" @click="showCreateAccountModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ createAccountTitle }}</text>
          <view class="modal-close-btn touch-active" @click="showCreateAccountModal = false">
            <VIcon name="close" :size="2" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="adjust-form">
          <view class="form-group">
            <text class="form-label">账号</text>
            <input class="form-input" v-model="createForm.account" placeholder="请输入账号" maxlength="32" />
          </view>
          <view class="form-group">
            <text class="form-label">初始密码</text>
            <input class="form-input" v-model="createForm.password" password placeholder="请输入初始密码" maxlength="64" />
          </view>
          <view v-if="createAccountType === 'player'" class="form-group">
            <text class="form-label">初始筹码</text>
            <input class="form-input" v-model="createForm.points" type="number" placeholder="默认 0" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-ghost touch-active" @click="showCreateAccountModal = false">取消</view>
          <view class="btn-primary touch-active" :class="{ disabled: isCreatingAccount }" @click="submitCreateAccount">
            {{ isCreatingAccount ? '创建中...' : '确认创建' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 调整筹码弹窗 -->
    <view v-if="showAdjustModal" class="modal-overlay" @click="showAdjustModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">调整筹码</text>
          <view class="modal-close-btn touch-active" @click="showAdjustModal = false">
            <VIcon name="close" :size="2" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="adjust-player">
          <text class="adjust-name">{{ adjustTarget?.nickname || adjustTarget?.account }}</text>
          <text class="adjust-current">当前: {{ formatPoints(adjustTarget?.points || 0) }}</text>
        </view>
        <view class="adjust-form">
          <view class="form-group">
            <text class="form-label">调整数量（正数增加，负数扣除）</text>
            <view class="amount-input-group">
              <view class="amount-btn touch-active" @click="adjustAmount -= 10">-10</view>
              <input class="amount-input" type="number" v-model="adjustAmount" placeholder="输入数量" />
              <view class="amount-btn touch-active" @click="adjustAmount += 10">+10</view>
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">调整原因（必填）</text>
            <input class="form-input" v-model="adjustReason" placeholder="请输入原因" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-ghost touch-active" @click="showAdjustModal = false">取消</view>
          <view class="btn-primary touch-active" :class="{ disabled: isAdjusting }" @click="confirmAdjust">
            {{ isAdjusting ? '提交中...' : '确认调整' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 玩家详情弹窗 -->
    <view v-if="showPlayerDetailModal" class="modal-overlay" @click="showPlayerDetailModal = false">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">玩家详情</text>
          <view class="modal-close-btn touch-active" @click="showPlayerDetailModal = false">
            <VIcon name="close" :size="2" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="player-detail-header">
            <view class="player-detail-avatar">
              <text>{{ (selectedPlayer?.nickname || selectedPlayer?.account || 'P').charAt(0).toUpperCase() }}</text>
            </view>
            <view class="player-detail-info">
              <text class="player-detail-name">{{ selectedPlayer?.nickname || selectedPlayer?.account || '未知玩家' }}</text>
              <text class="player-detail-id">ID: {{ selectedPlayer?.id || '-' }}</text>
            </view>
          </view>
          <view class="player-detail-stats">
            <view class="player-stat-card">
              <text class="player-stat-label">当前筹码</text>
              <text class="player-stat-value">{{ selectedPlayer?.points || 0 }}</text>
            </view>
            <view class="player-stat-card">
              <text class="player-stat-label">累计充值</text>
              <text class="player-stat-value">{{ selectedPlayer?.totalRecharge || 0 }}</text>
            </view>
            <view class="player-stat-card">
              <text class="player-stat-label">游戏局数</text>
              <text class="player-stat-value">{{ selectedPlayer?.totalGames || 0 }}</text>
            </view>
            <view class="player-stat-card">
              <text class="player-stat-label">胜率</text>
              <text class="player-stat-value">{{ selectedPlayer?.winRate || '0%' }}</text>
            </view>
          </view>
          <view class="player-detail-section">
            <text class="section-title">基本信息</text>
            <view class="info-row">
              <text class="info-label">账号</text>
              <text class="info-value">{{ selectedPlayer?.account || '-' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">注册时间</text>
              <text class="info-value">{{ selectedPlayer?.createdAt || selectedPlayer?.registerTime || '-' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">最后登录</text>
              <text class="info-value">{{ selectedPlayer?.lastLogin || '-' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">状态</text>
              <text class="info-value" :class="selectedPlayer?.status === 'active' ? 'status-active' : 'status-frozen'">
                {{ selectedPlayer?.status === 'frozen' ? '已冻结' : '正常' }}
              </text>
            </view>
          </view>
          <view class="player-detail-actions">
            <view class="action-btn touch-active" @click="adjustPoints(selectedPlayer)">调整筹码</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 玩家游戏记录弹窗 -->
    <view v-if="showPlayerHistoryModal" class="modal-overlay" @click="showPlayerHistoryModal = false">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">游戏记录 - {{ historyPlayer?.nickname || historyPlayer?.account || '' }}</text>
          <view class="modal-close-btn touch-active" @click="showPlayerHistoryModal = false">
            <VIcon name="close" :size="2" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="history-stats">
            <view class="hist-stat-card">
              <text class="hist-stat-label">总局数</text>
              <text class="hist-stat-value">{{ playerHistoryStats.totalGames || 0 }}</text>
            </view>
            <view class="hist-stat-card">
              <text class="hist-stat-label">胜场</text>
              <text class="hist-stat-value win">{{ playerHistoryStats.wins || 0 }}</text>
            </view>
            <view class="hist-stat-card">
              <text class="hist-stat-label">负场</text>
              <text class="hist-stat-value lose">{{ playerHistoryStats.losses || 0 }}</text>
            </view>
            <view class="hist-stat-card">
              <text class="hist-stat-label">总盈亏</text>
              <text class="hist-stat-value" :class="playerHistoryStats.totalProfit >= 0 ? 'win' : 'lose'">
                {{ playerHistoryStats.totalProfit >= 0 ? '+' : '' }}{{ playerHistoryStats.totalProfit || 0 }}
              </text>
            </view>
          </view>
          <view class="history-list">
            <view v-for="record in playerGameHistory" :key="record.id" class="history-item">
              <view class="history-game-type">
                <text>{{ record.gameType || '-' }}</text>
              </view>
              <view class="history-info">
                <text class="history-room">{{ record.roomName || '房间#' + record.roomId }}</text>
                <text class="history-time">{{ record.time || record.createdAt || '-' }}</text>
              </view>
              <view class="history-result" :class="record.result === 'win' ? 'win' : 'lose'">
                <text>{{ record.result === 'win' ? '+' : '' }}{{ record.profit || record.amount || 0 }}</text>
              </view>
            </view>
            <ListEmpty v-if="playerGameHistory.length === 0" text="{{ gameHistoryUnavailable ? '后端暂未提供该玩家的房间历史接口' : '暂无游戏记录' }}" />
          </view>
        </view>
      </view>
    </view>
    </template>
  </ImmersivePage>
</template>

<script>
import { userState, fetchUserInfo } from '../../store/user.js'
import { formatPoints, formatDateTime } from '../../utils/format.js'
import {
  getAgentPlayers,
  getPromotionData,
  promotePlayer as apiPromotePlayer,
  adjustPlayerChips as apiAdjustPoints,
  adjustPlayerPoints,
  getAgentChipTransactions,
  getInviteCode,
  generateInviteCode,
  createAgent,
  createPlayer,
  generateSubordinateInviteCode,
} from '../../api/agent.js'
import { getMe } from '../../api/auth.js'
import { getFontScale } from '../../utils/fontScale.js'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import VIcon from '../../components/ui/VIcon.vue'

export default {
  name: 'AgentWorkbench',
  components: { ImmersivePage, VIcon },
  data() {
    return {
      userState,
      fontScale: 1.0,
      searchKeyword: '',
      activeTrendTab: 'week',
      showInviteCode: false,
      showCreateAccountModal: false,
      createAccountType: 'player',
      createForm: { account: '', password: '', points: '' },
      showAdjustModal: false,
      adjustTarget: null,
      adjustAmount: 0,
      adjustReason: '',
      inviteCode: '',
      isLoading: false,
      isAdjusting: false,
      isRegenerating: false,
      isCreatingAccount: false,
      generatingInviteId: null,
      trendTabs: [
        { label: '今日', value: 'today' },
        { label: '本周', value: 'week' },
        { label: '本月', value: 'month' },
      ],
      statsData: [
        { iconName: 'coin', label: '今日佣金', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))' },
        { iconName: 'user', label: '下线数量', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-success), var(--color-success))' },
        { iconName: 'cards', label: '今日流水', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-info), var(--color-info))' },
        { iconName: 'more', label: '累计佣金', value: '0', trend: 0, color: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' },
      ],
      chartData: [],
      players: [],
      transactions: [],
      playerPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      transactionPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, loadingMore: { players: false, transactions: false }, noMore: { players: false, transactions: false },
      // 玩家详情
      showPlayerDetailModal: false,
      selectedPlayer: null,
      // 玩家游戏记录
      showPlayerHistoryModal: false,
      historyPlayer: null,
      playerGameHistory: [],
      playerHistoryStats: {},
      gameHistoryUnavailable: false,
      userRole: '',
    }
  },
  computed: {
    isTopAgent() {
      return this.userRole === 'top_agent'
    },
    canCreateAgent() {
      return ['top_agent', 'agent'].includes(this.userRole)
    },
    canCreatePlayer() {
      return ['top_agent', 'agent'].includes(this.userRole)
    },
    createAgentLabel() {
      return this.isTopAgent ? '新增一级代理' : '新增二级代理'
    },
    createAccountTitle() {
      if (this.createAccountType === 'player') return '新增玩家'
      return this.isTopAgent ? '新增一级代理' : '新增二级代理'
    },
    filteredPlayers() {
      if (!this.searchKeyword) return this.players
      const keyword = this.searchKeyword.toLowerCase()
      return this.players.filter(p =>
        (p.nickname || '').toLowerCase().includes(keyword) ||
        (p.account || '').toLowerCase().includes(keyword)
      )
    },
  },
  onLoad() {
    fetchUserInfo()
    this.fontScale = getFontScale()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    this.checkRoleAndLoad()
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
  },
  onPullDownRefresh() {
    this.loadAllData().finally(() => uni.stopPullDownRefresh())
  },
  onReachBottom() {
    if (!this.noMore.players && !this.loadingMore.players) { this.loadingMore.players = true; this.loadPlayers((this.playerPagination?.page || 1) + 1).finally(() => { this.loadingMore.players = false }) }
    if (!this.noMore.transactions && !this.loadingMore.transactions) { this.loadingMore.transactions = true; this.loadTransactions((this.transactionPagination?.page || 1) + 1).finally(() => { this.loadingMore.transactions = false }) }
  },
  methods: {
    formatPoints,
    formatDateTime,
    onFontScaleChange(scale) {
      this.fontScale = scale
    },

    // 角色校验：agent / top_agent 可访问
    async checkRoleAndLoad() {
      try {
        const res = await getMe()
        const role = res.user?.role || res.data?.user?.role
        if (!['agent', 'top_agent', 'admin'].includes(role)) {
          uni.showToast({ title: '无权限访问', icon: 'none' })
          setTimeout(() => uni.reLaunch({ url: '/pages/lobby/lobby' }), 800)
          return
        }
        this.userRole = role
        this.loadAllData()
      } catch (e) {
        console.error('[Workbench] 角色校验失败', e)
        uni.showToast({ title: '登录态失效，请重新登录', icon: 'none' })
        setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
      }
    },

    async loadAllData() {
      this.isLoading = true
      try {
        await Promise.all([
          ...(this.isTopAgent ? [this.loadPromotionData()] : []),
          this.loadPlayers(),
          this.loadTransactions(),
          this.loadInviteCode(),
        ])
      } catch (e) {
        console.error('[Workbench] 加载数据失败', e)
      } finally {
        this.isLoading = false
      }
    },

    async loadPromotionData() {
      try {
        const data = await getPromotionData()
        if (data) {
          this.statsData[0].value = formatPoints(data.todayCommission || 0)
          this.statsData[1].value = data.downlines?.length || 0
          this.statsData[2].value = formatPoints(data.todayFlow || 0)
          this.statsData[3].value = formatPoints(data.totalCommission || 0)
        }
        if (data.daily && data.daily.length > 0) {
          const maxVal = Math.max(...data.daily.map(t => t.commission || 0), 1)
          this.chartData = data.daily.map(t => ({
            label: t.date || '',
            value: t.commission || 0,
            height: Math.max(10, ((t.commission || 0) / maxVal) * 100),
            color: 'linear-gradient(180deg, var(--color-gold), var(--color-gold-dark))',
          }))
        } else {
          this.chartData = ['周一','周二','周三','周四','周五','周六','周日'].map(d => ({
            label: d, value: 0, height: 10, color: 'linear-gradient(180deg, var(--color-gold), var(--color-gold-dark))',
          }))
        }
      } catch (e) {
        console.warn('[Workbench] 推广数据加载失败', e)
      }
    },

    async loadPlayers(page = 1) {
      try {
        const params = { page, pageSize: this.playerPagination.pageSize }
        if (this.searchKeyword.trim()) params.q = this.searchKeyword.trim()
        const data = await getAgentPlayers(params)
        const _pList = Array.isArray(data.data) ? data.data : (data.players || data.list || []); this.players = page > 1 ? [...this.players, ..._pList] : _pList; if (_pList.length < this.playerPagination.pageSize) this.noMore.players = true
        this.playerPagination = data.pagination || { ...this.playerPagination, page }
        if (data.inviteCode) {
          this.inviteCode = data.inviteCode
        }
      } catch (e) {
        console.warn('[Workbench] 玩家列表加载失败', e)
        this.players = []
      }
    },

    async loadTransactions(page = 1) {
      try {
        const data = await getAgentChipTransactions({ page, pageSize: this.transactionPagination.pageSize })
        const _tList = Array.isArray(data.data) ? data.data : (data.items || data.list || []); this.transactions = page > 1 ? [...this.transactions, ..._tList] : _tList; if (_tList.length < this.transactionPagination.pageSize) this.noMore.transactions = true
        this.transactionPagination = data.pagination || { ...this.transactionPagination, page }
      } catch (e) {
        console.warn('[Workbench] 流水记录加载失败', e)
        this.transactions = []
      }
    },

    async loadInviteCode() {
      try {
        const data = await getInviteCode()
        this.inviteCode = data.inviteCode || data.code || ''
      } catch (e) {
        console.warn('[Workbench] 邀请码加载失败', e)
        this.inviteCode = ''
      }
    },

    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.reLaunch({ url: '/pages/lobby/lobby' })
      }
    },

    getAvatarColor(name) {
      const colors = [
        'linear-gradient(135deg, var(--theme-primary), #764ba2)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #43e97b, var(--color-info))',
        'linear-gradient(135deg, #fa709a, var(--color-gold))',
      ]
      let hash = 0
      for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
      }
      return colors[Math.abs(hash) % colors.length]
    },

    showPlayerDetail(player) {
      this.selectedPlayer = player
      this.showPlayerDetailModal = true
    },

    viewPlayerHistory(player) {
      this.historyPlayer = player
      this.showPlayerHistoryModal = true
      this.loadPlayerGameHistory()
    },

    loadPlayerGameHistory() {
      this.playerGameHistory = []
      this.playerHistoryStats = {}
      this.gameHistoryUnavailable = true
    },

    adjustPoints(player) {
      if (!this.isAdjustableTarget(player)) return
      this.adjustTarget = player
      this.adjustAmount = 0
      this.adjustReason = ''
      this.showAdjustModal = true
    },

    openCreateAccount(type) {
      if (type === 'agent' && !this.canCreateAgent) return
      if (type === 'player' && !this.canCreatePlayer) return
      this.createAccountType = type
      this.createForm = { account: '', password: '', points: '' }
      this.showCreateAccountModal = true
    },

    async submitCreateAccount() {
      if (this.isCreatingAccount) return
      const account = this.createForm.account.trim()
      const password = this.createForm.password
      if (!account || !password) {
        uni.showToast({ title: '请填写账号和初始密码', icon: 'none' })
        return
      }

      const isAgent = this.createAccountType === 'agent'
      if ((isAgent && !this.canCreateAgent) || (!isAgent && !this.canCreatePlayer)) {
        uni.showToast({ title: '无创建权限', icon: 'none' })
        return
      }

      const points = this.createForm.points === '' ? 0 : Number(this.createForm.points)
      if (!Number.isFinite(points) || points < 0 || !Number.isInteger(points)) {
        uni.showToast({ title: '初始筹码必须为非负整数', icon: 'none' })
        return
      }

      this.isCreatingAccount = true
      try {
        const data = isAgent
          ? await createAgent({ account, password, role: 'agent' })
          : await createPlayer({ account, password, points })
        const user = data.user || data.data?.user || data.data || data
        const userId = user.id || user.userId
        let inviteCode = ''
        if (isAgent && userId) {
          try {
            const invite = await generateSubordinateInviteCode(userId)
            inviteCode = invite.inviteCode || invite.code || invite.data?.inviteCode || ''
          } catch (e) {
            console.warn('[Workbench] 下级代理邀请码生成失败', e)
          }
        }
        this.showCreateAccountModal = false
        await this.loadPlayers(1)
        uni.showModal({
          title: '创建成功',
          content: inviteCode ? `账号：${account}\n邀请码：${inviteCode}` : `账号 ${account} 已创建`,
          showCancel: false,
          confirmText: '知道了',
        })
      } catch (e) {
        uni.showToast({ title: e.error || e.message || '创建失败', icon: 'none' })
      } finally {
        this.isCreatingAccount = false
      }
    },

    canGenerateInviteCode(player) {
      if (player?.role !== 'agent' || !player.id) return false
      const level = Number(player.agentLevel ?? player.level)
      if (this.userRole === 'top_agent') return level === 1
      if (this.userRole === 'agent') return level === 2
      return false
    },

    async generateInviteForAgent(agent) {
      if (!this.canGenerateInviteCode(agent) || this.generatingInviteId) return
      this.generatingInviteId = agent.id
      try {
        const data = await generateSubordinateInviteCode(agent.id)
        const code = data.inviteCode || data.code || data.data?.inviteCode
        if (!code) throw new Error('邀请码返回无效')
        uni.showModal({
          title: `${agent.nickname || agent.account} 的邀请码`,
          content: code,
          confirmText: '复制',
          success: (res) => {
            if (res.confirm) uni.setClipboardData({ data: code })
          },
        })
      } catch (e) {
        uni.showToast({ title: e.error || e.message || '生成失败', icon: 'none' })
      } finally {
        this.generatingInviteId = null
      }
    },

    async confirmAdjust() {
      if (!this.adjustAmount || parseInt(this.adjustAmount) === 0) {
        uni.showToast({ title: '请输入有效数量', icon: 'none' })
        return
      }
      if (!this.adjustReason.trim()) {
        uni.showToast({ title: '请输入调整原因', icon: 'none' })
        return
      }
      if (Math.abs(parseInt(this.adjustAmount)) > 1000000) {
        uni.showToast({ title: '单次调整不能超过100万', icon: 'none' })
        return
      }
      if (parseInt(this.adjustAmount) > this.userState.points) {
        uni.showToast({ title: '账户余额不足', icon: 'none' })
        return
      }
      this.isAdjusting = true
      try {
        const adjust = this.adjustTarget.role === 'agent' ? adjustPlayerPoints : apiAdjustPoints
        await adjust(this.adjustTarget.id, parseInt(this.adjustAmount), this.adjustReason)
        uni.showToast({ title: '调整成功', icon: 'success' })
        this.showAdjustModal = false
        this.loadPlayers()
        this.loadTransactions()
      } catch (e) {
        uni.showToast({ title: e.error || '调整失败', icon: 'none' })
      } finally {
        this.isAdjusting = false
      }
    },

    promotePlayer(player) {
      if (!this.isTopAgent) return
      uni.showModal({
        title: '升级代理',
        content: `确定将 ${player.nickname || player.account} 升级为代理吗？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await apiPromotePlayer(player.id)
              uni.showToast({ title: '升级成功', icon: 'success' })
              this.loadPlayers()
            } catch (e) {
              uni.showToast({ title: e.error || '升级失败', icon: 'none' })
            }
          }
        }
      })
    },
    isAgentTarget(player) {
      return player?.role === 'agent'
    },
    isPlayerTarget(player) {
      return player?.role === 'player'
    },
    isAdjustableTarget(player) {
      // 代理工作台下线列表均为玩家，只要有有效ID即可调整
      return !!player?.id
    },
    async regenerateInviteCode() {
      if (this.isRegenerating) return
      this.isRegenerating = true
      try {
        const data = await generateInviteCode()
        this.inviteCode = data.inviteCode || data.code || ''
        if (!this.inviteCode) throw new Error('邀请码返回无效')
        uni.showToast({ title: '邀请码已更新', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || e.message || '生成失败', icon: 'none' })
      } finally {
        this.isRegenerating = false
      }
    },

    searchPlayers() {
      this.loadPlayers(1)
    },

    copyInviteCode() {
      if (!this.inviteCode) {
        uni.showToast({ title: '邀请码未获取', icon: 'none' })
        return
      }
      uni.setClipboardData({
        data: this.inviteCode,
        success: () => {
          uni.showToast({ title: '已复制', icon: 'success' })
        }
      })
    },
  },
}
</script>

<style lang="scss" scoped>
/* 字体放大：覆盖全局小字体变量，保证手机上按钮文字清晰可见（对齐大厅规格） */
:deep(.section-title) { font-size: max(var(--text-base), 16px) !important; }
:deep(.section-subtitle) { font-size: max(var(--text-sm), 13px) !important; }
:deep(.stat-value) { font-size: max(var(--text-lg), 18px) !important; }
:deep(.stat-label) { font-size: max(var(--text-xs), 12px) !important; }
:deep(.player-name) { font-size: max(var(--text-base), 16px) !important; }
:deep(.player-account) { font-size: max(var(--text-sm), 13px) !important; }
:deep(.stat-num) { font-size: max(var(--text-base), 15px) !important; }
:deep(.stat-desc) { font-size: max(var(--text-xs), 12px) !important; }
:deep(.action-btn) { font-size: max(var(--text-sm), 14px) !important; min-height: 44px; }
:deep(.transaction-item) { font-size: max(var(--text-sm), 13px) !important; }
:deep(.modal-title) { font-size: max(var(--text-base), 17px) !important; }
:deep(.form-label) { font-size: max(var(--text-sm), 14px) !important; }
:deep(.points-value) { font-size: max(var(--text-base), 15px) !important; }
:deep(.invite-code) { font-size: max(var(--text-lg), 18px) !important; }

.theme-agent {
  --primary-color: var(--color-gold);
  --primary-gradient: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  background: radial-gradient(ellipse at top right, rgba(255, 191, 0, 0.08) 0%, transparent 50%),
              linear-gradient(180deg, #1a1508 0%, var(--color-bg) 100%) !important;
}

/* 工作台左右分栏布局 */
.workbench-grid {
  display: flex;
  gap: 3vh;
  padding: 2vh 0;
}

.workbench-left {
  width: 35%;
  min-width: 28vh;
  flex-shrink: 0;
}

.workbench-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3vh;
}

/* 响应式：窄屏时改为垂直布局 */
@media (max-width: 900px) {
  .workbench-grid {
    flex-direction: column;
    gap: 2vh;
  }
  .workbench-left {
    width: 100%;
    min-width: 0;
  }
  .stats-grid, .history-stats { grid-template-columns: repeat(2, 1fr); }
  .section-header { align-items: flex-start; gap: 1vh; }
  .header-actions { flex-wrap: wrap; justify-content: flex-end; }
}

.back-btn {
  width: 4.5vh;
  height: max(4.5vh, 44px);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
}

.user-points {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.8vh 1.2vw;
  border-radius: 2vh;
  border: 1px solid rgba(255, 191, 0, 0.2);
}

.points-value {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-gold);
}

.section { margin-bottom: 2.5vh; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5vh;
}
.header-left-group {
  display: flex;
  align-items: baseline;
  gap: 0.8vw;
}
.section-title { font-size: var(--text-sm); font-weight: 700; color: var(--color-text); }
.section-subtitle { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }
.section-link { font-size: var(--text-xs); color: var(--color-gold); }

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.2vw;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 1.8vh 1.2vw;
  border-radius: 1.2vh;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 191, 0, 0.1);
}

.stat-icon {
  width: 5vh;
  height: 5vh;
  min-width: 36px;
  min-height: 36px;
  border-radius: 1vh;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 1vw;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value { font-size: var(--text-lg); font-weight: 700; color: var(--color-text); }
.stat-label { font-size: var(--text-xs); color: rgba(255,255,255,0.5); }

.stat-trend {
  position: absolute;
  top: 0.8vh;
  right: 0.8vw;
  font-size: var(--text-xs);
  padding: 0.3vh 0.6vw;
  border-radius: 0.4vh;
}
.trend-up { color: var(--color-success); background: rgba(74, 222, 128, 0.1); }
.trend-down { color: var(--color-danger); background: rgba(255, 107, 107, 0.1); }

/* 趋势图 */
.tab-group {
  display: flex;
  gap: 0.4vw;
  background: rgba(255,255,255,0.05);
  padding: 0.3vh;
  border-radius: 0.6vh;
}
.tab-item {
  padding: 0.5vh 1vw;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.5);
  border-radius: 0.4vh;
  transition: all 0.2s;
}
.tab-item.active { background: rgba(255, 191, 0, 0.2); color: var(--color-gold); }

.chart-card {
  padding: 2vh 1.5vw;
  border-radius: 1.2vh;
  border: 1px solid rgba(255, 191, 0, 0.1);
}

.chart-container {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 14vh;
  gap: 0.5vw;
}

.chart-bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.chart-bar {
  width: 100%;
  max-width: 2.5vw;
  border-radius: 0.4vh 0.4vh 0 0;
  position: relative;
  transition: height 0.5s ease;
  margin-top: auto;
}

.bar-value {
  position: absolute;
  top: -2vh;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--text-xs);
  color: var(--color-gold);
  white-space: nowrap;
}

.bar-label {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
  margin-top: 0.5vh;
}

/* 玩家管理 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.8vw;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.05);
  border-radius: 1.5vh;
  padding: 0.6vh 1vw;
  gap: 0.4vw;
}

.search-input {
  width: max(10vw, 140px);
  font-size: var(--text-sm);
  color: var(--color-text);
}

.search-placeholder {
  color: rgba(255,255,255,0.3);
}

.invite-btn {
  padding: 0.6vh 1vw;
  background: rgba(255, 191, 0, 0.15);
  border: 1px solid rgba(255, 191, 0, 0.3);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: var(--color-gold);
}

.player-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.2vh;
}

/* 响应式：窄屏时改为单列 */
@media (max-width: 900px) {
  .player-list {
    grid-template-columns: 1fr;
  }
}

.player-card {
  display: flex;
  align-items: center;
  padding: 1.5vh 1.2vw;
  border-radius: 1.2vh;
  gap: 1vw;
  border: 1px solid rgba(255, 191, 0, 0.08);
  transition: all 0.15s;
  min-height: 8vh;
}

.player-card:active { transform: scale(0.98); }

.player-avatar {
  width: 5.5vh;
  height: 5.5vh;
  min-width: 40px;
  min-height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: var(--text-sm);
  font-weight: 700;
  color: #fff;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
  min-width: 0;
}

.player-name { font-size: var(--text-base); font-weight: 600; color: var(--color-text); }
.player-account { font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

.player-stats {
  display: flex;
  gap: 1.5vw;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num { font-size: var(--text-base); font-weight: 600; color: var(--color-gold); }
.stat-desc { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.player-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5vh;
}

.action-btn {
  padding: 0 1.2vw;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.4vh;
  font-size: var(--text-sm);
  text-align: center;
  white-space: nowrap;
}

.action-adjust {
  background: rgba(255, 191, 0, 0.15);
  color: var(--color-gold);
  border: 1px solid rgba(255, 191, 0, 0.3);
}

.action-promote {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-success);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4vh 0;
  gap: 1vh;
}

.empty-text {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
}

/* 流水记录 */
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
}

.transaction-item {
  display: flex;
  align-items: center;
  padding: 1.5vh 1.2vw;
  border-radius: 1vh;
  gap: 1vw;
  border: 1px solid rgba(255,255,255,0.06);
  transition: all 0.15s;
  min-height: 7vh;
}

.transaction-item:active { transform: scale(0.98); }

.tx-icon {
  width: 4.5vh;
  height: max(4.5vh, 44px);
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tx-icon.in { background: rgba(74, 222, 128, 0.15); }
.tx-icon.out { background: rgba(255, 107, 107, 0.15); }

.tx-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
  min-width: 0;
}

.tx-title { font-size: var(--text-sm); color: var(--color-text); }
.tx-time { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.tx-amount {
  font-size: var(--text-base);
  font-weight: 700;
  flex-shrink: 0;
}

.amount-in { color: var(--color-success); }
.amount-out { color: var(--color-danger); }

.bottom-spacing { height: 3vh; }

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: calc(1.5vh + var(--safe-top, 0px)) calc(1.5vh + var(--safe-right, 0px)) calc(1.5vh + var(--safe-bottom, 0px)) calc(1.5vh + var(--safe-left, 0px));
  box-sizing: border-box;
}

.modal-content {
  width: min(80vw, 560px);
  max-width: 100%;
  min-width: 0;
  max-height: 100%;
  padding: 2.5vh 2vw;
  border-radius: 1.5vh;
  border: 1px solid rgba(255, 191, 0, 0.15);
  box-sizing: border-box;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .modal-content, .modal-content.modal-large { width: 100%; max-width: 100%; padding: 2vh 4vw; }
  .invite-code-display, .adjust-player { flex-wrap: wrap; gap: 1vh; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2vh;
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-gold);
}

.modal-close-btn {
  width: max(4vh, 44px);
  height: max(4vh, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border-radius: 50%;
}

.invite-code-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1vw;
  padding: 2.5vh 2vw;
  background: rgba(255, 191, 0, 0.1);
  border: 2px dashed rgba(255, 191, 0, 0.4);
  border-radius: 1vh;
  margin-bottom: 1.5vh;
}

.invite-code {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-gold);
  letter-spacing: 0.3vw;
}

.copy-btn {
  padding: 0.6vh 1.5vw;
  background: rgba(255, 191, 0, 0.2);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: var(--color-gold);
}

.invite-tip {
  text-align: center;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.5);
  line-height: 1.5;
}

/* 调整筹码 */
.adjust-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5vh 1.2vw;
  background: rgba(255,255,255,0.05);
  border-radius: 1vh;
  margin-bottom: 2vh;
}

.adjust-name { font-size: var(--text-base); font-weight: 600; color: var(--color-text); }
.adjust-current { font-size: var(--text-sm); color: var(--color-gold); }

.adjust-form { margin-bottom: 2vh; }
.form-group { margin-bottom: 1.5vh; }
.form-label {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.7);
  margin-bottom: 0.8vh;
}

.amount-input-group {
  display: flex;
  align-items: center;
  gap: 0.8vw;
}

.amount-btn {
  padding: 0.8vh 1.2vw;
  background: rgba(255, 191, 0, 0.15);
  border: 1px solid rgba(255, 191, 0, 0.3);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: var(--color-gold);
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.amount-input {
  flex: 1;
  height: max(4.5vh, 44px);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 0.6vh;
  padding: 0 1vw;
  font-size: var(--text-sm);
  color: var(--color-text);
  text-align: center;
}

.form-input {
  width: 100%;
  height: max(4.5vh, 44px);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 0.6vh;
  padding: 0 1vw;
  font-size: var(--text-sm);
  color: var(--color-text);
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  gap: 1vw;
}

.btn-ghost, .btn-primary {
  flex: 1;
  height: 5vh;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
  border-radius: 0.8vh;
  transition: all 0.2s;
}

.btn-ghost {
  background: rgba(255,255,255,0.08);
  color: var(--color-text);
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  font-weight: 700;
}

.btn-primary:active { transform: scale(0.98); }
.btn-primary.disabled { opacity: 0.5; pointer-events: none; }

/* 玩家详情弹窗样式 */
.player-detail-header {
  display: flex;
  align-items: center;
  gap: 1.5vw;
  padding-bottom: 2vh;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 2vh;
}

.player-detail-avatar {
  width: 6vh;
  height: 6vh;
  min-width: 48px;
  min-height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.player-detail-avatar text {
  font-size: var(--text-lg);
  color: var(--color-bg-card);
  font-weight: 700;
}

.player-detail-info { flex: 1; min-width: 0; }
.player-detail-name { display: block; font-size: var(--text-sm); font-weight: 700; color: var(--color-border); margin-bottom: 0.3vh; }
.player-detail-id { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.player-detail-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1vw;
  margin-bottom: 2vh;
}

.player-stat-card {
  padding: 1.5vh 1vw;
  border-radius: 1vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  text-align: center;
}

.player-stat-label {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
  margin-bottom: 0.5vh;
}

.player-stat-value {
  display: block;
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-gold);
}

.player-detail-section {
  margin-bottom: 2vh;
}

.player-detail-section .section-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-border);
  margin-bottom: 1.5vh;
  padding-bottom: 0.8vh;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 1vh 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.info-label { font-size: var(--text-sm); color: rgba(255,255,255,0.5); }
.info-value { font-size: var(--text-sm); color: var(--color-border); }

.status-active { color: var(--color-success) !important; }
.status-frozen { color: var(--color-danger) !important; }

.player-detail-actions {
  display: flex;
  gap: 1vw;
}

.player-detail-actions .action-btn {
  flex: 1;
  padding: 1.2vh;
  text-align: center;
  border-radius: 0.8vh;
  font-size: var(--text-base);
  font-weight: 600;
  background: rgba(255,191,0,0.15);
  border: 1px solid rgba(255,191,0,0.3);
  color: var(--color-gold);
}

/* 游戏记录弹窗样式 */
.history-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1vw;
  margin-bottom: 2vh;
}

.hist-stat-card {
  padding: 1.5vh 1vw;
  border-radius: 1vh;
  background: rgba(255,191,0,0.1);
  border: 1px solid rgba(255,191,0,0.2);
  text-align: center;
}

.hist-stat-label { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); margin-bottom: 0.5vh; }
.hist-stat-value { display: block; font-size: var(--text-base); font-weight: 700; color: var(--color-border); }
.hist-stat-value.win { color: var(--color-success); }
.hist-stat-value.lose { color: var(--color-danger); }

.history-list { display: flex; flex-direction: column; gap: 1vh; }

.history-item {
  display: flex;
  align-items: center;
  gap: 1vw;
  padding: 1.5vh 1.2vw;
  border-radius: 1vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}

.history-game-type {
  padding: 0.5vh 1vw;
  background: rgba(255,191,0,0.15);
  border-radius: 0.5vh;
  font-size: var(--text-xs);
  color: var(--color-gold);
  flex-shrink: 0;
}

.history-info { flex: 1; min-width: 0; }
.history-room { display: block; font-size: var(--text-sm); color: var(--color-border); margin-bottom: 0.3vh; }
.history-time { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.history-result { font-size: var(--text-base); font-weight: 700; flex-shrink: 0; }
.history-result.win { color: var(--color-success); }
.history-result.lose { color: var(--color-danger); }

.empty-list { display: flex; align-items: center; justify-content: center; padding: 3vh 0; }
.empty-text { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }
</style>

<template>
  <ImmersivePage title="客服工作台" :show-header="true" :scrollable="false" page-class="theme-cs" :page-style="{ '--font-scale': fontScale }">
    <template #header-left>
      <view class="back-btn" @click="goBack">
        <VIcon name="back" :size="3.3" color="var(--color-text)" />
      </view>
    </template>
    <template #header-right>
      <view class="header-right-actions">
        <view class="msg-btn" @click="openMsgCenter">
          <VIcon name="warning" :size="3" color="var(--color-text)" />
          <view v-if="msgUnreadCount > 0" class="msg-dot">{{ msgUnreadCount > 99 ? '99+' : msgUnreadCount }}</view>
        </view>
        <view class="online-badge">
          <view class="online-dot"></view>
          <text class="online-text">在线</text>
        </view>
      </view>
    </template>

    <!-- 管理员 Tab 切换 -->
    <view v-if="isAdmin" class="admin-tabs">
      <view class="admin-tab" :class="{ active: activeWorkTab === 'workspace' }" @click="activeWorkTab = 'workspace'">
        <text>客服工作台</text>
      </view>
      <view class="admin-tab" :class="{ active: activeWorkTab === 'audit' }" @click="switchToAudit">
        <text>聊天审计</text>
      </view>
    </view>

    <!-- 工作台内容 -->
    <view v-show="activeWorkTab === 'workspace'" class="workspace-content">
    <!-- 今日统计栏 -->
    <view class="stats-bar glass">
      <view class="stat-item">
        <text class="stat-label">今日操作</text>
        <text class="stat-value">{{ todayStats.totalOps }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">今日上分</text>
        <text class="stat-value stat-add">+{{ formatPoints(todayStats.totalAdd) }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">今日下分</text>
        <text class="stat-value stat-sub">-{{ formatPoints(todayStats.totalSub) }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">净变动</text>
        <text class="stat-value" :class="todayStats.netChange >= 0 ? 'stat-add' : 'stat-sub'">
          {{ todayStats.netChange >= 0 ? '+' : '' }}{{ formatPoints(todayStats.netChange) }}
        </text>
      </view>
    </view>

    <!-- 双栏布局 -->
    <view class="main-content">
      <!-- 左侧：玩家列表 -->
      <view class="left-panel glass">
        <view class="panel-header">
          <text class="panel-title">玩家列表</text>
          <view class="search-box">
            <VIcon name="search" :size="1.5" color="rgba(255,255,255,0.4)" />
            <input class="search-input" v-model="searchKeyword" placeholder="搜索账号/昵称" placeholder-class="search-placeholder" @confirm="onSearch" />
            <view class="search-btn" @click="onSearch">
              <text>{{ isSearching ? '...' : '搜索' }}</text>
            </view>
          </view>
        </view>
          <scroll-view class="player-list" scroll-y>
          <view v-for="player in filteredPlayers" :key="player.id" class="player-item" :class="{ active: selectedPlayer?.id === player.id }" @click="selectPlayer(player)">
            <view class="player-avatar" :style="{ background: getAvatarColor(player.nickname) }">
              <text class="avatar-text">{{ (player.nickname || player.account || '?').charAt(0) }}</text>
            </view>
            <view class="player-info">
              <view class="player-name-row">
                <text class="player-name">{{ player.nickname || player.account }}</text>
                <view class="status-dot" :class="player.isOnline ? 'online' : 'offline'"></view>
              </view>
              <text class="player-account">{{ player.account }}</text>
            </view>
            <view class="player-points">
              <text class="points-num">{{ formatPoints(player.points || 0) }}</text>
            </view>
          </view>
            <view v-if="filteredPlayers.length === 0 && !isLoading" class="empty-list">
              <text class="empty-text">暂无玩家</text>
            </view>
          </scroll-view>
          <PaginationBar :pagination="playerPagination" @change="loadPlayers" />
      </view>

      <!-- 右侧：玩家详情+操作流水 -->
      <view class="right-panel">
        <!-- 玩家详情 -->
        <view v-if="selectedPlayer" class="detail-section glass">
          <view class="detail-header">
            <view class="detail-avatar" :style="{ background: getAvatarColor(selectedPlayer.nickname) }">
              <text class="detail-avatar-text">{{ (selectedPlayer.nickname || selectedPlayer.account || '?').charAt(0) }}</text>
            </view>
            <view class="detail-info">
              <text class="detail-name">{{ selectedPlayer.nickname || selectedPlayer.account }}</text>
              <text class="detail-account">{{ selectedPlayer.account }}</text>
              <view class="detail-tags">
                <text class="tag tag-role">{{ selectedPlayer.role === 'agent' ? '代理' : '玩家' }}</text>
                <text class="tag tag-status" :class="selectedPlayer.isOnline ? 'online' : 'offline'">
                  {{ selectedPlayer.isOnline ? '在线' : '离线' }}
                </text>
                <text v-if="selectedPlayer.isFrozen" class="tag tag-frozen">已冻结</text>
              </view>
            </view>
            <view class="detail-points">
              <text class="points-label">当前筹码</text>
              <text class="points-value">{{ formatPoints(selectedPlayer.points || 0) }}</text>
            </view>
          </view>

          <!-- 快捷操作 -->
          <view class="quick-actions">
            <view class="action-card" @click="showAdjustModal = true">
              <VIcon name="coin" :size="3.8" color="var(--color-info)" />
              <text class="action-text">调整筹码</text>
            </view>
          </view>
        </view>

        <!-- 未选择玩家提示 -->
        <view v-else class="empty-detail glass">
          <VIcon name="user" :size="6" color="rgba(255,255,255,0.15)" />
          <text class="empty-text">请选择左侧玩家查看详情</text>
        </view>

        <!-- 操作流水时间线 -->
        <view class="timeline-section glass">
          <view class="timeline-header">
            <text class="timeline-title">操作流水</text>
            <view class="timeline-filter">
              <text v-for="filter in timelineFilters" :key="filter.value" class="filter-item" :class="{ active: activeFilter === filter.value }" @click="setTimelineFilter(filter.value)">{{ filter.label }}</text>
            </view>
          </view>
          <scroll-view class="timeline-list" scroll-y>
            <view v-for="(record, index) in filteredTimeline" :key="record.id || index" class="timeline-item">
              <view class="timeline-dot" :class="record.type"></view>
              <view class="timeline-line" v-if="index < filteredTimeline.length - 1"></view>
              <view class="timeline-content">
                <view class="timeline-top">
                  <text class="timeline-action">{{ record.action || record.type }}</text>
                  <text class="timeline-amount" :class="(record.amount || 0) > 0 ? 'amount-in' : 'amount-out'">
                    {{ (record.amount || 0) > 0 ? '+' : '' }}{{ record.amount || 0 }}
                  </text>
                </view>
                <view class="timeline-bottom">
                  <text class="timeline-operator">操作人: {{ record.operator || record.operatorName }}</text>
                  <text class="timeline-time">{{ record.time || record.createdAt }}</text>
                </view>
                <text v-if="record.reason" class="timeline-reason">原因: {{ record.reason }}</text>
              </view>
            </view>
            <view v-if="filteredTimeline.length === 0 && !isLoading" class="empty-timeline">
              <text class="empty-text">暂无操作记录</text>
            </view>
          </scroll-view>
          <PaginationBar :pagination="timelinePagination" @change="loadTimeline" />
        </view>
      </view>
    </view>

    </view><!-- /workspace -->

    <!-- 管理员聊天审计面板 -->
    <view v-show="activeWorkTab === 'audit'" class="audit-panel">
      <!-- 统计卡片 -->
      <view class="audit-stats">
        <view v-for="cs in auditStats" :key="cs.id" class="audit-stat-card glass">
          <view class="audit-stat-header">
            <view class="audit-stat-avatar">
              <image class="audit-stat-avatar-img" src="https://static.yefeng.us.cc/static/images/cs-avatar.png" mode="aspectFill" />
            </view>
            <text class="audit-stat-name">{{ cs.nickname || cs.account }}</text>
            <view class="audit-stat-online" :class="{ online: cs.lastActive }">
              <text>{{ cs.lastActive ? '活跃' : '离线' }}</text>
            </view>
          </view>
          <view class="audit-stat-grid">
            <view class="audit-stat-item">
              <text class="audit-stat-label">活跃会话</text>
              <text class="audit-stat-value">{{ cs.activeSessions }}</text>
            </view>
            <view class="audit-stat-item">
              <text class="audit-stat-label">发送消息</text>
              <text class="audit-stat-value">{{ cs.messagesSent }}</text>
            </view>
            <view class="audit-stat-item">
              <text class="audit-stat-label">收到消息</text>
              <text class="audit-stat-value">{{ cs.messagesReceived }}</text>
            </view>
            <view class="audit-stat-item">
              <text class="audit-stat-label">筹码申请</text>
              <text class="audit-stat-value">{{ cs.chipRequestsReceived }}</text>
            </view>
            <view class="audit-stat-item">
              <text class="audit-stat-label">已处理</text>
              <text class="audit-stat-value processed">{{ cs.chipRequestsProcessed }}</text>
            </view>
          </view>
        </view>
        <view v-if="auditStats.length === 0" class="audit-empty">
          <text>暂无客服数据</text>
        </view>
      </view>

      <!-- 筛选条件 -->
      <view class="audit-filters glass">
        <view class="audit-filter-row">
          <input class="audit-filter-input" v-model="auditFilter.csId" type="number" placeholder="客服 ID" />
          <input class="audit-filter-input" v-model="auditFilter.keyword" placeholder="搜索关键词" />
          <input class="audit-filter-input" v-model="auditFilter.startDate" placeholder="开始日期 YYYY-MM-DD" />
          <input class="audit-filter-input" v-model="auditFilter.endDate" placeholder="结束日期 YYYY-MM-DD" />
        </view>
        <view class="audit-filter-row">
          <view class="audit-filter-btn" @click="loadAuditMessages">
            <text>查询</text>
          </view>
          <view class="audit-filter-btn reset" @click="resetAuditFilter">
            <text>重置</text>
          </view>
        </view>
      </view>

      <!-- 聊天记录列表 -->
      <view class="audit-messages glass">
        <view class="audit-messages-header">
          <text class="audit-messages-title">聊天记录</text>
        </view>
        <scroll-view class="audit-messages-list" scroll-y>
          <view v-for="msg in auditMessages" :key="msg.id" class="audit-msg-item">
            <view class="audit-msg-meta">
              <text class="audit-msg-sender">{{ messageParticipantLabel(msg.senderId, msg.senderRole) }}</text>
              <text class="audit-msg-arrow">→</text>
              <text class="audit-msg-receiver">{{ messageParticipantLabel(msg.receiverId, msg.receiverRole) }}</text>
              <text class="audit-msg-time">{{ formatAuditTime(msg.createdAt) }}</text>
            </view>
            <view class="audit-msg-content" :class="'type-' + msg.type">
              <text>{{ msg.content }}</text>
            </view>
            <view v-if="msg.relatedData" class="audit-msg-related">
              <text>{{ JSON.stringify(msg.relatedData) }}</text>
            </view>
          </view>
          <view v-if="auditMessages.length === 0 && !auditLoading" class="audit-empty">
            <text>暂无聊天记录</text>
          </view>
          <view v-if="auditLoading" class="audit-empty">
            <text>加载中...</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <template #modal>
    <!-- 调整筹码弹窗 -->
    <view v-if="showAdjustModal" class="modal-overlay" @click="showAdjustModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">调整玩家筹码</text>
          <view class="modal-close-btn" @click="showAdjustModal = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="adjust-info">
          <text class="adjust-name">{{ selectedPlayer?.nickname || selectedPlayer?.account }}</text>
          <text class="adjust-current">当前: {{ formatPoints(selectedPlayer?.points || 0) }}</text>
        </view>
        <view class="adjust-form">
          <view class="form-group">
            <text class="form-label">调整类型</text>
            <view class="type-group">
              <view class="type-btn" :class="{ active: adjustType === 'add' }" @click="adjustType = 'add'">
                <text>增加</text>
              </view>
              <view class="type-btn" :class="{ active: adjustType === 'deduct' }" @click="adjustType = 'deduct'">
                <text>扣除</text>
              </view>
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">调整数量</text>
            <input class="form-input" type="number" v-model="adjustAmount" placeholder="请输入数量" />
          </view>
          <view class="form-group">
            <text class="form-label">调整原因（必填）</text>
            <textarea class="form-textarea" v-model="adjustReason" placeholder="请详细说明调整原因，便于对账" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-cancel" @click="showAdjustModal = false">取消</view>
          <view class="btn-confirm" :class="{ disabled: isAdjusting }" @click="confirmAdjust">
            {{ isAdjusting ? '提交中...' : '确认调整' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 游戏记录弹窗 -->
    <view v-if="showGameHistoryModal" class="modal-overlay" @click="showGameHistoryModal = false">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">游戏记录 - {{ selectedPlayer?.nickname || selectedPlayer?.account || '' }}</text>
          <view class="modal-close-btn" @click="showGameHistoryModal = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="history-stats">
            <view class="hist-stat-card">
              <text class="hist-stat-label">总局数</text>
              <text class="hist-stat-value">{{ gameHistoryStats.totalGames || 0 }}</text>
            </view>
            <view class="hist-stat-card">
              <text class="hist-stat-label">胜场</text>
              <text class="hist-stat-value win">{{ gameHistoryStats.wins || 0 }}</text>
            </view>
            <view class="hist-stat-card">
              <text class="hist-stat-label">负场</text>
              <text class="hist-stat-value lose">{{ gameHistoryStats.losses || 0 }}</text>
            </view>
            <view class="hist-stat-card">
              <text class="hist-stat-label">总盈亏</text>
              <text class="hist-stat-value" :class="gameHistoryStats.totalProfit >= 0 ? 'win' : 'lose'">
                {{ gameHistoryStats.totalProfit >= 0 ? '+' : '' }}{{ gameHistoryStats.totalProfit || 0 }}
              </text>
            </view>
          </view>
          <view class="history-list">
            <view v-for="record in playerGameHistory" :key="record.id" class="history-item">
              <view class="history-game-type">
                <text>{{ formatGameType(record.gameType) || '-' }}</text>
              </view>
              <view class="history-info">
                <text class="history-room">{{ record.roomName || '房间#' + record.roomId }}</text>
                <text class="history-time">{{ record.time || record.createdAt || '-' }}</text>
              </view>
              <view class="history-result" :class="record.result === 'win' ? 'win' : 'lose'">
                <text>{{ record.result === 'win' ? '+' : '' }}{{ record.profit || record.amount || 0 }}</text>
              </view>
            </view>
            <view v-if="playerGameHistory.length === 0" class="empty-list">
              <text class="empty-text">{{ gameHistoryUnavailable ? '后端暂未提供该玩家的房间历史接口' : '暂无游戏记录' }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 登录记录弹窗 -->
    <view v-if="showLoginHistoryModal" class="modal-overlay" @click="showLoginHistoryModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">登录记录 - {{ selectedPlayer?.nickname || selectedPlayer?.account || '' }}</text>
          <view class="modal-close-btn" @click="showLoginHistoryModal = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="login-list">
            <view v-for="(log, index) in playerLoginHistory" :key="index" class="login-item">
              <view class="login-icon">
                <text>📱</text>
              </view>
              <view class="login-info">
                <text class="login-device">{{ log.device || log.userAgent || '未知设备' }}</text>
                <text class="login-ip">IP: {{ log.ip || '-' }} | {{ log.location || '未知位置' }}</text>
              </view>
              <view class="login-time">
                <text>{{ log.time || log.createdAt || '-' }}</text>
              </view>
            </view>
            <view v-if="playerLoginHistory.length === 0" class="empty-list">
              <text class="empty-text">暂无登录记录</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    <!-- 消息中心弹窗 -->
    <view v-if="showMsgCenter" class="msg-overlay" @click="showMsgCenter = false">
      <view class="msg-container glass" @click.stop>
        <view class="msg-header">
          <text class="msg-title">消息中心</text>
          <view class="msg-close" @click="showMsgCenter = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="msg-body">
          <!-- 左侧联系人列表 -->
          <scroll-view class="msg-contacts" scroll-y>
            <view v-for="c in msgContacts" :key="c.id" class="msg-contact-item" :class="{ active: msgPeerId === c.id }" @click="selectMsgContact(c)">
              <view class="msg-contact-avatar" :style="{ background: getAvatarColor(c.nickname) }">
                <text>{{ (c.nickname || c.account || '?').charAt(0) }}</text>
              </view>
              <view class="msg-contact-info">
                <text class="msg-contact-name">{{ c.nickname || c.account }}</text>
                <text class="msg-contact-last">{{ c.lastMessage || '暂无消息' }}</text>
              </view>
              <view v-if="c.unreadCount > 0" class="msg-contact-badge">{{ c.unreadCount > 99 ? '99+' : c.unreadCount }}</view>
            </view>
            <view v-if="msgContacts.length === 0" class="msg-empty">
              <text>暂无对话</text>
            </view>
          </scroll-view>
          <!-- 右侧聊天窗口 -->
          <view class="msg-chat-area">
            <ChatPanel
              v-if="msgPeerId"
              :peer-id="msgPeerId"
              :peer-name="msgPeerName"
              :peer-role="msgPeerRole"
              :show-quick-actions="false"
              :is-cs="true"
              :can-process-chip-request="userRole === 'customer_service'"
              @close="msgPeerId = null"
              @new-message="onChatNewMessage"
              @messages-read="onChatMessagesRead"
            />
            <view v-else class="msg-chat-placeholder">
              <text>选择左侧联系人开始对话</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    </template>
  </ImmersivePage>
</template>

<script>
import { formatPoints, formatGameType } from '../../utils/format.js'
import {
  getUserList,
  adjustUserPoints,
  getCsOperations,
} from '../../api/admin.js'
import { getMe } from '../../api/auth.js'
import { getFontScale } from '../../utils/fontScale.js'
import { getContacts, getUnreadCount } from '../../api/messages.js'
import { getAdminMessages, getAdminMessageStats } from '../../api/messages.js'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import VIcon from '../../components/ui/VIcon.vue'
import ChatPanel from '../../components/ui/ChatPanel.vue'
import PaginationBar from '../../components/ui/PaginationBar.vue'

export default {
  name: 'CustomerService',
  components: { ImmersivePage, VIcon, ChatPanel, PaginationBar },
  data() {
    return {
      searchKeyword: '',
      fontScale: 1.0,
      selectedPlayer: null,
      userRole: '',
      showAdjustModal: false,
      adjustType: 'add',
      adjustAmount: '',
      adjustReason: '',
      activeFilter: 'all',
      isLoading: false,
      isAdjusting: false,
      isSearching: false,
      timelineFilters: [
        { label: '全部', value: 'all' },
        { label: '上分', value: 'cs_add' },
        { label: '下分', value: 'cs_sub' },
      ],
      players: [],
      timeline: [],
      playerPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      timelinePagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      // 今日统计
      todayStats: {
        totalOps: 0,
        totalAdd: 0,
        totalSub: 0,
        netChange: 0,
      },
      // 游戏记录
      showGameHistoryModal: false,
      playerGameHistory: [],
      gameHistoryStats: {},
      gameHistoryUnavailable: false,
      // 登录记录
      showLoginHistoryModal: false,
      playerLoginHistory: [],
      // 消息中心
      showMsgCenter: false,
      msgContacts: [],
      msgPeerId: null,
      msgPeerName: '',
      msgPeerRole: '',
      msgUnreadCount: 0,
      msgPollTimer: null,
      // 管理员聊天审计
      activeWorkTab: 'workspace', // workspace | audit
      auditStats: [],
      auditMessages: [],
      auditLoading: false,
      auditFilter: {
        csId: '',
        keyword: '',
        startDate: '',
        endDate: '',
      },
      auditStatsDays: 7,
    }
  },
  computed: {
    isAdmin() {
      return this.userRole === 'admin'
    },
    filteredPlayers() {
      return this.players
    },
    filteredTimeline() {
      if (this.activeFilter === 'all') return this.timeline
      return this.timeline.filter(t => t.type === this.activeFilter)
    },
  },
  onLoad() {
    this.fontScale = getFontScale()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    this.checkRoleAndLoad()
    this.startMsgPolling()
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
    this.stopMsgPolling()
  },
  methods: {
    formatGameType,
    formatPoints,
    onFontScaleChange(scale) {
      this.fontScale = scale
    },

    // 角色校验：非 customer_service / admin 跳大厅
    async checkRoleAndLoad() {
      try {
        const res = await getMe()
        const user = res.user || res.data?.user || res
        const role = user?.role
        if (!['customer_service', 'admin'].includes(role)) {
          uni.showToast({ title: '无权限访问', icon: 'none' })
          setTimeout(() => uni.reLaunch({ url: '/pages/lobby/lobby' }), 800)
          return
        }
        this.userRole = role
        this.loadAllData()
      } catch (e) {
        console.error('[CS] 角色校验失败', e)
        uni.showToast({ title: '登录态失效，请重新登录', icon: 'none' })
        setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
      }
    },

    async loadAllData() {
      this.isLoading = true
      try {
        await Promise.all([
          this.loadPlayers(),
          this.loadTimeline(),
        ])
      } catch (e) {
        console.error('[CS] 加载数据失败', e)
      } finally {
        this.isLoading = false
      }
    },

    // 加载代理列表（仅 agent / top_agent）
    async loadPlayers(page = 1) {
      try {
        const params = { page, pageSize: this.playerPagination.pageSize }
        if (this.searchKeyword) params.q = this.searchKeyword
        const [agentData, topAgentData] = await Promise.all([
          getUserList({ ...params, role: 'agent' }),
          getUserList({ ...params, role: 'top_agent' }),
        ])
        const agentList = Array.isArray(agentData.data) ? agentData.data : (agentData.users || agentData.list || [])
        const topAgentList = Array.isArray(topAgentData.data) ? topAgentData.data : (topAgentData.users || topAgentData.list || [])
        const list = [...agentList, ...topAgentList]
        this.players = list.map(p => ({
          ...p,
          isOnline: p.isOnline || false,
          isFrozen: p.frozen || false,
        }))
        const agentPagination = agentData.pagination || { page, pageSize: this.playerPagination.pageSize, total: agentList.length, totalPages: 1 }
        const topAgentPagination = topAgentData.pagination || { total: topAgentList.length, totalPages: 1 }
        this.playerPagination = {
          ...agentPagination,
          total: (agentPagination.total || 0) + (topAgentPagination.total || 0),
          totalPages: Math.max(agentPagination.totalPages || 1, topAgentPagination.totalPages || 1),
        }
      } catch (e) {
        console.warn('[CS] 代理列表加载失败', e)
        this.players = []
      }
    },

    // 服务端搜索
    async onSearch() {
      this.isSearching = true
      try {
        await this.loadPlayers(1)
      } finally {
        this.isSearching = false
      }
    },

    // 加载客服操作记录
    async loadTimeline(page = 1) {
      try {
        const params = { page, pageSize: this.timelinePagination.pageSize }
        if (this.activeFilter !== 'all') params.type = this.activeFilter
        const data = await getCsOperations(params)
        const list = Array.isArray(data.data) ? data.data : (data.list || data.operations || [])
        this.timeline = list
        this.timelinePagination = data.pagination || { ...this.timelinePagination, page }
        // 计算今日统计
        this.calcTodayStats(list)
      } catch (e) {
        console.warn('[CS] 操作记录加载失败', e)
        this.timeline = []
      }
    },

    setTimelineFilter(type) {
      this.activeFilter = type
      this.loadTimeline(1)
    },

    // 计算今日统计
    calcTodayStats(list) {
      const today = new Date().toISOString().slice(0, 10)
      const todayList = (list || []).filter(item => {
        const date = item.createdAt || item.created_at || item.time || ''
        return date.slice(0, 10) === today
      })
      let totalAdd = 0, totalSub = 0
      todayList.forEach(item => {
        const amt = Math.abs(item.amount || 0)
        if (item.type === 'cs_add' || item.amount > 0) totalAdd += amt
        else if (item.type === 'cs_sub' || item.amount < 0) totalSub += amt
      })
      this.todayStats = {
        totalOps: todayList.length,
        totalAdd,
        totalSub,
        netChange: totalAdd - totalSub,
      }
    },

    goBack() {
      uni.navigateBack()
    },

    getAvatarColor(name) {
      const colors = [
        'linear-gradient(135deg, var(--color-text-muted), var(--color-bg-card))',
        'linear-gradient(135deg, var(--color-text-muted), var(--color-text-muted))',
        'linear-gradient(135deg, var(--color-text-muted), var(--color-text-muted))',
        'linear-gradient(135deg, var(--color-bg-card), #1A202C)',
      ]
      let hash = 0
      for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
      }
      return colors[Math.abs(hash) % colors.length]
    },

    selectPlayer(player) {
      this.selectedPlayer = player
    },

    viewGameHistory() {
      if (!this.selectedPlayer) {
        uni.showToast({ title: '请先选择玩家', icon: 'none' })
        return
      }
      this.showGameHistoryModal = true
      this.loadPlayerGameHistory()
    },

    loadPlayerGameHistory() {
      this.playerGameHistory = []
      this.gameHistoryStats = {}
      this.gameHistoryUnavailable = true
    },

    viewLoginHistory() {
      if (!this.selectedPlayer) {
        uni.showToast({ title: '请先选择玩家', icon: 'none' })
        return
      }
      this.showLoginHistoryModal = true
      this.loadPlayerLoginHistory()
    },

    loadPlayerLoginHistory() {
      // 模拟登录记录数据
      this.playerLoginHistory = [
        { device: 'iPhone 15 Pro', ip: '192.168.1.100', location: '菲律宾马尼拉', time: '2026-08-25 10:30:00' },
        { device: 'iPhone 14', ip: '192.168.1.101', location: '菲律宾马尼拉', time: '2026-08-24 22:15:00' },
        { device: 'iPhone 15 Pro', ip: '10.0.0.50', location: '菲律宾宿务', time: '2026-08-24 14:00:00' },
        { device: 'iPad Pro', ip: '192.168.0.200', location: '菲律宾马尼拉', time: '2026-08-23 20:45:00' },
      ]
    },

    async confirmAdjust() {
      const rawAmount = parseInt(this.adjustAmount)
      if (!rawAmount || rawAmount <= 0) {
        uni.showToast({ title: '请输入有效数量', icon: 'none' })
        return
      }
      // 单次操作上限 1,000,000
      if (rawAmount > 1000000) {
        uni.showToast({ title: '单次操作不能超过 1,000,000', icon: 'none' })
        return
      }
      const note = this.adjustReason.trim()
      if (!note) {
        uni.showToast({ title: '请填写调整原因', icon: 'none' })
        return
      }
      // 客服角色：备注至少 2 字符
      if (note.length < 2) {
        uni.showToast({ title: '备注至少 2 个字符', icon: 'none' })
        return
      }
      this.isAdjusting = true
      try {
        const amount = this.adjustType === 'add' ? rawAmount : -rawAmount
        const res = await adjustUserPoints(
          this.selectedPlayer.id,
          amount,
          note
        )
        // 使用后端返回的最新余额
        const newPoints = res?.points ?? (this.selectedPlayer.points || 0) + amount
        this.selectedPlayer.points = newPoints
        uni.showToast({ title: '调整成功', icon: 'success' })
        this.showAdjustModal = false
        this.adjustAmount = ''
        this.adjustReason = ''
        // 刷新列表和操作记录
        this.loadPlayers()
        this.loadTimeline()
      } catch (e) {
        const msg = e?.error || e?.message || '调整失败'
        uni.showToast({ title: msg, icon: 'none' })
      } finally {
        this.isAdjusting = false
      }
    },

    // ========== 消息中心 ==========
    startMsgPolling() {
      this.refreshMsgUnread()
      this.msgPollTimer = setInterval(() => {
        this.refreshMsgUnread()
      }, 10000)
    },
    stopMsgPolling() {
      if (this.msgPollTimer) {
        clearInterval(this.msgPollTimer)
        this.msgPollTimer = null
      }
    },
    async refreshMsgUnread() {
      try {
        const res = await getUnreadCount()
        this.msgUnreadCount = res.unreadCount || res.data?.unreadCount || 0
      } catch (e) {
        // 静默失败
      }
    },
    async openMsgCenter() {
      this.showMsgCenter = true
      await this.loadMsgContacts()
    },
    async loadMsgContacts() {
      try {
        const res = await getContacts()
        this.msgContacts = res.contacts || res.data?.contacts || res.data || res || []
      } catch (e) {
        console.error('[CS] 加载联系人失败', e)
      }
    },
    selectMsgContact(contact) {
      this.msgPeerId = contact.id
      this.msgPeerName = contact.nickname || contact.account || '用户'
      this.msgPeerRole = contact.role || 'agent'
      // 清除该联系人未读
      const c = this.msgContacts.find(x => x.id === contact.id)
      if (c) c.unreadCount = 0
      this.refreshMsgUnread()
    },
    // 聊天窗口收到新消息
    onChatNewMessage() {
      // 刷新联系人列表（更新最后消息和排序）
      this.loadMsgContacts()
      // 播放提示音
      try {
        const audio = uni.createInnerAudioContext()
        audio.src = 'https://static.yefeng.us.cc/static/sounds/notify.mp3'
        audio.volume = 0.5
        audio.play()
        audio.onEnded(() => audio.destroy())
      } catch (e) { /* 静默 */ }
    },
    // 聊天窗口消息已读
    onChatMessagesRead() {
      this.refreshMsgUnread()
    },

    // ========== 管理员聊天审计 ==========
    async switchToAudit() {
      this.activeWorkTab = 'audit'
      await Promise.all([this.loadAuditStats(), this.loadAuditMessages()])
    },
    async loadAuditStats() {
      try {
        const res = await getAdminMessageStats(this.auditStatsDays)
        this.auditStats = res.stats || res.data?.stats || []
      } catch (e) {
        console.error('[Audit] 加载统计失败', e)
      }
    },
    async loadAuditMessages() {
      this.auditLoading = true
      try {
        const params = {}
        if (this.auditFilter.csId) params.csId = this.auditFilter.csId
        if (this.auditFilter.keyword) params.keyword = this.auditFilter.keyword
        if (this.auditFilter.startDate) params.startDate = this.auditFilter.startDate
        if (this.auditFilter.endDate) params.endDate = this.auditFilter.endDate
        const res = await getAdminMessages(params)
        this.auditMessages = res.messages || res.data?.messages || []
      } catch (e) {
        console.error('[Audit] 加载消息失败', e)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.auditLoading = false
      }
    },
    resetAuditFilter() {
      this.auditFilter = { csId: '', keyword: '', startDate: '', endDate: '' }
      this.loadAuditMessages()
    },
    roleLabel(role) {
      const map = { admin: '管理员', customer_service: '客服', top_agent: '总代理', agent: '代理', player: '玩家' }
      return map[role] || role
    },
    messageParticipantLabel(id, role) {
      return `用户#${id || '-'}（${this.roleLabel(role)}）`
    },
    formatAuditTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
  },
}
</script>

<style lang="scss" scoped>
.theme-cs {
  --primary-color: var(--color-text-muted);
  --accent-color: var(--color-info);
  background: linear-gradient(180deg, #1a202c 0%, #0f1419 100%) !important;
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

.online-badge {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.6vh 1.2vw;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 1.5vh;
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.online-dot {
  width: 0.8vh;
  height: 0.8vh;
  min-width: 6px;
  min-height: 6px;
  border-radius: 50%;
  background: var(--color-success);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.online-text {
  font-size: var(--text-sm);
  color: var(--color-success);
  font-weight: 600;
}

/* 今日统计栏 */
.stats-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin: 1vh 1vw 0;
  padding: 1.5vh 2vw;
  border-radius: 1.2vh;
  border: 1px solid rgba(99, 179, 237, 0.1);
}

.workspace-content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5vh;
}
.stat-label {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.5);
}
.stat-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}
.stat-add { color: var(--color-success); }
.stat-sub { color: var(--color-danger); }

/* 双栏布局 */
.main-content {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 1.2vh 1vw;
  gap: 1vw;
  box-sizing: border-box;
}

.left-panel {
  width: 22vw;
  min-width: 24vh;
  display: flex;
  flex-direction: column;
  border-radius: 1.2vh;
  border: 1px solid rgba(99, 179, 237, 0.1);
  overflow: hidden;
  flex-shrink: 0;
}

.panel-header {
  padding: 1.5vh 1.2vw;
  border-bottom: 1px solid rgba(99, 179, 237, 0.1);
}

.panel-title {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-border);
  margin-bottom: 1vh;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.8vh;
  padding: 0.6vh 0.8vw;
  gap: 0.4vw;
}

.search-input {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.search-btn {
  flex-shrink: 0;
  min-height: max(4.5vh, 44px);
  display: flex;
  align-items: center;
  padding: 0.4vh 1.2vh;
  background: rgba(99, 179, 237, 0.15);
  border: 1px solid rgba(99, 179, 237, 0.3);
  border-radius: 0.6vh;
  font-size: var(--text-base);
  color: var(--color-info);
}

.search-placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.player-list {
  flex: 1;
  padding: 0.8vh;
}

.player-item {
  display: flex;
  align-items: center;
  padding: 1vh 0.8vw;
  border-radius: 0.8vh;
  margin-bottom: 0.4vh;
  gap: 0.8vw;
  transition: all 0.2s;
  min-height: 7vh;
}

.player-item.active {
  background: rgba(99, 179, 237, 0.15);
  border: 1px solid rgba(99, 179, 237, 0.3);
}

.player-avatar {
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

.avatar-text {
  font-size: var(--text-base);
  font-weight: 600;
  color: #fff;
}

.player-info {
  flex: 1;
  min-width: 0;
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 0.4vw;
}

.player-name {
  font-size: var(--text-base);
  color: var(--color-text);
  max-width: 8vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  width: 0.7vh;
  height: 0.7vh;
  min-width: 5px;
  min-height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online { background: var(--color-success); }
.status-dot.offline { background: var(--color-text-muted); }

.player-account {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.4);
}

.player-points {
  flex-shrink: 0;
}

.points-num {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-info);
}

.empty-list {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 0;
}

.empty-text {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.4);
}

/* 右侧面板 */
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.2vh;
  overflow: hidden;
  min-width: 0;
}

.detail-section {
  border-radius: 1.2vh;
  border: 1px solid rgba(99, 179, 237, 0.1);
  padding: 1.8vh 1.5vw;
  flex-shrink: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1.5vw;
  margin-bottom: 1.5vh;
}

.detail-avatar {
  width: 7vh;
  height: 7vh;
  min-width: 50px;
  min-height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-avatar-text {
  font-size: var(--text-xl);
  font-weight: 700;
  color: #fff;
}

.detail-info {
  flex: 1;
  min-width: 0;
}

.detail-name {
  display: block;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.3vh;
}

.detail-account {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.6vh;
}

.detail-tags {
  display: flex;
  gap: 0.5vw;
}

.tag {
  padding: 0.3vh 0.8vw;
  border-radius: 0.4vh;
  font-size: var(--text-sm);
}

.tag-role {
  background: rgba(99, 179, 237, 0.15);
  color: var(--color-info);
}

.tag-status.online {
  background: rgba(74, 222, 128, 0.15);
  color: var(--color-success);
}

.tag-status.offline {
  background: rgba(107, 114, 128, 0.15);
  color: var(--color-text-muted);
}

.tag-frozen {
  background: rgba(229, 62, 62, 0.15);
  color: var(--color-danger);
}

.detail-points {
  text-align: right;
  flex-shrink: 0;
}

.points-label {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 0.3vh;
}

.points-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-info);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.8vw;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.2vh 0.5vw;
  background: rgba(99, 179, 237, 0.08);
  border: 1px solid rgba(99, 179, 237, 0.2);
  border-radius: 0.8vh;
  gap: 0.5vh;
  transition: all 0.2s;
}

.action-card:active {
  transform: scale(0.95);
  background: rgba(99, 179, 237, 0.15);
}

.action-card.action-danger {
  background: rgba(229, 62, 62, 0.08);
  border-color: rgba(229, 62, 62, 0.2);
}

.action-text {
  font-size: var(--text-sm);
  color: var(--color-border);
}

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 1.2vh;
  border: 1px dashed rgba(99, 179, 237, 0.2);
  gap: 1.5vh;
  min-height: 20vh;
}

/* 时间线 */
.timeline-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 1.2vh;
  border: 1px solid rgba(99, 179, 237, 0.1);
  overflow: hidden;
  min-height: 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2vh 1.5vw;
  border-bottom: 1px solid rgba(99, 179, 237, 0.1);
  flex-shrink: 0;
}

.timeline-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-border);
}

.timeline-filter {
  display: flex;
  gap: 0.4vw;
}

.filter-item {
  padding: 0.4vh 0.8vw;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  border-radius: 0.4vh;
  transition: all 0.2s;
}

.filter-item.active {
  background: rgba(99, 179, 237, 0.15);
  color: var(--color-info);
}

.timeline-list {
  flex: 1;
  padding: 1.2vh 1.5vw;
  min-height: 0;
}

.timeline-item {
  position: relative;
  display: flex;
  padding-left: 2vw;
  padding-bottom: 1.5vh;
}

.timeline-dot {
  position: absolute;
  left: 0;
  top: 0.5vh;
  width: 1.2vh;
  height: 1.2vh;
  min-width: 8px;
  min-height: 8px;
  border-radius: 50%;
  z-index: 1;
}

.timeline-dot.add {
  background: var(--color-success);
  box-shadow: 0 0 0.5vh rgba(74, 222, 128, 0.5);
}

.timeline-dot.deduct {
  background: var(--color-danger);
  box-shadow: 0 0 0.5vh rgba(248, 113, 113, 0.5);
}

.timeline-dot.freeze {
  background: var(--color-gold);
  box-shadow: 0 0 0.5vh rgba(251, 191, 36, 0.5);
}

.timeline-line {
  position: absolute;
  left: 0.5vh;
  top: 1.7vh;
  width: 2px;
  height: calc(100% - 0.8vh);
  background: rgba(99, 179, 237, 0.2);
}

.timeline-content {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0.8vh;
  padding: 1vh 1.2vw;
}

.timeline-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4vh;
}

.timeline-action {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.timeline-amount {
  font-size: var(--text-base);
  font-weight: 700;
}

.amount-in { color: var(--color-success); }
.amount-out { color: var(--color-danger); }

.timeline-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timeline-operator {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.4);
}

.timeline-time {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.3);
}

.timeline-reason {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.4vh;
  padding-top: 0.4vh;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.empty-timeline {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 0;
}

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
  border-radius: 1.5vh;
  border: 1px solid rgba(99, 179, 237, 0.2);
  padding: 2.5vh 2vw;
  overflow-y: auto;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .main-content { height: auto; min-height: 0; flex-direction: column; overflow-y: auto; }
  .left-panel, .right-panel { width: 100%; min-width: 0; }
  .modal-content, .modal-content.modal-large { width: 100%; max-width: 100%; padding: 2vh 4vw; }
  .history-stats { grid-template-columns: repeat(2, 1fr); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2vh;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-info);
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

.adjust-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2vh 1.5vw;
  background: rgba(99, 179, 237, 0.08);
  border-radius: 0.8vh;
  margin-bottom: 2vh;
}

.adjust-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}

.adjust-current {
  font-size: var(--text-sm);
  color: var(--color-info);
}

.adjust-form {
  margin-bottom: 2vh;
}

.form-group {
  margin-bottom: 1.5vh;
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-border);
  margin-bottom: 0.8vh;
}

.type-group {
  display: flex;
  gap: 0.8vw;
}

.type-btn {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1vh;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
}

.type-btn.active {
  background: rgba(99, 179, 237, 0.15);
  border-color: var(--color-info);
  color: var(--color-info);
}

.form-input {
  width: 100%;
  height: max(4.5vh, 44px);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.6vh;
  padding: 0 1vw;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.form-textarea {
  width: 100%;
  height: 8vh;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.6vh;
  padding: 0.8vh 1vw;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.modal-footer {
  display: flex;
  gap: 1vw;
}

.btn-cancel, .btn-confirm {
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

.btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-border);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--color-text-muted), var(--color-bg-card));
  color: #fff;
  font-weight: 600;
}

.btn-confirm:active { transform: scale(0.98); }
.btn-confirm.disabled { opacity: 0.5; pointer-events: none; }

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
  background: rgba(74,85,104,0.15);
  border: 1px solid rgba(99,179,237,0.2);
  text-align: center;
}

.hist-stat-label { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.4); margin-bottom: 0.5vh; }
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
  background: rgba(99,179,237,0.15);
  border-radius: 0.5vh;
  font-size: var(--text-sm);
  color: var(--color-info);
  flex-shrink: 0;
}

.history-info { flex: 1; min-width: 0; }
.history-room { display: block; font-size: var(--text-sm); color: var(--color-border); margin-bottom: 0.3vh; }
.history-time { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

.history-result { font-size: var(--text-base); font-weight: 700; flex-shrink: 0; }
.history-result.win { color: var(--color-success); }
.history-result.lose { color: var(--color-danger); }

/* 登录记录弹窗样式 */
.login-list { display: flex; flex-direction: column; gap: 1vh; }

.login-item {
  display: flex;
  align-items: center;
  gap: 1vw;
  padding: 1.5vh 1.2vw;
  border-radius: 1vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}

.login-icon {
  width: 4vh;
  height: 4vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99,179,237,0.15);
  border-radius: 50%;
  flex-shrink: 0;
  font-size: var(--text-sm);
}

.login-info { flex: 1; min-width: 0; }
.login-device { display: block; font-size: var(--text-sm); color: var(--color-border); margin-bottom: 0.3vh; }
.login-ip { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

.login-time {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
  font-family: monospace;
}

.empty-list { display: flex; align-items: center; justify-content: center; padding: 3vh 0; }
.empty-text { font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

/* 消息中心 */
.header-right-actions { display: flex; align-items: center; gap: 2vh; }
.msg-btn { position: relative; width: 5vh; height: 5vh; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border-radius: 50%; }
.msg-dot { position: absolute; top: -0.5vh; right: -0.5vh; min-width: 2.5vh; height: 2.5vh; padding: 0 0.5vh; background: var(--color-danger); border-radius: 1.5vh; font-size: var(--text-xs); color: #fff; display: flex; align-items: center; justify-content: center; }

.msg-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; padding: calc(1.5vh + var(--safe-top, 0px)) calc(1.5vh + var(--safe-right, 0px)) calc(1.5vh + var(--safe-bottom, 0px)) calc(1.5vh + var(--safe-left, 0px)); background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.msg-container { width: min(90vh, 100%); max-width: 100%; height: min(80vh, 100%); border-radius: 2vh; overflow: hidden; display: flex; flex-direction: column; border: 1px solid rgba(255,215,0,0.2); }
.msg-header { display: flex; align-items: center; justify-content: space-between; padding: 2vh 3vh; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.08); }
.msg-title { font-size: var(--text-xl); color: var(--color-text); font-weight: 600; }
.msg-close { width: 5vh; height: 5vh; display: flex; align-items: center; justify-content: center; }
.msg-body { flex: 1; display: flex; overflow: hidden; }
.msg-contacts { width: 30vh; border-right: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.15); }
.msg-contact-item { display: flex; align-items: center; gap: 1.5vh; padding: 2vh; border-bottom: 1px solid rgba(255,255,255,0.04); position: relative; }
.msg-contact-item.active { background: rgba(255,215,0,0.1); }
.msg-contact-avatar { width: 5vh; height: 5vh; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--text-base); color: #fff; font-weight: 600; }
.msg-contact-info { flex: 1; min-width: 0; }
.msg-contact-name { font-size: var(--text-base); color: var(--color-text); display: block; }
.msg-contact-last { font-size: var(--text-sm); color: rgba(255,255,255,0.4); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.3vh; }
.msg-contact-badge { position: absolute; right: 2vh; top: 50%; transform: translateY(-50%); min-width: 2.5vh; height: 2.5vh; padding: 0 0.5vh; background: var(--color-danger); border-radius: 1.5vh; font-size: var(--text-xs); color: #fff; display: flex; align-items: center; justify-content: center; }
.msg-empty { padding: 4vh 2vh; text-align: center; color: rgba(255,255,255,0.4); font-size: var(--text-base); }
.msg-chat-area { flex: 1; display: flex; flex-direction: column; }
.msg-chat-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: var(--text-base); }

@media (max-width: 600px) {
  .msg-body { flex-direction: column; }
  .msg-contacts { width: 100%; height: 34%; border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
}

/* 管理员 Tab */
.admin-tabs { display: flex; gap: 1vh; padding: 1vh 3vh; background: rgba(0,0,0,0.2); }
.admin-tab { padding: 1vh 3vh; min-height: 44px; display: flex; align-items: center; border-radius: 1vh; font-size: var(--text-lg); color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.05); }
.admin-tab.active { background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark)); color: var(--color-bg-card); font-weight: 600; }

/* 审计面板 */
.audit-panel { padding: 2vh 3vh; }
.audit-stats { display: flex; flex-wrap: wrap; gap: 2vh; margin-bottom: 2vh; }
.audit-stat-card { flex: 1; min-width: 30vh; padding: 2vh; border-radius: 1.5vh; }
.audit-stat-header { display: flex; align-items: center; gap: 1.5vh; margin-bottom: 1.5vh; }
.audit-stat-avatar { width: 5vh; height: 5vh; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
.audit-stat-avatar-img { width: 100%; height: 100%; border-radius: 50%; }
.audit-stat-name { font-size: var(--text-xl); color: var(--color-text); font-weight: 600; flex: 1; }
.audit-stat-online { padding: 0.3vh 1.5vh; border-radius: 1vh; font-size: var(--text-sm); background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
.audit-stat-online.online { background: rgba(72,187,120,0.2); color: var(--color-success); }
.audit-stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1vh; }
.audit-stat-item { text-align: center; }
.audit-stat-label { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.4); }
.audit-stat-value { display: block; font-size: var(--text-xl); color: var(--color-text); font-weight: 600; margin-top: 0.3vh; }
.audit-stat-value.processed { color: var(--color-success); }

.audit-filters { padding: 2vh; border-radius: 1.5vh; margin-bottom: 2vh; }
.audit-filter-row { display: flex; gap: 1.5vh; margin-bottom: 1.5vh; }
.audit-filter-row:last-child { margin-bottom: 0; }
.audit-filter-input { flex: 1; height: max(5vh, 44px); padding: 0 2vh; background: rgba(255,255,255,0.08); border-radius: 1vh; color: #fff; font-size: var(--text-base); }
.audit-filter-picker-text { font-size: var(--text-base); color: rgba(255,255,255,0.7); }
.audit-filter-btn { padding: 0 3vh; height: max(5vh, 44px); display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark)); color: var(--color-bg-card); border-radius: 1vh; font-size: var(--text-base); font-weight: 600; }
.audit-filter-btn.reset { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }

.audit-messages { border-radius: 1.5vh; overflow: hidden; display: flex; flex-direction: column; max-height: 60vh; }
.audit-messages-header { padding: 2vh; border-bottom: 1px solid rgba(255,255,255,0.08); }
.audit-messages-title { font-size: var(--text-lg); color: var(--color-text); font-weight: 600; }
.audit-messages-list { flex: 1; padding: 1vh 2vh; overflow-y: auto; }
.audit-msg-item { padding: 1.5vh 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.audit-msg-meta { display: flex; align-items: center; gap: 1vh; margin-bottom: 0.8vh; flex-wrap: wrap; }
.audit-msg-sender { font-size: var(--text-base); color: var(--color-gold); font-weight: 600; }
.audit-msg-arrow { font-size: var(--text-base); color: rgba(255,255,255,0.3); }
.audit-msg-receiver { font-size: var(--text-base); color: var(--color-info); }
.audit-msg-time { font-size: var(--text-sm); color: rgba(255,255,255,0.4); margin-left: auto; }
.audit-msg-content { font-size: var(--text-base); color: var(--color-text); line-height: 1.4; padding: 1vh 1.5vh; background: rgba(255,255,255,0.05); border-radius: 1vh; border-left: 3px solid rgba(255,255,255,0.2); }
.audit-msg-content.type-chip_request { border-left-color: var(--color-success); background: rgba(72,187,120,0.08); }
.audit-msg-content.type-system { border-left-color: var(--color-gold); background: rgba(255,215,0,0.08); font-style: italic; }
.audit-msg-related { font-size: var(--text-sm); color: rgba(255,255,255,0.3); margin-top: 0.5vh; word-break: break-all; }

.audit-pagination { display: flex; align-items: center; justify-content: center; gap: 3vh; padding: 2vh; border-top: 1px solid rgba(255,255,255,0.08); }
.audit-page-btn { padding: 0.8vh 2.5vh; min-height: 44px; display: flex; align-items: center; background: rgba(255,255,255,0.08); border-radius: 1vh; font-size: var(--text-base); color: rgba(255,255,255,0.7); }
.audit-page-btn.disabled { opacity: 0.3; }
.audit-page-info { font-size: var(--text-base); color: rgba(255,255,255,0.5); }

.audit-empty { text-align: center; padding: 4vh 0; color: rgba(255,255,255,0.3); font-size: var(--text-base); }
</style>

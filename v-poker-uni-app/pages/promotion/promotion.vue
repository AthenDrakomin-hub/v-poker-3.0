<template>
  <ImmersivePage title="总代理工作台" :show-header="true" :scrollable="true" page-class="theme-promotion" :page-style="{ '--font-scale': fontScale }">
    <!-- 自定义头部：返回按钮 + 标题 + 总代理徽章 -->
    <template #header-left>
      <view class="back-btn touch-active" @click="goBack">
        <VIcon name="back" :size="3.3" color="var(--color-text)" />
      </view>
    </template>
    <template #header-right>
      <view class="empire-badge">
        <VIcon name="trophy" :size="2.7" color="var(--color-gold)" />
        <text class="badge-text">总代理</text>
      </view>
    </template>

    <!-- 工作台分栏布局 -->
    <view class="workbench-grid">
      <!-- 左侧：帝国概览 + 帝国版图 -->
      <view class="workbench-left">
    <!-- 内容区 -->
    <view class="section">
      <view class="section-header">
        <view class="section-title-wrap">
          <text class="section-title">帝国概览</text>
          <text class="section-subtitle">我的扑克帝国</text>
        </view>
      </view>
      <view class="empire-stats">
        <view class="stat-card glass" v-for="(stat, index) in empireStats" :key="index">
          <view class="stat-icon" :style="{ background: stat.bgColor }">
            <VIcon :name="stat.iconName" :size="3.3" color="#fff" />
          </view>
          <view class="stat-content">
            <text class="stat-value">{{ stat.value }}</text>
            <text class="stat-label">{{ stat.label }}</text>
          </view>
          <view v-if="stat.trend" class="stat-trend" :class="stat.trend > 0 ? 'up' : 'down'">
            <text>{{ stat.trend > 0 ? '↑' : '↓' }}{{ Math.abs(stat.trend) }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">帝国版图</text>
        <view class="view-toggle">
          <text v-for="view in viewModes" :key="view.value" class="toggle-item" :class="{ active: activeView === view.value }" @click="activeView = view.value">{{ view.label }}</text>
        </view>
      </view>
      <view class="graph-card glass">
        <view v-if="activeView === 'tree'" class="tree-view">
          <view class="tree-node root-node">
            <view class="node-avatar root-avatar">
              <VIcon name="trophy" :size="3.8" color="var(--color-bg-card)" />
            </view>
            <text class="node-name">我（总代理）</text>
            <text class="node-points">{{ formatPoints(myPoints) }}</text>
          </view>
          <view class="tree-children">
            <view v-for="agent in firstLevelAgents" :key="agent.id" class="tree-branch">
              <view class="branch-line"></view>
              <view class="tree-node level1-node">
                <view class="node-avatar">
                  <text class="avatar-text">{{ (agent.nickname || agent.account || '?').charAt(0) }}</text>
                </view>
                <text class="node-name">{{ agent.nickname || agent.account }}</text>
                <text class="node-points">{{ formatPoints(agent.points || 0) }}</text>
                <text class="node-count">{{ agent.subCount || 0 }}下线</text>
              </view>
              <view class="tree-grandchildren">
                <view v-for="sub in (agent.subAgents || [])" :key="sub.id" class="tree-node level2-node">
                  <view class="node-avatar small">
                    <text class="avatar-text">{{ (sub.nickname || sub.account || '?').charAt(0) }}</text>
                  </view>
                  <text class="node-name">{{ sub.nickname || sub.account }}</text>
                  <text class="node-points">{{ formatPoints(sub.points || 0) }}</text>
                </view>
              </view>
            </view>
            <view v-if="firstLevelAgents.length === 0 && !isLoading" class="empty-list">
              <text class="empty-text">暂无下级代理</text>
            </view>
          </view>
        </view>
        <view v-else class="force-view">
          <view class="force-container">
            <view v-for="node in forceNodes" :key="node.id" class="force-node" :style="{ left: node.x + '%', top: node.y + '%', transform: `translate(-50%, -50%) scale(${node.scale})` }" :class="node.level">
              <text class="force-avatar">{{ node.icon }}</text>
              <text class="force-name">{{ node.name }}</text>
            </view>
          </view>
          <view class="force-legend">
            <view class="legend-item"><view class="legend-dot level-root"></view><text>总代理</text></view>
            <view class="legend-item"><view class="legend-dot level-1"></view><text>一级代理</text></view>
            <view class="legend-item"><view class="legend-dot level-2"></view><text>二级代理/玩家</text></view>
          </view>
        </view>
      </view>
    </view>
      </view>

      <!-- 右侧：下属房间 + 代理管理 -->
      <view class="workbench-right">

    <!-- 房间管理 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">下属房间</text>
        <text class="section-link" @click="refreshSubRooms">刷新</text>
      </view>
      <view class="room-list">
        <view v-for="room in subRooms" :key="room.id" class="room-card glass">
          <view class="room-info">
            <view class="room-header">
              <text class="room-name">房间#{{ room.roomNo || room.id }}</text>
              <view class="room-status" :class="room.status">
                <text>{{ room.status === 'playing' ? '游戏中' : '等待中' }}</text>
              </view>
            </view>
            <view class="room-meta">
              <text class="meta-item">{{ getGameTypeName(room.gameType) }}</text>
              <text class="meta-item">{{ room.playerCount || 0 }}/{{ room.maxSeats || 8 }}人</text>
              <text class="meta-item">房主: {{ room.agentName || room.agentAccount || '-' }}</text>
            </view>
          </view>
          <view class="room-actions">
            <view class="action-btn action-danger touch-active" @click="dissolveSubRoom(room)">
              <text>解散</text>
            </view>
          </view>
        </view>
        <view v-if="subRooms.length === 0 && !roomsLoading" class="empty-list">
          <text class="empty-text">暂无活跃房间</text>
        </view>
        <view v-if="roomsLoading" class="empty-list">
          <text class="empty-text">加载中...</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">代理管理</text>
        <view class="header-actions">
          <view class="invite-btn touch-active" @click="showInviteModal = true">
            <VIcon name="plus" :size="2.7" color="#fff" />
            <text>生成邀请码</text>
          </view>
        </view>
      </view>
      <view class="agent-list">
        <view v-for="agent in allAgents" :key="agent.id" class="agent-card glass" @click="viewAgentDetail(agent)">
          <view class="agent-avatar" :style="{ background: getAvatarColor(agent.nickname) }">
            <text class="avatar-text">{{ (agent.nickname || agent.account || '?').charAt(0) }}</text>
          </view>
          <view class="agent-info">
            <view class="agent-name-row">
              <text class="agent-name">{{ agent.nickname || agent.account }}</text>
              <text class="agent-level" :class="'level-' + (agent.level || 1)">{{ agent.level === 1 ? '一级' : '二级' }}</text>
            </view>
            <text class="agent-account">{{ agent.account }}</text>
            <view class="agent-meta">
              <text class="meta-item">下线: {{ agent.subCount || 0 }}</text>
              <text class="meta-item">局数: {{ agent.gameCount || 0 }}</text>
            </view>
          </view>
          <view class="agent-stats">
            <text class="stat-label">贡献</text>
            <text class="stat-value">{{ formatPoints(agent.contribution || 0) }}</text>
          </view>
        </view>
        <view v-if="allAgents.length === 0 && !isLoading" class="empty-list">
          <text class="empty-text">暂无代理</text>
        </view>
      </view>
    </view>
      </view>
    </view>

    <view class="bottom-spacing"></view>

    <template #modal>
    <!-- 生成邀请码弹窗 -->
    <view v-if="showInviteModal" class="modal-overlay" @click="showInviteModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">生成邀请码</text>
          <view class="modal-close-btn touch-active" @click="showInviteModal = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="invite-form">
          <view class="form-group">
            <text class="form-label">邀请层级</text>
            <view class="level-group">
              <view v-for="level in inviteLevels" :key="level.value" class="level-btn touch-active" :class="{ active: inviteLevel === level.value }" @click="inviteLevel = level.value"><text>{{ level.label }}</text></view>
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">备注（可选）</text>
            <input class="form-input" v-model="inviteRemark" placeholder="请输入备注" placeholder-class="input-placeholder" />
          </view>
        </view>
        <view class="invite-result" v-if="generatedCode">
          <text class="result-label">邀请码</text>
          <text class="result-code">{{ generatedCode }}</text>
          <view class="copy-btn touch-active" @click="copyCode"><text>复制</text></view>
        </view>
        <view class="modal-footer">
          <view class="btn-cancel touch-active" @click="showInviteModal = false">取消</view>
          <view class="btn-confirm touch-active" :class="{ disabled: isGenerating }" @click="generateCode">{{ isGenerating ? '生成中...' : '生成' }}</view>
        </view>
      </view>
    </view>

    <!-- 分配详情弹窗 -->
    <view v-if="showDistributionDetail" class="modal-overlay" @click="showDistributionDetail = false">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">收益分配详情</text>
          <view class="modal-close-btn touch-active" @click="showDistributionDetail = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="distribution-stats">
            <view class="dist-card">
              <text class="dist-label">今日收益</text>
              <text class="dist-value">{{ distributionStats.todayProfit || 0 }}</text>
            </view>
            <view class="dist-card">
              <text class="dist-label">本周收益</text>
              <text class="dist-value">{{ distributionStats.weekProfit || 0 }}</text>
            </view>
            <view class="dist-card">
              <text class="dist-label">本月收益</text>
              <text class="dist-value">{{ distributionStats.monthProfit || 0 }}</text>
            </view>
            <view class="dist-card">
              <text class="dist-label">累计收益</text>
              <text class="dist-value">{{ distributionStats.totalProfit || 0 }}</text>
            </view>
          </view>
          <view class="section-subtitle">分配规则</view>
          <view class="rule-list">
            <view class="rule-item">
              <text class="rule-level">L0 开房代理</text>
              <text class="rule-rate">1/3 抽水 ≈ 1% 底池</text>
            </view>
            <view class="rule-item">
              <text class="rule-level">L1 一级代理</text>
              <text class="rule-rate">0.5/3 抽水 ≈ 0.5% 底池</text>
            </view>
            <view class="rule-item">
              <text class="rule-level">L2 总代理</text>
              <text class="rule-rate">0.5/3 抽水 ≈ 0.5% 底池</text>
            </view>
            <view class="rule-item">
              <text class="rule-level">平台</text>
              <text class="rule-rate">剩余 1/3 抽水 ≈ 1% 底池</text>
            </view>
          </view>
          <view class="section-subtitle">最近分配记录</view>
          <view class="dist-record-list">
            <view v-for="record in distributionRecords" :key="record.id" class="dist-record-item">
              <view class="dist-record-info">
                <text class="dist-record-room">{{ record.roomName || '房间#' + record.roomId }}</text>
                <text class="dist-record-time">{{ record.time || record.createdAt || '-' }}</text>
              </view>
              <view class="dist-record-amount">
                <text>+{{ record.amount || 0 }}</text>
              </view>
            </view>
            <view v-if="distributionRecords.length === 0" class="empty-list">
              <text class="empty-text">暂无分配记录</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 代理详情弹窗 -->
    <view v-if="showAgentDetailModal" class="modal-overlay" @click="showAgentDetailModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">代理详情</text>
          <view class="modal-close-btn touch-active" @click="showAgentDetailModal = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="agent-detail-header">
            <view class="agent-detail-avatar">
              <text>{{ (selectedAgent?.nickname || selectedAgent?.account || 'A').charAt(0).toUpperCase() }}</text>
            </view>
            <view class="agent-detail-info">
              <text class="agent-detail-name">{{ selectedAgent?.nickname || selectedAgent?.account || '未知代理' }}</text>
              <text class="agent-detail-id">ID: {{ selectedAgent?.id || '-' }}</text>
            </view>
          </view>
          <view class="agent-detail-stats">
            <view class="agent-stat-card">
              <text class="agent-stat-label">下级玩家</text>
              <text class="agent-stat-value">{{ selectedAgent?.playerCount || 0 }}</text>
            </view>
            <view class="agent-stat-card">
              <text class="agent-stat-label">下级代理</text>
              <text class="agent-stat-value">{{ selectedAgent?.subAgentCount || 0 }}</text>
            </view>
            <view class="agent-stat-card">
              <text class="agent-stat-label">累计贡献</text>
              <text class="agent-stat-value">{{ selectedAgent?.totalContribution || 0 }}</text>
            </view>
          </view>
          <view class="agent-detail-section">
            <text class="section-title">基本信息</text>
            <view class="info-row">
              <text class="info-label">账号</text>
              <text class="info-value">{{ selectedAgent?.account || '-' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">代理等级</text>
              <text class="info-value">{{ selectedAgent?.level || formatRole(selectedAgent?.role) || 'L1' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">注册时间</text>
              <text class="info-value">{{ selectedAgent?.createdAt || '-' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">最后登录</text>
              <text class="info-value">{{ selectedAgent?.lastLogin || '-' }}</text>
            </view>
          </view>
          <view class="agent-detail-actions">
            <view class="action-btn action-primary touch-active" @click="openAdjustPoints(selectedAgent)">
              <VIcon name="coin" :size="2.7" color="#fff" />
              <text>调整筹码</text>
            </view>
            <view
              class="action-btn touch-active"
              :class="selectedAgent?.status === 'frozen' || selectedAgent?.frozen ? 'action-success' : 'action-danger'"
              @click="toggleFreezeAgent(selectedAgent)"
            >
              <VIcon :name="selectedAgent?.status === 'frozen' || selectedAgent?.frozen ? 'check' : 'warning'" :size="2.7" color="#fff" />
              <text>{{ selectedAgent?.status === 'frozen' || selectedAgent?.frozen ? '解冻代理' : '冻结代理' }}</text>
            </view>
          </view>
          <view class="agent-balance-hint">
            <text class="hint-text">当前账户余额：{{ formatPoints(userState.points) }} 筹码</text>
            <text class="hint-text">调整筹码将从您的账户转出给下线代理</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 调整筹码弹窗 -->
    <view v-if="showAdjustModal" class="modal-overlay" @click="showAdjustModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">调整代理筹码</text>
          <view class="modal-close-btn touch-active" @click="showAdjustModal = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="adjust-target-info">
            <text class="adjust-label">目标代理</text>
            <text class="adjust-value">{{ adjustTarget?.nickname || adjustTarget?.account || '未知' }}</text>
          </view>
          <view class="adjust-target-info">
            <text class="adjust-label">当前余额</text>
            <text class="adjust-value">{{ formatPoints(userState.points) }}</text>
          </view>
          <view class="form-group">
            <text class="form-label">调整数量（正数=上分，负数=下分）</text>
            <input
              class="form-input"
              type="number"
              v-model="adjustAmount"
              placeholder="请输入数量"
              placeholder-class="input-placeholder"
            />
            <text class="form-hint">从您的账户转出，余额不足将无法操作</text>
          </view>
          <view class="form-group">
            <text class="form-label">调整原因（必填）</text>
            <input
              class="form-input"
              v-model="adjustReason"
              placeholder="请输入调整原因"
              placeholder-class="input-placeholder"
              maxlength="100"
            />
          </view>
        </view>
        <view class="modal-footer">
          <view class="btn-cancel touch-active" @click="showAdjustModal = false">取消</view>
          <view class="btn-confirm touch-active" :class="{ disabled: isAdjusting }" @click="confirmAdjustPoints">
            {{ isAdjusting ? '调整中...' : '确认调整' }}
          </view>
        </view>
      </view>
    </view>
    </template>
  </ImmersivePage>
</template>

<script>
import { formatPoints, formatRole } from '../../utils/format.js'
import { userState } from '../../store/user.js'
import {
  getPromotionData,
  getAgentPlayers,
  generateInviteCode,
  getDistributionRecords,
  adjustPlayerPoints,
  freezeAgent,
} from '../../api/agent.js'
import { getSubordinateRooms, dissolveRoom } from '../../api/rooms.js'
import { getMe } from '../../api/auth.js'
import { getFontScale } from '../../utils/fontScale.js'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import VIcon from '../../components/ui/VIcon.vue'

export default {
  name: 'PromotionCenter',
  components: { ImmersivePage, VIcon },
  data() {
    return {
      userState,
      fontScale: 1.0,
      activeView: 'tree',
      isLoading: false,
      isGenerating: false,
      viewModes: [
        { label: '树状图', value: 'tree' },
        { label: '力导向图', value: 'force' },
      ],
      showInviteModal: false,
      inviteLevel: 1,
      inviteRemark: '',
      generatedCode: '',
      inviteLevels: [
        { label: '一级代理', value: 1 },
        { label: '二级代理', value: 2 },
        { label: '普通玩家', value: 0 },
      ],
      empireStats: [
        { iconName: 'user', label: '总下线', value: '0', trend: 0, bgColor: 'rgba(96,165,250,0.3)' },
        { iconName: 'cards', label: '今日流水', value: '0', trend: 0, bgColor: 'rgba(74,222,128,0.3)' },
        { iconName: 'coin', label: '今日佣金', value: '0', trend: 0, bgColor: 'rgba(255,215,0,0.3)' },
        { iconName: 'more', label: '累计佣金', value: '0', trend: 0, bgColor: 'rgba(159,122,234,0.3)' },
      ],
      myPoints: 0,
      todayRake: 0,
      myTodayProfit: 0,
      totalProfit: 0,
      firstLevelAgents: [],
      allAgents: [],
      agentPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      // 下属房间管理
      subRooms: [],
      roomsLoading: false,
      forceNodes: [
        { id: 0, name: '我', icon: '👑', x: 50, y: 20, scale: 1.5, level: 'root' },
      ],
      forceLinks: [],
      // 分配详情
      showDistributionDetail: false,
      distributionStats: {},
      distributionRecords: [],
      // 代理详情
      showAgentDetailModal: false,
      selectedAgent: null,
      // 调整筹码
      showAdjustModal: false,
      adjustTarget: null,
      adjustAmount: 0,
      adjustReason: '',
      isAdjusting: false,
    }
  },
  onLoad() {
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
  methods: {
    formatRole,
    formatPoints,
    onFontScaleChange(scale) {
      this.fontScale = scale
    },

    // 角色校验：仅 top_agent 可访问
    async checkRoleAndLoad() {
      try {
        const res = await getMe()
        const role = res.user?.role || res.data?.user?.role
        if (!['top_agent', 'admin'].includes(role)) {
          uni.showToast({ title: '无权限访问', icon: 'none' })
          setTimeout(() => uni.reLaunch({ url: '/pages/lobby/lobby' }), 800)
          return
        }
        this.loadAllData()
      } catch (e) {
        console.error('[Promotion] 角色校验失败', e)
        uni.showToast({ title: '登录态失效，请重新登录', icon: 'none' })
        setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
      }
    },

    async loadAllData() {
      this.isLoading = true
      try {
        await Promise.all([
          this.loadPromotionData(),
          this.loadAgents(),
          this.loadSubRooms(),
        ])
      } catch (e) {
        console.error('[Promotion] 加载数据失败', e)
      } finally {
        this.isLoading = false
      }
    },

    // 加载下属代理创建的活跃房间
    async loadSubRooms() {
      this.roomsLoading = true
      try {
        const data = await getSubordinateRooms({ status: 'waiting,playing', pageSize: 20, silent: true })
        const list = data.rooms || data.list || data.items || []
        this.subRooms = list
      } catch (e) {
        // 静默失败：后端可能未实现此接口，不显示错误提示
        console.warn('[Promotion] 下属房间加载失败（后端可能未实现）', e)
        this.subRooms = []
      } finally {
        this.roomsLoading = false
      }
    },

    refreshSubRooms() {
      this.loadSubRooms()
      uni.showToast({ title: '已刷新', icon: 'success' })
    },

    // 解散下属房间（总代理权限）
    async dissolveSubRoom(room) {
      uni.showModal({
        title: '确认解散',
        content: `确定要解散房间#${room.roomNo || room.id}吗？`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            await dissolveRoom(room.id)
            uni.showToast({ title: '已解散', icon: 'success' })
            this.subRooms = this.subRooms.filter(r => r.id !== room.id)
          } catch (e) {
            uni.showToast({ title: '解散失败', icon: 'none' })
          }
        },
      })
    },

    // 游戏类型名称映射
    getGameTypeName(type) {
      const map = {
        niuniu: '抢庄牛牛',
        sangong: '抢庄三公',
        tbnn: '通比牛牛',
        jinhua: '炸金花',
        texas: '德州扑克',
      }
      return map[type] || type || '未知'
    },

    async loadPromotionData() {
      try {
        const data = await getPromotionData()
        if (data) {
          this.myPoints = data.points || userState.points || 0
          this.myTodayProfit = data.todayCommission || 0
          this.totalProfit = data.totalCommission || 0
          this.empireStats[0].value = data.downlines?.length || 0
          this.empireStats[1].value = formatPoints(data.todayFlow || 0)
          this.empireStats[2].value = formatPoints(data.todayCommission || 0)
          this.empireStats[3].value = formatPoints(data.totalCommission || 0)
          this.firstLevelAgents = (data.downlines || []).filter(agent => agent.role === 'agent')
        }
      } catch (e) {
        console.warn('[Promotion] 推广数据加载失败', e)
      }
    },

    async loadAgents(page = 1) {
      try {
        const data = await getAgentPlayers({ page, pageSize: this.agentPagination.pageSize })
        const list = Array.isArray(data.data) ? data.data : (data.players || data.list || [])
        this.allAgents = list
        this.agentPagination = data.pagination || { ...this.agentPagination, page }
        if (this.firstLevelAgents.length === 0) {
          this.firstLevelAgents = list.filter(a => a.level === 1 || a.role === 'agent').slice(0, 5)
        }
        this.buildForceGraph()
      } catch (e) {
        console.warn('[Promotion] 代理列表加载失败', e)
        this.allAgents = []
      }
    },

    buildForceGraph() {
      const nodes = [{ id: 0, name: '我', icon: '👑', x: 50, y: 15, scale: 1.5, level: 'root' }]
      const links = []
      const level1 = this.firstLevelAgents.slice(0, 4)
      level1.forEach((agent, i) => {
        const x = 20 + i * 20
        nodes.push({
          id: agent.id,
          name: agent.nickname || agent.account,
          icon: (agent.nickname || agent.account || 'A').charAt(0),
          x,
          y: 45,
          scale: 1.1,
          level: 'level-1',
        })
        links.push({ from: 0, to: agent.id })
      })
      this.forceNodes = nodes
      this.forceLinks = links
    },

    goBack() {
      uni.navigateBack()
    },
    getAvatarColor(name) {
      const colors = [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, var(--theme-primary), #44337A)',
      ]
      let hash = 0
      for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
      }
      return colors[Math.abs(hash) % colors.length]
    },
    viewDistributionDetail() {
      this.showDistributionDetail = true
      this.loadDistributionData()
    },

    async loadDistributionData() {
      try {
        const data = await getDistributionRecords()
        const items = data.items || data.records || data.list || []
        // 适配后端字段到前端格式
        this.distributionRecords = items.map(r => ({
          id: r.id,
          roomId: r.roomId,
          roomName: r.roomNo ? ('房间#' + r.roomNo) : (r.gameType || '房间#' + r.roomId),
          time: r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '-',
          amount: r.commissionAmount || 0,
          flow: r.flow || 0,
        }))
        this.distributionStats = {
          todayProfit: this.myTodayProfit || 0,
          weekProfit: 0,
          monthProfit: 0,
          totalProfit: data.summary?.totalCommission || this.totalProfit || 0,
        }
      } catch (e) {
        console.warn('[Promotion] 加载分配记录失败', e)
        this.distributionRecords = []
        this.distributionStats = { todayProfit: 0, weekProfit: 0, monthProfit: 0, totalProfit: 0 }
      }
    },

    viewAgentDetail(agent) {
      this.selectedAgent = agent
      this.showAgentDetailModal = true
    },

    // 打开调整筹码弹窗
    openAdjustPoints(agent) {
      this.adjustTarget = agent
      this.adjustAmount = 0
      this.adjustReason = ''
      this.showAdjustModal = true
      this.showAgentDetailModal = false
    },

    // 确认调整代理筹码（从自己账户转出）
    async confirmAdjustPoints() {
      const amount = parseInt(this.adjustAmount)
      if (!amount || amount === 0) {
        uni.showToast({ title: '请输入有效数量', icon: 'none' })
        return
      }
      if (!this.adjustReason.trim()) {
        uni.showToast({ title: '请输入调整原因', icon: 'none' })
        return
      }
      if (Math.abs(amount) > 1000000) {
        uni.showToast({ title: '单次调整不能超过100万', icon: 'none' })
        return
      }
      // 余额检查（正数=转出给下线，需要自己有足够筹码）
      if (amount > 0 && amount > this.userState.points) {
        uni.showToast({ title: '账户余额不足', icon: 'none' })
        return
      }
      this.isAdjusting = true
      try {
        await adjustPlayerPoints(
          this.adjustTarget.id,
          amount,
          this.adjustReason
        )
        uni.showToast({ title: '调整成功', icon: 'success' })
        this.showAdjustModal = false
        this.loadAgents()
      } catch (e) {
        uni.showToast({ title: e.error || '调整失败', icon: 'none' })
      } finally {
        this.isAdjusting = false
      }
    },

    // 冻结/解冻代理
    async toggleFreezeAgent(agent) {
      const isFrozen = agent.status === 'frozen' || agent.frozen
      const actionText = isFrozen ? '解冻' : '冻结'
      uni.showModal({
        title: `${actionText}代理`,
        content: `确定要${actionText}代理 ${agent.nickname || agent.account} 吗？`,
        confirmColor: isFrozen ? 'var(--color-success)' : 'var(--color-danger)',
        success: async (res) => {
          if (!res.confirm) return
          try {
            // 调用代理冻结/解冻 API
            await freezeAgent(agent.id, isFrozen ? 'unfreeze' : 'freeze')
            agent.status = isFrozen ? 'active' : 'frozen'
            agent.frozen = !isFrozen
            uni.showToast({ title: `${actionText}成功`, icon: 'success' })
            this.loadAgents()
          } catch (e) {
            uni.showToast({ title: e.error || `${actionText}失败`, icon: 'none' })
          }
        },
      })
    },

    async generateCode() {
      this.isGenerating = true
      try {
        const data = await generateInviteCode()
        this.generatedCode = data.inviteCode || ''
        if (!this.generatedCode) throw new Error('返回数据无效')
        uni.showToast({ title: '生成成功', icon: 'success' })
      } catch (e) {
        this.generatedCode = ''
        uni.showToast({ title: e.error || e.message || '生成失败，请重试', icon: 'none' })
      } finally {
        this.isGenerating = false
      }
    },
    copyCode() {
      if (!this.generatedCode) return
      uni.setClipboardData({
        data: this.generatedCode,
        success: () => {
          uni.showToast({ title: '已复制', icon: 'success' })
        }
      })
    },
  },
}
</script>

<style lang="scss" scoped>
.theme-promotion {
  --primary-color: var(--theme-primary);
  --primary-gradient: linear-gradient(135deg, var(--theme-primary), var(--theme-primary));
  background: #0f0a1a !important;
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
  .empire-stats, .distribution-stats { grid-template-columns: repeat(2, 1fr); }
}

/* 头部按钮 */
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

.empire-badge {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.8vh 1.2vw;
  background: linear-gradient(135deg, rgba(107,70,193,0.3), rgba(85,60,154,0.3));
  border: 1px solid rgba(159,122,234,0.4);
  border-radius: 2vh;
}

.badge-text {
  font-size: var(--text-sm);
  color: #D6BCFA;
  font-weight: 600;
}

/* 内容区 */
.section {
  margin-bottom: 2.5vh;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5vh;
}

.section-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 0.8vw;
}

.section-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
}

.section-subtitle {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
}

.section-link {
  font-size: var(--text-sm);
  color: var(--theme-primary);
}

/* 帝国统计 */
.empire-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1vw;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 1.5vh 1vw;
  border-radius: 1.2vh;
  position: relative;
  overflow: hidden;
}

.stat-icon {
  width: 4.5vh;
  height: max(4.5vh, 44px);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1vh;
  margin-right: 0.8vw;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
}

.stat-label {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.5);
}

.stat-trend {
  position: absolute;
  top: 0.8vh;
  right: 0.8vw;
  font-size: var(--text-xs);
  padding: 0.2vh 0.5vw;
  border-radius: 0.4vh;
}

.stat-trend.up { color: var(--color-success); background: rgba(74,222,128,0.1); }
.stat-trend.down { color: var(--color-danger); background: rgba(248,113,113,0.1); }

/* 视图切换 */
.view-toggle {
  display: flex;
  gap: 0.5vw;
  background: rgba(255,255,255,0.05);
  padding: 0.4vh;
  border-radius: 0.8vh;
}

.toggle-item {
  padding: 0.8vh 1.2vw;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.5);
  border-radius: 0.6vh;
  transition: all 0.2s;
}

.toggle-item.active {
  background: rgba(107,70,193,0.3);
  color: var(--theme-primary);
}

/* 图谱卡片 */
.graph-card {
  border-radius: 1.5vh;
  padding: 2vh 1.5vw;
  min-height: 30vh;
  border: 1px solid rgba(107,70,193,0.2);
}

.tree-view {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.root-node { margin-bottom: 2vh; }

.tree-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3vh;
  padding: 1vh;
  border-radius: 1vh;
  min-width: 10vw;
}

.root-avatar {
  width: 6vh;
  height: 6vh;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 2vh rgba(255,215,0,0.5);
}

.level1-node { background: rgba(107,70,193,0.2); border: 1px solid rgba(159,122,234,0.4); }
.level2-node { background: rgba(107,70,193,0.1); border: 1px solid rgba(107,70,193,0.2); transform: scale(0.92); }

.node-avatar {
  width: 4.5vh;
  height: max(4.5vh, 44px);
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-avatar.small { width: 3.5vh; height: 3.5vh; }

.avatar-text { font-size: var(--text-base); font-weight: 700; color: #fff; }
.node-name { font-size: var(--text-sm); color: var(--color-text); font-weight: 600; }
.node-points { font-size: var(--text-sm); color: var(--theme-primary); }
.node-count { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.tree-children { display: flex; gap: 2vw; width: 100%; justify-content: center; flex-wrap: wrap; }
.tree-branch { display: flex; flex-direction: column; align-items: center; position: relative; }
.branch-line { width: 0.2vw; height: 2vh; background: rgba(107,70,193,0.3); }
.tree-grandchildren { display: flex; gap: 0.8vw; margin-top: 0.8vh; flex-wrap: wrap; justify-content: center; }

/* 力导向图 */
.force-view { position: relative; height: 28vh; }
.force-container { position: relative; width: 100%; height: 100%; }
.force-node { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 0.3vh; z-index: 2; }
.force-node.root .force-avatar { width: 5vh; height: 5vh; background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark)); font-size: var(--text-sm); box-shadow: 0 0 1.5vh rgba(255,215,0,0.5); }
.force-node.level-1 .force-avatar { width: 4vh; height: 4vh; background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary)); font-size: var(--text-xs); }
.force-node.level-2 .force-avatar { width: 3vh; height: 3vh; background: linear-gradient(135deg, var(--theme-primary), #44337A); font-size: var(--text-xs); }
.force-node.level-2 .force-name { font-size: var(--text-xs); }
.force-avatar { border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; }
.force-name { font-size: var(--text-sm); color: var(--color-text); white-space: nowrap; }
.force-legend { display: flex; justify-content: center; gap: 2vw; margin-top: 1.5vh; }
.legend-item { display: flex; align-items: center; gap: 0.5vw; font-size: var(--text-sm); color: rgba(255,255,255,0.5); }
.legend-dot { width: 1.2vh; height: 1.2vh; border-radius: 50%; }
.legend-dot.level-root { background: var(--color-gold); }
.legend-dot.level-1 { background: var(--theme-primary); }
.legend-dot.level-2 { background: var(--theme-primary); }

/* 金字塔分配 */
.pyramid-card {
  display: flex;
  gap: 2vw;
  border-radius: 1.5vh;
  padding: 2vh 1.5vw;
  border: 1px solid rgba(107,70,193,0.2);
}

.pyramid-visual { flex: 1; display: flex; flex-direction: column; align-items: center; }
.pyramid-level { display: flex; align-items: center; justify-content: space-between; padding: 0.6vh 1.2vw; margin-bottom: 0.3vh; border-radius: 0.5vh; width: 80%; }
.level-platform { background: rgba(99,179,237,0.2); border: 1px solid rgba(99,179,237,0.4); width: 60%; }
.level-general { background: rgba(159,122,234,0.2); border: 1px solid rgba(159,122,234,0.4); width: 70%; }
.level-first { background: rgba(107,70,193,0.2); border: 1px solid rgba(107,70,193,0.4); width: 80%; }
.level-room { background: rgba(85,60,154,0.2); border: 1px solid rgba(85,60,154,0.4); width: 90%; }
.level-name { font-size: var(--text-sm); color: var(--color-text); }
.level-amount { font-size: var(--text-sm); font-weight: 700; color: var(--theme-primary); }
.pyramid-base { margin-top: 0.8vh; padding: 0.8vh 2vw; background: linear-gradient(135deg, rgba(107,70,193,0.3), rgba(85,60,154,0.3)); border-radius: 0.5vh; }
.base-text { font-size: var(--text-sm); font-weight: 700; color: #D6BCFA; }
.pyramid-info { width: 18vw; display: flex; flex-direction: column; justify-content: center; gap: 1.5vh; }
.info-item { display: flex; flex-direction: column; gap: 0.3vh; }
.info-label { font-size: var(--text-xs); color: rgba(255,255,255,0.5); }
.info-value { font-size: var(--text-base); font-weight: 700; color: var(--color-text); }
.info-value.highlight { color: var(--theme-primary); font-size: var(--text-lg); }

/* 代理管理 */
.header-actions { display: flex; gap: 1vw; }
.invite-btn {
  display: flex;
  align-items: center;
  gap: 0.4vw;
  padding: 0.8vh 1.2vw;
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary));
  border-radius: 0.8vh;
  font-size: var(--text-sm);
  color: #fff;
}

.agent-list { display: flex; flex-direction: column; gap: 1vh; }
.agent-card {
  display: flex;
  align-items: center;
  padding: 1.5vh 1.2vw;
  border-radius: 1.2vh;
  gap: 1.2vw;
  border: 1px solid rgba(107,70,193,0.15);
  transition: all 0.2s ease;
  min-height: 8vh;
}
.agent-card:active { transform: scale(0.98); border-color: rgba(159,122,234,0.4); }
.agent-avatar { width: 5vh; height: 5vh; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.agent-info { flex: 1; min-width: 0; }
.agent-name-row { display: flex; align-items: center; gap: 0.6vw; margin-bottom: 0.3vh; }
.agent-name { font-size: var(--text-base); font-weight: 600; color: var(--color-text); }
.agent-level { padding: 0.2vh 0.6vw; border-radius: 0.3vh; font-size: var(--text-sm); }
.agent-level.level-1 { background: rgba(159,122,234,0.2); color: var(--theme-primary); }
.agent-level.level-2 { background: rgba(107,70,193,0.2); color: var(--theme-primary); }
.agent-account { font-size: var(--text-sm); color: rgba(255,255,255,0.4); margin-bottom: 0.3vh; }
.agent-meta { display: flex; gap: 1.2vw; }
.meta-item { font-size: var(--text-sm); color: rgba(255,255,255,0.4); }
.agent-stats { text-align: right; flex-shrink: 0; }
.agent-stats .stat-label { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); margin-bottom: 0.3vh; }
.agent-stats .stat-value { font-size: var(--text-base); font-weight: 700; color: var(--theme-primary); }

.bottom-spacing { height: 3vh; }
.empty-list { display: flex; align-items: center; justify-content: center; padding: 3vh 0; width: 100%; }
.empty-text { font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

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
  border: 1px solid rgba(107,70,193,0.3);
  padding: 2.5vh 2vw;
  box-sizing: border-box;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .modal-content, .modal-content.modal-large { width: 100%; max-width: 100%; padding: 2vh 4vw; }
  .level-group, .agent-detail-header { flex-wrap: wrap; }
}

.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2vh; }
.modal-title { font-size: var(--text-base); font-weight: 700; color: var(--theme-primary); }
.modal-close-btn { width: max(4vh, 44px); height: max(4vh, 44px); display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 50%; }

.invite-form { margin-bottom: 1.5vh; }
.form-group { margin-bottom: 1.8vh; }
.form-label { display: block; font-size: var(--text-sm); color: var(--color-border); margin-bottom: 0.8vh; }
.level-group { display: flex; gap: 0.8vw; }
.level-btn { flex: 1; padding: 0 1vh; min-height: 40px; display: flex; align-items: center; justify-content: center; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.8vh; font-size: var(--text-sm); color: rgba(255,255,255,0.6); transition: all 0.2s; }
.level-btn.active { background: rgba(107,70,193,0.2); border-color: var(--theme-primary); color: var(--theme-primary); }
.form-input { width: 100%; height: 5.5vh; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.8vh; padding: 0 1vw; font-size: var(--text-base); color: var(--color-text); }
.input-placeholder { color: rgba(255,255,255,0.25); }

.invite-result { display: flex; align-items: center; gap: 1vw; padding: 1.2vh 1.2vw; background: rgba(107,70,193,0.1); border: 1px dashed rgba(159,122,234,0.4); border-radius: 0.8vh; margin-bottom: 1.5vh; }
.result-label { font-size: var(--text-sm); color: rgba(255,255,255,0.5); }
.result-code { flex: 1; font-size: var(--text-lg); font-weight: 700; color: var(--theme-primary); letter-spacing: 0.3vw; }
.copy-btn { padding: 0.6vh 1.2vw; background: rgba(107,70,193,0.2); border-radius: 0.5vh; font-size: var(--text-sm); color: var(--theme-primary); }

.modal-footer { display: flex; gap: 1vw; }
.btn-cancel, .btn-confirm { flex: 1; height: 5.5vh; display: flex; align-items: center; justify-content: center; font-size: var(--text-base); border-radius: 0.8vh; }
.btn-cancel { background: rgba(255,255,255,0.08); color: var(--color-border); }
.btn-confirm { background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary)); color: #fff; font-weight: 600; }
.btn-confirm.disabled { opacity: 0.5; pointer-events: none; }

/* 分配详情弹窗样式 */
.distribution-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1vw;
  margin-bottom: 2vh;
}

.dist-card {
  padding: 1.5vh 1vw;
  border-radius: 1vh;
  background: rgba(107,70,193,0.1);
  border: 1px solid rgba(159,122,234,0.2);
  text-align: center;
}

.dist-label { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); margin-bottom: 0.5vh; }
.dist-value { display: block; font-size: var(--text-base); font-weight: 700; color: var(--theme-primary); }

.rule-list { display: flex; flex-direction: column; gap: 1vh; margin-bottom: 2vh; }

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2vh 1.2vw;
  border-radius: 0.8vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}

.rule-level { font-size: var(--text-sm); color: var(--color-border); font-weight: 600; }
.rule-rate { font-size: var(--text-sm); color: rgba(255,255,255,0.5); }

.dist-record-list { display: flex; flex-direction: column; gap: 1vh; }

.dist-record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2vh 1.2vw;
  border-radius: 0.8vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}

.dist-record-info { flex: 1; }
.dist-record-room { display: block; font-size: var(--text-sm); color: var(--color-border); margin-bottom: 0.3vh; }
.dist-record-time { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.dist-record-amount { font-size: var(--text-base); font-weight: 700; color: var(--color-success); }

/* 代理详情弹窗样式 */
.agent-detail-header {
  display: flex;
  align-items: center;
  gap: 1.5vw;
  padding-bottom: 2vh;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 2vh;
}

.agent-detail-avatar {
  width: 6vh;
  height: 6vh;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-detail-avatar text { font-size: var(--text-lg); color: #fff; font-weight: 700; }

.agent-detail-info { flex: 1; }
.agent-detail-name { display: block; font-size: var(--text-base); font-weight: 700; color: var(--color-border); margin-bottom: 0.3vh; }
.agent-detail-id { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

.agent-detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1vw;
  margin-bottom: 2vh;
}

.agent-stat-card {
  padding: 1.5vh 1vw;
  border-radius: 1vh;
  background: rgba(107,70,193,0.1);
  border: 1px solid rgba(159,122,234,0.2);
  text-align: center;
}

.agent-stat-label { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); margin-bottom: 0.5vh; }
.agent-stat-value { display: block; font-size: var(--text-base); font-weight: 700; color: var(--theme-primary); }

.agent-detail-section { margin-bottom: 1vh; }
.agent-detail-section .section-title {
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

.section-subtitle { font-size: var(--text-sm); font-weight: 600; color: var(--color-border); margin: 2vh 0 1vh; }
.empty-list { display: flex; align-items: center; justify-content: center; padding: 3vh 0; }
.empty-text { font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

/* 代理详情操作按钮 */
.agent-detail-actions {
  display: flex;
  gap: 1.5vh;
  margin-top: 2vh;
  padding-top: 2vh;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.agent-detail-actions .action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8vh;
  padding: 1.2vh;
  border-radius: 0.8vh;
  font-size: var(--text-base);
  font-weight: 600;
  color: #fff;
  min-height: 44px;
}

.agent-detail-actions .action-primary {
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary));
}

.agent-detail-actions .action-danger {
  background: linear-gradient(135deg, var(--color-danger), var(--color-danger));
}

.agent-detail-actions .action-success {
  background: linear-gradient(135deg, var(--color-success), var(--color-success));
}

.agent-balance-hint {
  margin-top: 1.5vh;
  padding: 1vh 1.5vh;
  background: rgba(255,215,0,0.08);
  border-radius: 0.6vh;
  border-left: 0.3vh solid var(--color-gold);
}

.agent-balance-hint .hint-text {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.6);
  line-height: 1.6;
}

/* 调整筹码弹窗 */
.adjust-target-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1vh 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.adjust-label {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.5);
}

.adjust-value {
  font-size: var(--text-base);
  color: var(--color-gold);
  font-weight: 600;
}

.form-group {
  margin-top: 2vh;
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.7);
  margin-bottom: 0.8vh;
  font-weight: 600;
}

.form-input {
  width: 100%;
  height: 5vh;
  padding: 0 1.5vh;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.6vh;
  color: #fff;
  font-size: var(--text-base);
  box-sizing: border-box;
}

.form-input::placeholder {
  color: rgba(255,255,255,0.3);
}

.form-hint {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
  margin-top: 0.5vh;
}

.modal-footer {
  display: flex;
  gap: 1.5vh;
  margin-top: 2.5vh;
  padding-top: 2vh;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 1.2vh;
  border-radius: 0.6vh;
  font-size: var(--text-base);
  font-weight: 600;
  text-align: center;
}

.btn-cancel {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary));
  color: #fff;
}

.btn-confirm.disabled {
  opacity: 0.5;
}
</style>

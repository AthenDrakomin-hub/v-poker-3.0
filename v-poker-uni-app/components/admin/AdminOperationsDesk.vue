<template>
  <view class="admin-desk">
    <view class="desk-main">
      <SegmentControl :tabs="navTabs" :active="activeView" @change="switchView" />
      <view class="desk-header">
        <view>
          <text class="view-title">{{ activeNavigation.label }}</text>
          <text class="view-desc">{{ activeNavigation.desc }}</text>
        </view>
        <view class="header-actions">
          <text class="updated-at">{{ lastUpdated }}</text>
          <view class="icon-action" @click="refreshActive" title="刷新数据"><VIcon name="refresh" :size="2.4" color="var(--color-text)" /></view>
        </view>
      </view>

      <scroll-view class="desk-content" scroll-y @scrolltolower="onLoadMore">
        <view v-if="activeView === 'overview'" class="overview-view">
          <view class="metric-grid">
            <view v-for="stat in globalStats" :key="stat.key" class="metric-card glass touch-active">
              <VIcon :name="stat.icon" :size="3.2" :color="stat.color" />
              <text class="metric-value">{{ stat.value }}</text>
              <text class="metric-label">{{ stat.label }}</text>
            </view>
          </view>
          <view class="overview-section">
            <text class="section-title">待处理事项</text>
            <view class="quick-grid">
              <view v-for="item in quickActions" :key="item.view" class="quick-card glass touch-active" @click="switchView(item.view)">
                <VIcon :name="item.icon" :size="3" :color="item.color" />
                <view><text class="quick-title">{{ item.title }}</text><text class="quick-desc">{{ item.desc }}</text></view>
              </view>
            </view>
          </view>
          <AdminExtendedOperations />
        </view>

        <view v-else-if="activeView === 'users'" class="data-view">
          <view class="toolbar glass">
            <input v-model="userQuery.search" class="filter-input" placeholder="账号、昵称或用户 ID" @confirm="loadUsers(1)" />
            <picker :range="roleOptions" range-key="label" @change="onRoleFilterChange"><view class="select-control">{{ selectedRoleFilter.label }}</view></picker>
            <view class="command-btn primary touch-active" @click="openUserEditor()">新增用户</view>
            <view class="command-btn touch-active" @click="loadUsers(1)">查询</view>
          </view>
          <view class="data-table glass">
            <view class="table-head user-row"><text>用户</text><text>角色</text><text>筹码</text><text>状态</text><text>操作</text></view>
            <view v-for="user in users" :key="user.id || user.userId" class="table-row user-row">
              <view><text class="primary-text">{{ user.nickname || user.account }}</text><text class="secondary-text">ID {{ user.id || user.userId }} · {{ user.account }} · 邀请码 {{ user.inviteCode || user.invite_code || '-' }}</text></view>
              <text>{{ roleLabel(user.role) }}</text><text>{{ user.points || 0 }}</text>
              <text :class="user.frozen ? 'status-danger' : 'status-success'">{{ user.frozen ? '已冻结' : '正常' }}</text>
              <view class="row-actions"><text @click="openUserEditor(user)">编辑</text><text @click="openAdjust(user)">调账</text><text @click="toggleFreeze(user)">{{ user.frozen ? '解冻' : '冻结' }}</text><text class="danger-action" @click="removeUserById(user)">删除</text></view>
            </view>
            <view v-if="!users.length && !loading.users" class="empty-state">暂无用户数据</view>
          </view>
          <ListFooter :loading="loadingMore.users" :no-more="noMore.users" :has-data="users.length > 0" />
        </view>

        <view v-else-if="activeView === 'rooms'" class="data-view">
          <view class="toolbar glass"><picker :range="roomStatusOptions" range-key="label" @change="onRoomStatusChange"><view class="select-control">{{ selectedRoomStatus.label }}</view></picker><view class="command-btn touch-active" @click="loadRooms(1)">查询</view></view>
          <view class="data-table glass"><view class="table-head room-row"><text>房间</text><text>游戏</text><text>人数</text><text>状态</text><text>操作</text></view><view v-for="room in rooms" :key="room.id" class="table-row room-row"><view><text class="primary-text">#{{ room.roomNo || room.id }}</text><text class="secondary-text">房主 {{ room.agentName || room.agentId || '-' }}</text></view><text>{{ formatGameType(room.gameType) || '-' }}</text><text>{{ room.playerCount || room.currentPlayers || 0 }}/{{ room.maxSeats || 0 }}</text><text>{{ formatRoomStatus(room.status) }}</text><view class="row-actions"><text @click="showRoomDetail(room)">详情</text><text class="danger-action" @click="forceEnd(room)">强制结束</text></view></view><view v-if="!rooms.length && !loading.rooms" class="empty-state">暂无房间数据</view></view>
          <ListFooter :loading="loadingMore.rooms" :no-more="noMore.rooms" :has-data="rooms.length > 0" />
        </view>

        <view v-else-if="activeView === 'agents'" class="data-view">
          <view class="toolbar glass"><picker :range="agentRoleOptions" range-key="label" @change="onAgentRoleChange"><view class="select-control">{{ selectedAgentRole.label }}</view></picker><view class="command-btn touch-active" @click="loadAgents(1)">查询</view></view>
          <view class="data-table glass"><view class="table-head agent-row"><text>代理</text><text>层级</text><text>下线</text><text>返佣</text><text>操作</text></view><view v-for="agent in agents" :key="agent.id || agent.userId" class="table-row agent-row"><view><text class="primary-text">{{ agent.nickname || agent.account }}</text><text class="secondary-text">ID {{ agent.id || agent.userId }}</text></view><text>{{ roleLabel(agent.role) }}</text><text>{{ agent.subAgentCount || agent.subCount || 0 }}</text><text>{{ agent.commissionRate || 0 }}%</text><view class="row-actions"><text @click="openUserEditor(agent)">编辑资料</text><text @click="openAdjust(agent)">调账</text></view></view><view v-if="!agents.length && !loading.agents" class="empty-state">暂无代理数据</view></view>
          <ListFooter :loading="loadingMore.agents" :no-more="noMore.agents" :has-data="agents.length > 0" />
        </view>

        <view v-else-if="activeView === 'finance'" class="data-view">
          <view class="metric-grid compact"><view class="metric-card glass touch-active"><text class="metric-value">{{ financeStats.todayFlow || 0 }}</text><text class="metric-label">今日流水</text></view><view class="metric-card glass touch-active"><text class="metric-value">{{ financeStats.todayRake || 0 }}</text><text class="metric-label">今日抽水</text></view><view class="metric-card glass touch-active"><text class="metric-value">{{ financeStats.totalFlow || 0 }}</text><text class="metric-label">累计流水</text></view><view class="metric-card glass touch-active"><text class="metric-value">{{ financeStats.totalRake || 0 }}</text><text class="metric-label">累计抽水</text></view></view>
          <view class="toolbar glass"><input v-model="ledgerQuery.userId" class="filter-input" type="number" placeholder="用户 ID" /><input v-model="ledgerQuery.type" class="filter-input" placeholder="流水类型" /><view class="command-btn touch-active" @click="loadLedger(1)">查询</view></view>
          <view class="data-table glass"><view class="table-head ledger-row"><text>类型</text><text>用户</text><text>金额</text><text>时间</text></view><view v-for="item in ledger" :key="item.id" class="table-row ledger-row"><text>{{ item.type || item.action || '-' }}</text><text>{{ item.userId || '-' }}</text><text :class="item.amount >= 0 ? 'status-success' : 'status-danger'">{{ item.amount >= 0 ? '+' : '' }}{{ item.amount || 0 }}</text><text>{{ formatTime(item.createdAt || item.time) }}</text></view><view v-if="!ledger.length && !loading.ledger" class="empty-state">暂无流水数据</view></view>
        </view>

        <view v-else-if="activeView === 'service'" class="data-view">
          <view class="metric-grid compact"><view class="metric-card glass touch-active"><text class="metric-value">{{ onlineCsCount }}</text><text class="metric-label">接待中</text></view><view class="metric-card glass touch-active"><text class="metric-value">{{ csStaff.length }}</text><text class="metric-label">客服总数</text></view><view class="metric-card glass touch-active"><text class="metric-value">{{ csReport.totalSessions || 0 }}</text><text class="metric-label">今日会话</text></view><view class="metric-card glass touch-active"><text class="metric-value">{{ csReport.avgResponseTime || 0 }}s</text><text class="metric-label">平均响应</text></view></view>
          <view class="toolbar glass"><view class="command-btn primary touch-active" @click="openCsEditor()">新增客服</view><view class="command-btn touch-active" @click="loadService()">刷新</view></view><view class="data-table glass"><view class="table-head cs-row"><text>客服</text><text>当前会话</text><text>今日接待</text><text>状态</text><text>操作</text></view><view v-for="staff in csStaff" :key="staff.id" class="table-row cs-row"><text>{{ staff.nickname || staff.account }}</text><text>{{ staff.activeSessions || 0 }}</text><text>{{ staff.todaySessions || 0 }}</text><text :class="staff.csStatus === 'online' ? 'status-success' : 'secondary-text'">{{ staff.csStatus === 'online' ? '接待中' : '已关闭' }}</text><view class="row-actions"><text @click="openCsEditor(staff)">编辑</text><text @click="toggleCs(staff)">{{ staff.csStatus === 'online' ? '关闭接待' : '开启接待' }}</text><text class="danger-action" @click="removeUserById(staff)">删除</text></view></view><view v-if="!csStaff.length && !loading.service" class="empty-state">暂无客服数据</view></view>
        </view>

        <view v-else-if="activeView === 'audit'" class="data-view">
          <view class="toolbar glass"><input v-model="auditQuery.userId" class="filter-input" type="number" placeholder="操作人 ID" /><input v-model="auditQuery.type" class="filter-input" placeholder="操作类型" /><view class="command-btn touch-active" @click="loadAudit">查询</view></view>
          <view class="data-table glass"><view class="table-head audit-row"><text>操作</text><text>对象/说明</text><text>操作人</text><text>时间</text></view><view v-for="log in auditLogs" :key="log.id" class="table-row audit-row"><text>{{ log.action || log.type || '-' }}</text><text>{{ log.detail || log.reason || '-' }}</text><text>{{ log.operator || log.operatorName || '-' }}</text><text>{{ formatTime(log.createdAt || log.time) }}</text></view><view v-if="!auditLogs.length && !loading.audit" class="empty-state">暂无审计日志</view></view>
        </view>

        <view v-else-if="activeView === 'invite'" class="data-view">
          <view class="config-card glass">
            <text class="section-title">管理员邀请码</text>
            <view class="field">
              <text>当前邀请码</text>
              <view class="invite-code-display">
                <text class="invite-code-text">{{ currentInviteCode || '暂无邀请码' }}</text>
                <view class="command-btn touch-active" @click="copyInviteCode" v-if="currentInviteCode">复制</view>
              </view>
            </view>
            <view class="field">
              <text>邀请码状态</text>
              <text :class="currentInviteCode ? 'status-success' : 'status-danger'">{{ currentInviteCode ? '已生成' : '未生成' }}</text>
            </view>
            <view class="field" v-if="inviteCodeInfo">
              <text>创建时间</text>
              <text>{{ inviteCodeInfo.createdAt || inviteCodeInfo.created_at || '-' }}</text>
            </view>
            <view class="field" v-if="inviteCodeInfo">
              <text>使用次数</text>
              <text>{{ inviteCodeInfo.usedCount || inviteCodeInfo.used_count || 0 }} 次</text>
            </view>
            <view class="toolbar-actions">
              <view class="command-btn primary touch-active" @click="loadInviteCode">刷新邀请码</view>
              <view class="command-btn danger touch-active" @click="regenerateInviteCode">重新生成邀请码</view>
            </view>
            <view class="invite-tip">
              <text class="tip-text">提示：重新生成邀请码后，旧邀请码将失效。新用户使用此邀请码注册后将归属当前管理员。</text>
            </view>
          </view>
        </view>

        <view v-else-if="activeView === 'config'" class="data-view config-view">
          <view class="config-card glass"><text class="section-title">应用发布配置</text><view class="field"><text>当前版本</text><input v-model="systemConfig.app_version" class="filter-input" placeholder="例如 1.0.0" /></view><view class="field"><text>下载地址</text><input v-model="systemConfig.app_download_url" class="filter-input" placeholder="https://..." /></view><view class="toolbar-actions"><view class="command-btn primary touch-active" @click="saveConfig">保存配置</view><view class="command-btn danger touch-active" @click="reloadEconomy">重载经济模型</view></view></view>
        </view>
      </scroll-view>
    </view>

    <view v-if="editor.visible" class="modal-overlay" @click="closeEditor"><view class="modal-panel glass" @click.stop><view class="modal-head"><text>{{ editor.mode === 'create' ? '新增用户' : '编辑用户' }}</text><VIcon name="close" :size="2.6" color="var(--color-text-muted)" @click="closeEditor" /></view><view class="form-stack"><view class="field"><text>账号</text><input v-model="editor.form.account" class="filter-input" :disabled="editor.mode === 'edit'" placeholder="账号" /></view><view v-if="editor.mode === 'create'" class="field"><text>初始密码</text><input v-model="editor.form.password" class="filter-input" password placeholder="至少 6 位" /></view><view class="field"><text>昵称</text><input v-model="editor.form.nickname" class="filter-input" placeholder="昵称" /></view><view class="field"><text>角色</text><picker :range="editableRoles" range-key="label" @change="onEditorRoleChange"><view class="select-control">{{ editorRole.label }}</view></picker></view></view><view class="modal-actions"><view v-if="editor.mode === 'edit'" class="command-btn danger touch-active" @click="removeUser">删除用户</view><view class="command-btn primary touch-active" @click="saveUser">保存</view></view></view></view>
    <view v-if="adjust.visible" class="modal-overlay" @click="adjust.visible = false"><view class="modal-panel glass" @click.stop><view class="modal-head"><text>调整筹码</text><VIcon name="close" :size="2.6" color="var(--color-text-muted)" @click="adjust.visible = false" /></view><text class="adjust-target">{{ adjust.target.nickname || adjust.target.account }} 当前筹码 {{ adjust.target.points || 0 }}</text><view class="form-stack"><view class="field"><text>变动数量</text><input v-model="adjust.amount" class="filter-input" type="number" placeholder="正数增加，负数扣除" /></view><view class="field"><text>调整原因</text><input v-model="adjust.reason" class="filter-input" placeholder="必填，将写入审计日志" /></view></view><view class="modal-actions"><view class="command-btn primary touch-active" @click="submitAdjust">确认调整</view></view></view></view>

    <view v-if="csEditor.visible" class="modal-overlay" @click="closeCsEditor"><view class="modal-panel glass" @click.stop><view class="modal-head"><text>{{ csEditor.mode === 'create' ? '新增客服' : '编辑客服' }}</text><VIcon name="close" :size="2.6" color="var(--color-text-muted)" @click="closeCsEditor" /></view><view class="form-stack"><view class="field"><text>账号</text><input v-model="csEditor.form.account" class="filter-input" :disabled="csEditor.mode === 'edit'" placeholder="客服账号" /></view><view v-if="csEditor.mode === 'create'" class="field"><text>初始密码</text><input v-model="csEditor.form.password" class="filter-input" password placeholder="至少 6 位" /></view><view v-else class="field"><text>重置密码（留空不修改）</text><input v-model="csEditor.form.password" class="filter-input" password placeholder="输入新密码" /></view><view class="field"><text>昵称</text><input v-model="csEditor.form.nickname" class="filter-input" placeholder="客服昵称" /></view></view><view class="modal-actions"><view class="command-btn primary touch-active" @click="saveCs">保存</view></view></view></view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'
import AdminExtendedOperations from './AdminExtendedOperations.vue'
import { formatGameType, formatRoomStatus } from '../../utils/format.js'
import { getAdminStats, getUserList, createUser, updateUser, deleteUser, adjustUserPoints, freezeUser, unfreezeUser, getAdminRoomList, forceEndRoom, getAdminLedger, getAuditLogs, getSystemConfig, updateSystemConfig, reloadEconomyV2, getCsStaff, getCsReport, setCsStatus } from '../../api/admin.js'
import { getInviteCode, generateInviteCode } from '../../api/agent.js'

const roles = [{ label: '全部角色', value: '' }, { label: '玩家', value: 'player' }, { label: '代理', value: 'agent' }, { label: '总代理', value: 'top_agent' }, { label: '客服', value: 'customer_service' }, { label: '管理员', value: 'admin' }]

export default {
  name: 'AdminOperationsDesk', components: { VIcon, AdminExtendedOperations },
  data() { return { activeView: 'overview', lastUpdated: '--', loading: { users: false, rooms: false, agents: false, ledger: false, service: false, audit: false }, loadingMore: { users: false, rooms: false, agents: false }, noMore: { users: false, rooms: false, agents: false }, navigation: [{ key: 'overview', label: '运营概览', desc: '关键运营指标与待处理事项', icon: 'more' }, { key: 'users', label: '用户治理', desc: '用户、角色、状态与筹码管理', icon: 'user' }, { key: 'rooms', label: '房间监管', desc: '房间状态与强制干预', icon: 'cards' }, { key: 'agents', label: '代理管理', desc: '代理层级与账户管理', icon: 'user' }, { key: 'finance', label: '资金账本', desc: '平台流水与资金核查', icon: 'coin' }, { key: 'service', label: '客服运营', desc: '客服状态与服务指标', icon: 'headset' }, { key: 'audit', label: '审计中心', desc: '操作记录与安全追溯', icon: 'warning' }, { key: 'invite', label: '邀请码管理', desc: '查看与生成管理员邀请码', icon: 'user' }, { key: 'config', label: '系统配置', desc: '发布配置与经济模型', icon: 'gear' }], globalStats: [{ key: 'users', label: '总用户', value: 0, icon: 'user', color: 'var(--color-info)' }, { key: 'rooms', label: '活跃房间', value: 0, icon: 'cards', color: 'var(--color-success)' }, { key: 'flow', label: '累计流水', value: 0, icon: 'coin', color: 'var(--color-gold)' }, { key: 'rake', label: '累计抽水', value: 0, icon: 'more', color: 'var(--color-danger)' }], quickActions: [{ view: 'users', title: '用户治理', desc: '账号、角色、状态与调账', icon: 'user', color: 'var(--color-info)' }, { view: 'rooms', title: '房间监管', desc: '实时状态与强制结束', icon: 'cards', color: 'var(--color-success)' }, { view: 'finance', title: '资金账本', desc: '流水与异常核查', icon: 'coin', color: 'var(--color-gold)' }, { view: 'audit', title: '审计中心', desc: '操作记录与追踪', icon: 'warning', color: 'var(--color-danger)' }], roleOptions: roles, editableRoles: roles.slice(1), userQuery: { search: '', role: '' }, users: [], userPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, roomStatusOptions: [{ label: '全部状态', value: '' }, { label: '等待中', value: 'waiting' }, { label: '游戏中', value: 'playing' }, { label: '已结束', value: 'ended' }], roomQuery: { status: '' }, rooms: [], roomPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, agentRoleOptions: roles.filter(item => ['', 'agent', 'top_agent'].includes(item.value)), agentQuery: { role: 'agent' }, agents: [], agentPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, financeStats: {}, ledgerQuery: { userId: '', type: '' }, ledger: [], csStaff: [], csReport: {}, auditQuery: { userId: '', type: '' }, auditLogs: [], systemConfig: { app_version: '', app_download_url: '' }, editor: { visible: false, mode: 'create', target: null, form: { account: '', password: '', nickname: '', role: 'player' } }, adjust: { visible: false, target: {}, amount: '', reason: '' }, currentInviteCode: '', inviteCodeInfo: null, csEditor: { visible: false, mode: 'create', target: null, form: { account: '', password: '', nickname: '' } } } },
  computed: { navTabs() { return this.navigation.map(item => ({ key: item.key, label: item.label })) }, activeNavigation() { return this.navigation.find(item => item.key === this.activeView) || this.navigation[0] }, selectedRoleFilter() { return this.roleOptions.find(item => item.value === this.userQuery.role) || this.roleOptions[0] }, selectedRoomStatus() { return this.roomStatusOptions.find(item => item.value === this.roomQuery.status) || this.roomStatusOptions[0] }, selectedAgentRole() { return this.agentRoleOptions.find(item => item.value === this.agentQuery.role) || this.agentRoleOptions[0] }, editorRole() { return this.editableRoles.find(item => item.value === this.editor.form.role) || this.editableRoles[0] }, onlineCsCount() { return this.csStaff.filter(item => item.csStatus === 'online').length } },
  mounted() { this.loadOverview(); this.loadInviteCode() },
  methods: {
    formatGameType,
    formatRoomStatus,
    async onLoadMore() {
      const loaders = { users: this.loadUsers, rooms: this.loadRooms, agents: this.loadAgents };
      const loader = loaders[this.activeView];
      if (!loader || this.loadingMore[this.activeView] || this.noMore[this.activeView]) return;
      this.loadingMore[this.activeView] = true;
      try {
        const nextPage = (this[this.activeView + 'Pagination']?.page || 1) + 1;
        await loader(nextPage);
      } catch(e) {} finally { this.loadingMore[this.activeView] = false; }
    },
    async switchView(view) { this.activeView = view; this.loadingMore = { users: false, rooms: false, agents: false }; this.noMore = { users: false, rooms: false, agents: false }; await this.refreshActive() },
    async refreshActive() { const loader = { overview: this.loadOverview, users: () => this.loadUsers(1), rooms: () => this.loadRooms(1), agents: () => this.loadAgents(1), finance: () => this.loadFinance(), service: () => this.loadService(), audit: this.loadAudit, config: this.loadConfig, invite: this.loadInviteCode }[this.activeView]; if (loader) await loader(); this.lastUpdated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) },
    async loadOverview() { try { const data = await getAdminStats(); this.globalStats[0].value = data.totalUsers || 0; this.globalStats[1].value = data.activeRooms || data.onlineRooms || 0; this.globalStats[2].value = data.totalFlow || data.totalPoints || 0; this.globalStats[3].value = data.totalRake || 0; this.financeStats = { todayFlow: data.todayVolume || 0, todayRake: data.todayRake || 0, totalFlow: data.totalFlow || 0, totalRake: data.totalRake || 0 } } catch (e) { this.notify(e, '加载运营概览失败') } },
    normalizeList(data, keys) { if (Array.isArray(data?.data)) return data.data; for (const key of keys) if (Array.isArray(data?.[key])) return data[key]; return [] }, applyPagination(target, data, page) { this[target] = data.pagination || { ...this[target], page } },
    async loadUsers(page) { this.loading.users = true; try { const params = { page, limit: this.userPagination.pageSize, search: this.userQuery.search.trim(), role: this.userQuery.role }; const data = await getUserList(params); const _uItems = this.normalizeList(data, ['list', 'users']); this.users = page > 1 ? [...this.users, ..._uItems] : _uItems; if (_uItems.length < this.userPagination.pageSize) this.noMore.users = true; this.applyPagination('userPagination', data, page) } catch (e) { this.notify(e, '加载用户失败') } finally { this.loading.users = false } },
    async loadRooms(page) { this.loading.rooms = true; try { const data = await getAdminRoomList({ page, status: this.roomQuery.status }); const _rItems = this.normalizeList(data, ['list', 'rooms']); this.rooms = page > 1 ? [...this.rooms, ..._rItems] : _rItems; if (_rItems.length < this.roomPagination.pageSize) this.noMore.rooms = true; this.applyPagination('roomPagination', data, page) } catch (e) { this.notify(e, '加载房间失败') } finally { this.loading.rooms = false } },
    async loadAgents(page) { this.loading.agents = true; try { const data = await getUserList({ page, limit: this.agentPagination.pageSize, role: this.agentQuery.role }); const _aItems = this.normalizeList(data, ['list', 'users']); this.agents = page > 1 ? [...this.agents, ..._aItems] : _aItems; if (_aItems.length < this.agentPagination.pageSize) this.noMore.agents = true; this.applyPagination('agentPagination', data, page) } catch (e) { this.notify(e, '加载代理失败') } finally { this.loading.agents = false } },
    async loadFinance() { await Promise.all([this.loadLedger(1), this.loadOverview()]) }, async loadLedger(page) { this.loading.ledger = true; try { const data = await getAdminLedger({ page, limit: 50, userId: this.ledgerQuery.userId || undefined, type: this.ledgerQuery.type || undefined }); this.ledger = this.normalizeList(data, ['list', 'records']) } catch (e) { this.notify(e, '加载流水失败') } finally { this.loading.ledger = false } },
    async loadService() { this.loading.service = true; try { const [staff, report] = await Promise.all([getCsStaff(), getCsReport({ period: 'day' })]); this.csStaff = this.normalizeList(staff, ['list', 'staff']).map(item => ({ ...item, csStatus: item.csStatus || item.cs_status || 'offline', activeSessions: item.activeSessions ?? item.active_sessions ?? 0, todaySessions: item.todaySessions ?? item.today_sessions ?? 0 })); this.csReport = report.report || report.data?.report || report.data || report || {} } catch (e) { this.notify(e, '加载客服数据失败') } finally { this.loading.service = false } },
    async loadAudit() { this.loading.audit = true; try { const data = await getAuditLogs({ limit: 100, userId: this.auditQuery.userId || undefined, type: this.auditQuery.type || undefined }); this.auditLogs = this.normalizeList(data, ['list', 'logs']) } catch (e) { this.notify(e, '加载审计日志失败') } finally { this.loading.audit = false } }, async loadConfig() { try { const data = await getSystemConfig(); this.systemConfig = { ...this.systemConfig, ...data } } catch (e) { this.notify(e, '加载系统配置失败') } },
    onRoleFilterChange(e) { this.userQuery.role = this.roleOptions[e.detail.value].value; this.loadUsers(1) }, onRoomStatusChange(e) { this.roomQuery.status = this.roomStatusOptions[e.detail.value].value; this.loadRooms(1) }, onAgentRoleChange(e) { this.agentQuery.role = this.agentRoleOptions[e.detail.value].value; this.loadAgents(1) }, onEditorRoleChange(e) { this.editor.form.role = this.editableRoles[e.detail.value].value },
    openUserEditor(user) { this.editor.visible = true; this.editor.mode = user ? 'edit' : 'create'; this.editor.target = user || null; this.editor.form = user ? { account: user.account || '', password: '', nickname: user.nickname || '', role: user.role || 'player' } : { account: '', password: '', nickname: '', role: 'player' } }, closeEditor() { this.editor.visible = false },
    async saveUser() { const form = this.editor.form; if (!form.account || (this.editor.mode === 'create' && !form.password)) return uni.showToast({ title: '请填写账号与密码', icon: 'none' }); try { if (this.editor.mode === 'create') await createUser(form); else await updateUser(this.editor.target.id || this.editor.target.userId, { nickname: form.nickname, role: form.role }); uni.showToast({ title: '已保存', icon: 'success' }); this.closeEditor(); this.loadUsers(1); this.loadAgents(1) } catch (e) { this.notify(e, '保存用户失败') } },
    removeUser() { uni.showModal({ title: '删除用户', content: '将执行软删除，此操作会写入审计日志。确认继续？', success: async res => { if (!res.confirm) return; try { await deleteUser(this.editor.target.id || this.editor.target.userId); uni.showToast({ title: '用户已删除', icon: 'success' }); this.closeEditor(); this.loadUsers(1) } catch (e) { this.notify(e, '删除用户失败') } } }) },
    openAdjust(user) { this.adjust = { visible: true, target: user, amount: '', reason: '' } }, async submitAdjust() { const amount = Number(this.adjust.amount); if (!amount || !this.adjust.reason.trim()) return uni.showToast({ title: '请填写数量与调整原因', icon: 'none' }); try { await adjustUserPoints(this.adjust.target.id || this.adjust.target.userId, amount, this.adjust.reason.trim()); uni.showToast({ title: '调整成功', icon: 'success' }); this.adjust.visible = false; this.loadUsers(this.userPagination.page); this.loadOverview() } catch (e) { this.notify(e, '调整失败') } },
    toggleFreeze(user) { const id = user.id || user.userId; const action = user.frozen ? '解冻' : '冻结'; uni.showModal({ title: `${action}用户`, content: `确认${action} ${user.account || user.nickname}？`, success: async res => { if (!res.confirm) return; try { await (user.frozen ? unfreezeUser(id) : freezeUser(id)); uni.showToast({ title: `${action}成功`, icon: 'success' }); this.loadUsers(this.userPagination.page) } catch (e) { this.notify(e, `${action}失败`) } } }) },
    showRoomDetail(room) { uni.showModal({ title: `房间 #${room.roomNo || room.id}`, content: `游戏：${room.gameType || '-'}\n状态：${room.status || '-'}\n房主：${room.agentName || room.agentId || '-'}\n在线人数：${room.playerCount || room.currentPlayers || 0}`, showCancel: false }) }, forceEnd(room) { uni.showModal({ title: '强制结束房间', content: '系统将触发安全结算并写入审计日志。确认继续？', success: async res => { if (!res.confirm) return; try { await forceEndRoom(room.id); uni.showToast({ title: '房间已结束', icon: 'success' }); this.loadRooms(this.roomPagination.page); this.loadAudit() } catch (e) { this.notify(e, '结束房间失败') } } }) },
    async toggleCs(staff) { const status = staff.csStatus === 'online' ? 'offline' : 'online'; try { await setCsStatus(staff.id, status); staff.csStatus = status; uni.showToast({ title: status === 'online' ? '已开启接待' : '已关闭接待', icon: 'success' }) } catch (e) { this.notify(e, '切换客服状态失败') } }, async saveConfig() { try { await updateSystemConfig(this.systemConfig); uni.showToast({ title: '配置已保存', icon: 'success' }) } catch (e) { this.notify(e, '保存配置失败') } }, async reloadEconomy() { uni.showModal({ title: '重载经济模型', content: '将刷新服务端经济配置缓存，确认继续？', success: async res => { if (!res.confirm) return; try { await reloadEconomyV2(); uni.showToast({ title: '重载成功', icon: 'success' }) } catch (e) { this.notify(e, '重载失败') } } }) },
    roleLabel(role) { return ({ player: '玩家', agent: '代理', top_agent: '总代理', customer_service: '客服', admin: '管理员' })[role] || role || '-' }, formatTime(value) { if (!value) return '-'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false }) }, notify(error, fallback) { uni.showToast({ title: error?.error || error?.message || fallback, icon: 'none' }) },
    async loadInviteCode() { try { const data = await getInviteCode(); this.currentInviteCode = data.inviteCode || data.code || data.invite_code || ''; this.inviteCodeInfo = data; uni.showToast({ title: '邀请码已刷新', icon: 'success' }) } catch (e) { this.notify(e, '获取邀请码失败') } },
    async regenerateInviteCode() { uni.showModal({ title: '重新生成邀请码', content: '确定要重新生成邀请码吗？旧邀请码将失效。', success: async res => { if (!res.confirm) return; try { const data = await generateInviteCode(); this.currentInviteCode = data.inviteCode || data.code || data.invite_code || ''; this.inviteCodeInfo = data; uni.showToast({ title: '邀请码已重新生成', icon: 'success' }) } catch (e) { this.notify(e, '生成邀请码失败') } } }) },
    copyInviteCode() { if (!this.currentInviteCode) return; uni.setClipboardData({ data: this.currentInviteCode, success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' }) }) },
    openCsEditor(staff) { this.csEditor = { visible: true, mode: staff ? 'edit' : 'create', target: staff || null, form: staff ? { account: staff.account || '', password: '', nickname: staff.nickname || '' } : { account: '', password: '', nickname: '' } } },
    closeCsEditor() { this.csEditor.visible = false },
    async saveCs() { const form = this.csEditor.form; if (!form.account || (this.csEditor.mode === 'create' && !form.password)) return uni.showToast({ title: '请填写账号与密码', icon: 'none' }); try { if (this.csEditor.mode === 'create') { await createUser({ ...form, role: 'customer_service' }); uni.showToast({ title: '客服已创建', icon: 'success' }) } else { await updateUser(this.csEditor.target.id || this.csEditor.target.userId, { nickname: form.nickname }); if (form.password) { await updateUser(this.csEditor.target.id || this.csEditor.target.userId, { password: form.password }) } uni.showToast({ title: '客服已更新', icon: 'success' }) } this.closeCsEditor(); this.loadService() } catch (e) { this.notify(e, '保存客服失败') } },
    removeUserById(user) { uni.showModal({ title: '删除用户', content: `确定要删除 ${user.nickname || user.account} 吗？此操作会写入审计日志。`, success: async res => { if (!res.confirm) return; try { await deleteUser(user.id || user.userId); uni.showToast({ title: '用户已删除', icon: 'success' }); this.loadUsers(this.userPagination.page); this.loadService() } catch (e) { this.notify(e, '删除用户失败') } } }) }
  }
}
</script>

<style lang="scss" scoped>
.admin-desk{display:flex;min-height:100vh;background:#10151c;color:var(--color-text)}.desk-sidebar{width:22vw;max-width:260px;min-width:190px;padding:3vh 1.2vw;background:#151c25;border-right:1px solid rgba(255,255,255,.08)}.brand-block{padding:1vh 1vw 3vh}.brand-title,.brand-subtitle,.view-title,.view-desc,.metric-value,.metric-label,.primary-text,.secondary-text,.quick-title,.quick-desc{display:block}.brand-title{font-size:var(--text-lg);font-weight:700}.brand-subtitle,.view-desc,.secondary-text,.metric-label,.quick-desc,.updated-at{font-size:var(--text-xs);color:var(--color-text-muted);margin-top:.4vh}.nav-list{height:82vh}.nav-item{height:5.8vh;min-height:44px;padding:0 1vw;display:flex;align-items:center;gap:1vw;border-radius:6px;color:var(--color-text-muted);font-size:var(--text-sm)}.nav-item.active{background:rgba(255,215,0,.1);color:var(--color-text);border:1px solid rgba(255,215,0,.24)}.desk-main{flex:1;min-width:0;display:flex;flex-direction:column}.desk-header{padding:2.5vh 2vw;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}.view-title{font-size:var(--text-lg);font-weight:700}.header-actions,.toolbar,.toolbar-actions,.row-actions,.modal-actions{display:flex;align-items:center;gap:1vh}.icon-action{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.12);border-radius:6px}.desk-content{flex:1;height:0;padding:2vh 2vw;box-sizing:border-box}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1vw}.metric-grid.compact{margin-bottom:2vh}.metric-card{min-height:14vh;padding:2vh 1.2vw;border:1px solid rgba(255,255,255,.07);border-radius:7px;display:flex;flex-direction:column;justify-content:center;gap:.7vh}.metric-value{font-size:var(--text-xl);font-weight:700}.overview-section{margin-top:3vh}.section-title{display:block;font-size:var(--text-sm);font-weight:700;margin-bottom:1.2vh}.quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1vw}.quick-card{min-height:13vh;padding:1.8vh 1.2vw;display:flex;align-items:center;gap:1vw;border-radius:7px;border:1px solid rgba(255,255,255,.07)}.quick-title{font-size:var(--text-sm);font-weight:700}.toolbar{padding:1vh;margin-bottom:1.5vh;border-radius:7px;flex-wrap:wrap}.filter-input,.select-control{height:42px;min-width:150px;padding:0 12px;background:rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.12);border-radius:5px;color:var(--color-text);font-size:var(--text-xs)}.select-control{display:flex;align-items:center;box-sizing:border-box}.command-btn{height:42px;padding:0 14px;border:1px solid rgba(255,255,255,.16);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);color:var(--color-text)}.command-btn.primary{background:var(--color-gold);border-color:var(--color-gold);color:#18130a;font-weight:700}.command-btn.danger,.danger-action{color:#FCA5A5}.data-table{border-radius:7px;overflow:hidden}.table-head,.table-row{display:grid;align-items:center;gap:1vw;padding:1.2vh 1vw}.table-head{background:rgba(255,255,255,.06);font-size:var(--text-xs);color:var(--color-text-muted)}.table-row{min-height:58px;border-top:1px solid rgba(255,255,255,.06);font-size:var(--text-xs)}.user-row{grid-template-columns:2fr .8fr .8fr .7fr 1.4fr}.room-row{grid-template-columns:1.4fr 1fr .7fr .7fr 1.2fr}.agent-row{grid-template-columns:1.5fr .8fr .7fr .7fr 1.2fr}.ledger-row,.audit-row{grid-template-columns:repeat(4,1fr)}.cs-row{grid-template-columns:1.5fr repeat(3,.8fr) 1.2fr}.row-actions text{color:var(--color-info)}.primary-text{font-size:var(--text-xs);color:var(--color-text)}.status-success{color:var(--color-success)}.status-danger{color:var(--color-danger)}.empty-state{padding:8vh 0;text-align:center;font-size:var(--text-sm);color:var(--color-text-muted)}.config-card{max-width:700px;padding:2vh;border-radius:7px}.field{margin-bottom:1.6vh}.field>text{display:block;margin-bottom:.7vh;font-size:var(--text-xs);color:var(--color-text-muted)}.field .filter-input{width:100%;box-sizing:border-box}.modal-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:2vh;box-sizing:border-box}.modal-panel{width:min(500px,100%);padding:2vh;border-radius:8px;border:1px solid rgba(255,255,255,.12)}.modal-head{display:flex;justify-content:space-between;align-items:center;font-size:var(--text-base);font-weight:700;margin-bottom:2vh}.form-stack{display:flex;flex-direction:column}.modal-actions{justify-content:flex-end;margin-top:2vh}.adjust-target{display:block;margin-bottom:1.5vh;font-size:var(--text-xs);color:var(--color-text-muted)}.invite-code-display{display:flex;align-items:center;gap:1vh}.invite-code-text{flex:1;font-size:var(--text-base);font-weight:700;color:var(--color-gold);letter-spacing:2px;word-break:break-all}.invite-tip{margin-top:2vh;padding:1.5vh;border-radius:6px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2)}.tip-text{font-size:var(--text-xs);color:var(--color-text-muted);line-height:1.6}@media(max-width:900px){.admin-desk{min-height:100vh}.desk-sidebar{width:64px;min-width:64px;padding:2vh 8px}.brand-block{display:none}.nav-item{justify-content:center;padding:0}.nav-item text{display:none}.desk-header{padding:2vh 3vw}.desk-content{padding:2vh 3vw}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:2vw}.quick-grid{grid-template-columns:1fr}.table-head{display:none}.table-row{display:flex;flex-wrap:wrap;gap:1vh;padding:1.5vh 3vw}.table-row>text,.table-row>view{min-width:40%}.row-actions{width:100%}.filter-input{min-width:0;flex:1}.updated-at{display:none}}
@media (max-width: 900px) {
  .desk-sidebar {
    width: calc(64px + var(--safe-left, 0px));
    min-width: calc(64px + var(--safe-left, 0px));
    padding-left: calc(8px + var(--safe-left, 0px));
    box-sizing: border-box;
  }
}
</style>

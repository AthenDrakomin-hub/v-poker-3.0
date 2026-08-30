<template>
  <ImmersivePage title="管理后台" :show-header="true" :scrollable="true" page-class="theme-admin" :page-style="{ '--font-scale': fontScale }">
    <template #header-left>
      <view class="back-btn touch-active" @click="goBack">
        <VIcon name="back" :size="3.3" color="var(--color-text)" />
      </view>
    </template>
    <template #header-right>
      <view class="admin-badge">
        <VIcon name="gear" :size="2.7" color="var(--color-text-muted)" />
        <text class="badge-text">管理员</text>
      </view>
    </template>

    <!-- 工作台分栏布局 -->
    <view class="workbench-grid">
      <!-- 左侧：全局概览 -->
      <view class="workbench-left">
    <!-- 全局概览 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">全局概览</text>
        <text class="section-time">{{ currentTime }}</text>
      </view>
      <view class="stats-grid">
        <view class="stat-card glass" v-for="(stat, index) in globalStats" :key="index">
          <view class="stat-icon" :style="{ background: stat.color }">
            <VIcon :name="stat.iconName" :size="3" color="#fff" />
          </view>
          <view class="stat-content">
            <text class="stat-value">{{ stat.value }}</text>
            <text class="stat-label">{{ stat.label }}</text>
          </view>
        </view>
      </view>
    </view>
      </view>

      <!-- 右侧：功能管理 + 在线房间 -->
      <view class="workbench-right">

    <!-- 功能管理 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">功能管理</text>
      </view>
      <view class="menu-grid">
        <view v-for="(menu, index) in adminMenus" :key="index" class="menu-card glass" @click="openModal(menu.action)">
          <view class="menu-icon" :style="{ background: menu.color }">
            <VIcon :name="menu.iconName" :size="3.8" color="#fff" />
          </view>
          <text class="menu-name">{{ menu.name }}</text>
          <text class="menu-desc">{{ menu.desc }}</text>
          <view v-if="menu.badge" class="menu-badge">
            <text>{{ menu.badge }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 在线房间 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">在线房间</text>
        <text class="section-link" @click="openModal('rooms')">全部房间</text>
      </view>
      <view class="room-list">
        <view v-for="room in onlineRooms.slice(0, 5)" :key="room.id" class="room-card glass">
          <view class="room-info">
            <view class="room-header">
              <text class="room-name">房间#{{ room.roomNo || room.id }}</text>
              <view class="room-status" :class="room.status">
                <text>{{ room.status === 'playing' ? '游戏中' : '等待中' }}</text>
              </view>
            </view>
            <view class="room-meta">
              <text class="meta-item">{{ formatGameType(room.gameType) }}</text>
              <text class="meta-item">{{ room.level || '-' }}级</text>
              <text class="meta-item">{{ room.maxSeats || 0 }}人桌</text>
            </view>
          </view>
          <view class="room-actions">
            <view class="action-btn action-danger touch-active" @click="dissolveRoom(room)">
              <text>解散</text>
            </view>
          </view>
        </view>
        <view v-if="onlineRooms.length === 0 && !isLoading" class="empty-list">
          <text class="empty-text">暂无在线房间</text>
        </view>
      </view>
    </view>
      </view>
    </view>

    <view class="bottom-spacing"></view>

    <template #modal>
    <!-- ========== 用户管理弹窗 ========== -->
    <view v-if="showUserModal" class="modal-overlay" @click="closeModal('user')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">用户管理</text>
          <view class="modal-close-btn touch-active" @click="closeModal('user')">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="search-bar">
            <input class="search-input" v-model="userSearch" placeholder="搜索用户ID/账号" @confirm="searchUsers" />
            <view class="search-btn touch-active" @click="searchUsers">搜索</view>
            <view class="search-btn btn-primary touch-active" @click="openUserEditor()">新增用户</view>
          </view>
          <view class="data-list">
            <view v-for="user in userList" :key="user.id || user.userId" class="data-item">
              <view class="data-avatar">
                <text>{{ (user.account || user.nickname || 'U').charAt(0).toUpperCase() }}</text>
              </view>
              <view class="data-info">
                <text class="data-name">{{ user.account || user.nickname || '用户#' + user.id }}</text>
                <text class="data-sub">ID: {{ user.id || user.userId }} | 筹码: {{ user.points || 0 }} | 角色: {{ user.role || '玩家' }} | 邀请码: {{ user.inviteCode || user.invite_code || '-' }}</text>
              </view>
              <view class="data-actions">
                <view class="mini-btn touch-active" @click="openUserEditor(user)">编辑</view>
                <view class="mini-btn touch-active" @click="adjustUserPoints(user)">调整</view>
                <view class="mini-btn touch-active" :class="user.frozen ? 'btn-warn' : 'btn-success' touch-active" @click="toggleUserStatus(user)">
                  {{ user.frozen ? '解冻' : '冻结' }}
                </view>
                <view class="mini-btn btn-danger touch-active" @click="removeUser(user)">删除</view>
              </view>
            </view>
            <view v-if="userList.length === 0 && !modalLoading" class="empty-list">
              <text class="empty-text">暂无用户</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 房间管理弹窗 ========== -->
    <view v-if="showRoomModal" class="modal-overlay" @click="closeModal('room')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">房间管理</text>
          <view class="modal-close-btn touch-active" @click="closeModal('room')">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="data-list">
            <view v-for="room in allRooms" :key="room.id" class="data-item">
              <view class="data-avatar">
                <VIcon name="cards" :size="3" color="#fff" />
              </view>
              <view class="data-info">
                <text class="data-name">房间#{{ room.roomNo || room.id }}</text>
                <text class="data-sub">{{ formatGameType(room.gameType) }} | {{ room.level || '-' }}级 | {{ room.maxSeats || 0 }}人桌 | 代理: {{ room.agentName || room.agentId || '-' }}</text>
              </view>
              <view class="data-actions">
                <view class="mini-btn touch-active" @click="viewRoomDetail(room)">详情</view>
                <view class="mini-btn btn-danger touch-active" @click="dissolveRoom(room)">解散</view>
              </view>
            </view>
            <view v-if="allRooms.length === 0 && !modalLoading" class="empty-list">
              <text class="empty-text">暂无房间</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 房间详情弹窗 ========== -->
    <view v-if="showRoomDetailModal" class="modal-overlay" @click="closeModal('roomDetail')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">房间详情 #{{ roomDetail.roomNo || roomDetail.id }}</text>
          <view class="modal-close-btn touch-active" @click="closeModal('roomDetail')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="detail-grid">
            <view class="detail-item"><text class="detail-label">游戏</text><text class="detail-value">{{ formatGameType(roomDetail.gameType) || '-' }}</text></view>
            <view class="detail-item"><text class="detail-label">等级</text><text class="detail-value">{{ roomDetail.level || '-' }}</text></view>
            <view class="detail-item"><text class="detail-label">状态</text><text class="detail-value">{{ formatRoomStatus(roomDetail.status) || '-' }}</text></view>
            <view class="detail-item"><text class="detail-label">局数</text><text class="detail-value">{{ roomDetail.currentRound || 0 }}/{{ roomDetail.totalRounds || 25 }}</text></view>
            <view class="detail-item"><text class="detail-label">流水</text><text class="detail-value">{{ roomDetail.totalFlow || 0 }}</text></view>
            <view class="detail-item"><text class="detail-label">抽水</text><text class="detail-value">{{ roomDetail.totalRake || 0 }}</text></view>
          </view>
          <view class="section-subtitle">玩家列表 ({{ roomDetailPlayers.length }})</view>
          <view class="data-list">
            <view v-for="p in roomDetailPlayers" :key="p.userId || p.id" class="data-item">
              <view class="data-avatar"><text>{{ (p.account || 'P').charAt(0).toUpperCase() }}</text></view>
              <view class="data-info">
                <text class="data-name">{{ p.account || p.nickname || '玩家' }}</text>
                <text class="data-sub">座位: {{ p.seat }} | 筹码: {{ p.points || 0 }} | 准备: {{ p.ready ? '是' : '否' }}</text>
              </view>
            </view>
            <view v-if="roomDetailPlayers.length === 0" class="empty-list"><text class="empty-text">暂无玩家</text></view>
          </view>
          <view class="detail-actions"><view class="action-btn action-danger touch-active" @click="dissolveRoom(roomDetail)">强制结束房间</view></view>
        </view>
      </view>
    </view>

    <!-- ========== 代理管理弹窗 ========== -->
    <view v-if="showAgentModal" class="modal-overlay" @click="closeModal('agent')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">代理管理</text>
          <view class="modal-close-btn touch-active" @click="closeModal('agent')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="search-bar">
            <input class="search-input" v-model="agentSearch" placeholder="搜索代理账号/邀请码" @confirm="searchAgents" />
            <view class="search-btn touch-active" @click="searchAgents">搜索</view>
            <view class="search-btn btn-primary touch-active" @click="openAgentEditor()">新增代理</view>
          </view>
          <view class="data-list">
            <view v-for="agent in agentList" :key="agent.id || agent.userId" class="data-item">
              <view class="data-avatar agent-avatar"><text>{{ (agent.account || agent.nickname || 'A').charAt(0).toUpperCase() }}</text></view>
              <view class="data-info">
                <text class="data-name">{{ agent.account || agent.nickname || '代理#' + agent.id }}</text>
                <text class="data-sub">ID: {{ agent.id }} | 角色: {{ agent.role === 'top_agent' ? '总代理' : '代理' }} | 邀请码: {{ agent.inviteCode || '-' }} | 筹码: {{ agent.points || 0 }}</text>
              </view>
              <view class="data-actions">
                <view class="mini-btn touch-active" @click="openAgentEditor(agent)">编辑</view>
                <view class="mini-btn touch-active" @click="adjustAgentPoints(agent)">调筹码</view>
                <view class="mini-btn touch-active" :class="agent.frozen ? 'btn-warn' : 'btn-success' touch-active" @click="toggleAgentStatus(agent)">
                  {{ agent.frozen ? '解冻' : '冻结' }}
                </view>
                <view class="mini-btn btn-danger touch-active" @click="removeAgent(agent)">删除</view>
              </view>
            </view>
            <view v-if="agentList.length === 0 && !modalLoading" class="empty-list"><text class="empty-text">暂无代理数据</text></view>
          </view>
        </view>
      </view>
    </view>


    <!-- ========== 代理编辑弹窗 ========== -->
    <view v-if="showAgentEditor" class="modal-overlay" @click="closeModal('agentEditor')">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ editingAgent ? '编辑代理' : '新增代理' }}</text>
          <view class="modal-close-btn touch-active" @click="closeModal('agentEditor')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="form-group">
            <text class="form-label">账号</text>
            <input class="input-field" v-model="agentForm.account" placeholder="请输入账号" :disabled="!!editingAgent" />
          </view>
          <view class="form-group" v-if="!editingAgent">
            <text class="form-label">密码</text>
            <input class="input-field" v-model="agentForm.password" type="password" placeholder="请输入密码" />
          </view>
          <view class="form-group">
            <text class="form-label">角色</text>
            <view class="role-selector">
              <view class="role-option" :class="{ active: agentForm.role === 'agent' }" @click="agentForm.role = 'agent'">
                <text>代理</text>
              </view>
              <view class="role-option" :class="{ active: agentForm.role === 'top_agent' }" @click="agentForm.role = 'top_agent'">
                <text>总代理</text>
              </view>
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">初始筹码</text>
            <input class="input-field" v-model="agentForm.points" type="number" placeholder="请输入初始筹码" />
          </view>
          <view class="form-actions">
            <view class="action-btn touch-active" @click="closeModal('agentEditor')"><text>取消</text></view>
            <view class="action-btn action-primary touch-active" @click="saveAgent"><text>保存</text></view>
          </view>
        </view>
      </view>
    </view>
    <!-- ========== 财务中心弹窗 ========== -->
    <view v-if="showFinanceModal" class="modal-overlay" @click="closeModal('finance')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">财务中心</text>
          <view class="modal-close-btn touch-active" @click="closeModal('finance')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="finance-stats">
            <view class="finance-card"><text class="finance-label">今日流水</text><text class="finance-value">{{ financeStats.todayFlow || 0 }}</text></view>
            <view class="finance-card"><text class="finance-label">今日抽水</text><text class="finance-value">{{ financeStats.todayRake || 0 }}</text></view>
            <view class="finance-card"><text class="finance-label">累计流水</text><text class="finance-value">{{ financeStats.totalFlow || 0 }}</text></view>
            <view class="finance-card"><text class="finance-label">累计抽水</text><text class="finance-value">{{ financeStats.totalRake || 0 }}</text></view>
          </view>
          <view class="section-subtitle">最近流水记录</view>
          <view class="data-list">
            <view v-for="record in ledgerList" :key="record.id" class="data-item">
              <view class="data-avatar finance-avatar"><VIcon name="coin" :size="3" color="#fff" /></view>
              <view class="data-info">
                <text class="data-name">{{ record.type || record.action || '流水' }}</text>
                <text class="data-sub">{{ record.userId || '-' }} | {{ record.time || record.createdAt || '-' }}</text>
              </view>
              <view class="data-amount" :class="record.amount > 0 ? 'amount-positive' : 'amount-negative'">{{ record.amount > 0 ? '+' : '' }}{{ record.amount || 0 }}</view>
            </view>
            <view v-if="ledgerList.length === 0 && !modalLoading" class="empty-list"><text class="empty-text">暂无流水记录</text></view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 审计日志弹窗 ========== -->
    <view v-if="showAuditModal" class="modal-overlay" @click="closeModal('audit')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">审计日志</text>
          <view class="modal-close-btn touch-active" @click="closeModal('audit')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="log-list">
            <view v-for="(log, index) in auditLogs" :key="log.id || index" class="log-item">
              <view class="log-type" :class="log.type"><VIcon name="more" :size="2.7" color="var(--color-text-muted)" /></view>
              <view class="log-content">
                <view class="log-top">
                  <text class="log-action">{{ log.action || log.type }}</text>
                  <text class="log-time">{{ log.time || log.createdAt }}</text>
                </view>
                <text class="log-detail">{{ log.detail || log.reason }}</text>
                <view class="log-meta">
                  <text class="log-operator">操作人: {{ log.operator || log.operatorName }}</text>
                  <text class="log-ip">IP: {{ log.ip || '-' }}</text>
                </view>
              </view>
            </view>
            <view v-if="auditLogs.length === 0 && !modalLoading" class="empty-list"><text class="empty-text">暂无审计日志</text></view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 系统配置弹窗 ========== -->
    <view v-if="showConfigModal" class="modal-overlay" @click="closeModal('config')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">系统配置</text>
          <view class="modal-close-btn touch-active" @click="closeModal('config')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="config-group">
            <text class="config-group-title">APP 配置</text>
            <view class="config-item"><text class="config-label">当前版本</text><input class="config-input" v-model="systemConfig.app_version" /></view>
            <view class="config-item"><text class="config-label">下载地址</text><input class="config-input" v-model="systemConfig.app_download_url" /></view>
          </view>
          <view class="config-actions">
            <view class="config-btn config-btn-primary touch-active" @click="saveSystemConfig">保存配置</view>
            <view class="config-btn touch-active" @click="reloadEconomyConfig">重载经济模型</view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 调整筹码弹窗 ========== -->
    <view v-if="showAdjustModal" class="modal-overlay" @click="showAdjustModal = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">调整用户筹码</text>
          <view class="modal-close-btn touch-active" @click="showAdjustModal = false"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="adjust-user-info">
            <text>用户: {{ adjustTarget?.account || adjustTarget?.nickname || '-' }}</text>
            <text>当前筹码: {{ adjustTarget?.points || 0 }}</text>
          </view>
          <view class="form-group">
            <text class="form-label">调整数量(正数增加/负数减少)</text>
            <input class="form-input" type="digit" v-model="adjustAmount" placeholder="请输入数量" />
          </view>
          <view class="form-group">
            <text class="form-label">调整原因</text>
            <input class="form-input" v-model="adjustReason" placeholder="请输入原因" />
          </view>
          <view class="modal-footer">
            <view class="btn-cancel touch-active" @click="showAdjustModal = false">取消</view>
            <view class="btn-confirm touch-active" @click="confirmAdjustPoints">确认调整</view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 权限管理弹窗 ========== -->
    <view v-if="showPermissionModal" class="modal-overlay" @click="closeModal('permission')">
      <view class="modal-content modal-xlarge glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">权限管理</text>
          <view class="modal-close-btn touch-active" @click="closeModal('permission')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body permission-body">
          <view class="permission-role-tabs">
            <view v-for="role in permissionRoles" :key="role.key" class="permission-role-tab" :class="{ active: selectedRole === role.key }" @click="selectPermissionRole(role.key)">
              <text class="role-tab-label">{{ role.label }}</text>
              <text class="role-tab-desc">{{ role.desc }}</text>
            </view>
          </view>
          <view class="permission-toolbar">
            <text class="permission-hint">勾选 = 该角色可见/可用，取消勾选 = 隐藏</text>
            <view class="permission-actions">
              <view class="mini-btn btn-ghost touch-active" @click="resetCurrentRolePermissions">重置默认</view>
              <view class="mini-btn btn-primary touch-active" :class="{ disabled: !permissionDirty }" @click="savePermissions">{{ permissionDirty ? '保存修改' : '已保存' }}</view>
            </view>
          </view>
          <scroll-view class="permission-matrix-scroll" scroll-y>
            <view v-for="(features, category) in featuresByCategory" :key="category" class="permission-category">
              <view class="permission-category-header">
                <text class="category-title">{{ category }}</text>
                <text class="category-count">{{ features.length }} 项</text>
              </view>
              <view class="permission-list">
                <view v-for="feature in features" :key="feature.key" class="permission-item" :class="{ enabled: isFeatureEnabled(feature.key) }" @click="toggleFeature(feature.key)">
                  <view class="perm-icon-wrap"><VIcon :name="feature.icon" :size="3" :color="isFeatureEnabled(feature.key) ? 'var(--color-gold)' : 'var(--color-text-muted)'" /></view>
                  <view class="perm-info">
                    <text class="perm-label">{{ feature.label }}</text>
                    <text class="perm-key">{{ feature.key }}</text>
                  </view>
                  <view class="perm-switch" :class="{ on: isFeatureEnabled(feature.key) }"><view class="perm-switch-thumb"></view></view>
                </view>
              </view>
            </view>
          </scroll-view>
          <view class="permission-footer-note"><text>管理员(admin)权限固定全开，不可修改。修改后对应用户重新进入大厅即生效。</text></view>
        </view>
      </view>
    </view>

    <!-- ========== 客服管理弹窗 ========== -->
    <view v-if="showCsModal" class="modal-overlay" @click="closeModal('cs')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">客服管理</text>
          <view class="modal-close-btn touch-active" @click="closeModal('cs')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="cs-tabs">
            <view class="cs-tab" :class="{ active: csTab === 'staff' }" @click="switchCsTab('staff')">客服人员</view>
            <view class="cs-tab" :class="{ active: csTab === 'stats' }" @click="switchCsTab('stats')">数据统计</view>
          </view>
          <view v-if="csTab === 'staff'" class="cs-staff-panel">
            <view class="cs-stats-bar">
              <view class="cs-stat-item"><text class="cs-stat-value">{{ csStaffList.filter(s => s.csStatus === 'online').length }}</text><text class="cs-stat-label">接待中</text></view>
              <view class="cs-stat-item"><text class="cs-stat-value">{{ csStaffList.filter(s => s.csStatus === 'offline').length }}</text><text class="cs-stat-label">已关闭</text></view>
              <view class="cs-stat-item"><text class="cs-stat-value">{{ csStaffList.length }}</text><text class="cs-stat-label">总客服</text></view>
              <view class="cs-stat-item"><view class="mini-btn btn-primary touch-active" @click="openUserEditor(null, 'customer_service')">新增客服</view></view>
            </view>
            <view v-if="csStaffLoading" class="cs-loading"><text>加载中...</text></view>
            <view v-else class="cs-staff-list">
              <view v-for="staff in csStaffList" :key="staff.id" class="cs-staff-card">
                <view class="cs-staff-avatar"><text class="cs-staff-avatar-text">{{ (staff.nickname || staff.account || '?').charAt(0) }}</text></view>
                <view class="cs-staff-info">
                  <text class="cs-staff-name">{{ staff.nickname || staff.account }}</text>
                  <text class="cs-staff-meta">当前会话 {{ staff.activeSessions || 0 }} · 今日接待 {{ staff.todaySessions || 0 }}</text>
                </view>
                <view class="cs-staff-status" :class="staff.csStatus === 'online' ? 'online' : 'offline'"><text>{{ staff.csStatus === 'online' ? '接待中' : '已关闭' }}</text></view>
                <view class="cs-staff-action">
                  <view class="mini-btn touch-active" @click="openUserEditor(staff)">编辑</view>
                  <view class="cs-toggle-btn touch-active" :class="staff.csStatus === 'online' ? 'btn-off' : 'btn-on' touch-active" @click="toggleCsStatus(staff)"><text>{{ staff.csStatus === 'online' ? '关闭接待' : '开启接待' }}</text></view>
                  <view class="mini-btn btn-danger touch-active" @click="removeUser(staff)">删除</view>
                </view>
              </view>
              <view v-if="csStaffList.length === 0" class="cs-empty"><text>暂无客服人员</text></view>
            </view>
          </view>
          <view v-else class="cs-stats-panel">
            <view class="cs-stats-grid">
              <view class="cs-stat-card"><text class="cs-stat-card-value">{{ csStats.totalMessages || 0 }}</text><text class="cs-stat-card-label">总消息数</text></view>
              <view class="cs-stat-card"><text class="cs-stat-card-value">{{ csStats.totalSessions || 0 }}</text><text class="cs-stat-card-label">总会话数</text></view>
              <view class="cs-stat-card"><text class="cs-stat-card-value">{{ csStats.avgResponseTime || 0 }}s</text><text class="cs-stat-card-label">平均响应</text></view>
              <view class="cs-stat-card"><text class="cs-stat-card-value">{{ csStats.satisfactionRate || 0 }}%</text><text class="cs-stat-card-label">满意度</text></view>
            </view>
            <view class="cs-stats-refresh"><view class="mini-btn btn-primary touch-active" @click="loadCsStats">刷新统计</view></view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 用户编辑弹窗 ========== -->
    <view v-if="showUserEditor" class="modal-overlay" @click="closeUserEditor">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ userEditor.mode === 'create' ? (userEditor.defaultRole === 'customer_service' ? '新增客服' : '新增用户') : '编辑用户' }}</text>
          <view class="modal-close-btn touch-active" @click="closeUserEditor"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="form-group">
            <text class="form-label">账号</text>
            <input class="form-input" v-model="userEditor.form.account" :disabled="userEditor.mode === 'edit'" placeholder="请输入账号" />
          </view>
          <view class="form-group" v-if="userEditor.mode === 'create'">
            <text class="form-label">初始密码</text>
            <input class="form-input" v-model="userEditor.form.password" password placeholder="至少6位" />
          </view>
          <view class="form-group" v-else>
            <text class="form-label">重置密码（留空不修改）</text>
            <input class="form-input" v-model="userEditor.form.password" password placeholder="输入新密码" />
          </view>
          <view class="form-group">
            <text class="form-label">昵称</text>
            <input class="form-input" v-model="userEditor.form.nickname" placeholder="请输入昵称" />
          </view>
          <view class="form-group" v-if="!userEditor.defaultRole">
            <text class="form-label">角色</text>
            <picker :range="roleOptions" range-key="label" @change="onEditorRoleChange">
              <view class="form-input picker-input">{{ editorRole.label }}</view>
            </picker>
          </view>
        </view>
        <view class="modal-footer">
          <view v-if="userEditor.mode === 'edit'" class="modal-btn btn-danger touch-active" @click="removeUser(userEditor.target)">删除用户</view>
          <view class="modal-btn btn-primary touch-active" @click="saveUserEditor">保存</view>
          <view class="modal-btn touch-active" @click="closeUserEditor">取消</view>
        </view>
      </view>
    </view>

    <!-- ========== 经济配置弹窗 ========== -->
    <view v-if="showEconomyModal" class="modal-overlay" @click="closeModal('economy')">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">经济配置</text>
          <view class="modal-close-btn touch-active" @click="closeModal('economy')"><VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <view class="economy-tabs">
            <view class="economy-tab" :class="{ active: economyTab === 'games' }" @click="economyTab = 'games'">游戏配置</view>
            <view class="economy-tab" :class="{ active: economyTab === 'templates' }" @click="economyTab = 'templates'">房间模板</view>
            <view class="economy-tab" :class="{ active: economyTab === 'history' }" @click="economyTab = 'history'">修改历史</view>
          </view>
          <view v-if="economyTab === 'games'" class="economy-games-list">
            <view v-for="cfg in economyGameConfigs" :key="cfg.gameType" class="economy-game-card">
              <view class="economy-game-header">
                <text class="economy-game-name">{{ cfg.gameName || formatGameType(cfg.gameType) }}</text>
                <view class="mini-btn btn-primary touch-active" @click="editEconomyGame(cfg)">编辑</view>
              </view>
              <view class="economy-game-meta">
                <text>抽水: {{ cfg.rakeRate || 0 }}%</text>
                <text>抽水基数: {{ cfg.rakeBase || 0 }}</text>
                <text>代理返佣: {{ cfg.agentCommission || 0 }}%</text>
                <text>总代返佣: {{ cfg.topAgentCommission || 0 }}%</text>
              </view>
            </view>
            <view v-if="economyGameConfigs.length === 0" class="empty-list"><text class="empty-text">暂无游戏配置</text></view>
          </view>
          <view v-else-if="economyTab === 'templates'" class="economy-templates-list">
            <view v-for="tpl in economyTemplates" :key="tpl.id" class="economy-template-card">
              <text class="tpl-name">{{ tpl.name || tpl.level + '级' }}</text>
              <text class="tpl-meta">底注: {{ tpl.ante || 0 }} | 上限: {{ tpl.maxBet || 0 }} | 人数: {{ tpl.maxSeats || 0 }}</text>
            </view>
            <view v-if="economyTemplates.length === 0" class="empty-list"><text class="empty-text">暂无房间模板</text></view>
          </view>
          <view v-else class="economy-history-list">
            <view v-for="h in economyHistory" :key="h.id" class="economy-history-item">
              <text class="history-action">{{ h.action || '修改' }}</text>
              <text class="history-time">{{ h.time || h.createdAt }}</text>
              <text class="history-operator">{{ h.operator || '-' }}</text>
            </view>
            <view v-if="economyHistory.length === 0" class="empty-list"><text class="empty-text">暂无修改历史</text></view>
          </view>
        </view>
      </view>
    </view>
    </template>

    <view class="bottom-spacing"></view>
  </ImmersivePage>
  <AdminOperationsDesk />
</template>

<script>
import { formatGameType, formatRoomStatus } from '../../utils/format.js'
import {
  getAdminStats,
  getAdminRoomList,
  forceEndRoom,
  getAuditLogs,
  getUserList,
  createUser,
  updateUser,
  deleteUser,
  adjustUserPoints,
  setUserRole,
  freezeUser,
  unfreezeUser,
  getAdminLedger,
  getSystemConfig,
  updateSystemConfig,
  reloadEconomyV2,
  getCsStaff,
  getCsReport,
  setCsStatus,
} from '../../api/admin.js'
import { getMe } from '../../api/auth.js'
import { get } from '../../api/request.js'
import { getFontScale } from '../../utils/fontScale.js'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import VIcon from '../../components/ui/VIcon.vue'
import AdminOperationsDesk from '../../components/admin/AdminOperationsDesk.vue'
import { getFeaturesByCategory } from '../../utils/featurePermissions.js'
import { getAllPermissions, updateRolePermissions, resetRolePermissions } from '../../api/permissions.js'

export default {
  name: 'AdminDashboard',
  components: { ImmersivePage, VIcon, AdminOperationsDesk },

  data() {
    return {
      currentTime: '',
      fontScale: 1.0,
      isLoading: false,
      modalLoading: false,
      globalStats: [
        { iconName: 'user', label: '总用户', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-text-muted), var(--color-bg-card))' },
        { iconName: 'cards', label: '代理数', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-success), var(--color-success))' },
        { iconName: 'more', label: '在线房间', value: '0', trend: 0, color: 'linear-gradient(135deg, #4299E1, var(--color-info))' },
        { iconName: 'coin', label: '累计流水', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-dark))' },
        { iconName: 'more', label: '累计抽水', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--theme-primary), var(--theme-primary))' },
        { iconName: 'warning', label: '客服调整', value: '0', trend: 0, color: 'linear-gradient(135deg, var(--color-danger), var(--color-danger))' },
      ],
      adminMenus: [
        { name: '用户管理', desc: '用户列表/冻结/调整', iconName: 'user', color: 'linear-gradient(135deg, #4299E1, var(--color-info))', badge: null, action: 'users' },
        { name: '房间管理', desc: '房间列表/解散/监控', iconName: 'more', color: 'linear-gradient(135deg, var(--color-success), var(--color-success))', badge: null, action: 'rooms' },
        { name: '代理管理', desc: '代理层级/返佣配置', iconName: 'user', color: 'linear-gradient(135deg, var(--theme-primary), var(--theme-primary))', badge: null, action: 'agents' },
        { name: '客服管理', desc: '接待状态/工作统计', iconName: 'headset', color: 'linear-gradient(135deg, var(--color-info), #319795)', badge: null, action: 'cs' },
        { name: '财务中心', desc: '流水/抽水/对账', iconName: 'coin', color: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-dark))', badge: null, action: 'finance' },
        { name: '审计日志', desc: '操作记录/安全审计', iconName: 'more', color: 'linear-gradient(135deg, var(--color-text-muted), var(--color-bg-card))', badge: null, action: 'audit' },
        { name: '系统配置', desc: '版本/下载地址', iconName: 'gear', color: 'linear-gradient(135deg, var(--color-text-muted), var(--color-text-muted))', badge: null, action: 'config' },
        { name: '权限管理', desc: '角色功能/菜单显隐', iconName: 'gear', color: 'linear-gradient(135deg, var(--color-gold), #D69E2E)', badge: null, action: 'permissions' },
        { name: '经济配置', desc: '抽水比例/房间模板', iconName: 'coin', color: 'linear-gradient(135deg, #9F7AEA, #6B46C1)', badge: null, action: 'economy' },
      ],
      onlineRooms: [],
      auditLogs: [],
      // 弹窗状态
      showUserModal: false,
      showRoomModal: false,
      showRoomDetailModal: false,
      roomDetail: {},
      roomDetailPlayers: [],
      showAgentModal: false,
      showFinanceModal: false,
      showAuditModal: false,
      showConfigModal: false,
      showPermissionModal: false,
      showAdjustModal: false,
      showCsModal: false,
      showEconomyModal: false,
      economyTab: 'games',
      economyGameConfigs: [],
      economyTemplates: [],
      economyHistory: [],
      // 用户编辑器
      showUserEditor: false,
      userEditor: { mode: 'create', target: null, defaultRole: '', form: { account: '', password: '', nickname: '', role: 'player' } },
      roleOptions: [{ label: '玩家', value: 'player' }, { label: '代理', value: 'agent' }, { label: '总代理', value: 'top_agent' }, { label: '客服', value: 'customer_service' }],
      // 客服管理
      csStaffList: [],
      csStaffLoading: false,
      csStats: {},
      csTab: 'staff', // staff | stats
      // 权限管理
      permissionRoles: [
        { key: 'player', label: '普通玩家', desc: '基础游戏用户' },
        { key: 'agent', label: '代理', desc: '可创建房间' },
        { key: 'top_agent', label: '总代', desc: '管理下线代理' },
        { key: 'customer_service', label: '客服', desc: '客服工作台' },
      ],
      selectedRole: 'player',
      rolePermissions: {}, // { role: { featureKey: boolean } }
      permissionDirty: false,
      // 用户管理
      userSearch: '',
      userList: [],
      userPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      // 房间管理
      allRooms: [],
      roomPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      // 代理管理
      agentList: [],
      agentPagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      agentSearch: '',
      showAgentEditor: false,
      editingAgent: null,
      agentForm: { account: '', password: '', role: 'agent', points: '' },
      // 财务中心
      financeStats: {},
      ledgerList: [],
      // 系统配置
      systemConfig: { app_version: '', app_download_url: '' },
      // 调整筹码
      adjustTarget: null,
      adjustAmount: '',
      adjustReason: '',
    }
  },
  computed: {
    editorRole() { return this.roleOptions.find(r => r.value === this.userEditor.form.role) || this.roleOptions[0] },
    featuresByCategory() {
      return getFeaturesByCategory()
    },
  },
  onLoad() {
    this.updateTime()
    this.fontScale = getFontScale()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    this.timeInterval = setInterval(() => {
      this.updateTime()
    }, 1000)
    this.checkRoleAndLoad()
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
    }
  },
  methods: {
    onFontScaleChange(scale) {
      this.fontScale = scale
    },
    // 角色校验：仅 admin 可访问
    async checkRoleAndLoad() {
      try {
        const res = await getMe()
        const role = res.user?.role || res.data?.user?.role
        if (role !== 'admin') {
          uni.showToast({ title: '无权限访问', icon: 'none' })
          setTimeout(() => uni.reLaunch({ url: '/pages/lobby/lobby' }), 800)
          return
        }
        this.loadAllData()
      } catch (e) {
        console.error('[Admin] 角色校验失败', e)
        uni.showToast({ title: '登录态失效，请重新登录', icon: 'none' })
        setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
      }
    },
    async loadAllData() {
      this.isLoading = true
      try {
        await Promise.all([
          this.loadStats(),
          this.loadRooms(),
          this.loadAuditLogs(),
        ])
      } catch (e) {
        console.error('[Admin] 加载数据失败', e)
      } finally {
        this.isLoading = false
      }
    },

    async loadStats() {
      try {
        const data = await getAdminStats()
        if (data) {
          this.globalStats[0].value = data.totalUsers || 0
          this.globalStats[1].value = (data.users && (data.users.agent + data.users.top_agent)) || 0
          this.globalStats[2].value = data.activeRooms || data.onlineRooms || 0
          this.globalStats[3].value = data.totalFlow || data.todayVolume || 0
          this.globalStats[4].value = data.totalRake || data.todayRake || 0
          this.globalStats[5].value = data.v3TotalCsAdjust || 0
          this.adminMenus[1].badge = data.activeRooms || null
          this.financeStats = {
            todayFlow: data.todayVolume || 0,
            todayRake: data.todayRake || 0,
            totalFlow: data.totalFlow || 0,
            totalRake: data.totalRake || 0,
          }
        }
      } catch (e) {
        console.warn('[Admin] 统计数据加载失败', e)
      }
    },

    async loadRooms(page = 1) {
      try {
        const data = await getAdminRoomList({ page, pageSize: this.roomPagination.pageSize })
        this.onlineRooms = Array.isArray(data.data) ? data.data : (data.list || data.rooms || [])
        this.allRooms = this.onlineRooms
        this.roomPagination = data.pagination || { ...this.roomPagination, page }
      } catch (e) {
        console.warn('[Admin] 房间列表加载失败', e)
        this.onlineRooms = []
        this.allRooms = []
      }
    },

    async loadAuditLogs() {
      try {
        const data = await getAuditLogs({ limit: 100 })
        this.auditLogs = Array.isArray(data.data) ? data.data : (data.list || data.logs || [])
      } catch (e) {
        console.warn('[Admin] 审计日志加载失败', e)
        this.auditLogs = []
      }
    },

    async loadUsers(page = 1) {
      this.modalLoading = true
      try {
        const params = { page, pageSize: this.userPagination.pageSize }
        if (this.userSearch.trim()) {
          params.q = this.userSearch.trim()
        }
        const data = await getUserList(params)
        this.userList = Array.isArray(data.data) ? data.data : (data.list || data.users || [])
        this.userPagination = data.pagination || { ...this.userPagination, page }
      } catch (e) {
        console.warn('[Admin] 用户列表加载失败', e)
        this.userList = []
      } finally {
        this.modalLoading = false
      }
    },

    searchUsers() {
      this.loadUsers(1)
    },

    async loadAgents(page = 1) {
      this.modalLoading = true
      try {
        const params = { role: 'agent', page, pageSize: this.agentPagination.pageSize }
        if (this.agentSearch.trim()) params.q = this.agentSearch.trim()
        const data = await getUserList(params)
        this.agentList = Array.isArray(data.data) ? data.data : (data.list || data.users || [])
        this.agentPagination = data.pagination || { ...this.agentPagination, page }
      } catch (e) {
        console.warn('[Admin] 代理列表加载失败', e)
        this.agentList = []
      } finally {
        this.modalLoading = false
      }
    },
    searchAgents() {
      this.loadAgents(1)
    },
    openAgentEditor(agent = null) {
      this.editingAgent = agent
      if (agent) {
        this.agentForm = {
          account: agent.account || '',
          password: '',
          role: agent.role || 'agent',
          points: agent.points || ''
        }
      } else {
        this.agentForm = { account: '', password: '', role: 'agent', points: '' }
      }
      this.showAgentEditor = true
    },
    async saveAgent() {
      if (!this.agentForm.account.trim()) {
        uni.showToast({ title: '请输入账号', icon: 'none' })
        return
      }
      if (!this.editingAgent && !this.agentForm.password.trim()) {
        uni.showToast({ title: '请输入密码', icon: 'none' })
        return
      }
      try {
        if (this.editingAgent) {
          await updateUser(this.editingAgent.id, {
            role: this.agentForm.role,
            points: this.agentForm.points ? Number(this.agentForm.points) : undefined
          })
          uni.showToast({ title: '更新成功', icon: 'success' })
        } else {
          await createUser({
            account: this.agentForm.account.trim(),
            password: this.agentForm.password.trim(),
            role: this.agentForm.role,
            points: this.agentForm.points ? Number(this.agentForm.points) : 0
          })
          uni.showToast({ title: '创建成功', icon: 'success' })
        }
        this.showAgentEditor = false
        this.loadAgents(1)
      } catch (e) {
        console.error('[Admin] 保存代理失败', e)
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      }
    },
    async removeAgent(agent) {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除代理「${agent.account}」吗？此操作不可恢复。`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await deleteUser(agent.id)
              uni.showToast({ title: '删除成功', icon: 'success' })
              this.loadAgents(1)
            } catch (e) {
              console.error('[Admin] 删除代理失败', e)
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },
    async toggleAgentStatus(agent) {
      try {
        if (agent.frozen) {
          await unfreezeUser(agent.id)
          uni.showToast({ title: '已解冻', icon: 'success' })
        } else {
          await freezeUser(agent.id)
          uni.showToast({ title: '已冻结', icon: 'success' })
        }
        this.loadAgents(1)
      } catch (e) {
        console.error('[Admin] 切换代理状态失败', e)
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    adjustAgentPoints(agent) {
      this.openAdjustModal(agent)
    },

    async loadLedger() {
      this.modalLoading = true
      try {
        const data = await getAdminLedger()
        this.ledgerList = data.list || data.records || data || []
      } catch (e) {
        console.warn('[Admin] 流水记录加载失败', e)
        this.ledgerList = []
      } finally {
        this.modalLoading = false
      }
    },

    async loadSystemConfig() {
      this.modalLoading = true
      try {
        const data = await getSystemConfig()
        if (data) {
          this.systemConfig = { ...this.systemConfig, ...data }
        }
      } catch (e) {
        console.warn('[Admin] 系统配置加载失败', e)
      } finally {
        this.modalLoading = false
      }
    },

    updateTime() {
      const now = new Date()
      this.currentTime = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    },

    goBack() {
      uni.navigateBack()
    },

    openModal(action) {
      switch (action) {
        case 'users':
          this.showUserModal = true
          this.loadUsers(1)
          break
        case 'rooms':
          this.showRoomModal = true
          this.loadRooms(1)
          break
        case 'agents':
          this.showAgentModal = true
          this.loadAgents(1)
          break
        case 'finance':
          this.showFinanceModal = true
          this.loadLedger()
          break
        case 'audit':
          this.showAuditModal = true
          this.loadAuditLogs()
          break
        case 'config':
          this.showConfigModal = true
          this.loadSystemConfig()
          break
        case 'permissions':
          this.showPermissionModal = true
          this.loadPermissions()
          break
        case 'cs':
          this.showCsModal = true
          this.csTab = 'staff'
          this.loadCsStaff()
          break
        case 'economy':
          uni.navigateTo({ url: '/pages/economy/economy' })
          break
      }
    },

    closeModal(type) {
      switch (type) {
        case 'user':
          this.showUserModal = false
          break
        case 'room':
          this.showRoomModal = false
          break
        case 'agent':
          this.showAgentModal = false
          break
        case 'finance':
          this.showFinanceModal = false
          break
        case 'audit':
          this.showAuditModal = false
          break
        case 'config':
          this.showConfigModal = false
          break
        case 'permission':
          this.showPermissionModal = false
          break
        case 'cs':
          this.showCsModal = false
          break
        case 'roomDetail':
          this.showRoomDetailModal = false
          break
        case 'economy':
          this.showEconomyModal = false
          break
      }
    },

    async viewRoomDetail(room) {
      this.roomDetail = room
      this.roomDetailPlayers = []
      this.showRoomDetailModal = true
      try {
        const res = await get('/api/rooms/' + room.id + '/players')
        if (res && res.players) {
          this.roomDetailPlayers = res.players
        }
      } catch (e) {
        console.warn('[Admin] 加载房间玩家失败', e)
      }
    },

    viewAgentDetail(agent) {
      uni.showToast({ title: `代理ID: ${agent.id}`, icon: 'none' })
    },

    dissolveRoom(room) {
      uni.showModal({
        title: '解散房间',
        content: `确定强制解散房间 #${room.roomNo || room.id} 吗？`,
        confirmColor: 'var(--color-danger)',
        success: async (res) => {
          if (res.confirm) {
            try {
              await forceEndRoom(room.id)
              uni.showToast({ title: '已解散', icon: 'success' })
              this.loadRooms()
              this.loadAuditLogs()
            } catch (e) {
              uni.showToast({ title: e.error || '解散失败', icon: 'none' })
            }
          }
        },
      })
    },

    adjustUserPoints(user) {
      this.adjustTarget = user
      this.adjustAmount = ''
      this.adjustReason = ''
      this.showAdjustModal = true
    },

    async confirmAdjustPoints() {
      if (!this.adjustAmount || parseInt(this.adjustAmount) === 0) {
        uni.showToast({ title: '请输入有效数量', icon: 'none' })
        return
      }
      if (!this.adjustReason.trim()) {
        uni.showToast({ title: '请输入调整原因', icon: 'none' })
        return
      }
      try {
        await adjustUserPoints(
          this.adjustTarget.id || this.adjustTarget.userId,
          parseInt(this.adjustAmount),
          this.adjustReason
        )
        uni.showToast({ title: '调整成功', icon: 'success' })
        this.showAdjustModal = false
        this.loadUsers()
        this.loadStats()
      } catch (e) {
        uni.showToast({ title: e.error || '调整失败', icon: 'none' })
      }
    },

    async toggleUserStatus(user) {
      const userId = user.id || user.userId
      const isFrozen = user.frozen
      try {
        if (isFrozen) {
          await unfreezeUser(userId)
          uni.showToast({ title: '已解冻', icon: 'success' })
        } else {
          await freezeUser(userId)
          uni.showToast({ title: '已冻结', icon: 'success' })
        }
        this.loadUsers()
      } catch (e) {
        uni.showToast({ title: e.error || '操作失败', icon: 'none' })
      }
    },

    async saveSystemConfig() {
      try {
        await updateSystemConfig({
          app_version: this.systemConfig.app_version,
          app_download_url: this.systemConfig.app_download_url,
        })
        uni.showToast({ title: '配置已保存', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '保存失败', icon: 'none' })
      }
    },

    async reloadEconomyConfig() {
      try {
        await reloadEconomyV2()
        uni.showToast({ title: '经济模型已重载', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '重载失败', icon: 'none' })
      }
    },

    // ========== 权限管理 ==========
    async loadPermissions() {
      this.modalLoading = true
      try {
        const data = await getAllPermissions()
        this.rolePermissions = data.permissions || data || {}
        this.permissionDirty = false
      } catch (e) {
        console.warn('[Admin] 权限配置加载失败', e)
      } finally {
        this.modalLoading = false
      }
    },

    selectPermissionRole(roleKey) {
      if (this.permissionDirty) {
        uni.showModal({
          title: '未保存的修改',
          content: '当前角色的权限修改尚未保存，切换角色将丢失修改。是否继续？',
          success: (res) => {
            if (res.confirm) {
              this.selectedRole = roleKey
              this.permissionDirty = false
            }
          },
        })
      } else {
        this.selectedRole = roleKey
      }
    },

    toggleFeature(featureKey) {
      if (!this.rolePermissions[this.selectedRole]) {
        this.$set(this.rolePermissions, this.selectedRole, {})
      }
      const current = this.rolePermissions[this.selectedRole][featureKey]
      this.$set(this.rolePermissions[this.selectedRole], featureKey, !current)
      this.permissionDirty = true
    },

    async savePermissions() {
      try {
        const perms = this.rolePermissions[this.selectedRole] || {}
        await updateRolePermissions(this.selectedRole, perms)
        this.permissionDirty = false
        uni.showToast({ title: '权限已保存', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '保存失败', icon: 'none' })
      }
    },

    resetCurrentRolePermissions() {
      uni.showModal({
        title: '重置权限',
        content: `确定将「${this.getRoleLabel(this.selectedRole)}」恢复为默认权限吗？`,
        confirmColor: 'var(--color-danger)',
        success: async (res) => {
          if (res.confirm) {
            try {
              await resetRolePermissions(this.selectedRole)
              await this.loadPermissions()
              uni.showToast({ title: '已重置为默认', icon: 'success' })
            } catch (e) {
              uni.showToast({ title: e.error || '重置失败', icon: 'none' })
            }
          }
        },
      })
    },

    getRoleLabel(roleKey) {
      const role = this.permissionRoles.find(r => r.key === roleKey)
      return role ? role.label : roleKey
    },

    isFeatureEnabled(featureKey) {
      const perms = this.rolePermissions[this.selectedRole]
      if (!perms) return true
      return perms[featureKey] !== false
    },

    // ========== 客服管理 ==========
    switchCsTab(tab) {
      this.csTab = tab
      if (tab === 'staff') this.loadCsStaff()
      else if (tab === 'stats') this.loadCsStats()
    },

    async loadCsStaff() {
      this.csStaffLoading = true
      try {
        const res = await getCsStaff()
        const list = res.list || res.data?.list || res.data || res || []
        // 兼容后端字段名：cs_status 或 csStatus
        this.csStaffList = (Array.isArray(list) ? list : []).map(s => ({
          ...s,
          csStatus: s.csStatus || s.cs_status || 'offline',
          activeSessions: s.activeSessions ?? s.active_sessions ?? 0,
          todaySessions: s.todaySessions ?? s.today_sessions ?? 0,
        }))
      } catch (e) {
        console.error('[Admin] 加载客服列表失败', e)
        this.csStaffList = []
        uni.showToast({ title: '加载客服列表失败', icon: 'none' })
      } finally {
        this.csStaffLoading = false
      }
    },

    async openUserEditor(user, defaultRole = '') {
      this.userEditor = {
        mode: user ? 'edit' : 'create',
        target: user || null,
        defaultRole: defaultRole,
        form: user
          ? { account: user.account || '', password: '', nickname: user.nickname || '', role: user.role || 'player' }
          : { account: '', password: '', nickname: '', role: defaultRole || 'player' }
      }
      this.showUserEditor = true
    },
    closeUserEditor() { this.showUserEditor = false },
    onEditorRoleChange(e) { this.userEditor.form.role = this.roleOptions[e.detail.value].value },
    async saveUserEditor() {
      const form = this.userEditor.form
      if (!form.account || (this.userEditor.mode === 'create' && !form.password)) {
        return uni.showToast({ title: '请填写账号和密码', icon: 'none' })
      }
      try {
        if (this.userEditor.mode === 'create') {
          await createUser({ ...form, role: this.userEditor.defaultRole || form.role })
          uni.showToast({ title: '创建成功', icon: 'success' })
        } else {
          const updateData = { nickname: form.nickname }
          if (form.password) updateData.password = form.password
          if (!this.userEditor.defaultRole) updateData.role = form.role
          await updateUser(this.userEditor.target.id || this.userEditor.target.userId, updateData)
          uni.showToast({ title: '更新成功', icon: 'success' })
        }
        this.closeUserEditor()
        this.loadUsers(1)
        this.loadCsStaff()
      } catch (e) {
        uni.showToast({ title: e.error || e.message || '保存失败', icon: 'none' })
      }
    },
    removeUser(user) {
      uni.showModal({
        title: '删除用户',
        content: `确定要删除 ${user.nickname || user.account} 吗？此操作会写入审计日志。`,
        success: async (res) => {
          if (!res.confirm) return
          try {
            await deleteUser(user.id || user.userId)
            uni.showToast({ title: '已删除', icon: 'success' })
            this.loadUsers(1)
            this.loadCsStaff()
            this.closeUserEditor()
          } catch (e) {
            uni.showToast({ title: e.error || e.message || '删除失败', icon: 'none' })
          }
        }
      })
    },
    async toggleCsStatus(staff) {
      const newStatus = staff.csStatus === 'online' ? 'offline' : 'online'
      const actionText = newStatus === 'online' ? '开启接待' : '关闭接待'
      try {
        await setCsStatus(staff.id, newStatus)
        staff.csStatus = newStatus
        uni.showToast({ title: `${actionText}成功`, icon: 'success' })
      } catch (e) {
        console.error('[Admin] 切换客服状态失败', e)
        uni.showToast({ title: e.error || '操作失败', icon: 'none' })
      }
    },

    async loadCsStats() {
      try {
        const date = new Date().toISOString().slice(0, 10)
        const res = await getCsReport({ period: 'day', date })
        this.csStats = res.report || res.data?.report || res.data || res || {}
      } catch (e) {
        console.error('[Admin] 加载客服统计失败', e)
        this.csStats = {}
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.theme-admin {
  --primary-color: var(--color-text-muted);
  --accent-color: var(--color-text-muted);
  background: #0a0e14 !important;
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
  .stats-grid, .menu-grid, .finance-stats, .cs-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .data-item { flex-wrap: wrap; gap: 1vh; }
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

.admin-badge {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.8vh 1.2vw;
  background: rgba(113, 128, 150, 0.2);
  border: 1px solid rgba(113, 128, 150, 0.3);
  border-radius: 2vh;
}

.badge-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: 600;
}

.section { margin-bottom: 2.5vh; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5vh;
}
.section-title { font-size: var(--text-base); font-weight: 700; color: var(--color-border); }
.section-time { font-size: var(--text-xs); color: rgba(255,255,255,0.4); font-family: monospace; }
.section-link { font-size: var(--text-sm); color: var(--color-info); }
.section-subtitle { font-size: var(--text-sm); font-weight: 600; color: var(--color-border); margin: 2vh 0 1vh; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1vw;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 1.5vh 1vw;
  border-radius: 1.2vh;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(113, 128, 150, 0.15);
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

.stat-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.stat-value { font-size: var(--text-base); font-weight: 700; color: var(--color-border); }
.stat-label { font-size: var(--text-xs); color: rgba(255,255,255,0.4); }

.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1vw;
}

.menu-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2vh 1vw;
  border-radius: 1.2vh;
  gap: 0.8vh;
  transition: all 0.2s;
  border: 1px solid rgba(113, 128, 150, 0.15);
}

.menu-card:active { transform: scale(0.96); }

.menu-icon {
  width: 5.5vh;
  height: 5.5vh;
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1.2vh;
}

.menu-name { font-size: var(--text-base); font-weight: 600; color: var(--color-border); }
.menu-desc { font-size: var(--text-sm); color: rgba(255,255,255,0.4); text-align: center; }

.menu-badge {
  position: absolute;
  top: 0.8vh;
  right: 0.8vw;
  min-width: 2.5vh;
  height: 2.2vh;
  padding: 0 0.6vw;
  background: var(--color-danger);
  border-radius: 1.1vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-badge text { font-size: var(--text-xs); color: #fff; font-weight: 600; }

.room-list { display: flex; flex-direction: column; gap: 1vh; }

.room-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5vh 1.2vw;
  border-radius: 1.2vh;
  border: 1px solid rgba(113, 128, 150, 0.15);
  transition: all 0.15s;
  min-height: 7vh;
}

.room-card:active { transform: scale(0.98); }

.room-info { flex: 1; min-width: 0; }
.room-header { display: flex; align-items: center; gap: 0.8vw; margin-bottom: 0.5vh; }
.room-name { font-size: var(--text-base); font-weight: 600; color: var(--color-border); }
.room-status { padding: 0.2vh 0.8vw; border-radius: 0.4vh; font-size: var(--text-sm); }
.room-status.playing { background: rgba(72,187,120,0.15); color: var(--color-success); }
.room-status.waiting { background: rgba(237,137,54,0.15); color: var(--color-gold-dark); }
.room-meta { display: flex; gap: 1.2vw; }
.meta-item { font-size: var(--text-sm); color: rgba(255,255,255,0.5); }
.room-actions { display: flex; gap: 0.6vw; flex-shrink: 0; }

.action-btn {
  padding: 0.6vh 1.2vw;
  background: rgba(99,179,237,0.15);
  border: 1px solid rgba(99,179,237,0.3);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: var(--color-info);
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.action-danger {
  background: rgba(245,101,101,0.15);
  border-color: rgba(245,101,101,0.3);
  color: var(--color-danger);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2vh;
  padding-left: calc(2vh + env(safe-area-inset-left));
  padding-right: calc(2vh + env(safe-area-inset-right));
  padding-top: calc(2vh + env(safe-area-inset-top));
  padding-bottom: calc(2vh + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.modal-content {
  width: 80vw;
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 1.5vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-large {
  width: 90vw;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2vh 1.5vw;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.modal-title { font-size: var(--text-base); font-weight: 700; color: var(--color-border); }

.modal-close-btn {
  width: max(3.5vh, 44px);
  height: max(3.5vh, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
}

.modal-body {
  padding: 2vh 1.5vw;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  gap: 1vw;
  margin-top: 2vh;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  padding: 1.2vh;
  text-align: center;
  border-radius: 0.8vh;
  font-size: var(--text-base);
  font-weight: 600;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
}

/* 搜索栏 */
.search-bar {
  display: flex;
  gap: 0.8vw;
  margin-bottom: 2vh;
}

.search-input {
  flex: 1;
  padding: 1vh 1vw;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.8vh;
  font-size: var(--text-sm);
  color: var(--color-border);
}

.search-btn {
  padding: 1vh 1.5vw;
  background: linear-gradient(135deg, #4299E1, var(--color-info));
  border-radius: 0.8vh;
  font-size: var(--text-base);
  color: #fff;
  font-weight: 600;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 数据列表 */
.data-list {
  display: flex;
  flex-direction: column;
  gap: 1vh;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 1vw;
  padding: 1.5vh 1.2vw;
  border-radius: 1vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}

.data-avatar {
  width: 4.5vh;
  height: max(4.5vh, 44px);
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-text-muted), var(--color-bg-card));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.data-avatar text { font-size: var(--text-xs); color: #fff; font-weight: 700; }

.agent-avatar { background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary)); }
.finance-avatar { background: linear-gradient(135deg, var(--color-gold-dark), var(--color-gold-dark)); }

.data-info { flex: 1; min-width: 0; }
.data-name { display: block; font-size: var(--text-base); font-weight: 600; color: var(--color-border); margin-bottom: 0.3vh; }
.data-sub { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.4); }

.data-actions { display: flex; gap: 0.5vw; flex-shrink: 0; }

.mini-btn {
  padding: 0.5vh 1vw;
  background: rgba(99,179,237,0.15);
  border: 1px solid rgba(99,179,237,0.3);
  border-radius: 0.5vh;
  font-size: var(--text-sm);
  color: var(--color-info);
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-btn.btn-success { background: rgba(72,187,120,0.15); border-color: rgba(72,187,120,0.3); color: var(--color-success); }
.mini-btn.btn-warn { background: rgba(237,137,54,0.15); border-color: rgba(237,137,54,0.3); color: var(--color-gold-dark); }
.mini-btn.btn-danger { background: rgba(245,101,101,0.15); border-color: rgba(245,101,101,0.3); color: var(--color-danger); }

.data-amount {
  font-size: var(--text-base);
  font-weight: 700;
  flex-shrink: 0;
}

.amount-positive { color: var(--color-success); }
.amount-negative { color: var(--color-danger); }

/* 财务统计 */
.finance-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1vw;
  margin-bottom: 2vh;
}

.finance-card {
  padding: 1.5vh 1vw;
  border-radius: 1vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  text-align: center;
}

.finance-label { display: block; font-size: var(--text-xs); color: rgba(255,255,255,0.4); margin-bottom: 0.5vh; }
.finance-value { display: block; font-size: var(--text-base); font-weight: 700; color: var(--color-gold); }

/* 日志筛选 */
.log-filter { display: flex; gap: 0.5vw; margin-bottom: 1.5vh; }
.filter-item {
  padding: 0.5vh 1vw;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.5);
  border-radius: 0.5vh;
  transition: all 0.2s;
}
.filter-item.active { background: rgba(113,128,150,0.2); color: var(--color-text-muted); }

.log-list { display: flex; flex-direction: column; gap: 1vh; }

.log-item {
  display: flex;
  gap: 1vw;
  padding: 1.5vh 1.2vw;
  border-radius: 1.2vh;
  border: 1px solid rgba(113, 128, 150, 0.1);
}

.log-type {
  width: 4vh;
  height: 4vh;
  min-width: 28px;
  min-height: 28px;
  border-radius: 0.8vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-type.user { background: rgba(66,153,225,0.15); }
.log-type.room { background: rgba(72,187,120,0.15); }
.log-type.system { background: rgba(113,128,150,0.15); }
.log-type.finance { background: rgba(237,137,54,0.15); }

.log-content { flex: 1; min-width: 0; }
.log-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3vh; }
.log-action { font-size: var(--text-sm); font-weight: 600; color: var(--color-border); }
.log-time { font-size: var(--text-xs); color: rgba(255,255,255,0.3); font-family: monospace; }
.log-detail { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.6); margin-bottom: 0.5vh; line-height: 1.4; }
.log-meta { display: flex; gap: 1.2vw; }
.log-operator, .log-ip { font-size: var(--text-xs); color: rgba(255,255,255,0.3); }

/* 配置表单 */
.config-group { margin-bottom: 2.5vh; }
.config-group-title { display: block; font-size: var(--text-sm); font-weight: 600; color: var(--color-border); margin-bottom: 1.5vh; padding-bottom: 0.8vh; border-bottom: 1px solid rgba(255,255,255,0.1); }

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2vh;
}

.config-label { font-size: var(--text-base); color: rgba(255,255,255,0.7); }

.config-input {
  width: 15vw;
  padding: 0.8vh 1vw;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: var(--color-border);
}

.config-textarea {
  width: 100%;
  height: 10vh;
  padding: 1vh 1vw;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.8vh;
  font-size: var(--text-sm);
  color: var(--color-border);
  box-sizing: border-box;
}

.config-actions { display: flex; gap: 1vw; margin-top: 2vh; }

.config-btn {
  flex: 1;
  padding: 1.2vh;
  text-align: center;
  border-radius: 0.8vh;
  font-size: var(--text-base);
  font-weight: 600;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-btn-primary {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg);
}

/* 调整筹码表单 */
.adjust-user-info {
  display: flex;
  flex-direction: column;
  gap: 0.5vh;
  padding: 1.5vh;
  background: rgba(255,255,255,0.03);
  border-radius: 0.8vh;
  margin-bottom: 2vh;
}

.adjust-user-info text { font-size: var(--text-sm); color: rgba(255,255,255,0.7); }

.form-group { margin-bottom: 1.5vh; }
.form-label { display: block; font-size: var(--text-sm); color: rgba(255,255,255,0.7); margin-bottom: 0.8vh; }
.form-input {
  width: 100%;
  padding: 1vh 1vw;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  color: var(--color-border);
}

.empty-list { display: flex; align-items: center; justify-content: center; padding: 3vh 0; }
.empty-text { font-size: var(--text-sm); color: rgba(255,255,255,0.4); }
.bottom-spacing { height: 3vh; }

/* ========== 权限管理弹窗 ========== */
.modal-xlarge {
  width: 90vw;
  max-width: 110vh;
  max-height: 85vh;
}

.permission-body {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  padding: 0;
}

.permission-role-tabs {
  display: flex;
  gap: 0.8vw;
  padding: 1.5vh 1.5vw;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  overflow-x: auto;
  flex-shrink: 0;
}

.permission-role-tab {
  flex: 1;
  min-width: 12vh;
  padding: 1.2vh 1vw;
  border-radius: 1vh;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  text-align: center;
  transition: all 0.2s;

  &.active {
    background: rgba(236, 201, 75, 0.12);
    border-color: rgba(236, 201, 75, 0.4);
  }

  &:active {
    transform: scale(0.97);
  }
}

.role-tab-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-border);
  margin-bottom: 0.3vh;

  .active & {
    color: var(--color-gold);
  }
}

.role-tab-desc {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
}

.permission-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2vh 1.5vw;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.permission-hint {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
}

.permission-actions {
  display: flex;
  gap: 0.8vw;
}

.permission-matrix-scroll {
  flex: 1;
  padding: 1.5vh 1.5vw;
  box-sizing: border-box;
}

.permission-category {
  margin-bottom: 2vh;
}

.permission-category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1vh;
}

.category-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.category-count {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.3);
}

.permission-list {
  display: flex;
  flex-direction: column;
  gap: 0.6vh;
}

.permission-item {
  display: flex;
  align-items: center;
  gap: 1.2vw;
  padding: 1.2vh 1vw;
  border-radius: 0.8vh;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  transition: all 0.2s;

  &.enabled {
    background: rgba(236, 201, 75, 0.05);
    border-color: rgba(236, 201, 75, 0.15);
  }

  &:active {
    transform: scale(0.99);
  }
}

.perm-icon-wrap {
  width: 4vh;
  height: 4vh;
  border-radius: 0.8vh;
  background: rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.perm-info {
  flex: 1;
  min-width: 0;
}

.perm-label {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-border);
  margin-bottom: 0.2vh;
}

.perm-key {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.25);
  font-family: monospace;
}

.perm-switch {
  width: 5vh;
  height: 2.8vh;
  border-radius: 1.4vh;
  background: rgba(255,255,255,0.1);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;

  &.on {
    background: rgba(236, 201, 75, 0.6);
  }
}

.perm-switch-thumb {
  position: absolute;
  top: 0.3vh;
  left: 0.3vh;
  width: 2.2vh;
  height: 2.2vh;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;

  .perm-switch.on & {
    transform: translateX(2.2vh);
  }
}

.permission-footer-note {
  padding: 1.2vh 1.5vw;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;

  text {
    font-size: var(--text-sm);
    color: rgba(255,255,255,0.3);
  }
}

.btn-ghost {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.1);
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-gold), #D69E2E);
  color: var(--color-bg);
  font-weight: 600;

  &.disabled {
    opacity: 0.5;
  }
}

/* ========== 客服管理 ========== */
.cs-tabs {
  display: flex;
  gap: 1vh;
  margin-bottom: 2vh;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding-bottom: 1vh;
}

.cs-tab {
  padding: 0.8vh 2vh;
  border-radius: 0.8vh;
  font-size: var(--text-base);
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: rgba(56, 178, 172, 0.15);
    color: var(--color-info);
    font-weight: 600;
  }
}

.cs-stats-bar {
  display: flex;
  gap: 2vh;
  margin-bottom: 2vh;
  padding: 1.5vh;
  background: rgba(255,255,255,0.03);
  border-radius: 1vh;
}

.cs-stat-item {
  flex: 1;
  text-align: center;
}

.cs-stat-value {
  display: block;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-info);
}

.cs-stat-label {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
  margin-top: 0.3vh;
}

.cs-staff-list {
  max-height: 50vh;
  overflow-y: auto;
}

.cs-staff-card {
  display: flex;
  align-items: center;
  gap: 1.5vh;
  padding: 1.5vh;
  margin-bottom: 1vh;
  background: rgba(255,255,255,0.03);
  border-radius: 1vh;
  border: 1px solid rgba(255,255,255,0.06);
}

.cs-staff-avatar {
  width: 5vh;
  height: 5vh;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-info), #319795);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cs-staff-avatar-text {
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
}

.cs-staff-info {
  flex: 1;
  min-width: 0;
}

.cs-staff-name {
  display: block;
  font-size: var(--text-base);
  font-weight: 600;
  color: #fff;
}

.cs-staff-meta {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
  margin-top: 0.3vh;
}

.cs-staff-status {
  padding: 0.4vh 1.2vh;
  border-radius: 2vh;
  font-size: var(--text-sm);
  font-weight: 600;

  &.online {
    background: rgba(72, 187, 120, 0.15);
    color: var(--color-success);
  }

  &.offline {
    background: rgba(245, 101, 101, 0.15);
    color: var(--color-danger);
  }
}

.cs-toggle-btn {
  padding: 0.6vh 1.5vh;
  border-radius: 0.6vh;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.btn-on {
    background: rgba(72, 187, 120, 0.2);
    color: var(--color-success);
    border: 1px solid rgba(72, 187, 120, 0.3);
  }

  &.btn-off {
    background: rgba(245, 101, 101, 0.2);
    color: var(--color-danger);
    border: 1px solid rgba(245, 101, 101, 0.3);
  }
}

.cs-search-bar {
  display: flex;
  gap: 1vh;
  margin-bottom: 2vh;
}

.cs-search-input {
  flex: 1;
  padding: 1vh 1.5vh;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.8vh;
  color: #fff;
  font-size: var(--text-sm);
}

.cs-search-btn {
  padding: 1vh 2vh;
  background: linear-gradient(135deg, var(--color-info), #319795);
  color: #fff;
  border-radius: 0.8vh;
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cs-messages-list {
  max-height: 50vh;
  overflow-y: auto;
}

.cs-message-item {
  padding: 1.2vh;
  margin-bottom: 1vh;
  background: rgba(255,255,255,0.03);
  border-radius: 0.8vh;
  border-left: 3px solid var(--color-info);
}

.cs-message-header {
  display: flex;
  align-items: center;
  gap: 1vh;
  margin-bottom: 0.5vh;
}

.cs-message-from {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-info);
}

.cs-message-to {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
}

.cs-message-time {
  margin-left: auto;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.3);
}

.cs-message-content {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.7);
  line-height: 1.5;
}

.cs-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5vh;
  margin-bottom: 2vh;
}

.cs-stat-card {
  padding: 2vh;
  background: rgba(255,255,255,0.03);
  border-radius: 1vh;
  border: 1px solid rgba(255,255,255,0.06);
  text-align: center;
}

.cs-stat-card-value {
  display: block;
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-info);
}

.cs-stat-card-label {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.4);
  margin-top: 0.5vh;
}

.cs-stats-refresh {
  text-align: center;
}

.cs-loading,
.cs-empty {
  padding: 4vh 0;
  text-align: center;
  color: rgba(255,255,255,0.3);
  font-size: var(--text-xs);
}
</style>

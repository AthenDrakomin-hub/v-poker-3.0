<template>
  <ImmersivePage :show-header="false" page-class="lobby-page" :page-style="[lobbyBgStyle, { '--font-scale': fontScale }]">
    <!-- 第1层：背景装饰 -->
    <template #background>
      <view class="bg-decoration">
        <view class="bg-gradient" :style="bgGradientStyle"></view>
        <!-- 动态金色光晕层 -->
        <view class="bg-orb bg-orb-1"></view>
        <view class="bg-orb bg-orb-2"></view>
        <view class="bg-orb bg-orb-3"></view>
        <!-- 垂直数据流（预生成） -->
        <view
          v-for="(s, i) in bgStreams"
          :key="'stream-' + i"
          class="bg-stream"
          :style="{ left: s.left, height: s.height, width: s.width, opacity: s.opacity, animationDuration: s.duration, animationDelay: s.delay }"
        ></view>
        <!-- 漂浮数据粒子（预生成） -->
        <view
          v-for="(p, i) in bgParticles"
          :key="'particle-' + i"
          class="bg-particle"
          :style="{ left: p.left, width: p.size, height: p.size, opacity: p.opacity, animationDuration: p.duration, animationDelay: p.delay, '--drift': p.drift }"
        ></view>
        <view class="bg-grid"></view>
        <view class="bg-vignette"></view>
      </view>
    </template>

    <!-- 顶部栏 -->
    <TopBar
      :nickname="userState.nickname"
      :avatar="userState.avatar"
      :points="userState.points"
      @avatar="goProfile"
      @setting="goSettings"
      @wallet="openWallet"
    />

    <!-- 主体内容区 -->
    <view class="lobby-main">
      <view v-if="activeTab === 'rooms'" class="game-swiper-area">
        <GameCardSwiper
          :game-list="visibleGameTypes"
          :current-index="currentGameIndex"
          @change="onGameChange"
          @enter="openJoinModal"
          @rules="openGameRules"
          @click="openJoinModal"
        />
      </view>
      <MyRoomsPanel
        v-else-if="activeTab === 'mine'"
        :joined-rooms="joinedRooms"
        :owned-rooms="ownedRooms"
        :loading="isRoomsLoading"
        :is-agent="isAgent"
        @refresh="loadMyRooms"
        @enter="enterRoom"
        @share="shareRoom"
        @create="openCreateModal"
      />
    </view>

    <!-- 底部导航 -->
    <BottomTabBar :tabs="visibleTabs" :active="activeTab" @change="onTabChange" />

    <!-- 右侧悬浮按钮 -->
    <RightFloatButtons :visible-buttons="visibleFloatButtons" :cs-unread-count="csUnreadCount" @click="onRightFloatClick" />

    <!-- 钱包面板 -->
    <view v-if="activeTab === 'wallet'" class="panel-overlay" @click="activeTab = 'rooms'">
      <WalletPanel
        class="panel-content"
        @click.stop
        :balance="userState.points"
        :safe-balance="safeBalance"
        :safe-records="safeRecords"
        :chip-records="chipRecords"
        :history-loading="isWalletHistoryLoading"
        @close="activeTab = 'rooms'"
        @deposit="openSafeForm('deposit')"
        @withdraw="openSafeForm('withdraw')"
        @refresh="loadChipRecords"
      />
    </view>

    <!-- 创建房间弹窗 -->
    <view v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <view class="modal-content glass create-room-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">创建房间</text>
          <view class="modal-close-btn touch-active" @click="showCreateModal = false">
            <VIcon name="close" :size="2.2" color="var(--color-text-muted)" />
          </view>
        </view>
        <view class="modal-body">
          <!-- 游戏类型选择 -->
          <view class="form-group">
            <text class="form-label">选择游戏</text>
            <scroll-view class="game-selector" scroll-x>
              <view
                v-for="game in gameTypes"
                :key="game.id"
                class="game-selector-item"
                :class="{ active: createGameType === game.id }"
                :style="createGameType === game.id ? { borderColor: game.color + '88', background: game.color + '15' } : {}"
                @click="selectCreateGame(game.id)"
              >
                <view class="game-selector-icon" :style="{ background: game.gradient }">
                  <VIcon :name="game.iconName" :size="2" color="#fff" />
                </view>
                <text class="game-selector-name" :style="createGameType === game.id ? { color: game.color } : {}">{{ game.name }}</text>
              </view>
            </scroll-view>
          </view>

          <view v-if="createLoading" class="create-loading">
            <text>加载房间配置中...</text>
          </view>

          <template v-else>
            <view v-if="createError" class="create-error">
              <text>{{ createError }}</text>
              <view
                v-if="createError.includes('失败') || createError.includes('超时')"
                class="retry-btn touch-active"
                @click="loadRoomTemplates"
              >
                <text>重新加载</text>
              </view>
            </view>

            <view class="form-group" v-if="availableTemplates.length > 0">
              <text class="form-label">选择级别</text>
              <view class="level-options">
                <view
                  v-for="tpl in availableTemplates"
                  :key="tpl.templateCode"
                  class="level-option"
                  :class="{ active: createForm.level === tpl.templateCode?.split('_').pop() }"
                  @click="selectCreateLevel(tpl)"
                >
                  <text class="level-name">{{ tpl.templateName }}</text>
                  <text class="level-req">门槛 {{ tpl.creditRequirement || 0 }}</text>
                  <text class="level-range">{{ tpl.minBuyIn }}~{{ tpl.maxBuyIn }}</text>
                </view>
              </view>
            </view>

            <view class="form-group" v-if="selectedTemplate">
              <text class="form-label">玩家初始筹码</text>
              <input
                class="form-input"
                type="number"
                v-model="createForm.initialPoints"
                @blur="clampInitialPoints"
                :placeholder="`范围 ${selectedTemplate.minBuyIn} ~ ${selectedTemplate.maxBuyIn}`"
              />
              <text class="form-hint">每桌买入上限，范围 {{ selectedTemplate.minBuyIn }}~{{ selectedTemplate.maxBuyIn }}</text>
            </view>

            <view class="form-group" v-if="createGameType === 'tbnn' && selectedTemplate">
              <text class="form-label">固定底注</text>
              <view class="ante-slider">
                <input
                  class="form-input"
                  type="number"
                  v-model="createForm.fixedAnte"
                  :placeholder="createForm.level === 'junior' ? '范围 1~25' : '范围 25~2500'"
                />
              </view>
            </view>

            <view class="form-group" v-if="selectedTemplate">
              <text class="form-label">房间配置</text>
              <view class="template-info">
                <view class="info-row">
                  <text class="info-label">筹码面额</text>
                  <text class="info-value">{{ (selectedTemplate.chips || []).join(' / ') || '—' }}</text>
                </view>
                <view class="info-row">
                  <text class="info-label">单注封顶</text>
                  <text class="info-value">{{ selectedTemplate.cap === 0 ? '无限' : selectedTemplate.cap }}</text>
                </view>
                <view class="info-row">
                  <text class="info-label">基础底注</text>
                  <text class="info-value">{{ selectedTemplate.baseBet || '—' }}</text>
                </view>
                <view class="info-row">
                  <text class="info-label">最大人数</text>
                  <text class="info-value">{{ selectedTemplate.maxSeats || 8 }}人</text>
                </view>
                <view class="info-row">
                  <text class="info-label">总局数</text>
                  <text class="info-value">{{ selectedTemplate.defaultRounds || 25 }}局</text>
                </view>
              </view>
            </view>

            <view class="form-group" v-if="availableTemplates.length > 0">
              <text class="form-label">房间密码</text>
              <input class="form-input" :password="true" v-model="createForm.password" placeholder="设置房间密码（必填）" maxlength="20" />
            </view>
          </template>
        </view>
        <view class="modal-footer">
          <view class="btn btn-ghost touch-active" @click="showCreateModal = false">取消</view>
          <view
            class="btn btn-primary touch-active"
            :class="{ disabled: isCreating || createLoading || availableTemplates.length === 0 }"
            @click="confirmCreateRoom"
          >
            {{ isCreating ? '创建中...' : '确认创建' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 战绩弹窗 -->
    <view v-if="showRecordsModal" class="modal-overlay" @click="showRecordsModal = false">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">我的战绩</text>
          <view class="modal-close-btn touch-active" @click="showRecordsModal = false">
            <VIcon name="close" :size="2.2" color="var(--color-text-muted)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="records-stats">
            <view class="record-stat-card">
              <text class="record-stat-label">总局数</text>
              <text class="record-stat-value">{{ recordsStats.totalGames || 0 }}</text>
            </view>
            <view class="record-stat-card">
              <text class="record-stat-label">胜场</text>
              <text class="record-stat-value win">{{ recordsStats.wins || 0 }}</text>
            </view>
            <view class="record-stat-card">
              <text class="record-stat-label">负场</text>
              <text class="record-stat-value lose">{{ recordsStats.losses || 0 }}</text>
            </view>
            <view class="record-stat-card">
              <text class="record-stat-label">胜率</text>
              <text class="record-stat-value">{{ recordsStats.winRate || '0%' }}</text>
            </view>
            <view class="record-stat-card">
              <text class="record-stat-label">总盈亏</text>
              <text class="record-stat-value" :class="recordsStats.totalProfit >= 0 ? 'win' : 'lose'">
                {{ recordsStats.totalProfit >= 0 ? '+' : '' }}{{ recordsStats.totalProfit || 0 }}
              </text>
            </view>
          </view>
          <view class="section-subtitle">最近游戏记录</view>
          <view class="records-list">
            <view v-for="record in gameRecords" :key="record.id" class="record-item">
              <view class="record-game-type">
                <text>{{ formatGameType(record.gameType || record.game) || '-' }}</text>
              </view>
              <view class="record-info">
                <text class="record-room">房间#{{ record.roomNo || record.roomId || '-' }} · {{ record.rounds || 0 }}局</text>
                <text class="record-time">{{ record.time || record.createdAt || '-' }}</text>
              </view>
              <view class="record-result" :class="record.result === 'win' ? 'win' : 'lose'">
                <text>{{ record.result === 'win' ? '+' : '' }}{{ record.profit || record.amount || 0 }}</text>
              </view>
            </view>
            <ListEmpty v-if="gameRecords.length === 0" text="暂无游戏记录" />
          </view>
        </view>
      </view>
    </view>

    <!-- 保险柜操作 -->
    <view v-if="showSafeForm" class="modal-overlay" @click="showSafeForm = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ safeAction === 'deposit' ? '存入保险柜' : '取出保险柜' }}</text>
          <view class="modal-close-btn touch-active" @click="showSafeForm = false">
            <VIcon name="close" :size="2.2" color="var(--color-text-muted)" />
          </view>
        </view>
        <view class="modal-body">
          <view class="form-group">
            <text class="form-label">{{ safeAction === 'deposit' ? '存入数量' : '取出数量' }}</text>
            <input class="form-input" type="digit" v-model="safeAmount" placeholder="请输入数量" />
          </view>
          <view class="form-hint">
            <text>{{ safeAction === 'deposit' ? '当前钱包余额: ' + (userState.points || 0) : '保险柜余额: ' + (safeBalance || 0) }}</text>
          </view>
          <view class="modal-footer">
            <view class="btn btn-ghost touch-active" @click="showSafeForm = false">取消</view>
            <view class="btn btn-primary touch-active" :class="{ disabled: isTransferring }" @click="confirmSafeAction">
              {{ isTransferring ? '处理中...' : '确认' + (safeAction === 'deposit' ? '存入' : '取出') }}
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 加入房间 -->
    <JoinRoomModal v-if="showJoinModal" @close="showJoinModal = false" />

    <!-- 客服聊天 -->
    <view v-if="showCsChat" class="cs-chat-overlay" @click="showCsChat = false">
      <view class="cs-chat-container glass" @click.stop>
        <ChatPanel
          :peer-id="csPeerId"
          :peer-name="csPeerName"
          peer-role="customer_service"
          :show-quick-actions="true"
          :is-cs="false"
          @close="showCsChat = false"
          @new-message="onChatNewMessage"
          @messages-read="onChatMessagesRead"
        />
      </view>
    </view>

    <!-- 游戏规则弹窗 -->
    <view v-if="showRulesModal" class="modal-overlay" @click="showRulesModal = false">
      <view class="rules-modal glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">{{ rulesData?.gameName || '游戏规则' }}</text>
          <view class="modal-close-btn touch-active" @click="showRulesModal = false">
            <VIcon name="close" :size="2.2" color="var(--color-text-muted)" />
          </view>
        </view>
        <scroll-view class="rules-body" scroll-y>
          <view v-if="rulesLoading" class="rules-loading"><text>正在加载规则...</text></view>
          <template v-else-if="rulesData">
            <text class="rules-desc">{{ rulesData.description }}</text>

            <view v-if="rulesData.flow?.length" class="rules-section">
              <text class="rules-section-title">游戏流程</text>
              <view v-for="step in rulesData.flow" :key="step.step" class="rules-step">
                <text class="rules-step-num">{{ step.step }}</text>
                <view class="rules-step-content">
                  <text class="rules-step-phase">{{ step.phase }}</text>
                  <text class="rules-step-desc">{{ step.description }}</text>
                </view>
              </view>
            </view>

            <view v-if="rulesData.handTypes?.length" class="rules-section">
              <text class="rules-section-title">牌型说明</text>
              <view v-for="hand in rulesData.handTypes" :key="hand.key" class="rules-hand">
                <view class="rules-hand-header">
                  <text class="rules-hand-name">{{ hand.name }}</text>
                  <text class="rules-hand-mult">{{ hand.multiplier }}倍</text>
                </view>
                <text class="rules-hand-desc">{{ hand.description }}</text>
                <text class="rules-hand-example">示例：{{ hand.example }}</text>
              </view>
            </view>

            <view v-if="rulesData.actions?.length" class="rules-section">
              <text class="rules-section-title">操作说明</text>
              <view v-for="act in rulesData.actions" :key="act.action" class="rules-action">
                <text class="rules-action-name">{{ act.name }}</text>
                <text class="rules-action-desc">{{ act.description }}</text>
              </view>
            </view>

            <view v-if="rulesData.specialRules?.length" class="rules-section">
              <text class="rules-section-title">特殊规则</text>
              <view v-for="(rule, idx) in rulesData.specialRules" :key="idx" class="rules-special">
                <text class="rules-special-name">{{ rule.name }}</text>
                <text class="rules-special-content">{{ rule.content }}</text>
              </view>
            </view>
          </template>
          <view v-else class="rules-loading"><text>规则加载失败</text></view>
        </scroll-view>
      </view>
    </view>

    <!-- 快捷面板 -->
    <view v-if="quickPanel" class="modal-overlay" @click="quickPanel = ''">
      <view class="quick-panel glass" @click.stop>
        <view class="modal-header"><text class="modal-title">{{ quickPanel === 'message' ? '消息中心' : '帮助中心' }}</text><view class="modal-close-btn touch-active" @click="quickPanel = ''"><VIcon name="close" :size="2.2" color="var(--color-text-muted)" /></view></view>
        <view class="quick-panel-body">
          <view v-if="quickPanel === 'message'" class="quick-empty"><text>暂无未读消息</text><text>房间状态、筹码变动和平台通知将显示在这里</text></view>
          <view v-else class="help-list"><view class="help-item"><text>继续游戏</text><text>从“我的房间”直接进入已加入房间，无需重复输入密码。</text></view><view class="help-item"><text>代理主持</text><text>代理创建房间后可复制邀请信息，并以房主身份管理房间状态。</text></view><view class="help-item"><text>安全提醒</text><text>不要向他人提供账号、密码或验证码，筹码仅限平台虚拟用途。</text></view></view>
        </view>
        <view class="quick-panel-footer" @click="goService"><VIcon name="headset" :size="2" color="var(--color-gold)" /><text>联系专属客服</text></view>
      </view>
    </view>
  </ImmersivePage>
</template>

<script>
import { userState, fetchUserInfo, updatePoints } from '../../store/user.js'
import { formatPoints, formatGameType, formatRole } from '../../utils/format.js'
import { createRoom as apiCreateRoom, getMyRooms, getJoinedRooms, regenerateRoomInvite, getRoomTemplates } from '../../api/rooms.js'
import { getMyGameHistory } from '../../api/profile.js'
import { getWallet, vaultTransfer, getWalletTransactions } from '../../api/wallet.js'
import { getGameRule } from '../../api/games.js'
import { getFontScale } from '../../utils/fontScale.js'
import { cdnUrl } from '../../utils/cdn.js'
import { getSoundManager, getVoiceManager } from '../../utils/sound.js'
import { hasFeature } from '../../utils/featurePermissions.js'
import VIcon from '../../components/ui/VIcon.vue'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import GameCardSwiper from '../../components/lobby/GameCardSwiper.vue'
import BottomTabBar from '../../components/lobby/BottomTabBar.vue'
import RightFloatButtons from '../../components/lobby/RightFloatButtons.vue'
import TopBar from '../../components/lobby/TopBar.vue'
import WalletPanel from '../../components/lobby/WalletPanel.vue'
import JoinRoomModal from '../../components/lobby/JoinRoomModal.vue'
import MyRoomsPanel from '../../components/lobby/MyRoomsPanel.vue'
import ChatPanel from '../../components/ui/ChatPanel.vue'
import { getCsList, getUnreadCount, assignCs } from '../../api/messages.js'

export default {
  components: {
    VIcon,
    ImmersivePage,
    GameCardSwiper,
    BottomTabBar,
    RightFloatButtons,
    TopBar,
    WalletPanel,
    JoinRoomModal,
    MyRoomsPanel,
    ChatPanel
  },
  data() {
    // 预生成背景粒子（解决闪烁）
    const particles = Array.from({ length: 16 }, () => ({
      left: (Math.random() * 100).toFixed(1) + '%',
      size: (0.4 + Math.random() * 1.2).toFixed(2) + 'vh',
      duration: (18 + Math.random() * 22).toFixed(0) + 's',
      delay: (Math.random() * -30).toFixed(0) + 's',
      opacity: (0.25 + Math.random() * 0.5).toFixed(2),
      drift: ((Math.random() - 0.5) * 8).toFixed(1) + 'vh',
    }))
    const streams = Array.from({ length: 6 }, () => ({
      left: (5 + Math.random() * 90).toFixed(1) + '%',
      height: (12 + Math.random() * 20).toFixed(0) + 'vh',
      duration: (7 + Math.random() * 10).toFixed(0) + 's',
      delay: (Math.random() * -15).toFixed(0) + 's',
      opacity: (0.15 + Math.random() * 0.25).toFixed(2),
      width: (0.1 + Math.random() * 0.15).toFixed(2) + 'vh',
    }))

    return {
      userState,
      activeTab: 'rooms',
      selectedGame: 'niuniu',
      fontScale: 1.0,
      // 预生成粒子
      bgParticles: particles,
      bgStreams: streams,
      // 创建房间
      showCreateModal: false,
      isCreating: false,
      createLoading: false,
      createError: '',
      roomTemplates: [],
      createGameType: 'niuniu',
      createForm: {
        level: '',
        initialPoints: 0,
        password: '',
        fixedAnte: 0,
      },
      // 客服聊天
      showCsChat: false,
      csPeerId: null,
      csPeerName: '客服',
      csUnreadCount: 0,
      csUnreadTimer: null,
      // 游戏类型配置
      gameTypes: [
        { id: 'niuniu', name: '抢庄牛牛', desc: '庄闲对抗 · 极速博弈', iconName: 'bull', color: 'var(--color-gold)', gradient: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dark))', sceneImage: cdnUrl('/static/images/game-scenes/game-niuniu-v2.jpg'), onlineCount: 128, permissionKey: 'game.niuniu' },
        { id: 'sangong', name: '抢庄三公', desc: '三张定乾坤 · 水墨意境', iconName: 'cards', color: '#4A90A4', gradient: 'linear-gradient(135deg, #4A90A4, #2C5F6D)', sceneImage: cdnUrl('/static/images/game-scenes/game-sangong-v2.jpg'), onlineCount: 86, permissionKey: 'game.sangong' },
        { id: 'tbnn', name: '通比牛牛', desc: '无庄家 · 全自动比牌', iconName: 'bull', color: '#CD7F32', gradient: 'linear-gradient(135deg, #CD7F32, #8B4513)', sceneImage: cdnUrl('/static/images/game-scenes/game-tbnn-v2.jpg'), onlineCount: 64, permissionKey: 'game.tbnn' },
        { id: 'jinhua', name: '炸金花', desc: '心理战 · 隐蔽博弈', iconName: 'fan', color: '#C9A961', gradient: 'linear-gradient(135deg, #2a2a2a, #4a4a4a)', sceneImage: cdnUrl('/static/images/game-scenes/game-jinhua-v2.jpg'), onlineCount: 156, permissionKey: 'game.jinhua' },
        { id: 'texas', name: '德州扑克', desc: '数学赔率 · 理性竞技', iconName: 'spade', color: 'var(--color-info)', gradient: 'linear-gradient(135deg, var(--color-info), #0099CC)', sceneImage: cdnUrl('/static/images/game-scenes/game-texas-v3.jpg'), onlineCount: 92, permissionKey: 'game.texas' },
      ],
      betOptions: [5, 10, 20, 50, 100],
      roomLevels: [{ value: 'junior', label: '初级' }, { value: 'senior', label: '高级' }, { value: 'top', label: '顶级' }],
      playerTabs: [
        { key: 'rooms',   label: '房间大厅', icon: 'cards', permissionKey: 'tab.rooms' },
        { key: 'mine',    label: '我的房间', icon: 'user',  permissionKey: 'tab.mine' },
        { key: 'wallet',  label: '我的钱包', icon: 'coin',  permissionKey: 'tab.wallet' },
        { key: 'profile', label: '个人中心', icon: 'gear',  permissionKey: 'tab.profile' },
      ],
      agentTabs: [
        { key: 'rooms',     label: '房间大厅',   icon: 'cards', permissionKey: 'tab.rooms' },
        { key: 'mine',      label: '我的房间',   icon: 'user',  permissionKey: 'tab.mine' },
        { key: 'workbench', label: '代理工作台', icon: 'gear',  permissionKey: 'tab.workbench' },
        { key: 'wallet',    label: '我的钱包',   icon: 'coin',  permissionKey: 'tab.wallet' },
        { key: 'profile',   label: '个人中心',   icon: 'gear',  permissionKey: 'tab.profile' },
      ],
      topAgentTabs: [
        { key: 'rooms',        label: '房间大厅',     icon: 'cards',  permissionKey: 'tab.rooms' },
        { key: 'mine',         label: '我的房间',     icon: 'user',   permissionKey: 'tab.mine' },
        { key: 'topWorkbench', label: '总代理工作台', icon: 'trophy', permissionKey: 'tab.topWorkbench' },
        { key: 'wallet',       label: '我的钱包',     icon: 'coin',   permissionKey: 'tab.wallet' },
        { key: 'profile',      label: '个人中心',     icon: 'gear',   permissionKey: 'tab.profile' },
      ],
      adminTabs: [
        { key: 'rooms',   label: '房间大厅',   icon: 'cards', permissionKey: 'tab.rooms' },
        { key: 'admin',   label: '管理工作台', icon: 'gear',  permissionKey: 'tab.admin' },
        { key: 'wallet',  label: '我的钱包',   icon: 'coin',  permissionKey: 'tab.wallet' },
        { key: 'profile', label: '个人中心',   icon: 'gear',  permissionKey: 'tab.profile' },
      ],
      csTabs: [
        { key: 'csWorkbench', label: '客服工作台', icon: 'headset', permissionKey: 'tab.csWorkbench' },
        { key: 'profile',     label: '个人中心',   icon: 'gear',    permissionKey: 'tab.profile' },
      ],
      // 战绩
      showRecordsModal: false,
      recordsStats: {},
      gameRecords: [],
      // 保险柜
      safeBalance: 0,
      safeRecords: [],
      chipRecords: [],
      isWalletHistoryLoading: false,
      showSafeForm: false,
      safeAction: 'deposit',
      safeAmount: '',
      isTransferring: false,
      // 游戏规则
      showRulesModal: false,
      rulesLoading: false,
      rulesData: null,
      rulesGameType: '',
      // 我的房间
      showJoinModal: false,
      joinedRooms: [],
      ownedRooms: [],
      isRoomsLoading: false,
      quickPanel: '',
    }
  },
  computed: {
    currentGameInfo() {
      return this.visibleGameTypes.find(g => g.id === this.selectedGame) || this.visibleGameTypes[0] || this.gameTypes[0]
    },
    currentGameIndex() {
      return this.visibleGameTypes.findIndex(g => g.id === this.selectedGame)
    },
    availableTemplates() {
      // 代理/管理员开房：不按自身筹码过滤模板（门槛是给玩家的，不是限制开房者）
      return (this.roomTemplates || [])
        .filter(t => t.isActive !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    },
    selectedTemplate() {
      return this.availableTemplates.find(t => t.templateCode?.endsWith(this.createForm.level)) || null
    },
    isAgent() {
      return ['agent', 'top_agent'].includes(this.userState.role)
    },
    createGameInfo() {
      return this.gameTypes.find(g => g.id === this.createGameType) || this.gameTypes[0]
    },
    lobbyBgStyle() {
      return { '--theme-accent': this.currentGameInfo.color }
    },
    bgGradientStyle() {
      const c = this.currentGameInfo.color
      return {
        background: `radial-gradient(ellipse at 20% 30%, ${c}14 0%, transparent 45%),
                     radial-gradient(ellipse at 80% 70%, ${c}0d 0%, transparent 45%),
                     linear-gradient(180deg, var(--color-bg) 0%, #0d0d0d 100%)`,
      }
    },
    visibleGameTypes() {
      return this.gameTypes.filter(g => hasFeature(g.permissionKey))
    },
    visibleTabs() {
      const role = this.userState.role || 'player'
      let tabs
      if (role === 'admin') {
        tabs = this.adminTabs
      } else if (role === 'top_agent') {
        tabs = this.topAgentTabs
      } else if (role === 'agent') {
        tabs = this.agentTabs
      } else if (role === 'customer_service') {
        tabs = this.csTabs
      } else {
        tabs = this.playerTabs
      }
      return tabs.filter(t => hasFeature(t.permissionKey))
    },
    visibleFloatButtons() {
      const map = { join: 'float.join', service: 'float.service', help: 'float.help', notify: 'float.notify' }
      return Object.keys(map).filter(k => hasFeature(map[k]))
    },
  },
  onLoad() {
    this.init()
    this.fontScale = getFontScale()
    this.applyDailyOnlineCount()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    this.startCsUnreadPolling()
  },
  onShow() {
    this.loadUserInfo()
    this.ensureActiveTabValid()
    this.refreshCsUnread()
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
    this.stopCsUnreadPolling()
  },
  onPullDownRefresh() {
    this.loadMyRooms().finally(() => uni.stopPullDownRefresh())
  },
  methods: {
    formatPoints,
    formatGameType,
    formatRole,

    onFontScaleChange(scale) {
      this.fontScale = scale
    },

    applyDailyOnlineCount() {
      const today = new Date()
      const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
      this.gameTypes.forEach((game, idx) => {
        const idHash = game.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
        const hash = (dateSeed * 31 + idx * 17 + idHash * 7) % 1000
        const factor = 0.65 + (hash / 1000) * 0.7
        game.onlineCount = Math.max(10, Math.round(game.onlineCount * factor))
      })
    },

    async init() {
      await this.loadUserInfo()
    },

    async loadUserInfo() {
      try {
        await fetchUserInfo()
      } catch (e) {
        if (e.statusCode === 401) {
          uni.reLaunch({ url: '/pages/login/login' })
        }
      }
    },

    onTabChange(key) {
      if (key === 'wallet') {
        this.openWallet()
        return
      }
      if (key === 'mine') {
        this.activeTab = 'mine'
        this.loadMyRooms()
        return
      }
      if (key === 'profile') {
        uni.navigateTo({ url: '/pages/profile/profile' })
        return
      }
      if (key === 'workbench') {
        uni.navigateTo({ url: '/pages/workbench/workbench' })
        return
      }
      if (key === 'topWorkbench') {
        uni.navigateTo({ url: '/pages/promotion/promotion' })
        return
      }
      if (key === 'admin') {
        uni.navigateTo({ url: '/pages/admin/admin' })
        return
      }
      if (key === 'csWorkbench') {
        uni.navigateTo({ url: '/pages/customer-service/customer-service' })
        return
      }
      this.activeTab = key
    },

    ensureActiveTabValid() {
      const visibleKeys = this.visibleTabs.map(t => t.key)
      if (!visibleKeys.includes(this.activeTab)) {
        this.activeTab = visibleKeys[0] || 'rooms'
      }
    },

    onGameChange(index) {
      const game = this.visibleGameTypes[index]
      if (game && game.id !== this.selectedGame) {
        this.selectedGame = game.id
      }
    },

    enableAudioFromUserInteraction() {
      getSoundManager().markUserInteraction()
      getVoiceManager().markUserInteraction()
    },

    openJoinModal() {
      this.enableAudioFromUserInteraction()
      this.showJoinModal = true
    },

    goSettings() {
      uni.navigateTo({ url: '/pages/settings/settings' })
    },

    goProfile() {
      uni.navigateTo({ url: '/pages/profile/profile' })
    },

    goService() {
      uni.navigateTo({ url: '/pages/customer-service/customer-service' })
    },

    onRightFloatClick(type) {
      if (type === 'join') {
        this.showJoinModal = true
      } else if (type === 'service') {
        this.openCsChat()
      } else if (type === 'help') {
        this.quickPanel = 'help'
      } else if (type === 'notify') {
        this.quickPanel = 'message'
      }
    },

    async openCsChat() {
      try {
        uni.showLoading({ title: '正在连接客服...' })
        const res = await assignCs()
        uni.hideLoading()
        const cs = res.cs || res.data?.cs
        if (!cs) {
          uni.showToast({ title: '暂无可用客服', icon: 'none' })
          return
        }
        this.csPeerId = cs.id
        this.csPeerName = cs.nickname || cs.account || '客服'
        this.showCsChat = true
        this.csUnreadCount = 0
      } catch (e) {
        uni.hideLoading()
        console.error('[Lobby] 分配客服失败', e)
        try {
          const res2 = await getCsList()
          const list = res2.list || res2.data?.list || res2.data || res2 || []
          if (list.length > 0) {
            this.csPeerId = list[0].id
            this.csPeerName = list[0].nickname || list[0].account || '客服'
            this.showCsChat = true
            this.csUnreadCount = 0
          } else {
            uni.showToast({ title: '暂无在线客服', icon: 'none' })
          }
        } catch (e2) {
          uni.showToast({ title: '连接客服失败', icon: 'none' })
        }
      }
    },

    startCsUnreadPolling() {
      this.refreshCsUnread()
      this.csUnreadTimer = setInterval(() => {
        if (!this.showCsChat) {
          this.refreshCsUnread()
        }
      }, 10000)
    },

    stopCsUnreadPolling() {
      if (this.csUnreadTimer) {
        clearInterval(this.csUnreadTimer)
        this.csUnreadTimer = null
      }
    },

    async refreshCsUnread() {
      try {
        const res = await getUnreadCount()
        this.csUnreadCount = res.unreadCount || res.data?.unreadCount || 0
      } catch (e) {}
    },

    onChatNewMessage() {
    },

    onChatMessagesRead() {
      this.csUnreadCount = 0
    },

    openWallet() {
      this.activeTab = 'wallet'
      this.loadWallet()
      this.loadChipRecords()
    },

    async loadMyRooms() {
      this.isRoomsLoading = true
      try {
        const requests = [getJoinedRooms()]
        if (this.isAgent) requests.push(getMyRooms())
        const results = await Promise.all(requests)
        const joined = results[0]
        const owned = results[1]
        this.joinedRooms = joined.items || joined.list || joined.rooms || joined || []
        this.ownedRooms = owned ? (owned.items || owned.list || owned.rooms || owned || []) : []
      } catch (e) {
        this.joinedRooms = []
        this.ownedRooms = []
        uni.showToast({ title: '房间记录加载失败', icon: 'none' })
      } finally {
        this.isRoomsLoading = false
      }
    },

    enterRoom(room) {
      this.enableAudioFromUserInteraction()
      console.log('[enterRoom] room=', JSON.stringify(room))
      const roomId = room.id || room.roomId || room.roomNo || room.roomCode
      console.log('[enterRoom] roomId=', roomId)
      if (!roomId) {
        uni.showToast({ title: '房间信息不完整', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/pages/room/room?id=${roomId}` })
    },

    async shareRoom(room) {
      const roomNo = room.roomNo || room.roomCode || room.id || room.roomId
      if (!roomNo) {
        uni.showToast({ title: '房间号不可用', icon: 'none' })
        return
      }
      let invite = room.inviteUrl ? room : uni.getStorageSync(`vpoker_room_invite_${room.id || room.roomId}`)
      if (!invite || !invite.inviteUrl) {
        try {
          const data = await regenerateRoomInvite(room.id || room.roomId)
          invite = { ...room, ...data }
          uni.setStorageSync(`vpoker_room_invite_${room.id || room.roomId}`, invite)
        } catch (e) {
          uni.showToast({ title: e.error || '生成邀请失败', icon: 'none' })
          return
        }
      }
      const inviteText = `邀请加入房间：房间号 ${roomNo}\n邀请链接：${invite.inviteUrl}\n有效至：${invite.inviteExpiresAt || '24小时内'}`
      uni.setClipboardData({
        data: inviteText,
        success: () => uni.showToast({ title: '邀请信息已复制', icon: 'success' })
      })
    },

    async loadWallet() {
      try {
        const data = await getWallet()
        this.safeBalance = Number(data.vaultPoints) || 0
        if (typeof data.availablePoints === 'number') {
          updatePoints(data.availablePoints)
        }
      } catch (e) {
        console.warn('[Wallet] 加载钱包失败', e)
      }
    },

    async loadChipRecords() {
      this.isWalletHistoryLoading = true
      try {
        const data = await getWalletTransactions({ page: 1, pageSize: 50 })
        const all = data.items || data.list || data.records || []
        this.chipRecords = all
        this.safeRecords = all
          .filter(r => r.type === 'vault_deposit' || r.type === 'vault_withdraw')
          .map(r => ({
            id: r.id,
            type: r.type === 'vault_deposit' ? 'deposit' : 'withdraw',
            amount: r.amount,
            time: r.createdAt,
            balance: r.vaultBalance,
            availableBalance: r.availableBalance,
          }))
      } catch (e) {
        this.chipRecords = []
        this.safeRecords = []
      } finally {
        this.isWalletHistoryLoading = false
      }
    },

    openRecords() {
      this.showRecordsModal = true
      this.loadGameRecords()
    },

    async loadGameRecords() {
      try {
        const data = await getMyGameHistory({ page: 1, pageSize: 20 })
        const records = Array.isArray(data.data) ? data.data : (data.list || data.records || data.history || data.data?.history || [])
        this.gameRecords = records.map(record => ({
          ...record,
          result: Number(record.net || 0) >= 0 ? 'win' : 'lose',
          profit: Number(record.net || 0),
          time: record.lastPlayedAt || record.endedAt || record.createdAt,
        }))
        if (data.stats) {
          this.recordsStats = data.stats
        } else {
          this.calculateRecordsStats()
        }
      } catch (e) {
        console.warn('[Lobby] 加载战绩失败', e)
        this.gameRecords = []
        this.recordsStats = { totalGames: 0, wins: 0, losses: 0, winRate: '0%', totalProfit: 0 }
      }
    },

    calculateRecordsStats() {
      const wins = this.gameRecords.filter(r => r.result === 'win').length
      const total = this.gameRecords.length
      const totalProfit = this.gameRecords.reduce((sum, r) => sum + (r.profit || 0), 0)
      this.recordsStats = {
        totalGames: total,
        wins: wins,
        losses: total - wins,
        winRate: total > 0 ? Math.round((wins / total) * 100) + '%' : '0%',
        totalProfit: totalProfit,
      }
    },

    async openGameRules(gameType) {
      this.rulesGameType = gameType
      this.rulesData = null
      this.rulesLoading = true
      this.showRulesModal = true
      try {
        const data = await getGameRule(gameType)
        this.rulesData = data.rule || data
      } catch (e) {
        console.warn('[Lobby] 加载游戏规则失败', e)
        this.rulesData = null
      } finally {
        this.rulesLoading = false
      }
    },

    openSafeForm(action) {
      this.safeAction = action
      this.safeAmount = ''
      this.showSafeForm = true
    },

    async confirmSafeAction() {
      if (!this.safeAmount || parseInt(this.safeAmount) <= 0) {
        uni.showToast({ title: '请输入有效数量', icon: 'none' })
        return
      }
      if (this.isTransferring) return
      const amount = parseInt(this.safeAmount)
      this.isTransferring = true
      try {
        const resp = await vaultTransfer(this.safeAction, amount)
        if (resp) {
          if (typeof resp.availablePoints === 'number') updatePoints(resp.availablePoints)
          if (typeof resp.vaultPoints === 'number') this.safeBalance = resp.vaultPoints
        }
        this.loadChipRecords()
        uni.showToast({ title: this.safeAction === 'deposit' ? '存入成功' : '取出成功', icon: 'success' })
        this.showSafeForm = false
        this.safeAmount = ''
      } catch (e) {
        uni.showToast({ title: e.error || '操作失败', icon: 'none' })
      } finally {
        this.isTransferring = false
      }
    },

    async openCreateModal() {
      const role = this.userState.role
      if (!['agent', 'top_agent', 'admin'].includes(role)) {
        uni.showToast({ title: '无创建房间权限', icon: 'none' })
        return
      }
      if (this.userState.openRoomBlocked) {
        uni.showToast({ title: '开房权限已冻结，请联系客服', icon: 'none' })
        return
      }
      this.createError = ''
      this.createGameType = this.selectedGame
      this.createForm = { level: '', initialPoints: 0, password: '', fixedAnte: 0 }
      this.roomTemplates = []
      this.showCreateModal = true
      await this.loadRoomTemplates()
    },

    async loadRoomTemplates() {
      this.createLoading = true
      this.createError = ''
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 8000)
        })
        const res = await Promise.race([
          getRoomTemplates(this.createGameType),
          timeoutPromise
        ])
        let list = []
        if (Array.isArray(res)) {
          list = res
        } else if (Array.isArray(res?.templates)) {
          list = res.templates
        } else if (Array.isArray(res?.data?.templates)) {
          list = res.data.templates
        } else if (Array.isArray(res?.data)) {
          list = res.data
        }
        if (list.length === 0) {
          console.warn('[Lobby] 房间模板返回为空, gameType:', this.selectedGame, 'res:', res)
        }
        this.roomTemplates = list
        if (this.availableTemplates.length > 0) {
          const defaultTpl = this.availableTemplates[this.availableTemplates.length - 1]
          this.selectCreateLevel(defaultTpl)
        } else {
          this.createForm.level = ''
          this.createError = list.length === 0
            ? '房间配置加载失败，请检查网络后重试'
            : '筹码不足，无法创建任何级别房间'
        }
      } catch (err) {
        console.error('[Lobby] 加载房间模板失败:', err?.message || err)
        this.roomTemplates = []
        this.createError = err?.message === 'TIMEOUT' ? '请求超时，请检查网络后重试' : '加载房间配置失败，请重试'
      } finally {
        this.createLoading = false
      }
    },

    async selectCreateGame(gameId) {
      if (this.createLoading || this.isCreating) return
      if (gameId === this.createGameType) return
      this.createGameType = gameId
      this.createForm = { level: '', initialPoints: 0, password: '', fixedAnte: 0 }
      this.roomTemplates = []
      this.createError = ''
      await this.loadRoomTemplates()
    },

    selectCreateLevel(template) {
      const level = template.templateCode?.split('_').pop() || ''
      this.createForm.level = level
      this.createForm.initialPoints = template.minBuyIn || 1000
      if (this.createGameType === 'tbnn') {
        this.createForm.fixedAnte = level === 'junior' ? 1 : 25
      }
    },

    clampInitialPoints() {
      const tpl = this.selectedTemplate
      if (!tpl) return
      let val = Number(this.createForm.initialPoints) || 0
      if (tpl.minBuyIn && val < tpl.minBuyIn) val = tpl.minBuyIn
      if (tpl.maxBuyIn && val > tpl.maxBuyIn) val = tpl.maxBuyIn
      this.createForm.initialPoints = val
    },

    async confirmCreateRoom() {
      if (this.isCreating) return
      if (!this.createForm.level) {
        this.createError = '请选择房间级别'
        return
      }
      if (!this.createForm.initialPoints || this.createForm.initialPoints <= 0) {
        this.createError = '请输入有效的初始筹码'
        return
      }
      if (!this.createForm.password || this.createForm.password.trim() === '') {
        this.createError = '请设置房间密码'
        return
      }
      this.clampInitialPoints()
      this.createError = ''
      this.isCreating = true
      try {
        const body = {
          level: this.createForm.level,
          initialPoints: Number(this.createForm.initialPoints),
          password: this.createForm.password.trim(),
        }
        if (this.createGameType === 'tbnn' && this.createForm.fixedAnte > 0) {
          body.fixedAnte = Number(this.createForm.fixedAnte)
        }
        const createTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 12000)
        })
        const data = await Promise.race([
          apiCreateRoom(this.createGameType, body),
          createTimeout
        ])
        const room = data.room || data
        uni.showToast({ title: '房间创建成功', icon: 'success' })
        this.showCreateModal = false
        this.activeTab = 'mine'
        this.loadMyRooms()
        setTimeout(() => {
          uni.navigateTo({ url: `/pages/room/room?id=${room.id || room.roomId}` })
        }, 600)
      } catch (err) {
        let msg = err?.error || err?.message || '创建失败，请重试'
        if (err?.message === 'TIMEOUT') {
          msg = '创建请求超时，请检查网络后重试'
        }
        this.createError = msg
        uni.showToast({ title: msg, icon: 'none' })
      } finally {
        this.isCreating = false
      }
    },

    onLogout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出当前账号吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('token')
            uni.reLaunch({ url: '/pages/login/login' })
          }
        }
      })
    },
  },
}
</script>

<style lang="scss">
.lobby-page {
  --lobby-header-height: max(12vh, 52px);
  --lobby-footer-height: max(10vh, 64px);
  --content-padding-h: 0px;
  --content-padding-v: 0px;
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* 背景 */
.bg-decoration {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-gradient {
  position: absolute;
  width: 100%; height: 100%;
  transition: background 0.6s ease;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(8vh);
  -webkit-filter: blur(8vh);
  pointer-events: none;
  will-change: transform, opacity;
}

.bg-orb-1 {
  width: 55vh; height: 55vh;
  background: radial-gradient(circle, rgba(255,200,60,0.35) 0%, rgba(255,180,30,0.1) 40%, transparent 70%);
  top: -12vh; left: 8%;
  animation: orb-float-1 20s ease-in-out infinite;
}

.bg-orb-2 {
  width: 45vh; height: 45vh;
  background: radial-gradient(circle, rgba(200,150,40,0.3) 0%, rgba(160,110,20,0.08) 40%, transparent 70%);
  bottom: 8%; right: 3%;
  animation: orb-float-2 26s ease-in-out infinite;
}

.bg-orb-3 {
  width: 38vh; height: 38vh;
  background: radial-gradient(circle, rgba(255,220,100,0.25) 0%, rgba(255,200,60,0.06) 40%, transparent 70%);
  top: 45%; left: 45%;
  animation: orb-float-3 30s ease-in-out infinite;
}

@keyframes orb-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
  33% { transform: translate(18vh, 12vh) scale(1.12); opacity: 1; }
  66% { transform: translate(-12vh, 6vh) scale(0.92); opacity: 0.6; }
}

@keyframes orb-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
  50% { transform: translate(-22vh, -18vh) scale(1.18); opacity: 1; }
}

@keyframes orb-float-3 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  50% { transform: translate(-20%, -65%) scale(1.25); opacity: 0.8; }
}

.bg-grid {
  position: absolute;
  width: 100%; height: 100%;
  background-image:
    linear-gradient(rgba(255,215,0,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,215,0,0.07) 1px, transparent 1px),
    linear-gradient(rgba(255,215,0,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,215,0,0.03) 1px, transparent 1px);
  background-size: 4vh 4vh, 4vh 4vh, 20vh 20vh, 20vh 20vh;
  opacity: 0.9;
}

.bg-stream {
  position: absolute;
  top: 0;
  border-radius: 1vh;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(255,215,0,0.6) 30%,
    rgba(255,180,30,0.8) 50%,
    rgba(255,215,0,0.6) 70%,
    transparent 100%);
  filter: blur(0.3vh);
  -webkit-filter: blur(0.3vh);
  pointer-events: none;
  will-change: transform, opacity;
  animation: stream-flow linear infinite;
}

@keyframes stream-flow {
  0% { transform: translateY(-100%); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateY(110vh); opacity: 0; }
}

.bg-particle {
  position: absolute;
  bottom: -2vh;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255,230,120,0.9) 0%,
    rgba(255,200,50,0.5) 40%,
    rgba(255,180,30,0.1) 70%,
    transparent 100%);
  box-shadow: 0 0 1vh rgba(255,215,0,0.5);
  pointer-events: none;
  will-change: transform, opacity;
  animation: particle-float linear infinite;
}

@keyframes particle-float {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  10% { opacity: 1; }
  90% { opacity: 0.8; }
  100% {
    transform: translateY(-110vh) translateX(var(--drift, 0));
    opacity: 0;
  }
}

.bg-vignette {
  position: absolute;
  width: 100%; height: 100%;
  background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.45) 85%, rgba(0,0,0,0.65) 100%);
}

/* 主体内容区 */
.lobby-main {
  position: relative;
  z-index: 1;
  width: 100%;
  height: calc(100vh - var(--lobby-header-height) - var(--lobby-footer-height));
  margin-top: var(--lobby-header-height);
  display: flex;
  padding: 1vh 0 1vh;
  padding-left: calc(4vh + var(--safe-left, 0px));
  padding-right: calc(8vh + var(--safe-right, 0px));  /* 从16vh改为8vh */
  box-sizing: border-box;
  gap: 2vh;
}

.game-swiper-area {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

/* 浮层面板 */
.panel-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  backdrop-filter: blur(4px);
  padding-top: var(--safe-top, 0px);
  padding-bottom: var(--safe-bottom, 0px);
  box-sizing: border-box;
}

.panel-content {
  animation: panelIn 0.25s ease;
}

@keyframes panelIn {
  from { opacity: 0; transform: scale(0.92) translateY(2vh); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* 弹窗通用 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  backdrop-filter: blur(4px);
}

.modal-content {
  width: min(50vw, 70vh);
  max-width: 70vh;
  max-height: 80vh;
  background: rgba(25, 25, 25, 0.95);
  border-radius: 2vh;
  border: 0.1vh solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(20px);
  animation: modalIn 0.2s ease;
}

.modal-large {
  width: min(65vw, 85vh);
  max-width: 85vh;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.glass {
  backdrop-filter: blur(10px);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2vh 2.5vh;
  border-bottom: 0.1vh solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: #fff;
}

.modal-close-btn {
  width: max(4vh, 44px);
  height: max(4vh, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  &:active {
    background: rgba(255, 255, 255, 0.1);
  }
}

.modal-body {
  flex: 1;
  padding: 2.5vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  gap: 1.5vh;
  padding: 2vh 2.5vh;
  border-top: 0.1vh solid rgba(255, 255, 255, 0.06);
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5vh;
  border-radius: 1vh;
  font-size: var(--text-sm);
  font-weight: 600;
  transition: all 0.2s ease;
  &:active {
    transform: scale(0.97);
  }
  &.btn-ghost {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }
  &.btn-primary {
    background: var(--color-gold);
    color: var(--color-bg-card);
    &.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  }
}

/* 表单 */
.form-group {
  margin-bottom: 2.5vh;
}
.form-label {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 1vh;
}
.form-input {
  width: 100%;
  padding: 1.5vh;
  background: rgba(255, 255, 255, 0.05);
  border: 0.1vh solid rgba(255, 255, 255, 0.1);
  border-radius: 1vh;
  color: #fff;
  font-size: var(--text-sm);
}

.quick-panel { width: min(72vw, 80vh); max-height: 72vh; overflow: hidden; background: rgba(20,20,20,.98); border: .1vh solid rgba(255,255,255,.12); border-radius: 1.2vh; }
.quick-panel-body { padding: 2vh 2.5vh; }
.quick-empty { display:flex; flex-direction:column; gap:1vh; padding:4vh 0; color:rgba(255,255,255,.45); text-align:center; font-size:var(--text-sm); }
.quick-empty text:first-child { color:#fff; font-size:var(--text-base); }
.help-list { display:flex; flex-direction:column; gap:1vh; }
.help-item { padding:1.2vh 1.4vh; border-radius:.8vh; background:rgba(255,255,255,.05); }
.help-item text { display:block; }
.help-item text:first-child { color:#fff; font-size:var(--text-sm); font-weight:600; }
.help-item text:last-child { margin-top:.4vh; color:rgba(255,255,255,.5); font-size:var(--text-xs); line-height:1.45; }
.quick-panel-footer { display:flex; justify-content:center; align-items:center; gap:.8vh; padding:1.5vh; border-top:.1vh solid rgba(255,255,255,.08); color:var(--color-gold); font-size:var(--text-sm); }

.form-hint {
  margin-top: 1vh;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
}

/* 游戏选择器 */
.game-selector {
  white-space: nowrap;
  margin-top: 1vh;
}
.game-selector-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8vh;
  padding: 1.5vh 2vh;
  margin-right: 1.2vh;
  border-radius: 1.2vh;
  border: 0.1vh solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  transition: all 0.2s ease;
  min-width: 10vh;
}
.game-selector-item.active {
  border: 0.1vh solid;
}
.game-selector-icon {
  width: 4.5vh;
  height: 4.5vh;
  border-radius: 1vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.game-selector-name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}
.game-selector-item.active .game-selector-name {
  color: #fff;
}

/* 战绩 */
.records-stats {
  display: flex;
  gap: 1.5vh;
  margin-bottom: 2.5vh;
  flex-wrap: wrap;
}
.record-stat-card {
  flex: 1;
  min-width: 10vh;
  padding: 1.5vh;
  border-radius: 1vh;
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
}
.record-stat-label {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 0.5vh;
}
.record-stat-value {
  font-size: var(--text-base);
  font-weight: 700;
  color: #fff;
  &.win { color: var(--color-success); }
  &.lose { color: var(--color-danger); }
}
.section-subtitle {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 1.5vh;
}
.records-list {
  max-height: 30vh;
  overflow-y: auto;
}
.record-item {
  display: flex;
  align-items: center;
  padding: 1.2vh 0;
  border-bottom: 0.1vh solid rgba(255, 255, 255, 0.04);
}
.record-game-type {
  width: auto;
  min-width: 8vh;
  max-width: 14vh;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.record-info {
  flex: 1;
}
.record-room {
  display: block;
  font-size: var(--text-xs);
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 30vh;
}
.record-time {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
}
.record-result {
  font-size: var(--text-xs);
  font-weight: 600;
  &.win { color: var(--color-success); }
  &.lose { color: var(--color-danger); }
}
.empty-list {
  padding: 3vh 0;
  text-align: center;
}
.empty-text {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
}

/* 游戏规则 */
.rules-modal {
  width: min(90vw, 85vh);
  max-width: 90vw;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  border-radius: 1.5vh;
}
.rules-body {
  flex: 1;
  min-height: 0;
  padding: 0 3vh 2vh;
  overflow-y: auto;
}
.rules-loading {
  padding: 6vh 0;
  text-align: center;
  color: rgba(255,255,255,0.4);
  font-size: var(--text-sm);
}
.rules-desc {
  display: block;
  color: rgba(255,255,255,0.65);
  font-size: var(--text-sm);
  line-height: 1.7;
  margin-bottom: 2vh;
  word-break: break-word;
}
.rules-section {
  margin-bottom: 2.5vh;
}
.rules-section-title {
  display: block;
  color: var(--color-gold);
  font-size: var(--text-base);
  font-weight: 700;
  margin-bottom: 1.2vh;
  padding-bottom: 0.6vh;
  border-bottom: 0.1vh solid rgba(255,215,0,0.2);
}
.rules-step {
  display: flex;
  gap: 1.2vh;
  margin-bottom: 1vh;
}
.rules-step-num {
  flex-shrink: 0;
  width: 3vh;
  height: 3vh;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255,215,0,0.15);
  color: var(--color-gold);
  font-size: var(--text-xs);
  font-weight: 700;
}
.rules-step-content { flex: 1; min-width: 0; }
.rules-step-phase {
  display: block;
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
}
.rules-step-desc {
  display: block;
  color: rgba(255,255,255,0.55);
  font-size: var(--text-xs);
  line-height: 1.6;
  margin-top: 0.3vh;
}
.rules-hand {
  padding: 1.2vh;
  margin-bottom: 1vh;
  background: rgba(255,255,255,0.04);
  border-radius: 0.8vh;
  border: 0.1vh solid rgba(255,255,255,0.08);
}
.rules-hand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5vh;
  gap: 1vh;
}
.rules-hand-name {
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.rules-hand-mult {
  color: var(--color-gold);
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
}
.rules-hand-desc {
  display: block;
  color: rgba(255,255,255,0.55);
  font-size: var(--text-xs);
  line-height: 1.5;
}
.rules-hand-example {
  display: block;
  color: rgba(255,255,255,0.35);
  font-size: var(--text-xs);
  margin-top: 0.3vh;
}
.rules-action {
  margin-bottom: 1vh;
  padding-left: 1.5vh;
  border-left: 0.2vh solid rgba(255,215,0,0.3);
}
.rules-action-name {
  display: block;
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
}
.rules-action-desc {
  display: block;
  color: rgba(255,255,255,0.55);
  font-size: var(--text-xs);
  line-height: 1.5;
  margin-top: 0.3vh;
}
.rules-special {
  margin-bottom: 1.2vh;
  padding: 1.2vh;
  background: rgba(255,165,0,0.08);
  border-radius: 0.8vh;
  border: 0.1vh solid rgba(255,165,0,0.2);
}
.rules-special-name {
  display: block;
  color: var(--color-gold-dark);
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: 0.4vh;
}
.rules-special-content {
  display: block;
  color: rgba(255,255,255,0.6);
  font-size: var(--text-xs);
  line-height: 1.6;
}

/* 创建房间 */
.create-room-modal {
  max-height: 82vh;
  overflow-y: auto;
}
.create-loading {
  padding: 4vh 0;
  text-align: center;
  color: rgba(255,255,255,0.5);
  font-size: var(--text-sm);
}
.create-error {
  padding: 1.5vh 2vh;
  margin-bottom: 2vh;
  background: rgba(248,113,113,0.12);
  border: 0.1vh solid rgba(248,113,113,0.3);
  border-radius: 1vh;
  color: var(--color-danger);
  font-size: var(--text-xs);
}
.retry-btn {
  margin-top: 1.5vh;
  padding: 1vh 3vh;
  background: rgba(255,215,0,0.15);
  border: 0.1vh solid rgba(255,215,0,0.4);
  border-radius: 0.8vh;
  color: var(--color-gold);
  font-size: var(--text-xs);
  text-align: center;
}
.level-options {
  display: flex;
  gap: 1.5vh;
}
.level-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5vh;
  padding: 2vh 1vh;
  background: rgba(255,255,255,0.04);
  border: 0.15vh solid rgba(255,255,255,0.1);
  border-radius: 1.2vh;
  cursor: pointer;
  transition: all 0.2s;
}
.level-option.active {
  border-color: var(--color-gold);
  background: rgba(255,215,0,0.1);
  box-shadow: 0 0 1.5vh rgba(255,215,0,0.2);
}
.level-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
}
.level-option.active .level-name { color: var(--color-gold); }
.level-req {
  font-size: calc(var(--text-xs) * 0.9);
  color: rgba(255,255,255,0.4);
}
.level-range {
  font-size: calc(var(--text-xs) * 0.85);
  color: rgba(255,255,255,0.3);
}
.template-info {
  background: rgba(255,255,255,0.03);
  border-radius: 1vh;
  padding: 1.5vh 2vh;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8vh 0;
  border-bottom: 0.1vh solid rgba(255,255,255,0.05);
}
.info-row:last-child { border-bottom: none; }
.info-label {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.5);
}
.info-value {
  font-size: var(--text-xs);
  color: var(--color-text);
  font-weight: 600;
}

/* 客服聊天 */
.cs-chat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: var(--safe-top, 0px);
  padding-bottom: var(--safe-bottom, 0px);
  padding-left: var(--safe-left, 0px);
  padding-right: var(--safe-right, 0px);
  box-sizing: border-box;
}

.cs-chat-container {
  width: min(70vh, 60vw);
  min-width: 320px;
  height: min(80vh, 85vh);
  border-radius: 2vh;
  overflow: hidden;
  border: 1px solid rgba(255, 215, 0, 0.2);
}
</style>

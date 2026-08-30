<template>
  <ImmersivePage title="个人中心" :show-header="true" :scrollable="true" page-class="profile-page" :page-style="{ '--font-scale': fontScale }">
    <template #header-left>
      <view class="back-btn touch-active" @click="goBack">
        <VIcon name="back" :size="2.2" color="var(--color-text)" />
      </view>
    </template>
    <template #header-right>
      <view class="settings-btn touch-active" @click="goToSettings">
        <VIcon name="gear" :size="2.2" color="var(--color-text)" />
      </view>
    </template>

    <!-- 工作台分栏布局（横屏核心） -->
    <view class="workbench-grid">
      <!-- ===== 左侧：用户信息 + 数据统计 ===== -->
      <view class="workbench-left">
        <!-- 用户信息卡片（深色磨砂背景，突出身份） -->
        <view class="user-card">
          <view class="user-avatar-wrap" @click="openAvatarSelector">
            <PreviewImage class="user-avatar-img" :src="currentAvatarImage" :urls="[currentAvatarImage]" mode="aspectFill" />
            <view class="avatar-edit-hint">
              <VIcon name="edit" :size="3" color="#fff" />
            </view>
          </view>
          <view class="user-info">
            <view class="user-name-row" @click="openNicknameModal">
              <text class="user-name">{{ userState.nickname || '未设置昵称' }}</text>
              <VIcon name="edit" :size="3" color="rgba(255,255,255,0.6)" />
            </view>
            <text class="user-account">账号：{{ userState.account || '未设置' }}</text>
            <view v-if="userState.role" class="role-badge" :class="'role-' + userState.role">
              <text>{{ getRoleText(userState.role) }}</text>
            </view>
            <view class="user-meta">
              <text v-if="userState.id" class="meta-item">ID: {{ userState.id }}</text>
              <text class="meta-item">{{ userState.isLoggedIn ? '在线' : '离线' }}</text>
            </view>
          </view>
          <!-- 筹码区块（横屏下放大显示） -->
          <view class="user-points">
            <text class="points-label">我的筹码</text>
            <text class="points-value">{{ formatPoints(userState.points || 0) }}</text>
          </view>
        </view>

        <!-- 数据统计（改为 2×2 网格，横屏更饱满） -->
        <view class="stats-section">
          <view class="stats-grid">
            <view class="stat-item">
              <text class="stat-value">{{ userStats.totalGames }}</text>
              <text class="stat-label">总局数</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ userStats.winRate }}%</text>
              <text class="stat-label">胜率</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ formatPoints(userStats.totalProfit) }}</text>
              <text class="stat-label">总盈亏</text>
            </view>
            <view class="stat-item">
              <text class="stat-value">{{ userStats.maxWin }}</text>
              <text class="stat-label">最大连胜</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ===== 右侧：功能菜单（三个分组） ===== -->
      <view class="workbench-right">
        <!-- 分组1：个人资料 -->
        <view class="menu-group">
          <text class="group-title">个人资料</text>
          <view class="menu-list">
            <view class="menu-item" @click="openNicknameModal">
              <view class="menu-icon icon-yellow">
                <VIcon name="edit" :size="4" color="var(--color-gold)" />
              </view>
              <text class="menu-name">修改昵称</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @click="openAvatarSelector">
              <view class="menu-icon icon-pink">
                <VIcon name="user" :size="4" color="#F472B6" />
              </view>
              <text class="menu-name">更换头像</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @click="openVoicePack">
              <view class="menu-icon icon-cyan">
                <VIcon name="volume" :size="4" color="#22D3EE" />
              </view>
              <text class="menu-name">语音包试听</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 分组2：账号安全 -->
        <view class="menu-group">
          <text class="group-title">账号安全</text>
          <view class="menu-list">
            <view class="menu-item" @click="changePassword">
              <view class="menu-icon icon-orange">
                <VIcon name="lock" :size="4" color="#FB923C" />
              </view>
              <text class="menu-name">修改密码</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @click="viewLoginHistory">
              <view class="menu-icon icon-gray">
                <VIcon name="user" :size="4" color="var(--color-text-muted)" />
              </view>
              <text class="menu-name">登录记录</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 分组3：系统与协议（原“其他”，改名后更清晰） -->
        <view class="menu-group">
          <text class="group-title">系统与协议</text>
          <view class="menu-list">
            <view class="menu-item" @click="goToSettings">
              <view class="menu-icon icon-indigo">
                <VIcon name="gear" :size="4" color="var(--theme-primary)" />
              </view>
              <text class="menu-name">系统设置</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @click="aboutUs">
              <view class="menu-icon icon-indigo">
                <VIcon name="more" :size="4" color="var(--theme-primary)" />
              </view>
              <text class="menu-name">关于我们</text>
              <text class="menu-arrow">›</text>
            </view>
            <view class="menu-item" @click="userAgreement">
              <view class="menu-icon icon-teal">
                <VIcon name="more" :size="4" color="#2DD4BF" />
              </view>
              <text class="menu-name">用户协议</text>
              <text class="menu-arrow">›</text>
            </view>
          </view>
        </view>

        <!-- 退出登录按钮（放在右侧底部，随内容滚动） -->
        <view class="logout-section">
          <button class="logout-btn touch-active" @click="handleLogout">退出登录</button>
        </view>
        <view class="bottom-spacing"></view>
      </view>
    </view>

    <!-- ===== 以下弹窗全部保留，未做任何改动 ===== -->
    <!-- 充值弹窗 -->
    <view v-if="showRecharge" class="modal-overlay" @click="showRecharge = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">筹码充值</text>
          <view class="modal-close" @click="showRecharge = false"><VIcon name="close" :size="4" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="recharge-tip">
          <text class="tip-text">请联系客服或代理进行充值</text>
        </view>
        <view class="recharge-amounts">
          <view
            v-for="(amount, index) in rechargeAmounts"
            :key="index"
            class="amount-card"
            :class="{ active: selectedAmount === index }"
            @click="selectedAmount = index"
          >
            <text class="amount-value">{{ amount }}</text>
            <text class="amount-unit">筹码</text>
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-cancel touch-active" @click="showRecharge = false">取消</button>
          <button class="btn-confirm touch-active" @click="confirmRecharge">联系充值</button>
        </view>
      </view>
    </view>

    <!-- 修改密码弹窗 -->
    <view v-if="showChangePassword" class="modal-overlay" @click="showChangePassword = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">修改密码</text>
          <view class="modal-close" @click="showChangePassword = false"><VIcon name="close" :size="4" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="password-form">
          <view class="form-group">
            <text class="form-label">原密码</text>
            <input class="form-input" type="password" v-model="passwordForm.oldPassword" placeholder="请输入原密码" />
          </view>
          <view class="form-group">
            <text class="form-label">新密码</text>
            <input class="form-input" type="password" v-model="passwordForm.newPassword" placeholder="请输入新密码(6-20位)" />
          </view>
          <view class="form-group">
            <text class="form-label">确认新密码</text>
            <input class="form-input" type="password" v-model="passwordForm.confirmPassword" placeholder="请再次输入新密码" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn-cancel touch-active" @click="showChangePassword = false">取消</button>
          <button class="btn-confirm touch-active" @click="confirmChangePassword">确认修改</button>
        </view>
      </view>
    </view>

    <!-- 头像选择底部面板 -->
    <BottomSheet :visible="showAvatarSelector" title="选择头像" @update:visible="showAvatarSelector = $event">
        <view class="avatar-preview">
          <PreviewImage class="preview-img" :src="getAvatarImage(selectedAvatarId)" :urls="[getAvatarImage(selectedAvatarId)]" mode="aspectFit" />
          <text class="preview-name">{{ getAvatarConfig(selectedAvatarId).name }}</text>
        </view>
        <view class="avatar-grid">
          <view
            v-for="avatar in avatarList"
            :key="avatar.id"
            class="avatar-option"
            :class="{ active: selectedAvatarId === avatar.id }"
            @click="selectedAvatarId = avatar.id"
          >
            <PreviewImage class="option-img" :src="getAvatarImage(avatar.id)" :urls="[getAvatarImage(avatar.id)]" mode="aspectFill" />
            <view class="option-check" v-if="selectedAvatarId === avatar.id">
              <text>✓</text>
            </view>
          </view>
        </view>
      <template #footer>
        <view class="modal-footer">
          <button class="btn-cancel touch-active" @click="showAvatarSelector = false">取消</button>
          <button class="btn-confirm touch-active" :disabled="updatingAvatar" @click="confirmAvatar">
            {{ updatingAvatar ? '保存中...' : '确认使用' }}
          </button>
        </view>
      </template>
    </BottomSheet>

    <!-- 昵称修改弹窗 -->
    <view v-if="showNicknameModal" class="modal-overlay" @click="showNicknameModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">修改昵称</text>
          <view class="modal-close" @click="showNicknameModal = false"><VIcon name="close" :size="4" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="modal-body">
          <input class="form-input" v-model="nicknameForm" placeholder="请输入昵称（最多20字）" maxlength="20" />
        </view>
        <view class="modal-footer">
          <button class="btn-cancel touch-active" @click="showNicknameModal = false">取消</button>
          <button class="btn-confirm touch-active" :disabled="updatingNickname" @click="confirmNickname">
            {{ updatingNickname ? '保存中...' : '确认' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 语音包试听弹窗 -->
    <view v-if="showVoicePackModal" class="modal-overlay" @click="showVoicePackModal = false">
      <view class="modal-content voice-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">语音包试听</text>
          <view class="modal-close" @click="showVoicePackModal = false"><VIcon name="close" :size="4" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <view class="voice-current">
          <text class="voice-current-label">当前使用</text>
          <text class="voice-current-name">{{ getVoicePackName(currentVoicePack) }}</text>
        </view>
        <scroll-view class="voice-list" scroll-y>
          <view v-for="pack in voicePackList" :key="pack.id" class="voice-item" :class="{ active: currentVoicePack === pack.id }">
            <view class="voice-info">
              <text class="voice-name">{{ pack.name }}</text>
              <text class="voice-desc">{{ pack.desc }}</text>
            </view>
            <view class="voice-actions">
              <view class="voice-play-btn touch-active" @click="playVoiceSample(pack.id)">
                <text>{{ playingVoice === pack.id ? '⏸' : '▶' }}</text>
              </view>
              <view v-if="currentVoicePack !== pack.id" class="voice-use-btn touch-active" @click="useVoicePack(pack.id)">
                <text>使用</text>
              </view>
              <view v-else class="voice-used-tag">
                <text>使用中</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 设备管理弹窗 -->
    <view v-if="showDeviceModal" class="modal-overlay" @click="showDeviceModal = false">
      <view class="modal-content list-modal" @click.stop>
        <view class="modal-header">
          <text class="modal-title">登录设备</text>
          <view class="modal-close" @click="showDeviceModal = false"><VIcon name="close" :size="4" color="rgba(255,255,255,0.5)" /></view>
        </view>
        <scroll-view class="modal-list" scroll-y>
          <view v-if="loadingDevice" class="list-loading"><text>加载中...</text></view>
          <view v-else-if="deviceList.length === 0" class="list-empty"><text>暂无设备记录</text></view>
          <view v-else v-for="(item, idx) in deviceList" :key="idx" class="list-item">
            <view class="item-left">
              <text class="item-title">{{ getDeviceName(item) }}</text>
              <text class="item-sub">{{ getDeviceInfo(item) }}</text>
            </view>
            <view class="item-right">
              <text v-if="item.isCurrent || item.current" class="item-tag current">当前</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </ImmersivePage>
</template>

<script>
import { userState, fetchUserInfo, logout } from '../../store/user.js'
import { formatPoints } from '../../utils/format.js'
import { getAvatarImage, getAvatarConfig, AVATAR_LIST } from '../../utils/avatar.js'
import { getFontScale } from '../../utils/fontScale.js'
import VIcon from '../../components/ui/VIcon.vue'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import {
  updateAvatar as apiUpdateAvatar,
  updateNickname,
  getMyDevices,
  getProfile,
} from '../../api/profile.js'
import { changePassword as apiChangePassword } from '../../api/auth.js'

export default {
  name: 'ProfilePage',
  components: { VIcon, ImmersivePage },
  data() {
    return {
      userState,
      fontScale: 1.0,
      showRecharge: false,
      showChangePassword: false,
      selectedAmount: 1,
      rechargeAmounts: [100, 500, 1000, 5000, 10000, 50000],
      passwordForm: {
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      },
      userStats: {
        totalGames: 0,
        winRate: 0,
        totalProfit: 0,
        maxWin: 0,
      },
      showAvatarSelector: false,
      selectedAvatarId: 1,
      updatingAvatar: false,
      avatarList: AVATAR_LIST,
      showNicknameModal: false,
      nicknameForm: '',
      updatingNickname: false,
      showDeviceModal: false,
      deviceList: [],
      loadingDevice: false,
      changingPassword: false,
      showVoicePackModal: false,
      currentVoicePack: 1,
      playingVoice: null,
      voiceAudio: null,
      voicePackList: [
        { id: 1, name: 'VIP-1 经典男声', desc: '沉稳磁性 · 专业荷官' },
        { id: 2, name: 'VIP-2 活力女声', desc: '清脆明亮 · 热情洋溢' },
        { id: 3, name: 'VIP-3 磁性大叔', desc: '低沉浑厚 · 大佬气场' },
        { id: 4, name: 'VIP-4 甜美萝莉', desc: '可爱俏皮 · 轻松愉悦' },
        { id: 5, name: 'VIP-5 冷酷御姐', desc: '高冷御姐 · 不怒自威' },
      ],
    }
  },
  computed: {
    currentAvatarImage() {
      const avatar = this.userState.avatar
      if (!avatar) return getAvatarImage(1)
      if (typeof avatar === 'number') return getAvatarImage(avatar)
      if (typeof avatar === 'string' && avatar.startsWith('http')) return this.$cdn(avatar)
      if (typeof avatar === 'string' && /^\d+$/.test(avatar)) return getAvatarImage(parseInt(avatar))
      return getAvatarImage(1)
    },
  },
  onLoad() {
    fetchUserInfo()
    this.loadUserStats()
    this.fontScale = getFontScale()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    try {
      const savedVoice = uni.getStorageSync('vpoker_voice_pack')
      if (savedVoice) this.currentVoicePack = savedVoice
    } catch (e) {}
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
  },
  onPullDownRefresh() {
    this.loadUserStats().finally(() => uni.stopPullDownRefresh())
  },
  methods: {
    formatPoints,
    getAvatarImage,
    getAvatarConfig,
    onFontScaleChange(scale) {
      this.fontScale = scale
    },
    async loadUserStats() {
      try {
        const res = await getProfile()
        const data = res.data || res
        const totalRounds = data.totalRounds || 0
        const wins = data.wins || 0
        const net = data.net || 0
        this.userStats.totalGames = totalRounds
        this.userStats.winRate = totalRounds > 0 ? ((wins / totalRounds) * 100).toFixed(1) : 0
        this.userStats.totalProfit = net
        if (Array.isArray(data.history)) {
          let maxStreak = 0
          let currentStreak = 0
          for (const h of data.history) {
            if (h.won) {
              currentStreak++
              maxStreak = Math.max(maxStreak, currentStreak)
            } else {
              currentStreak = 0
            }
          }
          this.userStats.maxWin = maxStreak
        }
      } catch (e) {
        console.error('[Profile] 加载用户统计失败:', e)
      }
    },
    goBack() {
      uni.navigateBack()
    },
    goToSettings() {
      uni.navigateTo({ url: '/pages/settings/settings' })
    },
    getDeviceName(item) {
      return item.deviceName || item.device_name || item.model || item.deviceModel ||
             item.device_model || item.name || item.os || item.platform ||
             (item.deviceType ? item.deviceType + '设备' : '未知设备')
    },
    getDeviceInfo(item) {
      const parts = []
      if (item.ip) parts.push(item.ip)
      if (item.ipAddress) parts.push(item.ip_address || item.ipAddress)
      const time = item.lastLoginAt || item.last_login_at || item.createdAt || item.loginTime || item.time
      if (time) {
        try {
          parts.push(new Date(time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
        } catch (e) {
          parts.push(String(time))
        }
      }
      if (item.location) parts.push(item.location)
      return parts.join(' · ') || '暂无详细信息'
    },
    openVoicePack() {
      this.showVoicePackModal = true
    },
    getVoicePackName(id) {
      const pack = this.voicePackList.find(p => p.id === id)
      return pack ? pack.name : '默认语音'
    },
    playVoiceSample(id) {
      try {
        if (this.playingVoice === id) {
          if (this.voiceAudio) {
            this.voiceAudio.stop()
            this.voiceAudio.destroy()
            this.voiceAudio = null
          }
          this.playingVoice = null
          return
        }
        if (this.voiceAudio) {
          this.voiceAudio.stop()
          this.voiceAudio.destroy()
        }
        const audio = uni.createInnerAudioContext()
        audio.src = this.$cdn(`/static/voices/vip-${id}/win.mp3?v=1.0.3`)
        audio.volume = 0.8
        audio.onEnded(() => {
          this.playingVoice = null
          audio.destroy()
        })
        audio.onError(() => {
          this.playingVoice = null
          uni.showToast({ title: '语音加载失败', icon: 'none' })
        })
        audio.play()
        this.voiceAudio = audio
        this.playingVoice = id
      } catch (e) {
        uni.showToast({ title: '语音播放失败', icon: 'none' })
      }
    },
    useVoicePack(id) {
      try {
        uni.setStorageSync('vpoker_voice_pack', id)
        this.currentVoicePack = id
        uni.showToast({ title: '语音包已切换', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: '设置失败', icon: 'none' })
      }
    },
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
    getRoleText(role) {
      const roleMap = {
        player: '玩家',
        agent: '代理',
        general_agent: '总代理',
        top_agent: '总代理',
        customer_service: '客服',
        admin: '管理员',
      }
      return roleMap[role] || role
    },
    openAvatarSelector() {
      const avatar = this.userState.avatar
      if (typeof avatar === 'number') {
        this.selectedAvatarId = avatar
      } else if (typeof avatar === 'string' && /^\d+$/.test(avatar)) {
        this.selectedAvatarId = parseInt(avatar)
      } else {
        this.selectedAvatarId = 1
      }
      this.showAvatarSelector = true
    },
    selectAvatar(id) {
      this.selectedAvatarId = id
      try {
        if (uni.vibrateShort) uni.vibrateShort()
      } catch (e) {}
    },
    onAvatarImageError(e) {
      console.warn('[Profile] 头像图片加载失败:', e)
    },
    async confirmAvatar() {
      if (this.updatingAvatar) return
      if (!this.selectedAvatarId) {
        uni.showToast({ title: '请选择头像', icon: 'none' })
        return
      }
      this.updatingAvatar = true
      try {
        const avatarId = this.selectedAvatarId
        await apiUpdateAvatar(String(avatarId))
        this.userState.avatar = String(avatarId)
        uni.setStorageSync('vpoker_avatar', String(avatarId))
        try { if (uni.vibrateShort) uni.vibrateShort() } catch (e) {}
        uni.showToast({ title: '头像更新成功', icon: 'success' })
        this.showAvatarSelector = false
      } catch (err) {
        console.error('[Profile] 更新头像失败:', err)
        const errMsg = err?.error || err?.message || '头像更新失败，请重试'
        uni.showToast({ title: errMsg, icon: 'none' })
      } finally {
        this.updatingAvatar = false
      }
    },
    openNicknameModal() {
      this.nicknameForm = this.userState.nickname || ''
      this.showNicknameModal = true
    },
    async confirmNickname() {
      const name = this.nicknameForm.trim()
      if (!name) { uni.showToast({ title: '昵称不能为空', icon: 'none' }); return }
      if (name.length > 20) { uni.showToast({ title: '昵称最多20个字符', icon: 'none' }); return }
      this.updatingNickname = true
      try {
        await updateNickname(name)
        this.userState.nickname = name
        uni.setStorageSync('vpoker_nickname', name)
        uni.showToast({ title: '昵称修改成功', icon: 'success' })
        this.showNicknameModal = false
      } catch (err) {
        console.error('[Profile] 修改昵称失败:', err)
        uni.showToast({ title: err.message || '修改失败，请重试', icon: 'none' })
      } finally {
        this.updatingNickname = false
      }
    },
    changePassword() {
      this.showChangePassword = true
      this.passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' }
    },
    async confirmChangePassword() {
      const { oldPassword, newPassword, confirmPassword } = this.passwordForm
      if (!oldPassword) { uni.showToast({ title: '请输入原密码', icon: 'none' }); return }
      if (!newPassword || newPassword.length < 6) { uni.showToast({ title: '新密码至少6位', icon: 'none' }); return }
      if (newPassword !== confirmPassword) { uni.showToast({ title: '两次密码不一致', icon: 'none' }); return }
      this.changingPassword = true
      try {
        await apiChangePassword(oldPassword, newPassword, confirmPassword)
        uni.showToast({ title: '密码修改成功', icon: 'success' })
        this.showChangePassword = false
      } catch (err) {
        console.error('[Profile] 修改密码失败:', err)
        uni.showToast({ title: err.message || '修改失败，请检查原密码', icon: 'none' })
      } finally {
        this.changingPassword = false
      }
    },
    async viewLoginHistory() {
      if (this.loadingDevice) return
      this.loadingDevice = true
      this.showDeviceModal = true
      try {
        const res = await getMyDevices()
        this.deviceList = res.items || res.data?.items || res.data?.list || []
      } catch (err) {
        console.error('[Profile] 加载设备列表失败:', err)
        this.deviceList = []
        uni.showToast({ title: '加载失败，请重试', icon: 'none' })
      } finally {
        this.loadingDevice = false
      }
    },
    aboutUs() {
      uni.showModal({
        title: '关于V-Poker',
        content: 'V-Poker\n版本: 1.0.4\n一款专业的棋牌游戏平台\n\n客服邮箱: support@v-poker.com',
        showCancel: false,
      })
    },
    userAgreement() {
      uni.showModal({
        title: '用户协议',
        content: 'V-Poker 用户协议\n\n1. 本平台仅供娱乐，禁止赌博\n2. 禁止使用外挂、作弊或任何不公平手段\n3. 用户需妥善保管账号密码，因账号泄露造成的损失由用户自行承担\n4. 禁止利用平台进行任何违法违规活动\n5. 平台有权对违规账号进行封禁处理\n6. 最终解释权归平台所有',
        showCancel: false
      })
    },
    confirmRecharge() {
      uni.showToast({ title: '请联系客服完成充值', icon: 'none' })
      this.showRecharge = false
    },
    handleLogout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            logout()
          }
        }
      })
    },
  },
}
</script>

<style lang="scss" scoped>
.profile-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* ===== 工作台左右分栏布局（横屏核心） ===== */
.workbench-grid {
  display: flex;
  gap: 3vh;
  padding: 2vh 0;
  /* 安全区兜底 */
  padding-left: max(2vh, env(safe-area-inset-left, 0px));
  padding-right: max(2vh, env(safe-area-inset-right, 0px));
  box-sizing: border-box;
}

.workbench-left {
  width: 32%;        /* 比原来35%略收窄，视觉更均衡 */
  min-width: 26vh;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2vh;
}

.workbench-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2.5vh;        /* 分组间距加大，视觉分区更明显 */
}

/* 窄屏（竖屏或小屏）回退为上下排列 */
@media (max-width: 900px) {
  .workbench-grid {
    flex-direction: column;
  }
  .workbench-left {
    width: 100%;
  }
}

/* ===== 用户卡片 ===== */
.user-card {
  display: flex;
  align-items: center;
  padding: 2.4vh 2vh;
  background: rgba(255, 255, 255, 0.06);   /* 深色半透明磨砂，突出身份区 */
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 215, 0, 0.15);
  border-radius: 2vh;
  gap: 2vh;
}

.user-avatar-wrap {
  position: relative;
  width: 11vh;       /* 横屏下头像稍大 */
  height: 11vh;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  border: 0.3vh solid rgba(255, 215, 0, 0.6);
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-edit-hint {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 3.2vh;
  height: 3.2vh;
  background: rgba(255, 215, 0, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 0.8vh;
  margin-bottom: 0.4vh;
  cursor: pointer;
}

.user-name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
}

.user-account {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.5vh;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  min-height: 2.8vh;
  padding: 0.25vh 1.1vh;
  margin-bottom: 0.8vh;
  border: 1px solid transparent;
  border-radius: 0.5vh;
}

.role-badge text {
  font-size: var(--text-xs);
  font-weight: 700;
}

.role-player {
  color: #7DD3FC;
  background: rgba(56, 189, 248, 0.14);
  border-color: rgba(56, 189, 248, 0.3);
}

.role-agent {
  color: #C4B5FD;
  background: rgba(139, 92, 246, 0.14);
  border-color: rgba(139, 92, 246, 0.3);
}

.role-general_agent,
.role-top_agent {
  color: #FCD34D;
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.3);
}

.role-customer_service {
  color: #5EEAD4;
  background: rgba(20, 184, 166, 0.14);
  border-color: rgba(20, 184, 166, 0.3);
}

.role-admin {
  color: #FDA4AF;
  background: rgba(244, 63, 94, 0.14);
  border-color: rgba(244, 63, 94, 0.3);
}

.user-meta {
  display: flex;
  gap: 1.6vh;
}

.meta-item {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.35);
}

/* ===== 筹码区块（横屏下突出显示） ===== */
.user-points {
  text-align: right;
  flex-shrink: 0;
  min-width: 12vh;
}

.points-label {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 0.4vh;
}

.points-value {
  display: block;
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-gold);
  font-family: Georgia, serif;
  margin-bottom: 0.8vh;
  letter-spacing: 0.1vh;
}

/* ===== 统计卡片（2×2 网格） ===== */
.stats-section {
  flex: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;   /* 改为两列，横屏更饱满 */
  gap: 1.2vh;
  height: 100%;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.8vh 0.8vh;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 1.2vh;
  min-height: 10vh;
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.4vh;
}

.stat-label {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
}

/* ===== 右侧菜单 ===== */
.menu-group {
  /* 无需额外样式，靠父级 gap 分隔 */
}

.group-title {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 0.8vh;
  padding-left: 0.8vh;
  letter-spacing: 0.2vh;
  text-transform: uppercase;
}

.menu-list {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 1.6vh;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 1.8vh 1.6vh;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  gap: 1.6vh;
  transition: background 0.15s;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.menu-icon {
  width: 4.4vh;
  height: 4.4vh;
  border-radius: 1vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-yellow { background: rgba(255, 215, 0, 0.12); }
.icon-pink   { background: rgba(244, 114, 182, 0.12); }
.icon-cyan   { background: rgba(34, 211, 238, 0.12); }
.icon-orange { background: rgba(251, 146, 60, 0.12); }
.icon-gray   { background: rgba(113, 128, 150, 0.12); }
.icon-indigo { background: rgba(102, 126, 234, 0.12); }
.icon-teal   { background: rgba(45, 212, 191, 0.12); }

.menu-name {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.menu-arrow {
  font-size: var(--text-base);
  color: rgba(255, 255, 255, 0.2);
}

/* ===== 退出登录 ===== */
.logout-section {
  padding: 0.8vh 0;
  margin-top: 0.4vh;
}

.logout-btn {
  width: 100%;
  height: 6.4vh;
  min-height: 44px;
  line-height: 6.4vh;
  background: rgba(245, 101, 101, 0.08);
  border: 1px solid rgba(245, 101, 101, 0.2);
  border-radius: 1.6vh;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-danger);
}

.bottom-spacing {
  height: 3vh;
}

/* ===== 弹窗（全部保留原样式，未改动） ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 2vh;
  padding-top: calc(2vh + var(--safe-top, 0px));
  padding-bottom: calc(2vh + var(--safe-bottom, 0px));
  padding-left: calc(2vh + var(--safe-left, 0px));
  padding-right: calc(2vh + var(--safe-right, 0px));
  box-sizing: border-box;
}

.modal-content {
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  background: linear-gradient(145deg, #1f1f35, #1a1a2e);
  border-radius: 2vh;
  border: 0.2vh solid rgba(255, 215, 0, 0.2);
  padding: 3vh;
  overflow-y: auto;
  box-shadow: 0 1vh 4vh rgba(0,0,0,0.5), 0 0 2vh rgba(255,215,0,0.1);
  animation: modalIn 0.3s ease-out;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9) translateY(2vh); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2vh;
  padding-bottom: 1.5vh;
  border-bottom: 0.1vh solid rgba(255,255,255,0.1);
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-gold);
}

.modal-close {
  width: max(4vh, 44px);
  height: max(4vh, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
}

.modal-close:active {
  background: rgba(255,255,255,0.2);
  transform: scale(0.9);
}

.recharge-tip {
  padding: 1.6vh;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 1vh;
  margin-bottom: 2vh;
}

.tip-text {
  font-size: var(--text-sm);
  color: var(--color-gold);
}

.recharge-amounts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2vh;
  margin-bottom: 2.4vh;
}

.amount-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2vh 0.8vh;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.2vh;
  transition: all 0.2s;
}

.amount-card.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: var(--color-gold);
}

.amount-value {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
}

.amount-card.active .amount-value {
  color: var(--color-gold);
}

.amount-unit {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
}

.password-form {
  margin-bottom: 2.4vh;
}

.form-group {
  margin-bottom: 2vh;
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-border);
  margin-bottom: 1vh;
}

.form-input {
  width: 100%;
  height: 6vh;
  min-height: 40px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1vh;
  padding: 0 1.6vh;
  font-size: var(--text-base);
  color: var(--color-text);
}

.modal-footer {
  display: flex;
  gap: 2vh;
  margin-top: 2vh;
  padding-top: 2vh;
  border-top: 0.1vh solid rgba(255,255,255,0.1);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  height: 6vh;
  min-height: 44px;
  line-height: 6vh;
  font-size: var(--text-base);
  border-radius: 1vh;
  border: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-cancel:active,
.btn-confirm:active {
  transform: scale(0.96);
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255,255,255,0.7);
}

.btn-cancel:active {
  background: rgba(255, 255, 255, 0.15);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  font-weight: 700;
  box-shadow: 0 0.4vh 1vh rgba(255,215,0,0.3);
}

.btn-confirm:active {
  box-shadow: 0 0.2vh 0.5vh rgba(255,215,0,0.4);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 列表弹窗 */
.list-modal {
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}
.modal-list {
  max-height: 50vh;
  min-height: 30vh;
}
.list-loading, .list-empty {
  padding: 6vh 0;
  text-align: center;
  color: rgba(255,255,255,0.4);
  font-size: var(--text-sm);
}
.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2vh 3vh;
  border-bottom: 0.1vh solid rgba(255,255,255,0.06);
}
.item-left {
  display: flex;
  flex-direction: column;
  gap: 0.5vh;
}
.item-title {
  font-size: var(--text-sm);
  color: var(--color-text);
  font-weight: 600;
}
.item-sub {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
}
.item-right {
  text-align: right;
}
.item-tag {
  font-size: var(--text-xs);
  padding: 0.4vh 1.2vh;
  border-radius: 1vh;
  background: rgba(255,215,0,0.15);
  color: var(--color-gold);
}
.item-tag.current {
  background: rgba(74,222,128,0.15);
  color: var(--color-success);
}

/* 语音包弹窗 */
.voice-modal {
  max-height: 70vh;
}
.voice-current {
  padding: 2vh 3vh;
  background: rgba(255,215,0,0.08);
  border-radius: 1.5vh;
  margin-bottom: 2vh;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.voice-current-label {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.5);
}
.voice-current-name {
  font-size: var(--text-sm);
  color: var(--color-gold);
  font-weight: 600;
}
.voice-list {
  max-height: 45vh;
}
.voice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2vh;
  border-radius: 1.5vh;
  margin-bottom: 1.5vh;
  background: rgba(255,255,255,0.03);
  border: 0.1vh solid rgba(255,255,255,0.06);
  transition: all 0.2s;
}
.voice-item.active {
  background: rgba(255,215,0,0.08);
  border-color: rgba(255,215,0,0.3);
}
.voice-info {
  flex: 1;
}
.voice-name {
  font-size: var(--text-sm);
  color: #fff;
  font-weight: 500;
  display: block;
  margin-bottom: 0.5vh;
}
.voice-desc {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
}
.voice-actions {
  display: flex;
  align-items: center;
  gap: 1.5vh;
}
.voice-play-btn {
  width: 5vh;
  height: 5vh;
  border-radius: 50%;
  background: rgba(255,215,0,0.15);
  color: var(--color-gold);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
}
.voice-use-btn {
  padding: 1vh 2.5vh;
  background: var(--color-gold);
  color: var(--color-bg-card);
  border-radius: 1vh;
  font-size: var(--text-sm);
  font-weight: 600;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.voice-used-tag {
  padding: 1vh 2.5vh;
  background: rgba(74,222,128,0.15);
  color: var(--color-success);
  border-radius: 1vh;
  font-size: var(--text-sm);
}

/* 头像弹窗专用 */
.avatar-modal {
  width: 90%;
  max-width: 450px;
}
.avatar-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2vh 0;
}
.preview-img {
  width: 12vh;
  height: 12vh;
  border-radius: 50%;
  border: 0.4vh solid var(--color-gold);
  box-shadow: 0 0 2vh rgba(255,215,0,0.3);
  background: linear-gradient(135deg, #667eea, #764ba2);
}
.preview-name {
  margin-top: 1.5vh;
  font-size: var(--text-base);
  color: var(--color-gold);
  font-weight: 600;
}
.avatar-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2vh;
  padding: 2vh 0;
}
.avatar-option {
  position: relative;
  width: 9vh;
  height: 9vh;
  border-radius: 50%;
  border: 0.3vh solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
}
.avatar-option:active {
  transform: scale(0.95);
}
.avatar-option.active {
  border-color: var(--color-gold);
  box-shadow: 0 0 2vh rgba(255, 215, 0, 0.6);
  transform: scale(1.1);
}
.option-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}
.option-check {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 3.2vh;
  height: 3.2vh;
  background: var(--color-gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.option-check text {
  font-size: var(--text-sm);
  color: var(--color-bg-card);
  font-weight: 700;
}
</style>

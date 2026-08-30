<template>
  <ImmersivePage title="经济配置" :show-header="true" :scrollable="true" page-class="theme-economy" :page-style="{ '--font-scale': fontScale }">
    <template #header-left>
      <view class="back-btn touch-active" @click="goBack">
        <VIcon name="back" :size="3.3" color="var(--color-text)" />
      </view>
    </template>
    <template #header-right>
      <view class="reload-btn glass touch-active" @click="reloadConfig">
        <VIcon name="more" :size="2.5" color="var(--color-gold)" />
        <text class="reload-text">刷新缓存</text>
      </view>
    </template>

    <!-- Tab 切换 -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>

    <!-- ========== 游戏经济配置 ========== -->
    <view v-if="activeTab === 'games'" class="content-area">
      <view v-if="loadingGames" class="loading-tip">
        <text>加载中...</text>
      </view>
      <view v-else class="game-list">
        <view
          v-for="game in gameList"
          :key="game.gameType"
          class="game-card glass"
          @click="openGameEdit(game)"
        >
          <view class="game-card-header">
            <view class="game-icon" :style="{ background: game.color }">
              <text class="game-icon-text">{{ game.emoji }}</text>
            </view>
            <view class="game-info">
              <text class="game-name">{{ game.gameName }}</text>
              <text class="game-type">{{ formatGameType(game.gameType) }}</text>
            </view>
            <view class="game-arrow">
              <VIcon name="back" :size="2.5" color="var(--color-text-muted)" />
            </view>
          </view>
          <view class="game-stats">
            <view class="stat-item">
              <text class="stat-label">抽水比例</text>
              <text class="stat-value gold">{{ (game.rakeRate * 100).toFixed(1) }}%</text>
            </view>
            <view class="stat-item">
              <text class="stat-label">抽水基数</text>
              <text class="stat-value">{{ game.rakeBaseType === 'pot' ? '底池' : '赢家盈利' }}</text>
            </view>
            <view class="stat-item">
              <text class="stat-label">代理返佣</text>
              <text class="stat-value">{{ (game.agentRebateRate * 100).toFixed(1) }}%</text>
            </view>
            <view class="stat-item">
              <text class="stat-label">总代返佣</text>
              <text class="stat-value">{{ (game.topAgentRebateRate * 100).toFixed(1) }}%</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 房间模板配置 ========== -->
    <view v-if="activeTab === 'templates'" class="content-area">
      <view v-if="loadingTemplates" class="loading-tip">
        <text>加载中...</text>
      </view>
      <view v-else>
        <view v-for="group in templateGroups" :key="group.gameType" class="template-group">
          <view class="group-header">
            <text class="group-title">{{ group.gameName }}</text>
            <text class="group-count">{{ group.templates.length }} 套模板</text>
          </view>
          <view class="template-list">
            <view
              v-for="tpl in group.templates"
              :key="tpl.id"
              class="template-card glass"
              @click="openTemplateEdit(tpl)"
            >
              <view class="template-card-header">
                <text class="template-name">{{ tpl.templateName }}</text>
                <view class="template-level" :class="tpl.templateCode">
                  <text>{{ levelLabel(tpl.templateCode) }}</text>
                </view>
              </view>
              <view class="template-stats">
                <view class="stat-row">
                  <text class="stat-label">带入范围</text>
                  <text class="stat-value">{{ tpl.minBuyIn }} - {{ tpl.maxBuyIn }}</text>
                </view>
                <view class="stat-row">
                  <text class="stat-label">基础注额</text>
                  <text class="stat-value">{{ tpl.baseBet }}</text>
                </view>
                <view class="stat-row">
                  <text class="stat-label">默认局数</text>
                  <text class="stat-value">{{ tpl.defaultRounds }} 局</text>
                </view>
                <view class="stat-row">
                  <text class="stat-label">最大座位</text>
                  <text class="stat-value">{{ tpl.maxSeats }} 人</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 修改历史 ========== -->
    <view v-if="activeTab === 'history'" class="content-area">
      <view v-if="loadingHistory" class="loading-tip">
        <text>加载中...</text>
      </view>
      <view v-else-if="historyList.length === 0" class="empty-tip">
        <text>暂无修改记录</text>
      </view>
      <view v-else class="history-list">
        <view v-for="item in historyList" :key="item.id" class="history-item glass">
          <view class="history-header">
            <view class="history-type" :class="item.configType">
              <text>{{ item.configType === 'game_economy' ? '游戏配置' : '房间模板' }}</text>
            </view>
            <text class="history-time">{{ formatTime(item.createdAt) }}</text>
          </view>
          <view class="history-body">
            <text class="history-reason">{{ item.reason || '管理员修改配置' }}</text>
            <text class="history-operator">操作人ID: {{ item.operatorId }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 游戏配置编辑弹窗 ========== -->
    <view v-if="showGameEdit" class="modal-overlay" @click="closeGameEdit">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">编辑 - {{ editingGame?.gameName }}</text>
          <view class="modal-close-btn touch-active" @click="closeGameEdit">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <view class="form-group">
            <text class="form-label">抽水比例（%）</text>
            <input
              class="form-input"
              type="digit"
              v-model="gameForm.rakeRate"
              placeholder="如 3.0 表示 3%"
            />
            <text class="form-hint">每局从底池/赢家盈利中抽取的比例</text>
          </view>
          <view class="form-group">
            <text class="form-label">抽水基数</text>
            <view class="form-radio-group">
              <view
                class="form-radio"
                :class="{ active: gameForm.rakeBaseType === 'pot' }"
                @click="gameForm.rakeBaseType = 'pot'"
              >
                <text>底池 (pot)</text>
              </view>
              <view
                class="form-radio"
                :class="{ active: gameForm.rakeBaseType === 'flow' }"
                @click="gameForm.rakeBaseType = 'flow'"
              >
                <text>赢家盈利 (flow)</text>
              </view>
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">单局抽水封顶（0=不封顶）</text>
            <input
              class="form-input"
              type="digit"
              v-model="gameForm.rakeCap"
              placeholder="0"
            />
          </view>
          <view class="form-group">
            <text class="form-label">起抽门槛（底池低于此值不抽水）</text>
            <input
              class="form-input"
              type="digit"
              v-model="gameForm.minRakePot"
              placeholder="0"
            />
          </view>
          <view class="form-group">
            <text class="form-label">代理返佣比例（%）</text>
            <input
              class="form-input"
              type="digit"
              v-model="gameForm.agentRebateRate"
              placeholder="如 1.0 表示 1%"
            />
          </view>
          <view class="form-group">
            <text class="form-label">总代理返佣比例（%）</text>
            <input
              class="form-input"
              type="digit"
              v-model="gameForm.topAgentRebateRate"
              placeholder="如 1.0 表示 1%"
            />
            <text class="form-hint warn">代理+总代返佣之和不能超过抽水比例</text>
          </view>
          <view class="form-group">
            <text class="form-label">修改原因（选填）</text>
            <input
              class="form-input"
              v-model="gameForm.reason"
              placeholder="记录本次修改原因，便于审计追溯"
            />
          </view>
        </scroll-view>
        <view class="modal-footer">
          <view class="btn btn-ghost touch-active" @click="closeGameEdit">取消</view>
          <view class="btn btn-primary touch-active" :class="{ disabled: savingGame }" @click="saveGameConfig">
            {{ savingGame ? '保存中...' : '保存修改' }}
          </view>
        </view>
      </view>
    </view>

    <!-- ========== 房间模板编辑弹窗 ========== -->
    <view v-if="showTemplateEdit" class="modal-overlay" @click="closeTemplateEdit">
      <view class="modal-content modal-large glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">编辑 - {{ editingTemplate?.templateName }}</text>
          <view class="modal-close-btn touch-active" @click="closeTemplateEdit">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <scroll-view class="modal-body" scroll-y>
          <view class="form-group">
            <text class="form-label">模板名称</text>
            <input class="form-input" v-model="tplForm.templateName" />
          </view>
          <view class="form-row">
            <view class="form-group half">
              <text class="form-label">最小带入</text>
              <input class="form-input" type="digit" v-model="tplForm.minBuyIn" />
            </view>
            <view class="form-group half">
              <text class="form-label">最大带入</text>
              <input class="form-input" type="digit" v-model="tplForm.maxBuyIn" />
            </view>
          </view>
          <view class="form-row">
            <view class="form-group half">
              <text class="form-label">基础注额</text>
              <input class="form-input" type="digit" v-model="tplForm.baseBet" />
            </view>
            <view class="form-group half">
              <text class="form-label">单注/累计上限</text>
              <input class="form-input" type="digit" v-model="tplForm.cap" />
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">下注选项（逗号分隔）</text>
            <input
              class="form-input"
              v-model="tplForm.chipsText"
              placeholder="如 10,25,50,100"
            />
          </view>
          <view class="form-row">
            <view class="form-group half">
              <text class="form-label">默认局数</text>
              <input class="form-input" type="number" v-model="tplForm.defaultRounds" />
            </view>
            <view class="form-group half">
              <text class="form-label">最大座位数</text>
              <input class="form-input" type="number" v-model="tplForm.maxSeats" />
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">修改原因（选填）</text>
            <input
              class="form-input"
              v-model="tplForm.reason"
              placeholder="记录本次修改原因"
            />
          </view>
        </scroll-view>
        <view class="modal-footer">
          <view class="btn btn-ghost touch-active" @click="closeTemplateEdit">取消</view>
          <view class="btn btn-primary touch-active" :class="{ disabled: savingTpl }" @click="saveTemplateConfig">
            {{ savingTpl ? '保存中...' : '保存修改' }}
          </view>
        </view>
      </view>
    </view>
  </ImmersivePage>
</template>

<script>
import { formatGameType } from '../../utils/format.js'
import { getFontScale } from '../../utils/fontScale.js'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import VIcon from '../../components/ui/VIcon.vue'
import {
  getEconomyV2Games,
  getEconomyV2Templates,
  getEconomyV2History,
  updateEconomyV2Game,
  updateEconomyV2Template,
  reloadEconomyV2
} from '../../api/admin.js'

const GAME_META = {
  texas: { name: '德州竞技', emoji: '♠', color: 'linear-gradient(135deg, #4299E1, #2B6CB0)' },
  jinhua: { name: '金花竞技', emoji: '🃏', color: 'linear-gradient(135deg, #ED8936, #C05621)' },
  sangong: { name: '三公竞技', emoji: '👑', color: 'linear-gradient(135deg, #9F7AEA, #6B46C1)' },
  niuniu: { name: '斗牛竞技', emoji: '🐂', color: 'linear-gradient(135deg, #48BB78, #2F855A)' },
  tbnn: { name: '通比牛牛', emoji: '🏆', color: 'linear-gradient(135deg, #F6AD55, #DD6B20)' }
}

export default {
  name: 'EconomyConfig',
  components: { ImmersivePage, VIcon },
  data() {
    return {
      activeTab: 'games',
      fontScale: 1.0,
      tabs: [
        { key: 'games', label: '游戏配置' },
        { key: 'templates', label: '房间模板' },
        { key: 'history', label: '修改历史' }
      ],
      loadingGames: false,
      loadingTemplates: false,
      loadingHistory: false,
      gameList: [],
      templateGroups: [],
      historyList: [],
      // 游戏编辑
      showGameEdit: false,
      savingGame: false,
      editingGame: null,
      gameForm: {
        rakeRate: '',
        rakeBaseType: 'pot',
        rakeCap: '',
        minRakePot: '',
        agentRebateRate: '',
        topAgentRebateRate: '',
        reason: ''
      },
      // 模板编辑
      showTemplateEdit: false,
      savingTpl: false,
      editingTemplate: null,
      tplForm: {
        templateName: '',
        minBuyIn: '',
        maxBuyIn: '',
        baseBet: '',
        cap: '',
        chipsText: '',
        defaultRounds: '',
        maxSeats: '',
        reason: ''
      }
    }
  },
  onLoad() {
    this.fontScale = getFontScale()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    this.loadGames()
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
  },
  onPullDownRefresh() {
    this.loadGames().finally(() => uni.stopPullDownRefresh())
  },
  methods: {
    formatGameType,
    onFontScaleChange(scale) {
      this.fontScale = scale
    },
    goBack() {
      uni.navigateBack()
    },
    switchTab(key) {
      this.activeTab = key
      if (key === 'games' && this.gameList.length === 0) this.loadGames()
      if (key === 'templates' && this.templateGroups.length === 0) this.loadTemplates()
      if (key === 'history' && this.historyList.length === 0) this.loadHistory()
    },
    async loadGames() {
      this.loadingGames = true
      try {
        const res = await getEconomyV2Games()
        const games = res.games || res.data?.games || []
        this.gameList = games.map(g => ({
          ...g,
          emoji: GAME_META[g.gameType]?.emoji || '🎮',
          color: GAME_META[g.gameType]?.color || 'var(--theme-primary)'
        }))
      } catch (e) {
        console.error('[Economy] 加载游戏配置失败', e)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loadingGames = false
      }
    },
    async loadTemplates() {
      this.loadingTemplates = true
      try {
        const res = await getEconomyV2Templates()
        const templates = res.templates || res.data?.templates || []
        // 按游戏分组
        const groups = {}
        templates.forEach(t => {
          if (!groups[t.gameType]) {
            groups[t.gameType] = {
              gameType: t.gameType,
              gameName: GAME_META[t.gameType]?.name || t.gameType,
              templates: []
            }
          }
          groups[t.gameType].templates.push(t)
        })
        this.templateGroups = Object.values(groups)
      } catch (e) {
        console.error('[Economy] 加载房间模板失败', e)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loadingTemplates = false
      }
    },
    async loadHistory() {
      this.loadingHistory = true
      try {
        const res = await getEconomyV2History({ limit: 50 })
        this.historyList = res.history || res.data?.history || []
      } catch (e) {
        console.error('[Economy] 加载修改历史失败', e)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loadingHistory = false
      }
    },
    async reloadConfig() {
      try {
        await reloadEconomyV2()
        uni.showToast({ title: '缓存已刷新', icon: 'success' })
        this.loadGames()
        this.templateGroups = []
        this.historyList = []
      } catch (e) {
        uni.showToast({ title: '刷新失败', icon: 'none' })
      }
    },
    levelLabel(code) {
      const map = { junior: '初级', senior: '高级', top: '顶级' }
      return map[code] || code
    },
    formatTime(ts) {
      if (!ts) return '-'
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
    // ===== 游戏配置编辑 =====
    openGameEdit(game) {
      this.editingGame = game
      this.gameForm = {
        rakeRate: String((game.rakeRate * 100).toFixed(2)),
        rakeBaseType: game.rakeBaseType || 'pot',
        rakeCap: String(game.rakeCap || 0),
        minRakePot: String(game.minRakePot || 0),
        agentRebateRate: String((game.agentRebateRate * 100).toFixed(2)),
        topAgentRebateRate: String((game.topAgentRebateRate * 100).toFixed(2)),
        reason: ''
      }
      this.showGameEdit = true
    },
    closeGameEdit() {
      this.showGameEdit = false
      this.editingGame = null
    },
    async saveGameConfig() {
      if (!this.editingGame) return
      const rakeRate = parseFloat(this.gameForm.rakeRate)
      const agentRebate = parseFloat(this.gameForm.agentRebateRate)
      const topAgentRebate = parseFloat(this.gameForm.topAgentRebateRate)
      if (isNaN(rakeRate) || rakeRate < 0) {
        uni.showToast({ title: '抽水比例无效', icon: 'none' })
        return
      }
      if (agentRebate + topAgentRebate > rakeRate + 0.01) {
        uni.showToast({ title: '返佣之和不能超过抽水比例', icon: 'none' })
        return
      }
      this.savingGame = true
      try {
        await updateEconomyV2Game(this.editingGame.gameType, {
          rakeRate: rakeRate / 100,
          rakeBaseType: this.gameForm.rakeBaseType,
          rakeCap: parseFloat(this.gameForm.rakeCap) || 0,
          minRakePot: parseFloat(this.gameForm.minRakePot) || 0,
          agentRebateRate: agentRebate / 100,
          topAgentRebateRate: topAgentRebate / 100,
          reason: this.gameForm.reason || '管理员修改游戏经济配置'
        })
        uni.showToast({ title: '保存成功', icon: 'success' })
        this.closeGameEdit()
        this.loadGames()
      } catch (e) {
        console.error('[Economy] 保存游戏配置失败', e)
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.savingGame = false
      }
    },
    // ===== 房间模板编辑 =====
    openTemplateEdit(tpl) {
      this.editingTemplate = tpl
      this.tplForm = {
        templateName: tpl.templateName || '',
        minBuyIn: String(tpl.minBuyIn || 0),
        maxBuyIn: String(tpl.maxBuyIn || 0),
        baseBet: String(tpl.baseBet || 0),
        cap: String(tpl.cap || 0),
        chipsText: Array.isArray(tpl.chips) ? tpl.chips.join(',') : '',
        defaultRounds: String(tpl.defaultRounds || 25),
        maxSeats: String(tpl.maxSeats || 8),
        reason: ''
      }
      this.showTemplateEdit = true
    },
    closeTemplateEdit() {
      this.showTemplateEdit = false
      this.editingTemplate = null
    },
    async saveTemplateConfig() {
      if (!this.editingTemplate) return
      const minBuyIn = parseFloat(this.tplForm.minBuyIn)
      const maxBuyIn = parseFloat(this.tplForm.maxBuyIn)
      if (minBuyIn > maxBuyIn) {
        uni.showToast({ title: '最小带入不能大于最大带入', icon: 'none' })
        return
      }
      this.savingTpl = true
      try {
        const chips = this.tplForm.chipsText
          .split(',')
          .map(s => parseFloat(s.trim()))
          .filter(n => !isNaN(n))
        await updateEconomyV2Template(this.editingTemplate.templateCode, {
          gameType: this.editingTemplate.gameType,
          templateName: this.tplForm.templateName,
          minBuyIn,
          maxBuyIn,
          baseBet: parseFloat(this.tplForm.baseBet) || 0,
          cap: parseInt(this.tplForm.cap) || 0,
          chips,
          defaultRounds: parseInt(this.tplForm.defaultRounds) || 25,
          maxSeats: parseInt(this.tplForm.maxSeats) || 8,
          reason: this.tplForm.reason || '管理员修改房间模板'
        })
        uni.showToast({ title: '保存成功', icon: 'success' })
        this.closeTemplateEdit()
        this.templateGroups = []
        this.loadTemplates()
      } catch (e) {
        console.error('[Economy] 保存模板失败', e)
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.savingTpl = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.theme-economy {
  background: var(--color-bg);
  min-height: 100vh;
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reload-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}
.reload-text {
  font-size: var(--text-sm);
  color: var(--color-gold);
}

/* Tab */
.tab-bar {
  display: flex;
  padding: 20rpx 30rpx;
  gap: 16rpx;
}
.tab-item {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 16rpx;
  background: rgba(255,255,255,0.05);
  transition: all 0.2s;
}
.tab-item.active {
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-dark));
}
.tab-label {
  font-size: var(--text-base);
  color: var(--color-text-muted);
}
.tab-item.active .tab-label {
  color: #fff;
  font-weight: 600;
}

.content-area {
  padding: 0 30rpx 40rpx;
}

.loading-tip, .empty-tip {
  text-align: center;
  padding: 80rpx 0;
  color: var(--color-text-muted);
  font-size: var(--text-base);
}

/* 游戏卡片 */
.game-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.game-card {
  border-radius: 24rpx;
  padding: 28rpx;
}
.game-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}
.game-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}
.game-icon-text {
  font-size: var(--text-2xl);
}
.game-info {
  flex: 1;
}
.game-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  display: block;
}
.game-type {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.game-arrow {
  transform: rotate(180deg);
  opacity: 0.5;
}
.game-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}
.stat-item {
  background: rgba(255,255,255,0.04);
  border-radius: 12rpx;
  padding: 16rpx;
}
.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  display: block;
  margin-bottom: 6rpx;
}
.stat-value {
  font-size: var(--text-base);
  color: var(--color-text);
  font-weight: 600;
}
.stat-value.gold {
  color: var(--color-gold);
}

/* 模板分组 */
.template-group {
  margin-bottom: 36rpx;
}
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding: 0 8rpx;
}
.group-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}
.group-count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.template-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.template-card {
  border-radius: 20rpx;
  padding: 24rpx;
}
.template-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.template-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}
.template-level {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: var(--text-sm);
}
.template-level.junior { background: rgba(72,187,120,0.2); color: #48BB78; }
.template-level.senior { background: rgba(237,137,54,0.2); color: #ED8936; }
.template-level.top { background: rgba(159,122,234,0.2); color: #9F7AEA; }
.template-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}
.stat-row .stat-label {
  color: var(--color-text-muted);
  margin: 0;
}
.stat-row .stat-value {
  color: var(--color-text);
  font-weight: 500;
}

/* 历史 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.history-item {
  border-radius: 16rpx;
  padding: 24rpx;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.history-type {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: var(--text-sm);
}
.history-type.game_economy { background: rgba(66,153,225,0.2); color: #4299E1; }
.history-type.room_template { background: rgba(159,122,234,0.2); color: #9F7AEA; }
.history-time {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.history-body {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.history-reason {
  font-size: var(--text-base);
  color: var(--color-text);
}
.history-operator {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(20rpx + var(--safe-top, 0px)) calc(20rpx + var(--safe-right, 0px)) calc(20rpx + var(--safe-bottom, 0px)) calc(20rpx + var(--safe-left, 0px));
  box-sizing: border-box;
}
.modal-content {
  width: 100%;
  max-height: 85vh;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-large {
  max-width: 680rpx;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
}
.modal-close-btn {
  width: max(56rpx, 44px);
  height: max(56rpx, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-body {
  flex: 1;
  padding: 28rpx 32rpx;
  max-height: 60vh;
}
.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  border-top: 1px solid rgba(255,255,255,0.1);
}

/* 表单 */
.form-group {
  margin-bottom: 28rpx;
}
.form-group.half {
  flex: 1;
}
.form-row {
  display: flex;
  gap: 20rpx;
}
.form-label {
  font-size: var(--text-sm);
  color: var(--color-text);
  margin-bottom: 12rpx;
  display: block;
  font-weight: 500;
}
.form-input {
  width: 100%;
  min-height: max(4.5vh, 44px);
  height: max(80rpx, 44px);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: var(--text-base);
  color: var(--color-text);
}
.form-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: 8rpx;
  display: block;
}
.form-hint.warn {
  color: #FC8181;
}
.form-radio-group {
  display: flex;
  gap: 16rpx;
}
.form-radio {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.form-radio.active {
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-dark));
  border-color: transparent;
  color: #fff;
}

/* 按钮 */
.btn {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 12rpx;
  font-size: var(--text-base);
  font-weight: 600;
}
.btn-ghost {
  background: rgba(255,255,255,0.08);
  color: var(--color-text);
}
.btn-primary {
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-dark));
  color: #fff;
}
.btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>

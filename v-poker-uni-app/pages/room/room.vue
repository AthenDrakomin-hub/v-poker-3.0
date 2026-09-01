<template>
  <ImmersivePage :show-header="false" :page-class="themeClass">
    <view v-if="!isLandscapeReady" class="orientation-blocker">
      <VIcon name="warning" :size="4" color="var(--color-gold)" />
      <text>正在切换至横屏</text>
      <view class="orientation-back-btn touch-active" @click="goLobby">
        <VIcon name="back" :size="2.5" color="var(--color-bg-card)" />
        <text>返回大厅</text>
      </view>
    </view>
    <!-- 逻辑层→renderjs 命令传递视图（不可见，仅用于通讯） -->
    <view
      :data-render-cmd="renderCmd"
      :change:data-render-cmd="gameRender.onCommand"
      class="render-cmd-bridge"
    ></view>

    <!-- 背景层（主题背景 + 粒子） -->
    <template #background>
      <ThemeBackground
        :game-type="roomInfo?.gameType || 'niuniu'"
        :show-particles="false"
        :particles-enabled="false"
      />
    </template>

    <!-- Canvas 游戏层（卡牌/筹码/粒子 全部在此绘制） -->
    <view class="canvas-stage">
      <canvas
        type="2d"
        id="gameCanvas"
        :style="{ width: canvasW + 'px', height: canvasH + 'px' }"
      ></canvas>
    </view>

    <!-- 子弹时间遮罩 -->
    <view v-if="bulletTimeActive" class="bullet-time-overlay"></view>

    <!-- 开牌高潮动画（DOM 遮罩层，光效由 Canvas 绘制） -->
    <OpenCardEffect
      :active="openCardActive"
      :effect-type="currentOpenCardEffect"
      :color="currentThemeColor"
      :duration="600"
      :screen-shake="true"
      :shake-intensity="5"
      @complete="openCardActive = false"
    />

    <!-- 顶部 HUD（沉浸式模式，点击顶部区域呼出，3秒后自动隐藏） -->
    <view class="room-hud" :class="{ 'hud-hidden': !showHud }" v-show="showHud">
      <view class="hud-left">
        <view class="back-btn touch-active" @click="goBack">
          <VIcon name="back" :size="2.5" />
        </view>
        <view class="room-info">
          <text class="room-name">{{ roomInfo?.name || '房间#' + roomId }}</text>
          <text class="room-game">{{ formatGameType(roomInfo?.gameType) }}</text>
        </view>
      </view>
      <view class="hud-center">
        <view v-if="countdown > 0" class="countdown" :class="{ 'countdown-warning': countdown <= 5 }">
          <text class="countdown-num">{{ countdown }}</text>
        </view>
      </view>
      <view class="hud-right">
        <view class="user-points-hud">
          <VIcon name="coin" :size="2.2" />
          <text class="points-value">{{ formatPoints(userState.points) }}</text>
        </view>
        <view class="settings-btn touch-active" @click="openGameHistory">
          <VIcon name="list" :size="2.5" />
        </view>
        <view class="settings-btn touch-active" @click="showSettings = true">
          <VIcon name="gear" :size="2.5" />
        </view>
      </view>
    </view>

    <!-- HUD隐藏时的常驻迷你余额条（点击呼出HUD） -->
    <view v-if="!showHud" class="mini-points-bar" @click="toggleHud">
      <VIcon name="coin" :size="2" color="var(--color-gold)" />
      <text class="mini-points-value">{{ formatPoints(userState.points) }}</text>
    </view>

    <!-- 顶部呼出区域（透明，点击显示 HUD） -->
    <view class="hud-trigger-area" @click="toggleHud" v-if="!showHud"></view>

    <view v-if="isHost" class="host-control-bar" :class="{ 'host-collapsed': hostPanelCollapsed }">
      <view class="host-collapse-btn touch-active" @click="hostPanelCollapsed = !hostPanelCollapsed">
        <text class="host-collapse-icon">{{ hostPanelCollapsed ? '⚙' : '—' }}</text>
      </view>
      <text v-if="!hostPanelCollapsed" class="host-label">房主管理</text>
      <view v-if="!hostPanelCollapsed && isWaitingState" class="host-action primary" @click="hostStartGame">开始游戏{{ playablePlayerCount < 2 ? `（${playablePlayerCount}/2）` : '' }}</view>
      <view v-else-if="!hostPanelCollapsed && roomStatus === 'waiting_continue'" class="host-action primary" @click="runHostAction('continue')">续开房间</view>
      <view v-if="!hostPanelCollapsed" class="host-action" @click="runHostAction(roomInfo?.status === 'paused' ? 'resume' : 'pause')">{{ roomInfo?.status === 'paused' ? '恢复房间' : '暂停房间' }}</view>
      <view v-if="!hostPanelCollapsed" class="host-action" @click="showChipAdjust = true">筹码调整</view>
      <view v-if="!hostPanelCollapsed" class="host-action" @click="showKickModal = true">踢出玩家</view>
      <view v-if="!hostPanelCollapsed" class="host-action danger" @click="confirmEarlySettle"><VIcon name="warning" :size="1.8" color="#fca5a5" /><text>提前结算</text></view>
    </view>

    <!-- 玩家准备按钮 -->
    <view v-if="(isWaitingState || roomStatus === 'waiting_continue') && !isHost && !isMySpectator" class="player-ready-bar">
      <view class="player-ready-btn touch-active" :class="{ ready: amIReady }" @click="toggleReady">
        <text>{{ amIReady ? '已准备（点击取消）' : (roomStatus === 'waiting_continue' ? '准备下一局' : '准备') }}</text>
      </view>
    </view>

    <!-- 独立倒计时（固定显示在牌桌顶部中央，不随HUD隐藏） -->
    <view v-if="countdown > 0 && isMyTurn" class="fixed-countdown" :class="{ warning: countdown <= 5 }">
      <view class="countdown-ring">
        <text class="countdown-num">{{ countdown }}</text>
      </view>
      <text class="countdown-label">行动</text>
    </view>

    <!-- 牌型提示条（本人手牌实时牌型） -->
    <HandTypeHint
      v-if="myCards.length > 0 && !isFolded"
      :visible="myCards.length > 0"
      :hand-type="currentHandType"
      :probability="handProbability"
      position="bottom-center"
      label="我的牌型"
    />

    <!-- 牌桌区域（桌面椭圆 + 座位 UI，DOM 层） -->
    <view class="poker-table">
      <view class="table-ellipse">
        <view class="table-inner" :style="{ backgroundImage: 'url(' + $cdn('/static/images/ui/poker-table-bg.jpg') + ')' }"></view>
        <view class="table-border"></view>
        <view class="table-highlight"></view>
        <!-- V-POKER 品牌浮雕 -->
        <view class="brand-emboss">
          <text class="brand-text">V-POKER</text>
          <text class="brand-subtitle">TEXAS HOLD'EM</text>
        </view>
      </view>

      <!-- 底池显示（DOM，位于桌面中央） -->
      <view class="pot-area">
        <PotDisplay :value="currentPot" size="md" />
      </view>

      <!-- 座位容器（8 人桌，DOM 头像/金币/状态；横屏两侧座位紧凑模式） -->
      <view class="seats-container">
        <PlayerSeat
          v-for="(seat, index) in seats"
          :key="index"
          :player="seat.player"
          :position="seatPositions[index].position"
          :is-active="seat.isActive"
          :is-me="seat.isMe"
          :show-cards="false"
          :player-cards="[]"
          :cards-dealt="false"
          :is-folded="seat.isFolded"
          :is-winner="seat.isWinner"
          :is-dealer="seat.isDealer"
          :compact="index === 3 || index === 4"
          :auto-play="seat.autoPlay"
          :custom-style="seatPositions[index].style"
        />
      </view>
    </view>

    <!-- 操作栏（根据后端返回的 options 动态渲染） -->
    <view v-if="isMyTurn && !showAllCards && availableOptions.length > 0" class="action-bar">
      <DynamicActions
        :options="availableOptions"
        :disabled="isActing"
        :pot="currentPot"
        :call-amount="callAmount ? Number(callAmount) : 0"
        :player-points="mySeat?.player?.points || userState.points || 0"
        @action="handleAction"
      />
    </view>

    <!-- 弹幕层 -->
    <view class="danmaku-layer" v-if="danmakuEnabled">
      <view
        v-for="(item, idx) in danmakuList"
        :key="item.id"
        class="danmaku-item"
        :style="{ top: item.top + '%', animationDuration: item.duration + 's' }"
      >
        <text class="danmaku-sender">{{ item.sender }}:</text>
        <text class="danmaku-content">{{ item.content }}</text>
      </view>
    </view>

    <!-- 聊天框（沉浸式模式，默认收起，点击聊天按钮展开） -->
    <view class="chat-wrapper" :class="{ 'chat-expanded': showChat }">
      <view class="chat-toggle-btn touch-active" @click="showChat = !showChat">
        <VIcon name="chat" :size="2.2" color="#fff" />
        <view v-if="chatMessages.length > 0" class="chat-badge">{{ chatMessages.length }}</view>
      </view>
      <ChatBox
        v-show="showChat"
        :messages="chatMessages"
        @send="sendChat"
        @quick-voice="onQuickVoice"
        @close="showChat = false"
      />
    </view>

    <!-- 结算面板 -->
    <SettlementPanel
      :visible="showSettlement"
      :results="isFinalRound ? getFinalSettlementResults() : settlementResults"
      :total-pot="currentPot"
      :hierarchy="hierarchy"
      :is-final="isFinalRound"
      :summary="finalSummary"
      :is-host="isHost"
      :warning="settlementWarning"
      @continue="closeSettlement"
      @exit="exitRoom"
    />

    <!-- 比牌面板（炸金花/三公） -->
    <ComparePanel
      :visible="showComparePanel"
      :challenger="compareChallenger"
      :defender="compareDefender"
      :challenger-cards="compareChallengerCards"
      :defender-cards="compareDefenderCards"
      :challenger-hand="compareChallengerHand"
      :defender-hand="compareDefenderHand"
      :winner-id="compareWinnerId"
      :win-amount="compareWinAmount"
      :countdown="compareCountdown"
      :reveal-all="showAllCards"
      :current-user-id="userState.userId"
      @close="closeComparePanel"
    />

    <!-- 等待续开提示（25局结束，非房主） -->
    <view v-if="showWaitingContinue && !isHost" class="waiting-continue-overlay">
      <view class="waiting-continue-card">
        <view class="waiting-icon"><VIcon name="refresh" :size="4" color="var(--color-gold)" /></view>
        <text class="waiting-title">本局已结束</text>
        <text class="waiting-desc">第 {{ (roomInfo?.room || roomInfo)?.currentRound || 0 }} / {{ (roomInfo?.room || roomInfo)?.totalRounds || 25 }} 局已完成</text>
        <text class="waiting-desc">等待房主续开下一局...</text>
      </view>
    </view>

    <!-- 掷骰子动画（牛牛/三公抢庄） -->
    <view v-if="showDiceRoll" class="dice-overlay">
      <view class="dice-card">
        <text class="dice-title">掷骰子抢庄</text>
        <view class="dice-container">
          <view class="dice" :class="{ 'dice-rolling': diceRolling, 'dice-result': !diceRolling && diceValue }">
            <text class="dice-face">{{ diceDisplay }}</text>
          </view>
        </view>
        <text v-if="!diceRolling && diceValue" class="dice-result-text">{{ diceValue }} 点</text>
        <text v-else class="dice-rolling-text">投掷中...</text>
      </view>
    </view>

    <!-- 设置弹窗 -->
    <view v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <view class="modal-content glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">设置</text>
          <text class="modal-close" @click="showSettings = false">✕</text>
        </view>
        <view class="modal-body">
          <view class="setting-item">
            <text class="setting-label">音效</text>
            <switch :checked="soundEnabled" @change="toggleSound" color="var(--color-gold)" />
          </view>
          <view class="setting-item">
            <text class="setting-label">玩家语音</text>
            <switch :checked="voiceEnabled" @change="toggleVoice" color="var(--color-gold)" />
          </view>
          <view class="setting-item">
            <text class="setting-label">震动反馈</text>
            <switch :checked="vibrateEnabled" @change="toggleVibrate" color="var(--color-gold)" />
          </view>
          <view class="setting-item">
            <text class="setting-label">自动看牌</text>
            <switch :checked="autoLook" @change="toggleAutoLook" color="var(--color-gold)" />
          </view>
        </view>
      </view>
    </view>

    <view v-if="showChipAdjust" class="modal-overlay" @click="showChipAdjust = false">
      <view class="chip-adjust-modal glass" @click.stop>
        <view class="modal-header"><text class="modal-title">玩家筹码调整</text><text class="modal-close" @click="showChipAdjust = false">✕</text></view>
        <scroll-view class="chip-player-list" scroll-y>
          <view v-for="player in manageablePlayers" :key="player.id" class="chip-player" :class="{ active: adjustTargetId === player.id }" @click="adjustTargetId = player.id"><text>{{ player.nickname || player.account }}</text><text>{{ formatPoints(player.points) }} 筹码</text></view>
        </scroll-view>
        <view class="chip-adjust-form"><input class="chip-amount-input" type="number" v-model="adjustAmount" placeholder="输入调整数量" /><view class="chip-adjust-actions"><view class="host-action" @click="adjustPlayerPoints(1)">上分</view><view class="host-action danger" @click="adjustPlayerPoints(-1)">下分</view></view></view>
      </view>
    </view>

    <!-- 踢出玩家弹窗 -->
    <view v-if="showKickModal" class="modal-overlay" @click="showKickModal = false">
      <view class="kick-modal glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">踢出玩家</text>
          <text class="modal-close" @click="showKickModal = false">✕</text>
        </view>
        <scroll-view class="kick-player-list" scroll-y>
          <view v-if="kickablePlayers.length === 0" class="kick-empty">
            <VIcon name="user" :size="4" color="rgba(255,255,255,0.2)" />
            <text>暂无可踢出的玩家</text>
          </view>
          <view
            v-for="player in kickablePlayers"
            :key="player.id"
            class="kick-player-item"
            :class="{ kicking: kickingUserId === player.id }"
          >
            <view class="kick-player-info">
              <text class="kick-player-name">{{ player.nickname || player.account }}</text>
              <text class="kick-player-points">{{ formatPoints(player.points) }} 筹码</text>
            </view>
            <view class="kick-btn touch-active" :class="{ disabled: kickingUserId === player.id }" @click="confirmKickPlayer(player.id)">
              <text>{{ kickingUserId === player.id ? '踢出中...' : '踢出' }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 游戏记录弹窗 -->
    <view v-if="showGameHistoryModal" class="modal-overlay" @click="showGameHistoryModal = false">
      <view class="history-modal glass" @click.stop>
        <view class="modal-header">
          <text class="modal-title">游戏记录</text>
          <text class="modal-close" @click="showGameHistoryModal = false">✕</text>
        </view>
        <view class="history-tabs">
          <text class="history-tab" :class="{ active: historyTab === 'mine' }" @click="historyTab = 'mine'">我的记录</text>
          <text class="history-tab" :class="{ active: historyTab === 'all' }" @click="historyTab = 'all'">全部玩家</text>
        </view>
        <scroll-view class="history-list" scroll-y>
          <view v-if="gameHistoryLoading" class="history-loading">
            <text>加载中...</text>
          </view>
          <view v-else-if="gameHistoryList.length === 0" class="history-empty">
            <text>暂无游戏记录</text>
          </view>
          <view
            v-else
            v-for="(item, idx) in gameHistoryList"
            :key="idx"
            class="history-item"
          >
            <view class="history-left">
              <text class="history-round">第 {{ item.roundNo }} 局</text>
              <text class="history-game">{{ formatGameType(item.gameType) }}</text>
              <text class="history-winner-name">{{ item.winnerNickname }} · {{ item.handName }}</text>
              <text class="history-time">{{ item.createdAt || '' }}</text>
            </view>
            <view class="history-right">
               <text class="history-amount" :class="item.delta >= 0 ? 'profit' : 'loss'">
                 {{ item.delta >= 0 ? '+' : '' }}{{ item.delta }}
               </text>
               <text class="history-pot">底池 {{ item.pot }}</text>
               <text class="history-pot">抽水 {{ item.rake }} · 流水 {{ item.turnover }}</text>
            <!-- 全部玩家明细 -->
            <view v-if="historyTab === 'all' && item.allHands && item.allHands.length > 0" class="all-hands">
              <view v-for="(h, hi) in item.allHands" :key="hi" class="all-hand-item">
                <text class="all-hand-name">{{ h.account }}</text>
                <text class="all-hand-type">{{ h.handName }}</text>
                <text class="all-hand-amount" :class="h.delta >= 0 ? 'profit' : 'loss'">{{ h.delta >= 0 ? '+' : '' }}{{ h.delta }}</text>
              </view>
            </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </ImmersivePage>
</template>

<script module="gameRender" lang="renderjs">
// ============================================
// renderjs: 运行在视图层(WKWebView)，负责 Canvas 绘制与所有动画
// 卡牌/筹码/粒子全部在此绘制，逻辑层仅通过方法调用传递业务数据
// ============================================
export default {
  name: 'GameRender',
  data() {
    return {
      ctx: null,
      dpr: 1,
      canvasW: 0,
      canvasH: 0,
      // 卡牌对象数组 {id, suit, rank, x, y, targetX, targetY, rotation, scale, faceUp, flipping, flipScaleX, delay, startTime, flipStartTime, seatIndex, handIndex}
      cards: [],
      // 筹码对象 {id, x, y, targetX, targetY, value, color, delay, startTime}
      chips: [],
      // 粒子对象 {x, y, vx, vy, life, decay, size, color, gravity}
      particles: [],
      // 预渲染卡牌纹理（离屏 canvas）
      cardTextures: {},
      cardBack: null,
      // 动画状态
      animating: false,
      lastTime: 0,
      frameCount: 0,
      animationEpoch: 0,
      animationFrame: null,
      animationsPaused: false,
      // 性能配置
      config: {
        particleMax: 100,
        antiAlias: true,
        textureDPR: 2
      },
      // 帧率监控
      fpsFrames: [],
      lowFpsStreak: 0,
      // 座位坐标（百分比，对应 DOM 座位位置）— 8人桌横屏适配
      seatCoords: [
        { x: 0.14, y: 0.20 },  // 0: top-left
        { x: 0.50, y: 0.14 },  // 1: top
        { x: 0.86, y: 0.20 },  // 2: top-right
        { x: 0.06, y: 0.48 },  // 3: left (compact)
        { x: 0.94, y: 0.48 },  // 4: right (compact)
        { x: 0.14, y: 0.76 },  // 5: bottom-left
        { x: 0.50, y: 0.82 },  // 6: bottom (me)
        { x: 0.86, y: 0.76 }   // 7: bottom-right
      ],
      // 公共牌位置（桌面中央偏上）
      communityPos: { x: 0.50, y: 0.30 },
      // 牌堆位置
      deckPos: { x: 0.50, y: 0.24 },
      // 底池位置
      potPos: { x: 0.50, y: 0.52 }
    }
  },

  methods: {
    // ---------- 逻辑层命令入口（通过 :change:data-render-cmd 触发） ----------
    onCommand(newVal) {
      if (!newVal || !newVal.type) return
      // H5端：如果还没初始化Canvas，先初始化（mounted可能未触发）
      if (!this.ctx) {
        this.init()
      }
      if (!this.ctx) return
      if (newVal.type === 'cancelAnimations') {
        this.cancelAnimations(newVal.epoch)
        return
      }
      if (newVal.epoch !== this.animationEpoch) return
      switch (newVal.type) {
        case 'dealCards':
          this.dealCards(newVal.data)
          break
        case 'dealCommunityCards':
          this.dealCommunityCards(newVal.data)
          break
        case 'flipCard':
          this.flipCard(newVal.data)
          break
        case 'flipSeatCards':
          this.flipSeatCards(newVal.data)
          break
        case 'spawnFlyingChips':
          this.spawnFlyingChips(newVal.data)
          break
        case 'victoryBurst':
          this.victoryBurst(newVal.data)
          break
        case 'clearTable':
          this.clearTable()
          break
        case 'pauseAnimations':
          this.pauseAnimations()
          break
        case 'resumeAnimations':
          this.resumeAnimations()
          break
      }
    },

    // ---------- 初始化 ----------
    init() {
      // H5端：uni-canvas内部有原生canvas元素，需要获取内层canvas
      let canvas = document.getElementById('gameCanvas')
      if (canvas && canvas.tagName === 'UNI-CANVAS') {
        canvas = canvas.querySelector('canvas') || canvas
      }
      if (!canvas) return
      this.ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
        willReadFrequently: false
      })
      this.dpr = window.devicePixelRatio || 2
      this.canvasW = window.innerWidth
      this.canvasH = window.innerHeight
      canvas.width = this.canvasW * this.dpr
      canvas.height = this.canvasH * this.dpr
      this.ctx.scale(this.dpr, this.dpr)
      this._preloadCardTextures()

      // 内存警告监听：纯uni-app无跨平台API，预留
    },

    // 预渲染 52 张牌到离屏 canvas（iOS 会缓存为 GPU 纹理）
    _preloadCardTextures() {
      const suits = ['spade', 'heart', 'club', 'diamond']
      const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
      const W = 70, H = 98  // 卡牌逻辑尺寸（像素）
      const tdpr = this.config.textureDPR

      suits.forEach(suit => {
        ranks.forEach(rank => {
          const off = document.createElement('canvas')
          off.width = W * tdpr
          off.height = H * tdpr
          const octx = off.getContext('2d')
          octx.scale(tdpr, tdpr)
          this._drawCardFace(octx, suit, rank, W, H)
          this.cardTextures[`${suit}_${rank}`] = off
        })
      })

      // 牌背
      const back = document.createElement('canvas')
      back.width = W * tdpr
      back.height = H * tdpr
      const bctx = back.getContext('2d')
      bctx.scale(tdpr, tdpr)
      this._drawCardBack(bctx, W, H)
      this.cardBack = back
    },

    // ---------- 逻辑层调用：发牌 ----------
    // payload: { cards: [{seatIndex, handIndex, suit, rank, faceUp}], duration }
    dealCards(payload) {
      const deckX = this.canvasW * this.deckPos.x
      const deckY = this.canvasH * this.deckPos.y

      payload.cards.forEach((card, i) => {
        const target = this._getHandTarget(card.seatIndex, card.handIndex, payload.cards.length)
        this.cards.push({
          id: `card_${card.seatIndex}_${card.handIndex}_${Date.now()}_${i}`,
          suit: card.suit,
          rank: card.rank,
          seatIndex: card.seatIndex,
          handIndex: card.handIndex,
          x: deckX + (Math.random() - 0.5) * 10,
          y: deckY + (Math.random() - 0.5) * 10,
          targetX: target.x,
          targetY: target.y,
          rotation: (Math.random() - 0.5) * 20,
          targetRotation: target.rotation,
          scale: 0.4,
          targetScale: card.seatIndex === 6 ? 1.1 : 0.85,
          faceUp: card.faceUp || false,
          flipping: false,
          flipScaleX: 1,
          delay: i * 100,
          startTime: 0,
          flipStartTime: 0
        })
      })
      this._startLoop()
      this._haptic('deal')
    },

    // ---------- 逻辑层调用：发公共牌（德州 flop/turn/river） ----------
    // payload: { cards: [{suit, rank, faceUp, index}], duration }
    dealCommunityCards(payload) {
      const deckX = this.canvasW * this.deckPos.x
      const deckY = this.canvasH * this.deckPos.y
      const total = payload.cards.length

      payload.cards.forEach((card, i) => {
        const target = this._getCommunityTarget(card.index != null ? card.index : i, Math.max(total, 5))
        this.cards.push({
          id: `community_${card.index != null ? card.index : i}_${Date.now()}_${i}`,
          suit: card.suit,
          rank: card.rank,
          seatIndex: -1, // 标记为公共牌
          handIndex: card.index != null ? card.index : i,
          x: deckX + (Math.random() - 0.5) * 10,
          y: deckY + (Math.random() - 0.5) * 10,
          targetX: target.x,
          targetY: target.y,
          rotation: 0,
          targetRotation: 0,
          scale: 0.4,
          targetScale: 0.9,
          faceUp: card.faceUp !== false,
          flipping: false,
          flipScaleX: 1,
          delay: i * 200, // 逐张出现
          startTime: 0,
          flipStartTime: 0
        })
      })
      this._startLoop()
      this._haptic('deal')
    },

    // ---------- 计算公共牌目标位置（桌面中央横向排列） ----------
    _getCommunityTarget(cardIndex, totalCards) {
      const baseX = this.canvasW * this.communityPos.x
      const baseY = this.canvasH * this.communityPos.y
      const spacing = 42 // 公共牌间距
      const offsetX = (cardIndex - (totalCards - 1) / 2) * spacing
      return {
        x: baseX + offsetX,
        y: baseY,
        rotation: 0
      }
    },

    // ---------- 逻辑层调用：翻牌 ----------
    flipCard(cardId) {
      const card = this.cards.find(c => c.id === cardId)
      if (card && !card.flipping) {
        card.flipping = true
        card.flipStartTime = performance.now()
        this._startLoop()
        this._haptic('flip')
      }
    },

    // 翻指定座位的所有牌
    flipSeatCards(seatIndex) {
      this.cards.filter(c => c.seatIndex === seatIndex).forEach(card => {
        if (!card.flipping) {
          card.flipping = true
          card.flipStartTime = performance.now()
        }
      })
      this._startLoop()
      this._haptic('flip')
    },

    // ---------- 逻辑层调用：飞行筹码 ----------
    // payload: { fromSeat, amount, chipCount }
    spawnFlyingChips(payload) {
      const from = this.seatCoords[payload.fromSeat] || this.seatCoords[4]
      const startX = this.canvasW * from.x
      const startY = this.canvasH * from.y
      const endX = this.canvasW * this.potPos.x
      const endY = this.canvasH * this.potPos.y
      const colors = ['#eab308', '#dc2626', '#2563eb', 'var(--color-success)', '#f8fafc']
      const count = payload.chipCount || 5

      for (let i = 0; i < count; i++) {
        this.chips.push({
          id: `chip_${Date.now()}_${i}`,
          x: startX + (Math.random() - 0.5) * 30,
          y: startY + (Math.random() - 0.5) * 20,
          targetX: endX + (Math.random() - 0.5) * 20,
          targetY: endY + (Math.random() - 0.5) * 15,
          color: colors[i % colors.length],
          size: 14 + Math.random() * 4,
          delay: i * 60,
          startTime: 0
        })
      }
      this._startLoop()
      this._haptic('chip')
    },

    // ---------- 逻辑层调用：胜利粒子爆发 ----------
    victoryBurst(seatIndex) {
      const pos = this.seatCoords[seatIndex] || this.seatCoords[6]
      const cx = this.canvasW * pos.x
      const cy = this.canvasH * pos.y
      const count = Math.min(80, this.config.particleMax)
      const colors = ['var(--color-gold)', 'var(--color-danger)', 'var(--color-info)', '#FFF', 'var(--color-gold-dark)']

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
        const speed = 3 + Math.random() * 7
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          life: 1.0,
          decay: 0.012 + Math.random() * 0.008,
          size: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 0.12
        })
      }
      this._startLoop()
      this._haptic('victory')
    },

    // ---------- 逻辑层调用：清桌 ----------
    clearTable() {
      this.cards = []
      this.chips = []
      this.particles = []
    },

    cancelAnimations(epoch) {
      this.animationEpoch = epoch || this.animationEpoch + 1
      this.clearTable()
      this.animating = false
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame)
        this.animationFrame = null
      }
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvasW, this.canvasH)
    },

    pauseAnimations() {
      this.animationsPaused = true
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame)
        this.animationFrame = null
      }
      this.animating = false
    },

    resumeAnimations() {
      this.animationsPaused = false
      if (this.cards.length || this.chips.length || this.particles.length) {
        this._startLoop()
      }
    },

    // ---------- 动画主循环 ----------
    _startLoop() {
      if (this.animating || this.animationsPaused) return
      this.animating = true
      this.lastTime = performance.now()
      this._frameInterval = 1000 / 60 // 目标60fps
      this._loop()
    },

    _loop() {
      if (this.animationsPaused) return
      const now = performance.now()
      const dt = Math.min(now - this.lastTime, 33)

      // 帧率控制：如果距离上一帧不足16ms（60fps），跳过本次渲染
      if (dt < this._frameInterval * 0.8) {
        if (this.animating) {
          this.animationFrame = requestAnimationFrame(() => this._loop())
        }
        return
      }

      this.lastTime = now
      this.frameCount++

      // 帧率监控
      this._monitorFps(now)

      let needMore = false
      this.ctx.clearRect(0, 0, this.canvasW, this.canvasH)

      // 按 y 坐标排序卡牌（后面的先画）
      const sortedCards = [...this.cards].sort((a, b) => a.y - b.y)
      sortedCards.forEach(card => {
        if (card.delay > 0) {
          card.delay -= dt
          needMore = true
          return
        }
        if (!card.startTime) card.startTime = now

        // 发牌移动插值（600ms，贝塞尔弧线 + overshoot回弹）
        const progress = Math.min((now - card.startTime) / 600, 1)
        // 前80%用easeOutCubic快速移动，后20%用easeOutBack回弹落位
        const eased = progress < 0.8
          ? this._easeOutCubic(progress / 0.8) * 0.95
          : 0.95 + this._easeOutBack((progress - 0.8) / 0.2) * 0.05

        // 贝塞尔曲线：中间点抬高，模拟发牌弧线
        const midX = (card.x + card.targetX) / 2
        const midY = Math.min(card.y, card.targetY) - 60
        card.x = this._quadBezier(card.x, midX, card.targetX, eased)
        card.y = this._quadBezier(card.y, midY, card.targetY, eased)
        // 旋转：发牌过程中快速旋转，落位时减速
        const rotationEased = this._easeOutCubic(progress)
        card.rotation = this._lerp(card.rotation, card.targetRotation, rotationEased)
        // 缩放：发牌时先放大再缩小，增加动感
        const scaleEased = progress < 0.5
          ? this._easeOutCubic(progress * 2) * 0.3 + 0.4
          : 0.7 + this._easeInOutQuad((progress - 0.5) * 2) * 0.3
        card.scale = card.targetScale * scaleEased

        // 翻牌动画（400ms，cos曲线模拟3D翻转 + 发光效果）
        if (card.flipping) {
          const fp = Math.min((now - card.flipStartTime) / 400, 1)
          const fe = this._easeInOutQuad(fp)
          card.flipScaleX = Math.abs(Math.cos(fe * Math.PI))
          if (fp >= 0.5 && !card.faceUp) {
            card.faceUp = true
            card.flipGlow = 1 // 触发发光效果
          }
          // 发光效果衰减
          if (card.flipGlow && card.flipGlow > 0) {
            card.flipGlow = Math.max(0, card.flipGlow - dt / 500)
          }
          if (fp < 1) needMore = true
        } else if (card.flipGlow && card.flipGlow > 0) {
          card.flipGlow = Math.max(0, card.flipGlow - dt / 500)
          needMore = true
        }

        this._drawCard(card)
        if (progress < 1 || card.flipping) needMore = true
      })

      // 筹码绘制 + 飞行动画（带旋转+落入弹跳）
      this.chips = this.chips.filter(chip => {
        if (chip.delay > 0) {
          chip.delay -= dt
          return true
        }
        if (!chip.startTime) chip.startTime = now
        if (chip.rotation === undefined) chip.rotation = 0
        if (chip.spinSpeed === undefined) chip.spinSpeed = (Math.random() - 0.5) * 720 // 随机旋转速度

        const progress = Math.min((now - chip.startTime) / 600, 1)
        // 前80%飞行，后20%落入弹跳
        const flyProgress = Math.min(progress / 0.8, 1)
        const bounceProgress = Math.max((progress - 0.8) / 0.2, 0)

        const flyEased = this._easeOutCubic(flyProgress)
        const bounceEased = this._easeOutBounce(bounceProgress)

        const midX = (chip.x + chip.targetX) / 2
        const midY = Math.min(chip.y, chip.targetY) - 50

        // 飞行轨迹
        const flyX = this._quadBezier(chip.x, midX, chip.targetX, flyEased)
        const flyY = this._quadBezier(chip.y, midY, chip.targetY, flyEased)

        // 落入弹跳（在目标位置附近上下弹跳）
        const bounceOffset = bounceProgress > 0 ? (1 - bounceEased) * 15 : 0

        const drawX = flyX
        const drawY = flyY + bounceOffset

        // 伪3D深度：筹码飞行轨迹中顶点最大（模拟飞到空中），终点最小（落入底池）
        const arcScale = 1 + Math.sin(flyEased * Math.PI) * 0.35
        const depthScale = this._lerp(1, 0.45, flyEased)
        const scale = arcScale * depthScale * (bounceProgress > 0 ? this._lerp(1, 0.9, bounceProgress) : 1)

        // 筹码旋转
        chip.rotation += chip.spinSpeed * (dt / 1000)
        if (bounceProgress > 0) chip.rotation *= 0.95 // 落入时减速

        // 根据颜色映射面额
        const denomMap = { '#eab308': '100', '#dc2626': '500', '#2563eb': '1000', '#22c55e': '5000', '#f8fafc': '10000' }
        const denom = denomMap[chip.color] || ''

        this._drawChip(drawX, drawY, chip.size * scale, chip.color, denom, chip.rotation)

        if (progress < 1) {
          needMore = true
          return true
        }
        return false
      })

      // 粒子系统
      if (this.particles.length) {
        this.particles = this.particles.filter(p => {
          p.vy += p.gravity
          p.x += p.vx
          p.y += p.vy
          p.life -= p.decay
          if (p.life <= 0) return false

          this.ctx.globalAlpha = p.life
          this.ctx.fillStyle = p.color
          this.ctx.beginPath()
          this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
          this.ctx.fill()
          return true
        })
        this.ctx.globalAlpha = 1
        if (this.particles.length) needMore = true
      }

      if (needMore) {
        this.animationFrame = requestAnimationFrame(() => this._loop())
      } else {
        this.animating = false
        this.animationFrame = null
        // 动画结束通知逻辑层（仅1次，不在循环内频繁调用）
        this.$owner.callMethod('onRenderEvent', { type: 'animationComplete' })
      }
    },

    // ---------- 绘制单张牌 ----------
    _drawCard(card) {
      this.ctx.save()
      this.ctx.translate(card.x, card.y)
      this.ctx.rotate(card.rotation * Math.PI / 180)
      this.ctx.scale(card.scale * card.flipScaleX, card.scale)

      const W = 70, H = 98

      // 翻牌发光效果（金色光晕）
      if (card.flipGlow && card.flipGlow > 0) {
        this.ctx.save()
        this.ctx.globalAlpha = card.flipGlow * 0.6
        const glowGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H) * 0.8)
        glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.8)')
        glowGrad.addColorStop(0.5, 'rgba(255, 215, 0, 0.3)')
        glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)')
        this.ctx.fillStyle = glowGrad
        this.ctx.beginPath()
        this.ctx.arc(0, 0, Math.max(W, H) * 0.8, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.restore()
      }

      // 卡牌底部投影（增强悬浮感）
      this.ctx.save()
      this.ctx.shadowColor = 'rgba(0,0,0,0.45)'
      this.ctx.shadowBlur = 8
      this.ctx.shadowOffsetX = 0
      this.ctx.shadowOffsetY = 4
      this.ctx.fillStyle = 'rgba(0,0,0,0.1)'
      this._roundRect(this.ctx, -W/2 + 2, -H/2 + 3, W, H, 6)
      this.ctx.fill()
      this.ctx.restore()

      // 卡牌边缘厚度（底部深色侧边，模拟纸牌厚度）
      this.ctx.fillStyle = 'rgba(0,0,0,0.15)'
      this._roundRect(this.ctx, -W/2 + 1, -H/2 + 2, W - 2, H - 1, 5.5)
      this.ctx.fill()

      const texture = card.faceUp
        ? this.cardTextures[`${card.suit}_${card.rank}`]
        : this.cardBack

      if (texture) {
        this.ctx.drawImage(texture, -W / 2, -H / 2, W, H)
      }

      // 卡牌顶部高光（模拟覆膜反光）
      this.ctx.save()
      this.ctx.globalAlpha = 0.15
      const topGloss = this.ctx.createLinearGradient(0, -H/2, 0, -H/2 + H*0.3)
      topGloss.addColorStop(0, 'rgba(255,255,255,0.8)')
      topGloss.addColorStop(1, 'rgba(255,255,255,0)')
      this.ctx.fillStyle = topGloss
      this._roundRect(this.ctx, -W/2 + 1, -H/2 + 1, W - 2, H*0.35, 5)
      this.ctx.fill()
      this.ctx.restore()

      this.ctx.restore()
    },

    // ---------- 绘制单个筹码 ----------
    _drawChip(x, y, size, color, denomination, rotation = 0) {
      this.ctx.save()
      this.ctx.translate(x, y)
      this.ctx.rotate(rotation * Math.PI / 180)

      // 筹码底部投影
      this.ctx.save()
      this.ctx.shadowColor = 'rgba(0,0,0,0.4)'
      this.ctx.shadowBlur = 6
      this.ctx.shadowOffsetX = 0
      this.ctx.shadowOffsetY = 3
      this.ctx.fillStyle = 'rgba(0,0,0,0.15)'
      this.ctx.beginPath()
      this.ctx.arc(0, 1, size, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.restore()

      // 筹码侧面厚度（底部深色边）
      this.ctx.fillStyle = this._darkenColor(color, 0.3)
      this.ctx.beginPath()
      this.ctx.arc(0, 1.5, size, 0, Math.PI * 2)
      this.ctx.fill()

      // 筹码主体
      this.ctx.fillStyle = color
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size, 0, Math.PI * 2)
      this.ctx.fill()

      // 边缘锯齿条纹（12个白色短弧线段）
      this.ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      this.ctx.lineWidth = Math.max(1.5, size * 0.08)
      const notchCount = 12
      const notchAngle = (Math.PI * 2) / notchCount
      for (let i = 0; i < notchCount; i++) {
        const angle = i * notchAngle
        const innerR = size * 0.82
        const outerR = size * 0.95
        this.ctx.beginPath()
        this.ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
        this.ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
        this.ctx.stroke()
      }

      // 内圈（白色环形）
      this.ctx.fillStyle = 'rgba(255,255,255,0.85)'
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2)
      this.ctx.fill()

      // 内圈内部（主体色）
      this.ctx.fillStyle = color
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
      this.ctx.fill()

      // 面额数字（反向旋转，保持正向可读）
      if (denomination) {
        this.ctx.save()
        this.ctx.rotate(-rotation * Math.PI / 180)
        this.ctx.fillStyle = '#fff'
        this.ctx.font = `bold ${Math.max(8, size * 0.45)}px -apple-system, Arial`
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        this.ctx.fillText(denomination, 0, 1)
        this.ctx.restore()
      }

      // 顶部高光（左上弧形反光）
      this.ctx.save()
      this.ctx.globalAlpha = 0.35
      const glossGrad = this.ctx.createRadialGradient(-size*0.3, -size*0.3, 0, -size*0.3, -size*0.3, size*0.6)
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.9)')
      glossGrad.addColorStop(1, 'rgba(255,255,255,0)')
      this.ctx.fillStyle = glossGrad
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.restore()

      this.ctx.restore()
    },

    // ---------- 颜色变暗工具函数 ----------
    _darkenColor(color, amount) {
      // 简单的颜色变暗处理
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1,3), 16)
        const g = parseInt(color.slice(3,5), 16)
        const b = parseInt(color.slice(5,7), 16)
        return `rgb(${Math.floor(r*(1-amount))},${Math.floor(g*(1-amount))},${Math.floor(b*(1-amount))})`
      }
      return color
    },

    // ---------- 离屏绘制：牌面 ----------
    _drawCardFace(ctx, suit, rank, w, h) {
      // 大小王特殊绘制
      if (suit === 'joker') {
        const isRed = rank === 'RED'
        ctx.fillStyle = isRed ? '#fff5f5' : '#f5f5f5'
        this._roundRect(ctx, 0, 0, w, h, 6)
        ctx.fill()
        ctx.strokeStyle = isRed ? '#c62828' : '#333'
        ctx.lineWidth = 2
        this._roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 5.5)
        ctx.stroke()
        ctx.fillStyle = isRed ? '#c62828' : '#212121'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.font = 'bold 11px -apple-system, Arial'
        ctx.fillText(isRed ? '大王' : '小王', w / 2, 4)
        ctx.font = 'bold 16px -apple-system, Arial'
        ctx.textBaseline = 'middle'
        ctx.fillText('JOKER', w / 2, h / 2)
        ctx.save()
        ctx.translate(w / 2, h - 4)
        ctx.rotate(Math.PI)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.font = 'bold 11px -apple-system, Arial'
        ctx.fillText(isRed ? '大王' : '小王', 0, 0)
        ctx.restore()
        return
      }
      // 白底 + 圆角
      ctx.fillStyle = '#FFF'
      this._roundRect(ctx, 0, 0, w, h, 6)
      ctx.fill()

      // 牌面光泽渐变（左上→右下斜向反光）
      const glossGrad = ctx.createLinearGradient(0, 0, w, h)
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.6)')
      glossGrad.addColorStop(0.3, 'rgba(255,255,255,0.1)')
      glossGrad.addColorStop(0.7, 'rgba(0,0,0,0.03)')
      glossGrad.addColorStop(1, 'rgba(0,0,0,0.08)')
      ctx.fillStyle = glossGrad
      this._roundRect(ctx, 0, 0, w, h, 6)
      ctx.fill()

      // 边缘内阴影（增加厚度感）
      ctx.save()
      this._roundRect(ctx, 0, 0, w, h, 6)
      ctx.clip()
      const innerShadow = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.3, w/2, h/2, Math.max(w,h)*0.7)
      innerShadow.addColorStop(0, 'rgba(0,0,0,0)')
      innerShadow.addColorStop(1, 'rgba(0,0,0,0.12)')
      ctx.fillStyle = innerShadow
      ctx.fillRect(0, 0, w, h)
      ctx.restore()

      // 边框
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 1
      this._roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 5.5)
      ctx.stroke()

      const isRed = suit === 'heart' || suit === 'diamond'
      const color = isRed ? '#c62828' : '#1a1a1a'
      const symbols = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }

      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      // 左上角
      ctx.font = 'bold 13px -apple-system, Arial'
      ctx.fillText(rank, 5, 3)
      ctx.font = '11px -apple-system, Arial'
      ctx.fillText(symbols[suit], 5, 17)
      // 右下角（倒置）
      ctx.save()
      ctx.translate(w - 5, h - 3)
      ctx.rotate(Math.PI)
      ctx.textAlign = 'left'
      ctx.font = 'bold 13px -apple-system, Arial'
      ctx.fillText(rank, 0, 0)
      ctx.font = '11px -apple-system, Arial'
      ctx.fillText(symbols[suit], 0, 14)
      ctx.restore()

      // 中央大花色（半透明水印，增强品牌感）
      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.font = 'bold 42px -apple-system, Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(symbols[suit], w / 2, h / 2 + 2)
      ctx.restore()

      // 中央小花色（实色，位于大花色上方）
      ctx.font = '24px -apple-system, Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(symbols[suit], w / 2, h / 2 + 1)
    },

    // ---------- 离屏绘制：牌背 ----------
    _drawCardBack(ctx, w, h) {
      // 渐变背景
      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, '#1a237e')
      grad.addColorStop(1, '#0d1442')
      ctx.fillStyle = grad
      this._roundRect(ctx, 0, 0, w, h, 6)
      ctx.fill()
      // 金色边框
      ctx.strokeStyle = 'var(--color-gold)'
      ctx.lineWidth = 2
      this._roundRect(ctx, 3, 3, w - 6, h - 6, 4)
      ctx.stroke()
      // 内部花纹（菱形网格）
      ctx.strokeStyle = 'rgba(255,215,0,0.2)'
      ctx.lineWidth = 1
      for (let x = 8; x < w - 8; x += 10) {
        for (let y = 8; y < h - 8; y += 10) {
          ctx.beginPath()
          ctx.moveTo(x, y - 3)
          ctx.lineTo(x + 3, y)
          ctx.lineTo(x, y + 3)
          ctx.lineTo(x - 3, y)
          ctx.closePath()
          ctx.stroke()
        }
      }
    },

    // ---------- 计算手牌目标位置 ----------
    _getHandTarget(seatIndex, handIndex, totalCards) {
      const seat = this.seatCoords[seatIndex] || this.seatCoords[4]
      const baseX = this.canvasW * seat.x
      const baseY = this.canvasH * seat.y
      // 手牌横向展开，每张间隔 24px
      const spacing = 24
      const offsetX = (handIndex - (totalCards - 1) / 2) * spacing
      // 我的手牌在下方，其他玩家在座位位置
      const yOffset = seatIndex === 6 ? 30 : -10
      // 旋转角度：两侧座位有轻微旋转（8人桌）
      const rotations = [-10, 0, 10, -5, 5, -8, 0, 8]
      return {
        x: baseX + offsetX,
        y: baseY + yOffset,
        rotation: rotations[seatIndex] || 0
      }
    },

    // ---------- 帧率监控 ----------
    _monitorFps(now) {
      this.fpsFrames.push(now)
      while (this.fpsFrames.length && now - this.fpsFrames[0] > 1000) {
        this.fpsFrames.shift()
      }
      const fps = this.fpsFrames.length
      if (fps < 40) {
        this.lowFpsStreak++
        if (this.lowFpsStreak >= 180 && this.config.textureDPR > 1) {
          this.config.textureDPR = 1
          this.config.particleMax = Math.min(this.config.particleMax, 50)
          this._preloadCardTextures()
          this.lowFpsStreak = 0
        }
      } else {
        this.lowFpsStreak = 0
      }
    },

    // ---------- 内存警告处理 ----------
    _handleMemoryWarning() {
      console.warn('[renderjs] 内存警告，清理粒子和纹理缓存')
      this.particles = []
      this.config.particleMax = 30
      if (this.config.textureDPR > 1) {
        this.config.textureDPR = 1
        this._preloadCardTextures()
      }
    },

    // ---------- 触觉反馈（纯uni-app，由逻辑层处理） ----------
    _haptic(style) {
      try {
        this.$owner.callMethod('triggerHaptic', style)
      } catch (e) {}
    },

// ---------- 工具函数 ----------
    _quadBezier(p0, p1, p2, t) {
      return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2
    },
    _lerp(a, b, t) { return a + (b - a) * t },
    _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) },
    _easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 },
    // 带回弹的缓动（overshoot效果，适合发牌落位）
    _easeOutBack(t) {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    },
    // 弹跳缓动（适合筹码落入底池）
    _easeOutBounce(t) {
      const n1 = 7.5625
      const d1 = 2.75
      if (t < 1 / d1) return n1 * t * t
      else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
      else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
      else return n1 * (t -= 2.625 / d1) * t + 0.984375
    },
    // 弹性缓动（适合胜利效果）
    _easeOutElastic(t) {
      const c4 = (2 * Math.PI) / 3
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
    },
    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    }
  },

  mounted() {
    this.$nextTick(() => {
      this.init()
    })
  }
}
</script>

<script>

// ========== 游戏常量配置 ==========
const GAME_CONSTANTS = {
  ACTION_TIMEOUT: 30,        // 玩家操作超时时间（秒），与后端 timeoutChecker 一致
  COUNTDOWN_WARNING: 5,       // 倒计时剩余多少秒时触发警告（语音+震动）
  COUNTDOWN_VIBRATE: 3,       // 倒计时剩余多少秒时加强震动
  STATE_CHANGE_DEBOUNCE: 200, // 状态变更防抖时间（毫秒）
  ROOM_INFO_CACHE_TTL: 5000,  // 房间信息缓存有效期（毫秒）
  HUD_AUTO_HIDE_DELAY: 5000,  // HUD自动隐藏延迟（毫秒）
  SLOW_ACTION_THRESHOLD: 500, // 操作延迟警告阈值（毫秒）
  RECONNECT_TOAST_DURATION: 1500, // 重连成功提示时长（毫秒）
  DISCONNECT_TOAST_DURATION: 2000, // 断线提示时长（毫秒）
}

import PotDisplay from '../../components/chips/PotDisplay.vue'
import PlayerSeat from '../../components/seat/PlayerSeat.vue'
import ChatBox from '../../components/ui/ChatBox.vue'
import ThemeBackground from '../../components/ui/ThemeBackground.vue'
import OpenCardEffect from '../../components/ui/OpenCardEffect.vue'
import SettlementPanel from '../../components/settlement/SettlementPanel.vue'
import VIcon from '../../components/ui/VIcon.vue'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import DynamicActions from '../../components/actions/DynamicActions.vue'
import ComparePanel from '../../components/game/ComparePanel.vue'
import HandTypeHint from '../../components/game/HandTypeHint.vue'
import { userState, fetchUserInfo, updatePoints } from '../../store/user.js'
import { formatPoints, formatGameType } from '../../utils/format.js'
import { getRoom, getRoomHand, getRoomHandSnapshot, startHand, readyRoom, readyNext, performAction, sendRoomChat, continueRoom, pauseRoom, resumeRoom, earlySettle, adjustRoomPoints, kickPlayer, leaveRoom } from '../../api/rooms.js'
import { getMyRoomRounds } from '../../api/profile.js'
import { getThemeByGameType } from '../../themes/themeConfig.js'
import { getSoundManager, getVoiceManager } from '../../utils/sound.js'
import { connectSocket, getSocket } from '../../socket/index.js'
import { getRoomSocket, destroyRoomSocket } from '../../socket/roomSocket.js'
import { saveAppSettings } from '../../utils/appSettings.js'

export default {
  name: 'RoomPage',
  components: {
    PotDisplay,
    PlayerSeat,
    ChatBox,
    ThemeBackground,
    OpenCardEffect,
    SettlementPanel,
    VIcon,
    ImmersivePage,
    DynamicActions,
    ComparePanel,
    HandTypeHint,
  },
  data() {
    return {
      userState,
      roomId: null,
      roomInfo: null,
      handData: null,
      handSequence: 0,
      snapshotSyncing: false,
      isLandscapeReady: false,
      orientationRetryTimer: null,
      // Canvas 尺寸
      canvasW: 0,
      canvasH: 0,
      // renderjs 命令对象（逻辑层→renderjs 通讯）
      renderCmd: { type: '', data: null, ts: 0 },
      animationEpoch: 0,
      // H5端Canvas渲染（renderjs在H5端不工作，直接在逻辑层渲染）
      canvasCtx: null,
      canvasCards: [],
      canvasLoop: null,
      // 座位数据（8人桌）
      seats: [
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: true, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false },
        { player: null, isActive: false, isMe: false, cards: [], isFolded: false, isWinner: false, isDealer: false, autoPlay: false }
      ],
      mySeatIndex: 6,
      // 座位位置配置（对应 renderjs 中的 seatCoords）— 8人桌横屏适配
      seatPositions: [
        { position: 'top-left', style: { top: '10%', left: '12%' } },
        { position: 'top', style: { top: '8%', left: '50%', transform: 'translateX(-50%)' } },
        { position: 'top-right', style: { top: '10%', right: '12%' } },
        { position: 'left', style: { top: '42%', left: '3%' } },
        { position: 'right', style: { top: '42%', right: '3%' } },
        { position: 'bottom-left', style: { bottom: '24%', left: '12%' } },
        { position: 'bottom', style: { bottom: '22%', left: '50%', transform: 'translateX(-50%)' } },
        { position: 'bottom-right', style: { bottom: '24%', right: '12%' } }
      ],
      // 牌局状态
      currentPot: 0,
      communityCards: [],
      lastCommunityCount: 0, // 上一次公共牌数量，用于检测新牌触发发牌动画
      myCards: [],
      hasLooked: false,
      showAllCards: false,
      cardsDealt: false,
      isMyTurn: false,
      isActing: false,
      pendingAction: null,
      actionLatencyMs: 0,
      slowActionTimer: null,
      countdown: 0,
      lastTurnUserId: null, // 检测操作玩家变化，用于启动倒计时
      loadHandDebounceTimer: null, // onStateChanged防抖定时器
      roomInfoCacheTime: 0, // 房间信息缓存时间戳
      roomInfoCache: null, // 房间信息缓存数据
      isLeavingRoom: false,
      // 操作金额
      callAmount: '',
      raiseAmount: '',
      compareAmount: '',
      // 后端返回的可用操作列表（驱动动态按钮渲染）
      availableOptions: [],
      // 聊天
      chatMessages: [],
      // 结算
      showSettlement: false,
      settlementResults: [],
      bulletTimeActive: false,
      // 25局结束等待续开
      showWaitingContinue: false,
      // 骰子动画（牛牛/三公抢庄）
      showDiceRoll: false,
      diceRolling: false,
      diceValue: null,
      diceDisplay: '?',
      _diceTimer: null,
      // 比牌面板（炸金花/三公）
      showComparePanel: false,
      compareChallenger: null,
      compareDefender: null,
      compareChallengerCards: [],
      compareDefenderCards: [],
      compareChallengerHand: '',
      compareDefenderHand: '',
      compareWinnerId: null,
      compareWinAmount: 0,
      compareCountdown: 0,
      _compareTimer: null,
      // 开牌动画
      openCardActive: false,
      // 音效管理器
      soundManager: null,
      // 语音管理器（方言语音包）
      voiceManager: null,
      // 上次牌局状态（用于检测其他玩家操作变化）
      lastHandState: null,
      lastHandPhase: '',
      // V3经济模型 - 层级信息
      hierarchy: {
        L0: null,
        L1: null,
        L2: null
      },

      // 25局累计净输赢（总结算用）
      cumulativeNetResults: {},
      // 设置
      showSettings: false,
      soundEnabled: true,
      voiceEnabled: true,
      vibrateEnabled: true,
      autoLook: false,
      // 沉浸式游戏模式
      showHud: true,
      showChat: false,
      hostPanelCollapsed: false,
      hudAutoHideTimer: null,
      // 定时器
      countdownTimer: null,
      // 背景音乐播放状态
      bgmWasPlaying: false,
      showChipAdjust: false,
      adjustTargetId: null,
      adjustAmount: '',
      // 踢出玩家
      showKickModal: false,
      kickingUserId: null,
      // 游戏记录
      showGameHistoryModal: false,
      gameHistoryList: [],
      gameHistoryLoading: false,
      historyTab: 'mine', // 游戏记录tab：mine=我的记录 all=全部玩家
      // 弹幕
      danmakuEnabled: true,
      danmakuList: [],
      _danmakuId: 0
    }
  },
  computed: {
    mySeat() {
      return this.seats[this.mySeatIndex]
    },
    isFolded() {
      return this.mySeat?.isFolded || false
    },
    // 当前手牌牌型（简化版，实际应由后端返回或前端计算）
    currentHandType() {
      if (!this.myCards || this.myCards.length === 0) return ''
      const gameType = this.roomInfo?.gameType || this.roomInfo?.room?.gameType
      // 非德州游戏（niuniu/sangong/tbnn/jinhua）：牌型由后端结算返回，游戏进行中不显示前端估算牌型
      if (gameType && gameType !== 'texas') return ''
      // 德州扑克：2张手牌 + 公共牌
      const allCards = [...this.myCards, ...(this.communityCards || [])]
      if (allCards.length < 2) return '高牌'
      return this.evaluateHandType(allCards)
    },
    // 手牌胜率估算（简化版）
    handProbability() {
      if (!this.myCards || this.myCards.length === 0) return 0
      // 简化估算：根据牌型返回大致胜率
      const type = this.currentHandType
      const probMap = {
        '皇家同花顺': 95, '同花顺': 90, '四条': 85, '葫芦': 80,
        '同花': 70, '顺子': 65, '三条': 55, '两对': 45,
        '一对': 35, '高牌': 20
      }
      return probMap[type] || 30
    },
    themeClass() {
      const themeMap = {
        niuniu: 'theme-forbidden-city',
        sangong: 'theme-jiangnan',
        tbnn: 'theme-steampunk',
        jinhua: 'theme-noir',
        texas: 'theme-wallstreet'
      }
      return themeMap[this.roomInfo?.gameType] || 'theme-default'
    },
    currentTheme() {
      return getThemeByGameType(this.roomInfo?.gameType || 'niuniu')
    },
    currentOpenCardEffect() {
      return this.currentTheme?.openCardEffect?.type || 'gold_burst'
    },
    currentThemeColor() {
      return this.currentTheme?.colors?.primary || 'var(--color-gold)'
    },
    isHost() {
      const room = this.roomInfo?.room || this.roomInfo
      const ownerId = room?.ownerId || room?.hostId || room?.creatorId || room?.createdBy || room?.agentId
      // 后端也会直接返回 isHost 字段
      if (this.roomInfo?.isHost === true) return true
      return !!ownerId && String(ownerId) === String(userState.id)
    },
    // 是否最后一局（总结算）
    isFinalRound() {
      const room = this.roomInfo?.room || this.roomInfo
      const cur = Number(room?.currentRound) || 0
      const total = Number(room?.totalRounds) || 25
      return cur > 0 && cur >= total
    },
    // 总结算累计数据
    finalSummary() {
      const room = this.roomInfo?.room || this.roomInfo
      return {
        roundNo: Number(room?.currentRound) || 0,
        totalRounds: Number(room?.totalRounds) || 25,
        totalFlow: Number(room?.totalFlow) || 0,
        totalRake: Number(room?.totalRake) || 0,
      }
    },

    // 结算警告（庄家赔付不足等）
    settlementWarning() {
      const log = this.handData?.log || []
      const warn = log.find(l => l && l.includes("庄家筹码不足"))
      return warn || ''
    },
    // 房间状态（兼容嵌套和扁平结构）
    roomStatus() {
      const room = this.roomInfo?.room || this.roomInfo
      return room?.status || ''
    },
    isWaitingState() {
      if (this.roomStatus === 'waiting_continue') return false
      if (this.roomStatus === 'finished') return false
      const phase = this.handData?.phase
      return !phase || phase === 'waiting' || phase === 'idle'
    },
    amIReady() {
      const me = this.occupiedSeats.find(s => String(s.player?.id) === String(userState.id))
      return !!(me?.player?.ready || me?.ready)
    },
    isMySpectator() {
      return !!this.roomInfo?.me?.isSpectator
    },
    occupiedSeats() {
      return this.seats.filter(seat => seat.player && seat.player.id)
    },
    // 房主操作使用房间成员列表，而非仅使用已开局的 hand.seats。
    manageablePlayers() {
      const room = this.roomInfo?.room || this.roomInfo || {}
      const ownerId = room.ownerId || room.hostId || room.creatorId || room.createdBy || room.agentId
      const players = this.roomInfo?.players || room.players || []
      return players
        .map(player => ({
          ...player,
          id: player.id || player.userId,
          nickname: player.nickname || player.account,
        }))
        .filter(player => player.id && String(player.id) !== String(ownerId) && String(player.id) !== String(userState.id))
    },
    playablePlayers() {
      return this.manageablePlayers.filter(player => !player.isSpectator && Number(player.points) > 0)
    },
    playablePlayerCount() {
      return this.playablePlayers.length
    },
    unreadyPlayablePlayers() {
      return this.playablePlayers.filter(player => !player.ready)
    },
    // 可踢出的玩家（排除房主自己）
    kickablePlayers() {
      return this.manageablePlayers
    },
  },
  onLoad(options) {
    this.roomId = options.id
    this.prepareRoomInLandscape()
    // #ifdef H5
    // H5端：延迟初始化Canvas（renderjs在H5端不工作，直接在逻辑层渲染）
    setTimeout(() => {
      this.initCanvas()
    }, 500)
    // #endif
  },
  onHide() {
    this.sendCmd('pauseAnimations')
    if (this.soundManager && this.soundManager.backgroundAudio) {
      this.bgmWasPlaying = true
      this.soundManager.pauseBackground()
    }
  },
  onShow() {
    this.sendCmd('resumeAnimations')
    if (this.soundManager && this.bgmWasPlaying) {
      this.soundManager.playBackground()
      this.bgmWasPlaying = false
    }
  },
  onUnload() {
    this.clearHudTimer()
    if (this.loadHandDebounceTimer) { clearTimeout(this.loadHandDebounceTimer); this.loadHandDebounceTimer = null }
    if (this.orientationRetryTimer) {
      clearTimeout(this.orientationRetryTimer)
      this.orientationRetryTimer = null
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    if (this.slowActionTimer) {
      clearTimeout(this.slowActionTimer)
      this.slowActionTimer = null
    }
    this.stopCanvasLoop()
    this.cancelTableAnimations()
    if (this._diceTimer) {
      clearInterval(this._diceTimer)
      this._diceTimer = null
    }
    if (this.soundManager) {
      this.soundManager.stopBackground()
      this.soundManager.destroy()
      this.soundManager = null
    }
    if (this.voiceManager) {
      this.voiceManager.destroy()
      this.voiceManager = null
    }
    try {
      const roomSocket = getRoomSocket()
      if (this.roomId) {
        roomSocket.leaveRoom(this.roomId)
      }
      roomSocket.clearRoomHandlers()
      // 移除全局 disconnect/reconnect 监听，避免反复进出后重复订阅
      const socket = getSocket()
      socket.off('disconnect', this.onSocketDisconnect)
      socket.off('reconnect', this.onSocketReconnect)
    } catch (e) {
      console.warn('[Room] Socket清理失败', e)
    }
  },
  methods: {
    formatPoints,
    formatGameType,

    // ---------- H5端Canvas渲染（renderjs在H5端不工作，直接在逻辑层渲染） ----------
    initCanvas() {
      // #ifndef H5
      return // App端使用renderjs渲染，跳过逻辑层Canvas
      // #endif
      if (this.canvasCtx) return
      const uniCanvas = document.getElementById('gameCanvas')
      if (!uniCanvas) return
      const canvas = uniCanvas.querySelector('canvas') || uniCanvas
      if (!canvas || typeof canvas.getContext !== 'function') return
      this.canvasCtx = canvas.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      this.canvasW = window.innerWidth
      this.canvasH = window.innerHeight
      canvas.width = this.canvasW * dpr
      canvas.height = this.canvasH * dpr
      this.canvasCtx.scale(dpr, dpr)
      this.startCanvasLoop()
    },
    startCanvasLoop() {
      // 优化：卡牌位置是静态的，不需要持续渲染循环
      // 只在 canvasCards 更新时调用 renderCanvasCards() 重绘一次
      // 如果未来有卡牌动画，再启用 requestAnimationFrame 循环
      this.renderCanvasCards()
    },
    stopCanvasLoop() {
      // 兼容旧代码，不再需要取消动画帧
      if (this.canvasLoop) {
        cancelAnimationFrame(this.canvasLoop)
        this.canvasLoop = null
      }
    },
    renderCanvasCards() {
      if (!this.canvasCtx) return
      const ctx = this.canvasCtx
      ctx.clearRect(0, 0, this.canvasW, this.canvasH)
      // 绘制所有卡牌
      this.canvasCards.forEach(card => {
        this.drawCard(card)
      })
    },
    drawCard(card) {
      const ctx = this.canvasCtx
      const W = 60, H = 84
      ctx.save()
      ctx.translate(card.x, card.y)
      ctx.rotate((card.rotation || 0) * Math.PI / 180)
      const scale = card.scale || 1
      ctx.scale(scale, scale)
      if (card.faceUp) {
        this.drawCardFace(ctx, card.suit, card.rank, W, H)
      } else {
        this.drawCardBack(ctx, W, H)
      }
      ctx.restore()
    },
    drawCardFace(ctx, suit, rank, W, H) {
      // 大小王特殊绘制
      if (suit === 'joker') {
        const isRed = rank === 'RED'
        ctx.fillStyle = isRed ? '#fff5f5' : '#f5f5f5'
        ctx.strokeStyle = isRed ? '#c62828' : '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(0, 0, W, H, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = isRed ? '#c62828' : '#212121'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(isRed ? '大王' : '小王', W / 2, 15)
        ctx.font = 'bold 18px Arial'
        ctx.fillText('JOKER', W / 2, H / 2 + 6)
        ctx.save()
        ctx.translate(W / 2, H - 8)
        ctx.rotate(Math.PI)
        ctx.font = 'bold 11px Arial'
        ctx.fillText(isRed ? '大王' : '小王', 0, 0)
        ctx.restore()
        return
      }
      // 牌面背景
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(0, 0, W, H, 6)
      ctx.fill()
      ctx.stroke()
      // 花色颜色
      const isRed = suit === 'heart' || suit === 'diamond'
      ctx.fillStyle = isRed ? '#d32f2f' : '#212121'
      // 点数
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(rank, W / 2, 18)
      // 花色符号
      const suitSymbol = { spade: '♠', heart: '♥', diamond: '♦', club: '♣' }[suit] || '♠'
      ctx.font = '24px Arial'
      ctx.fillText(suitSymbol, W / 2, H / 2 + 8)
      // 底部点数（倒转）
      ctx.save()
      ctx.translate(W / 2, H - 6)
      ctx.rotate(Math.PI)
      ctx.font = 'bold 14px Arial'
      ctx.fillText(rank, 0, 0)
      ctx.restore()
    },
    drawCardBack(ctx, W, H) {
      // 牌背背景
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, '#1a237e')
      grad.addColorStop(1, '#0d47a1')
      ctx.fillStyle = grad
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(0, 0, W, H, 6)
      ctx.fill()
      ctx.stroke()
      // 牌背图案
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.roundRect(6 + i * 4, 6 + i * 4, W - 12 - i * 8, H - 12 - i * 8, 4)
        ctx.stroke()
      }
      // 中心V标志
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = 'bold 28px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('V', W / 2, H / 2 + 10)
    },
    // 座位坐标（8人桌）
    getSeatCanvasPos(seatIndex) {
      const w = this.canvasW, h = this.canvasH
      const positions = [
        { x: w * 0.18, y: h * 0.22 },  // 0 top-left
        { x: w * 0.5, y: h * 0.15 },   // 1 top
        { x: w * 0.82, y: h * 0.22 },  // 2 top-right
        { x: w * 0.08, y: h * 0.5 },   // 3 left
        { x: w * 0.92, y: h * 0.5 },   // 4 right
        { x: w * 0.22, y: h * 0.78 },  // 5 bottom-left
        { x: w * 0.5, y: h * 0.82 },   // 6 bottom (me)
        { x: w * 0.78, y: h * 0.78 }   // 7 bottom-right
      ]
      return positions[seatIndex] || { x: w / 2, y: h / 2 }
    },

    // 完整牌型评估（德州扑克：从7张牌中选最佳5张）
    evaluateHandType(cards) {
      if (!cards || cards.length < 2) return '高牌'

      // 解析卡牌：格式如 "As", "Kh", "10d"
      const parsed = cards.map(c => {
        if (typeof c === 'string') {
          const rank = c.slice(0, -1), suit = c.slice(-1)
          const rankMap = { A: 14, K: 13, Q: 12, J: 11 }
          return { rank: rankMap[rank] || parseInt(rank) || 0, suit }
        }
        return { rank: c?.rank || 0, suit: c?.suit || '' }
      }).filter(c => c.rank > 0)

      if (parsed.length < 5) {
        // 不足5张，简化判断
        const rankCount = {}
        parsed.forEach(c => { rankCount[c.rank] = (rankCount[c.rank] || 0) + 1 })
        const counts = Object.values(rankCount).sort((a, b) => b - a)
        if (counts[0] === 4) return '四条'
        if (counts[0] === 3 && counts[1] >= 2) return '葫芦'
        if (counts[0] === 3) return '三条'
        if (counts[0] === 2 && counts[1] === 2) return '两对'
        if (counts[0] === 2) return '一对'
        return '高牌'
      }

      // 完整5+张牌型计算
      // 统计点数和花色
      const rankCount = {}, suitCount = {}
      const ranks = [], suits = []
      parsed.forEach(c => {
        rankCount[c.rank] = (rankCount[c.rank] || 0) + 1
        suitCount[c.suit] = (suitCount[c.suit] || 0) + 1
        ranks.push(c.rank)
        suits.push(c.suit)
      })

      const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a)
      const counts = Object.values(rankCount).sort((a, b) => b - a)

      // 检查同花
      const flushSuit = Object.entries(suitCount).find(([s, count]) => count >= 5)
      const isFlush = !!flushSuit

      // 检查顺子（包括A-2-3-4-5）
      const isStraight = this.checkStraight(uniqueRanks)

      // 皇家同花顺：A-K-Q-J-10 同花
      if (isFlush && isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(13) && uniqueRanks.includes(12) && uniqueRanks.includes(11) && uniqueRanks.includes(10)) {
        return '皇家同花顺'
      }

      // 同花顺
      if (isFlush && isStraight) return '同花顺'

      // 四条
      if (counts[0] === 4) return '四条'

      // 葫芦（三条+一对）
      if (counts[0] === 3 && counts[1] >= 2) return '葫芦'

      // 同花
      if (isFlush) return '同花'

      // 顺子
      if (isStraight) return '顺子'

      // 三条
      if (counts[0] === 3) return '三条'

      // 两对
      if (counts[0] === 2 && counts[1] === 2) return '两对'

      // 一对
      if (counts[0] === 2) return '一对'

      return '高牌'
    },

    // 检查顺子（包括A-2-3-4-5的特殊情况）
    checkStraight(uniqueRanks) {
      if (uniqueRanks.length < 5) return false

      // 常规顺子检查
      for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) return true
      }

      // A-2-3-4-5 特殊顺子（A作为1）
      if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
        return true
      }

      return false
    },

    // 沉浸式模式：切换 HUD 显示
    toggleHud() {
      this.showHud = !this.showHud
      if (this.showHud) {
        this.resetHudAutoHide()
      } else {
        this.clearHudTimer()
      }
    },

    // 重置 HUD 自动隐藏定时器（3秒后隐藏）
    resetHudAutoHide() {
      this.clearHudTimer()
      this.hudAutoHideTimer = setTimeout(() => {
        this.showHud = false
      }, 5000)
    },

    // 清除 HUD 定时器
    clearHudTimer() {
      if (this.hudAutoHideTimer) {
        clearTimeout(this.hudAutoHideTimer)
        this.hudAutoHideTimer = null
      }
    },

    // 返回大厅（orientation-blocker和异常退出时使用）
    goLobby() {
      uni.reLaunch({ url: '/pages/lobby/lobby' })
    },

    prepareRoomInLandscape(attempt = 0) {
      // 横屏和全屏由 manifest.json 配置，运行时无需设置
      const sys = uni.getSystemInfoSync()
      if (sys.windowWidth > sys.windowHeight) {
        this.canvasW = sys.windowWidth
        this.canvasH = sys.windowHeight
        this.isLandscapeReady = true
        this.initRoom()
        return
      }
      if (attempt >= 15) {
        // 横屏检测超时（H5端方向检测可能不可靠），仍加载房间数据
        this.canvasW = sys.windowWidth
        this.canvasH = sys.windowHeight
        this.isLandscapeReady = true
        this.initRoom()
        return
      }
      this.orientationRetryTimer = setTimeout(() => this.prepareRoomInLandscape(attempt + 1), 100)
    },

    // ---------- Socket 全局监听 handler（方法引用，便于 onUnload 清理） ----------
    onSocketDisconnect() {
      console.warn('[Room] Socket断开，将自动重连')
      uni.showToast({ title: '网络断开，正在重连...', icon: 'none', duration: 2000 })
    },
    onSocketReconnect() {
      const roomSocket = getRoomSocket()
      if (this.roomId) {
        roomSocket.joinRoom(this.roomId)
        this.syncHandSnapshot()
        this.lastTurnUserId = null // 重置操作玩家追踪，确保重连后倒计时正常触发
        this.loadHand() // 重连后重新加载完整房间状态（玩家列表/房间信息）
        uni.showToast({ title: '已重新连接', icon: 'success', duration: 1500 })
      }
    },

    // ---------- renderjs 通讯 ----------
    // 发送命令给 renderjs（通过 props change 事件触发）+ 同步音效
    sendCmd(type, data) {
      this.renderCmd = { type, data, epoch: this.animationEpoch, ts: Date.now() }
      // 同步播放对应音效
      if (this.soundManager && this.soundEnabled) {
        try {
          switch (type) {
            case 'dealCards':
            case 'dealCommunityCards':
              this.soundManager.playDeal()
              break
            case 'flipCard':
            case 'flipSeatCards':
              this.soundManager.playOpenCard()
              break
            case 'spawnFlyingChips':
              this.soundManager.playChip()
              break
            case 'victoryBurst':
              this.soundManager.playWin()
              break
          }
        } catch (e) { /* 音效播放失败静默处理 */ }
      }
    },
    cancelTableAnimations() {
      this.animationEpoch += 1
      this.sendCmd('cancelAnimations')
    },
    // renderjs 回调（由 renderjs 通过 $owner.callMethod 触发）
    onRenderEvent(info) {
      if (info && info.type === 'animationComplete') {
        // 动画完成，可触发后续业务逻辑
      }
    },

    // renderjs 回调：触发触觉反馈（纯uni-app实现）
    triggerHaptic(style) {
      try {
        const typeMap = {
          light: 'light', deal: 'light', flip: 'light', selection: 'light',
          medium: 'medium', chip: 'medium', warning: 'medium', success: 'medium',
          heavy: 'heavy', victory: 'heavy', error: 'heavy',
        }
        uni.vibrateShort({ type: typeMap[style] || 'light' })
      } catch (e) {}
    },

    // ---------- 语音播放（方言语音包） ----------
    // 根据玩家实际头像获取语音包ID（头像与语音包一一对应）
    getAvatarIdBySeatIndex(seatIndex) {
      const idx = seatIndex !== undefined ? seatIndex : this.mySeatIndex
      const seat = this.seats[idx]
      if (seat?.player?.avatar) {
        const av = String(seat.player.avatar)
        // 支持 "1"、"vip-1"、数字等格式
        if (av.startsWith('vip-')) return av
        const num = parseInt(av, 10)
        if (!isNaN(num) && num >= 1 && num <= 5) return `vip-${num}`
      }
      // 回退：按座位索引
      return `vip-${(idx % 5) + 1}`
    },

    // 播放玩家语音
    playVoice(action, seatIndex) {
      if (!this.voiceManager || !this.voiceEnabled) return
      const avatarId = this.getAvatarIdBySeatIndex(seatIndex)
      this.voiceManager.play(avatarId, action, { interrupt: true })
    },

    // 切换音效开关
    toggleSound() {
      this.soundEnabled = !this.soundEnabled
      if (this.soundManager) {
        this.soundManager.setEnabled(this.soundEnabled)
      }
      this.saveSettings()
    },

    // 切换语音开关
    toggleVoice() {
      this.voiceEnabled = !this.voiceEnabled
      if (this.voiceManager) {
        this.voiceManager.setEnabled(this.voiceEnabled)
      }
      this.saveSettings()
    },

    // 切换震动开关
    toggleVibrate() {
      this.vibrateEnabled = !this.vibrateEnabled
      if (this.soundManager) {
        this.soundManager.setVibrateEnabled(this.vibrateEnabled)
      }
      this.saveSettings()
    },

    // 切换自动看牌
    toggleAutoLook() {
      this.autoLook = !this.autoLook
      this.saveSettings()
    },

    // 保存设置到本地存储
    saveSettings() {
      saveAppSettings({
        soundEnabled: this.soundEnabled,
        voiceEnabled: this.voiceEnabled,
        vibrationEnabled: this.vibrateEnabled,
        autoLook: this.autoLook,
      })
    },

    // 初始化房间
    async initRoom() {
      try {
        this.roomInfo = await getRoom(this.roomId)
        this.soundManager = getSoundManager()
        this.soundManager.init(this.roomInfo?.gameType || 'niuniu')
        this.soundManager.setTheme(this.roomInfo?.gameType || 'niuniu')

        // 初始化语音管理器（方言语音包）
        this.voiceManager = getVoiceManager()
        this.voiceManager.init()

        try {
          const settings = uni.getStorageSync('vpoker_settings')
          if (settings) {
            const s = JSON.parse(settings)
            this.soundEnabled = s.soundEnabled !== false
            this.voiceEnabled = s.voiceEnabled !== false
            this.vibrateEnabled = s.vibrationEnabled !== false
            this.soundManager.setEnabled(this.soundEnabled)
            this.voiceManager.setEnabled(this.voiceEnabled)
            this.soundManager.setVibrateEnabled(this.vibrateEnabled)
            if (s.musicEnabled) {
              this.soundManager.setBackgroundVolume((s.musicVolume || 50) / 100)
              this.soundManager.playBackground()
            }
          }
        } catch (e) {
          console.warn('[Room] 读取设置失败', e)
        }

        this.loadHierarchy()
        await this.loadHand()
        fetchUserInfo()
        await this.initSocket()
      } catch (e) {
        console.error('[Room] 初始化失败', e)
        uni.showToast({ title: '加载房间失败', icon: 'none' })
      }
    },

    async hostStartGame() {
      try {
        await this.loadHand(true)
        if (this.playablePlayerCount < 2) {
          const missing = 2 - this.playablePlayerCount
          uni.showToast({ title: `还需 ${missing} 名已上分玩家才能开始`, icon: 'none' })
          return
        }
        if (this.unreadyPlayablePlayers.length) {
          const names = this.unreadyPlayablePlayers
            .slice(0, 2)
            .map(player => player.nickname || player.account)
            .join('、')
          uni.showToast({ title: `${names} 尚未准备`, icon: 'none' })
          return
        }
        await startHand(this.roomId)
        await this.loadHand()
        uni.showToast({ title: '游戏已开始', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '开始失败', icon: 'none' })
      }
    },
    async toggleReady() {
      try {
        const nextReady = !this.amIReady
        if (this.roomStatus === 'waiting_continue') {
          await readyNext(this.roomId)
        } else {
          await readyRoom(this.roomId, nextReady)
        }
        await this.loadHand()
        uni.showToast({ title: nextReady ? '已准备' : '已取消准备', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '操作失败', icon: 'none' })
      }
    },
    async runHostAction(action) {
      try {
        if (action === 'continue') await continueRoom(this.roomId)
        if (action === 'pause') await pauseRoom(this.roomId)
        if (action === 'resume') await resumeRoom(this.roomId)
        await this.loadHand()
        uni.showToast({ title: '房间状态已更新', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '操作失败', icon: 'none' })
      }
    },

    confirmEarlySettle() {
      uni.showModal({
        title: '提前结算',
        content: '将结束当前房间并进行结算，确认继续？',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await earlySettle(this.roomId)
            await this.loadHand()
            uni.showToast({ title: '已提交提前结算', icon: 'success' })
          } catch (e) {
            uni.showToast({ title: e.error || '结算失败', icon: 'none' })
          }
        }
      })
    },

    async adjustPlayerPoints(direction) {
      const amount = Number(this.adjustAmount)
      if (!this.adjustTargetId || !Number.isFinite(amount) || amount <= 0) {
        uni.showToast({ title: '请选择玩家并输入有效数量', icon: 'none' })
        return
      }
      try {
        const data = await adjustRoomPoints(this.roomId, this.adjustTargetId, direction * amount)
        if (typeof data.agentPoints === 'number') updatePoints(data.agentPoints)
        this.adjustAmount = ''
        await this.loadHand()
        uni.showToast({ title: direction > 0 ? '上分成功' : '下分成功', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e.error || '筹码调整失败', icon: 'none' })
      }
    },

    // 踢出玩家
    async confirmKickPlayer(userId) {
      if (this.kickingUserId) return
      const player = this.kickablePlayers.find(p => p.id === userId)
      const name = player?.nickname || player?.account || '该玩家'
      uni.showModal({
        title: '确认踢出',
        content: `确定要将「${name}」踢出房间吗？`,
        confirmColor: 'var(--color-danger)',
        success: async (res) => {
          if (!res.confirm) return
          this.kickingUserId = userId
          try {
            await kickPlayer(this.roomId, userId)
            uni.showToast({ title: '已踢出玩家', icon: 'success' })
            this.showKickModal = false
            await this.loadHand()
          } catch (e) {
            uni.showToast({ title: e.error || '踢出失败', icon: 'none' })
          } finally {
            this.kickingUserId = null
          }
        }
      })
    },

    // 打开游戏记录
    async openGameHistory() {
      this.showGameHistoryModal = true
      this.gameHistoryList = []
      await this.loadGameHistory()
    },

    // 加载游戏记录（每局详情）
    async loadGameHistory() {
      this.gameHistoryLoading = true
      try {
        const roomNo = this.roomInfo?.room?.roomNo || this.roomInfo?.roomNo || this.roomInfo?.room_no
        if (!roomNo) throw new Error('房间号不可用')
        const res = await getMyRoomRounds(roomNo, { page: 1, pageSize: 100 })
        const rounds = Array.isArray(res?.data) ? res.data : (res?.rounds || res?.data?.rounds || [])
        this.gameHistoryList = (Array.isArray(rounds) ? rounds : []).map(r => {
          return {
            roundNo: r.roundNo,
            gameType: r.gameType || this.roomInfo?.gameType,
            winnerUserId: r.winnerUserId || null,
            winnerNickname: r.winnerNickname || (r.won ? '本局获胜' : '其他玩家获胜'),
            handName: r.handName || '—',
            delta: Number(r.delta || 0),
            pot: Number(r.potBeforeRake || 0),
            rake: Number(r.rake || 0),
            turnover: Number(r.turnover || 0),
            createdAt: r.createdAt,
          }
        })
      } catch (e) {
        console.error('[Room] 加载游戏记录失败', e)
        this.gameHistoryList = []
      } finally {
        this.gameHistoryLoading = false
      }
    },

    // 初始化Socket
    async initSocket() {
      try {
        await connectSocket()
        const socket = getSocket()
        const roomSocket = getRoomSocket()

        roomSocket.joinRoom(this.roomId, () => {
          // 加入房间确认
        })

        roomSocket.onRoomUpdate((data) => {
          if (data) {
            this.roomInfo = { ...this.roomInfo, ...data }
          }
        })

        roomSocket.onHandUpdate((data) => {
          this.handleHandUpdate(data)
        })

        roomSocket.onChatMessage((data) => {
          if (data && data.senderId !== userState.id) {
            const senderName = data.senderName || '玩家'
            const content = data.content || data.message || ''
            this.chatMessages.push({
              senderName,
              content,
              isSelf: false,
              type: data.type || 'chat'
            })
            // 添加弹幕
            this.addDanmaku(senderName, content)
          }
        })

        roomSocket.onActionRequired((data) => {
          if (data && data.playerId) {
            // 无论轮到谁，都显示倒计时（观众也能看到）
            this.countdown = data.countdown || 15
            this.startCountdown()
            if (data.playerId === userState.id) {
              this.isMyTurn = true
              // 拉取最新可用操作列表（options 由后端 hand 接口返回）
              this.loadHand()
            } else {
            // 轮到其他玩家操作，播放该玩家的等待语音
            const seatIndex = (this.handData?.seats || []).findIndex(
              s => s.userId === data.playerId
            )
            if (seatIndex >= 0) {
              // 延迟播放，避免与发牌等音效冲突
              setTimeout(() => {
                this.playVoice('wait', seatIndex)
              }, 800)
            }
            }
          }
        })

        roomSocket.onHandFinished((data) => {
          if (data) {
            this.showSettlement = true
            const resultData = data.hand?.result || data.result || data.results || {}
            // 后端result是对象，玩家结算数组在result.hands中
            const rawResults = Array.isArray(resultData.hands) ? resultData.hands : (Array.isArray(resultData) ? resultData : [])
            // 从seats中获取玩家名字，补充到结算结果中
            const seats = data.hand?.seats || this.handData?.seats || []
            this.settlementResults = rawResults.map(r => {
              const seat = seats.find(s => s.userId === r.userId)
              return {
                ...r,
                name: r.name || r.account || (seat ? seat.account : '玩家'),
                amount: typeof r.delta === 'number' ? r.delta : (typeof r.amount === 'number' ? r.amount : (r.netAmount || r.winAmount || 0)),
                isWinner: resultData.winnerUserId === r.userId || r.won === true
              }
            })
            // 累加到25局累计输赢
            this.accumulateRoundResults(this.settlementResults)
            this.triggerOpenCardEffect()
            this.triggerBulletTime()

            // 比牌面板触发（炸金花/三公比牌结果）
            const compareData = data.compareResult || data.compare || data.hand?.compareResult
            if (compareData && compareData.challenger && compareData.defender) {
              this.triggerCompare(
                compareData.challenger,
                compareData.defender,
                compareData.challengerCards || [],
                compareData.defenderCards || [],
                compareData.winnerUserId || compareData.winnerId,
                compareData.winAmount || 0
              )
            }

            // 胜利粒子：标记赢家座位并触发粒子
            if (this.settlementResults.length > 0) {
              this.settlementResults.forEach(r => {
                const winnerSeat = (this.handData?.seats || []).findIndex(s =>
                  s.userId === r.userId || s.userId === r.winnerUserId
                )
                if (winnerSeat >= 0) {
                  this.sendCmd('victoryBurst', winnerSeat)
                }
              })
            }
            if (this.soundManager) this.soundManager.playWin()
          }
        })

        roomSocket.onPlayerJoin((data) => {
          if (data && data.seatIndex !== undefined && this.seats[data.seatIndex]) {
            this.seats[data.seatIndex].player = data.player || null
            this.seats[data.seatIndex].isActive = true
            // 播放入场语音（延迟一点，避免与其他音效冲突）
            setTimeout(() => {
              this.playVoice('enter', data.seatIndex)
            }, 500)
          }
        })

        roomSocket.onPlayerLeave((data) => {
          if (data && data.seatIndex !== undefined && this.seats[data.seatIndex]) {
            this.seats[data.seatIndex].player = null
            this.seats[data.seatIndex].isActive = false
          }
        })

        roomSocket.onStateChanged((data) => {
          if (data && data.roomId) {
        // 防抖：200ms内多次状态变更合并为一次loadHand，避免频繁请求
        if (this.loadHandDebounceTimer) clearTimeout(this.loadHandDebounceTimer)
        this.loadHandDebounceTimer = setTimeout(() => { this.loadHand(true) }, 200)
          }
        })

        roomSocket.onGameStarting((data) => {
          if (data && data.countdown !== undefined) {
            this.countdown = data.countdown
          }
        })

        roomSocket.onError((data) => {
          const msg = data?.message || data?.error || '游戏异常'
          uni.showToast({ title: msg, icon: 'none' })
        })

        socket.on('disconnect', this.onSocketDisconnect)
        socket.on('reconnect', this.onSocketReconnect)
      } catch (e) {
        console.error('[Room] Socket初始化失败', e)
      }
    },

    // 加载牌局状态
    async loadHand(forceRoomRefresh = false) {
      try {
        // 同步刷新房间信息（currentRound/status/totalRounds 可能已变化）
        try {
        // 房间信息缓存：5秒内不重复拉取，减少API请求
        const now = Date.now()
        if (!forceRoomRefresh && this.roomInfoCache && now - this.roomInfoCacheTime < 5000) {
          this.roomInfo = { ...this.roomInfo, ...this.roomInfoCache }
        } else {
          const room = await getRoom(this.roomId)
          if (room) { this.roomInfo = { ...this.roomInfo, ...room }; this.roomInfoCache = room; this.roomInfoCacheTime = now }
        }
        } catch (e) { /* 房间信息刷新失败不影响牌局加载 */ }

        const resp = await getRoomHand(this.roomId)
        // 后端返回 { hand: {...}, options: [...] }
        this.applyAuthoritativeHand(resp, resp.sequence)
        if (!resp?.hand || resp.hand.finished || this.isWaitingState) {
          this.syncWaitingRoomPlayers()
        }
        // 保存代理层级链（总结算抽水分配用）
        if (resp.hierarchy) this.hierarchy = resp.hierarchy

        // 25局结束且非房主：显示等待续开
        if (this.roomStatus === 'waiting_continue' && !this.isHost && !this.showSettlement) {
          this.showWaitingContinue = true
        } else if (this.roomStatus !== 'waiting_continue') {
          this.showWaitingContinue = false
        }
      } catch (e) {
        console.error('[Room] 加载牌局失败', e)
      }
    },

    // 等待开局时服务端没有 hand.seats，成员要从 room.players 同步到牌桌。
    syncWaitingRoomPlayers() {
      const room = this.roomInfo?.room || this.roomInfo || {}
      const players = this.roomInfo?.players || room.players || []
      const activePlayers = players.filter(player => !player.isSpectator && player.userId)
      const nextSeats = this.seats.map(() => ({
        player: null,
        isActive: false,
        isMe: false,
        cards: [],
        isFolded: false,
        isWinner: false,
        isDealer: false,
        autoPlay: false,
      }))

      activePlayers.forEach((player, fallbackIndex) => {
        const seatIndex = Number.isInteger(Number(player.seat)) && Number(player.seat) > 0
          ? Number(player.seat) - 1
          : fallbackIndex
        if (!nextSeats[seatIndex]) return
        nextSeats[seatIndex] = {
          ...nextSeats[seatIndex],
          player: {
            id: player.userId,
            account: player.account,
            nickname: player.nickname || player.account,
            points: Number(player.points) || 0,
            avatar: player.avatar || '1',
            ready: !!player.ready,
          },
          isActive: true,
          isMe: String(player.userId) === String(userState.id),
          autoPlay: !!player.autoPlay,
        }
        if (String(player.userId) === String(userState.id)) this.mySeatIndex = seatIndex
      })
      this.seats = nextSeats
    },

    applyAuthoritativeHand(payload, sequence) {
      const hand = payload?.hand || payload
      if (!hand) return
      this.handData = hand
      this.availableOptions = payload?.options || []
      const nextSequence = Number(sequence ?? payload?.sequence ?? hand.sequence)
      if (Number.isFinite(nextSequence) && nextSequence > this.handSequence) {
        this.handSequence = nextSequence
      }
      this.updateHandState(hand, payload?.clientActionId)
    },

    async handleHandUpdate(payload) {
      const sequence = Number(payload?.sequence)
      if (!Number.isFinite(sequence)) {
        this.applyAuthoritativeHand(payload)
        return
      }
      if (sequence <= this.handSequence) return
      if (this.handSequence && sequence > this.handSequence + 1) {
        await this.syncHandSnapshot()
        return
      }
      const eventPayload = payload.data
        ? { ...payload.data, clientActionId: payload.clientActionId }
        : payload
      this.applyAuthoritativeHand(eventPayload, sequence)
    },

    async syncHandSnapshot() {
      if (this.snapshotSyncing || !this.roomId) return
      this.snapshotSyncing = true
      try {
        const snapshot = await getRoomHandSnapshot(this.roomId, this.handSequence || undefined)
        const events = snapshot?.events || snapshot?.updates
        if (Array.isArray(events)) {
          for (const event of events) {
            await this.handleHandUpdate(event)
          }
        } else {
          this.applyAuthoritativeHand(snapshot, snapshot?.sequence)
        }
      } catch (e) {
        console.warn('[Room] 同步牌局快照失败', e)
      } finally {
        this.snapshotSyncing = false
      }
    },

    // 更新牌局状态
    updateHandState(data, clientActionId) {
      if (!data) return
      data = data.hand || data

      // 保存上次座位状态快照（用于检测其他玩家操作变化）
      const prevSeats = this.lastHandState ? (this.lastHandState.seats || []) : []
      this.currentPot = data.pot || 0
      this.communityCards = data.community || data.communityCards || []

      const startsNewDeal = (data.phase === 'dealing' || data.phase === 'waiting') && data.phase !== this.lastHandPhase
      if (startsNewDeal) {
        this.cardsDealt = false
        this.lastCommunityCount = 0
        this.stopCanvasLoop()
    this.cancelTableAnimations()
      }

      // 公共牌发牌动画（德州 flop/turn/river 逐张出现）
      const newCount = this.communityCards.length
      if (newCount > this.lastCommunityCount) {
        const newCards = this.communityCards.slice(this.lastCommunityCount).map((card, i) => {
          const parsed = this._parseCard(card)
          return { suit: parsed.suit, rank: parsed.rank, faceUp: true, index: this.lastCommunityCount + i }
        })
        if (newCards.length > 0) {
          this.sendCmd('dealCommunityCards', { cards: newCards })
        }
      }
      this.lastCommunityCount = newCount

      const mySeatData = (data.seats || []).find(s => s.userId === userState.id)
      if (mySeatData) {
        this.myCards = mySeatData.cards || []
        this.hasLooked = mySeatData.looked || false
        const myIdx = (data.seats || []).findIndex(s => s.userId === userState.id)
        if (myIdx >= 0) this.mySeatIndex = myIdx
      }

      this.showAllCards = data.phase === 'showdown' || data.phase === 'settled' || data.finished === true
      this.isMyTurn = data.turnUserId === userState.id || data.currentPlayerId === userState.id
        // 检测操作玩家变化，启动倒计时（后端超时30秒，前端同步显示）
        const newTurnUserId = data.turnUserId || data.currentPlayerId || null
        if (newTurnUserId && newTurnUserId !== this.lastTurnUserId && !data.finished && data.phase !== 'showdown' && data.phase !== 'settled') {
          this.countdown = 30
          this.lastTurnUserId = newTurnUserId
          this.startCountdown()
        } else if (!newTurnUserId || data.finished) {
          this.lastTurnUserId = newTurnUserId
          if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null }
          this.countdown = 0
        }

      // 触发发牌动画到 Canvas
      if ((this.myCards.length > 0 || (data.seats && data.seats.some(s => (s.cards && s.cards.length > 0) || (s.cardCount && s.cardCount > 0)))) && !this.cardsDealt) {
        this.triggerDealAnimation(data)
      }

      // 更新座位
      if (data.seats) {
        const playerList = (this.roomInfo?.room?.players || this.roomInfo?.players || [])
        const avatarMap = new Map(playerList.map(p => [p.userId, p.avatar]))
        data.seats.forEach((seat, index) => {
          if (this.seats[index]) {
            this.seats[index].player = seat.userId ? {
              id: seat.userId,
              account: seat.account,
              nickname: seat.account,
              points: seat.points || 0,
              avatar: avatarMap.get(seat.userId) || '1'
            } : null
            this.seats[index].isActive = !!seat.userId && !seat.folded
            this.seats[index].cards = seat.cards || []
            this.seats[index].isFolded = seat.folded || false
            this.seats[index].isWinner = false
            this.seats[index].isDealer = data.dealerUserId === seat.userId
            this.seats[index].autoPlay = !!seat.autoPlay
            this.seats[index].isMe = seat.userId === userState.id
          }
        })

        // 检测其他玩家操作变化并播放语音
        this.detectPlayerActions(prevSeats, data.seats)
      }

      // 结算状态
      if ((data.finished === true || data.phase === 'showdown' || data.phase === 'settled') && data.result) {
        this.showSettlement = true
        // 后端result是对象，玩家结算数组在result.hands中（与onHandFinished保持一致）
        const rawResults = Array.isArray(data.result.hands) ? data.result.hands : (Array.isArray(data.result) ? data.result : [])
        this.settlementResults = rawResults.map(r => {
          const seat = (data.seats || []).find(s => s.userId === r.userId)
          return {
            ...r,
            name: r.name || r.account || (seat ? seat.account : '玩家'),
            amount: typeof r.delta === 'number' ? r.delta : (typeof r.amount === 'number' ? r.amount : (r.netAmount || r.winAmount || 0)),
            isWinner: data.result.winnerUserId === r.userId || r.won === true
          }
        })
        // 累加到25局累计输赢
        this.accumulateRoundResults(this.settlementResults)
        if (this.settlementResults.length > 0) {
          this.settlementResults.forEach(r => {
            const winnerSeat = (data.seats || []).findIndex(s =>
              s.userId === r.userId || s.userId === r.winnerUserId
            )
            if (winnerSeat >= 0 && this.seats[winnerSeat]) {
              this.seats[winnerSeat].isWinner = true
            }
          })
        }
        this.triggerOpenCardEffect()
        this.triggerBulletTime()
        if (this.soundManager) {
          this.soundManager.playWin()
        }
        // 结算语音：播放赢家语音，若我是输家则播放失败语音
        if (this.settlementResults.length > 0) {
          const winnerSeat = (data.seats || []).findIndex(s =>
            s.userId === this.settlementResults[0].userId ||
            s.userId === this.settlementResults[0].winnerUserId
          )
          if (winnerSeat >= 0) {
            // 延迟播放，等开牌动画后
            setTimeout(() => {
              this.playVoice('win', winnerSeat)
            }, 800)
            // 如果我不是赢家，播放我的失败语音
            if (winnerSeat !== this.mySeatIndex) {
              setTimeout(() => {
                this.playVoice('lose', this.mySeatIndex)
              }, 2000)
            }
          }
        }
      }

      if (this.countdown > 0) {
        this.startCountdown()
      }

      this.reconcilePendingAction(data, clientActionId)

      // 保存当前状态为下次比较的基准
      this.lastHandState = data
      this.lastHandPhase = data.phase || ''
    },

    // 检测其他玩家操作变化并播放语音
    detectPlayerActions(prevSeats, currentSeats) {
      if (!this.voiceEnabled || !this.voiceManager) return
      if (!prevSeats || prevSeats.length === 0) return

      currentSeats.forEach((seat, index) => {
        // 跳过我自己的座位（已在 handleAction 中处理）
        if (seat.userId === userState.id) return
        if (!seat.userId) return

        const prevSeat = prevSeats[index]
        if (!prevSeat) return

        // 检测弃牌：folded 从 false 变为 true
        if (!prevSeat.folded && seat.folded) {
          setTimeout(() => {
            this.playVoice('fold', index)
          }, 300)
          return
        }

        // 检测看牌：looked 从 false 变为 true
        if (!prevSeat.looked && seat.looked) {
          setTimeout(() => {
            this.playVoice('look', index)
          }, 300)
          return
        }

        // 检测下注：points 减少（且不是弃牌）
        const prevPoints = prevSeat.points || 0
        const currPoints = seat.points || 0
        if (!seat.folded && currPoints < prevPoints) {
          const betAmount = prevPoints - currPoints
          // 大额下注可能是加注或全押，小额是跟注
          // 这里简化处理：根据下注比例判断
          const isAllIn = currPoints <= 0 || seat.allIn
          if (isAllIn) {
            setTimeout(() => {
              this.playVoice('allin', index)
            }, 300)
          } else if (betAmount > (prevPoints * 0.3)) {
            // 下注超过30%筹码，认为是加注
            setTimeout(() => {
              this.playVoice('raise', index)
            }, 300)
          } else {
            // 小额下注，认为是跟注
            setTimeout(() => {
              this.playVoice('call', index)
            }, 300)
          }
        }
      })
    },

    // 触发发牌动画（调用 renderjs）
    triggerDealAnimation(handData) {
      this.cardsDealt = true
      if (this.soundManager) {
        this.soundManager.playDeal()
      }
      // 发牌语音
      this.playVoice('deal')

      // 收集所有玩家的手牌，发送给 renderjs 绘制
      const allCards = []
      const seats = handData?.seats || this.handData?.seats || []
      seats.forEach((seat, seatIndex) => {
        // 有明确牌面数据
        if (seat.cards && seat.cards.length > 0) {
          seat.cards.forEach((card, handIndex) => {
            const parsed = this._parseCard(card)
            allCards.push({
              seatIndex,
              handIndex,
              suit: parsed.suit,
              rank: parsed.rank,
              faceUp: this.showAllCards || seat.looked || seatIndex === this.mySeatIndex
            })
          })
        }
        // 观众模式：cards为null但有cardCount，渲染牌背面
        else if (seat.cardCount && seat.cardCount > 0) {
          for (let handIndex = 0; handIndex < seat.cardCount; handIndex++) {
            allCards.push({
              seatIndex,
              handIndex,
              suit: 'spade',
              rank: 'A',
              faceUp: false
            })
          }
        }
      })

      if (allCards.length > 0) {
        // #ifdef H5
        // H5端：直接在逻辑层渲染卡牌（renderjs在H5端不工作）
        this.initCanvas()
        this.canvasCards = []
        allCards.forEach((card, i) => {
          const pos = this.getSeatCanvasPos(card.seatIndex)
          const offsetX = (card.handIndex - 1) * 35
          this.canvasCards.push({
            id: 'card_' + card.seatIndex + '_' + card.handIndex + '_' + Date.now() + '_' + i,
            suit: card.suit,
            rank: card.rank,
            faceUp: card.faceUp,
            x: pos.x + offsetX,
            y: pos.y,
            rotation: 0,
            scale: card.seatIndex === 6 ? 1.1 : 0.85
          })
        })
        // 卡牌更新后立即重绘（优化：不再使用持续渲染循环）
        this.$nextTick(() => {
          this.renderCanvasCards()
        })
        // #endif
      }

      // 自动看牌
      if (this.autoLook && this.myCards.length > 0) {
        setTimeout(() => {
          this.hasLooked = true
        }, 600)
      }
    },

    // 解析牌面字符串
    _parseCard(cardStr) {
      if (!cardStr) return { suit: 'spade', rank: 'A' }
      // 大小王识别：后端 cardLabel 返回 "🃏黑"(小王 rank=15) / "🃏红"(大王 rank=16)
      if (cardStr.includes('🃏黑')) return { suit: 'joker', rank: 'BLACK' }
      if (cardStr.includes('🃏红')) return { suit: 'joker', rank: 'RED' }
      const suitMap = { s: 'spade', h: 'heart', d: 'diamond', c: 'club' }
      const suitChar = cardStr.slice(-1).toLowerCase()
      const rank = cardStr.slice(0, -1)
      return {
        suit: suitMap[suitChar] || 'spade',
        rank: rank || 'A'
      }
    },

    // 启动倒计时
    startCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer)
      this.countdownTimer = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--
          // 倒计时剩余5秒时，播放催促语音 + 震动反馈
          if (this.countdown === 5 && this.isMyTurn) {
            this.playVoice('wait', this.mySeatIndex)
            try { if (uni.vibrateShort) uni.vibrateShort() } catch(e) {}
          }
          // 最后3秒加强震动
          if (this.countdown <= 3 && this.isMyTurn) {
            try { if (uni.vibrateLong) uni.vibrateLong() } catch(e) {}
          }
        } else {
          clearInterval(this.countdownTimer)
        }
      }, 1000)
    },

    createClientActionId() {
      return `act_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    },

    beginPendingAction(action, clientActionId, expectedVersion) {
      this.pendingAction = { action, clientActionId, expectedVersion, startedAt: Date.now(), slow: false }
      if (this.slowActionTimer) clearTimeout(this.slowActionTimer)
      this.slowActionTimer = setTimeout(() => {
        if (this.pendingAction?.action === action) this.pendingAction.slow = true
      }, 500)
    },

    finishPendingAction() {
      if (!this.pendingAction) return
      this.actionLatencyMs = Date.now() - this.pendingAction.startedAt
      this.pendingAction = null
      if (this.slowActionTimer) {
        clearTimeout(this.slowActionTimer)
        this.slowActionTimer = null
      }
    },

    reconcilePendingAction(data, clientActionId) {
      const pending = this.pendingAction
      if (!pending) return
      if (clientActionId && clientActionId !== pending.clientActionId) return
      const mySeat = (data.seats || []).find(seat => seat.userId === userState.id)
      const turnPassed = data.turnUserId !== userState.id && data.currentPlayerId !== userState.id
      const confirmed = (pending.action === 'fold' && mySeat?.folded) ||
        (pending.action === 'look' && mySeat?.looked) ||
        (['call', 'raise', 'allin', 'compare', 'bet', 'blind'].includes(pending.action) && turnPassed)
      if (confirmed) this.finishPendingAction()
    },

    applyOptimisticAction(action) {
      const seat = this.seats[this.mySeatIndex]
      const snapshot = {
        isFolded: seat?.isFolded,
        isActive: seat?.isActive,
        hasLooked: this.hasLooked,
      }

      if (action === 'fold' && seat) {
        seat.isFolded = true
        seat.isActive = false
      }
      if (action === 'look') {
        this.hasLooked = true
      }
      return snapshot
    },

    restoreOptimisticAction(snapshot) {
      if (!snapshot) return
      const seat = this.seats[this.mySeatIndex]
      if (seat) {
        seat.isFolded = snapshot.isFolded
        seat.isActive = snapshot.isActive
      }
      this.hasLooked = snapshot.hasLooked
    },

    // 关键操作二次确认弹窗
    confirmCriticalAction(action) {
      return new Promise((resolve) => {
        const isAllin = action === 'allin'
        uni.showModal({
          title: isAllin ? '确认全押' : '确认弃牌',
          content: isAllin ? '全押将投入所有剩余筹码，确定继续吗？' : '弃牌将放弃本局，确定继续吗？',
          confirmText: '确定',
          cancelText: '取消',
          success: (res) => { resolve(res.confirm) },
          fail: () => { resolve(false) }
        })
      })
    },

    // 处理操作（DynamicActions emit: action, amount）
    async handleAction(action, amount) {
      if (this.isActing) return

      // 炸金花比牌：需要选择目标玩家
      if (action === 'compare') {
        const targetUserId = await this.selectCompareTarget()
        if (targetUserId === null) return // 用户取消
        amount = targetUserId
      }
      // 关键操作二次确认：仅德州全押 + 所有游戏弃牌
      const gameType = this.roomInfo?.gameType || this.roomInfo?.room?.gameType || ''
      const isTexas = gameType === 'texas'
      if ((action === 'allin' && isTexas) || action === 'fold') {
        const confirmed = await this.confirmCriticalAction(action)
        if (!confirmed) return
      }

      this.isActing = true
      const optimisticSnapshot = this.applyOptimisticAction(action)
      const clientActionId = this.createClientActionId()
      const expectedVersion = Number(this.handData?.version)
      this.beginPendingAction(action, clientActionId, expectedVersion)

      try {
        // 掷骰子：先播放动画
        if (action === 'roll') {
          this.startDiceAnimation()
        }

        const actionData = {
          clientActionId,
          ...(Number.isFinite(expectedVersion) ? { expectedVersion } : {}),
          ...(amount !== undefined ? { amount } : {})
        }

        // 下注类操作触发 Canvas 飞行筹码
        if (['call', 'raise', 'allin', 'compare', 'bet', 'blind'].includes(action)) {
          this.sendCmd('spawnFlyingChips', {
            fromSeat: this.mySeatIndex,
            chipCount: action === 'allin' ? 8 : 5
          })
        }

        // 操作音效 + 语音
        if (this.soundManager) {
          if (action === 'look') {
            this.soundManager.playLookCard()
            // 看牌时翻牌动画
            this.sendCmd('flipSeatCards', this.mySeatIndex)
            this.playVoice('look')
          } else if (action === 'blind') {
            this.playVoice('blind')
          } else if (action === 'fold') {
            this.soundManager.playFold()
            this.playVoice('fold')
          } else if (action === 'call') {
            this.playVoice('call')
          } else if (action === 'raise') {
            this.playVoice('raise')
          } else if (action === 'allin') {
            this.playVoice('allin')
          } else if (action === 'compare') {
            this.playVoice('compare')
          } else if (!['bet'].includes(action)) {
            this.soundManager.playChip()
          }
        }

        // 游戏操作统一走 REST（后端 Socket 仅广播状态，不接收 game_action）
        const resp = await performAction(this.roomId, action, actionData)
        if (resp) {
          this.applyAuthoritativeHand(resp, resp.sequence)

          // 掷骰子：从响应中获取我的点数，结束动画
          if (action === 'roll') {
            const mySeat = (this.handData?.seats || []).find(s => s.userId === userState.id)
            const val = mySeat?.diceRoll ?? null
            this.finishDiceAnimation(val)
          }
        }
        this.finishPendingAction()
        this.isMyTurn = false
      } catch (e) {
        console.error('[Room] 操作失败', e)
        const conflictSnapshot = e.statusCode === 409 ? e.data : null
        if (conflictSnapshot?.hand) {
          this.applyAuthoritativeHand(conflictSnapshot, conflictSnapshot.sequence)
          this.finishPendingAction()
        }
        // Socket 已确认时，REST 响应丢失不应回滚已生效的操作。
        if (this.pendingAction) this.restoreOptimisticAction(optimisticSnapshot)
        this.finishPendingAction()
        uni.showToast({ title: e.error || '操作失败', icon: 'none' })
        // 掷骰子失败时关闭动画
        if (action === 'roll') {
          if (this._diceTimer) { clearInterval(this._diceTimer); this._diceTimer = null }
    if (this._compareTimer) {
      clearInterval(this._compareTimer)
      this._compareTimer = null
    }
          this.showDiceRoll = false
          this.diceRolling = false
        }
      } finally {
        this.isActing = false
      }
    },

    // ---------- 掷骰子动画 ----------
    startDiceAnimation() {
      this.showDiceRoll = true
      this.diceRolling = true
      this.diceValue = null
      this.diceDisplay = '?'
      // 快速切换数字模拟滚动
      this._diceTimer = setInterval(() => {
        this.diceDisplay = String(Math.floor(Math.random() * 6) + 1)
      }, 80)
    },
    finishDiceAnimation(value) {
      if (this._diceTimer) {
        clearInterval(this._diceTimer)
        this._diceTimer = null
      }
      this.diceRolling = false
      this.diceValue = value
      this.diceDisplay = value != null ? String(value) : '?'
      // 显示结果1秒后关闭
      setTimeout(() => {
        this.showDiceRoll = false
        this.diceValue = null
      }, 1200)
    },

    // ---------- 炸金花比牌：选择目标玩家 ----------
    selectCompareTarget() {
      return new Promise((resolve) => {
        const opponents = (this.handData?.seats || [])
          .filter(s => s.userId && s.userId !== userState.id && !s.folded)
          .map(s => `${s.account || '玩家'}（${s.points || 0}筹码）`)
        const userIds = (this.handData?.seats || [])
          .filter(s => s.userId && s.userId !== userState.id && !s.folded)
          .map(s => s.userId)

        if (userIds.length === 0) {
          uni.showToast({ title: '无可比牌对手', icon: 'none' })
          resolve(null)
          return
        }
        if (userIds.length === 1) {
          resolve(userIds[0])
          return
        }

        uni.showActionSheet({
          itemList: opponents,
          success: (res) => {
            resolve(userIds[res.tapIndex])
          },
          fail: () => {
            resolve(null)
          }
        })
      })
    },

    // 发送聊天（统一走 REST，后端 Socket 仅广播）
    async sendChat(message, options = {}) {
      try {
        await sendRoomChat(this.roomId, message)
        const msgType = options.type || 'chat'
        this.chatMessages.push({
          senderName: userState.nickname || '我',
          content: message,
          isSelf: true,
          isOwner: this.isHost,
          type: msgType
        })
        // 添加弹幕
        this.addDanmaku(userState.nickname || '我', message)
        // 播放快捷聊天语音
        if (msgType === 'voice' && options.voiceKey) {
          this.playVoiceByKey(options.voiceKey)
        } else {
          this.playQuickChatVoice(message)
        }
      } catch (e) {
        console.error('[Room] 发送聊天失败', e)
      }
    },

    // 快捷语音事件
    onQuickVoice(item) {
      // sendChat 已经处理了发送和语音，这里可以做额外处理
    },

    // 根据快捷语音key播放对应语音包
    playVoiceByKey(voiceKey) {
      if (!this.voiceEnabled) return
      const voiceMap = {
        hurry: 'wait', wait: 'wait', luck: 'chat2', secure: 'call',
        bye: 'fold', go: 'chat2', nice: 'win', pleasure: 'chat1',
        bluff: 'raise', allin: 'allin', fold: 'fold', gg: 'chat3'
      }
      const mappedKey = voiceMap[voiceKey] || 'chat1'
      this.playVoice(mappedKey)
    },

    // 添加弹幕
    addDanmaku(sender, content) {
      if (!this.danmakuEnabled) return
      const id = ++this._danmakuId
      const top = 15 + Math.random() * 40 // 15%~55% 高度，避开底部操作区
      const duration = 6 + Math.random() * 3 // 6~9秒飘过
      this.danmakuList.push({ id, sender, content, top, duration })
      // 自动移除
      setTimeout(() => {
        this.danmakuList = this.danmakuList.filter(d => d.id !== id)
      }, duration * 1000 + 500)
    },

    // 播放快捷聊天语音（根据消息内容匹配）
    playQuickChatVoice(message) {
      if (!message || !this.voiceEnabled) return
      const msg = message.toLowerCase()
      // chat1: 打招呼
      if (/(你好|大家好|嗨|hi|hello|哈喽|早上好|晚上好)/.test(msg)) {
        this.playVoice('chat1')
        return
      }
      // chat2: 加油/祝福
      if (/(加油|好运|祝你好运|good luck|加油哦|冲|雄起)/.test(msg)) {
        this.playVoice('chat2')
        return
      }
      // chat3: 抱歉/不好意思
      if (/(抱歉|不好意思|对不起|sorry|对不住|失礼了)/.test(msg)) {
        this.playVoice('chat3')
        return
      }
    },

    // 触发子弹时间
    triggerBulletTime() {
      this.bulletTimeActive = true
      setTimeout(() => {
        this.bulletTimeActive = false
      }, 1200)
    },

    // 触发开牌高潮动画
    triggerOpenCardEffect() {
      this.openCardActive = true
      if (this.soundManager) {
        this.soundManager.playOpenCard()
      }
    },

    // 加载层级信息
    loadHierarchy() {
      if (this.roomInfo?.hierarchy) {
        this.hierarchy = { ...this.roomInfo.hierarchy }
      } else {
        this.hierarchy = {
          L0: this.roomInfo?.creatorId || null,
          L1: null,
          L2: null
        }
      }
    },

    // 累加一局玩家输赢到25局累计
    accumulateRoundResults(results) {
      if (!Array.isArray(results) || results.length === 0) return
      results.forEach(r => {
        const uid = r.userId
        if (!uid) return
        if (!this.cumulativeNetResults[uid]) {
          this.cumulativeNetResults[uid] = {
            userId: uid,
            name: r.name || r.account || '玩家',
            amount: 0,
            handName: r.handName || '—'
          }
        }
        const amt = typeof r.amount === 'number' ? r.amount : (typeof r.delta === 'number' ? r.delta : 0)
        this.cumulativeNetResults[uid].amount += amt
        if (r.name || r.account) {
          this.cumulativeNetResults[uid].name = r.name || r.account
        }
      })
    },

    // 重置25局累计（房间续开时调用）
    resetCumulativeResults() {
      this.cumulativeNetResults = {}
    },

    // 获取总结算的累计输赢结果数组（按输赢降序）
    getFinalSettlementResults() {
      return Object.values(this.cumulativeNetResults)
        .sort((a, b) => b.amount - a.amount)
        .map(r => ({
          ...r,
          isWinner: r.amount > 0
        }))
    },

    // 关闭结算
    async closeSettlement() {
      this.showSettlement = false
      // 总结算：25局结束
      if (this.isFinalRound || this.roomStatus === 'waiting_continue') {
        if (this.isHost) {
          // 房主：续开房间
          try {
            await continueRoom(this.roomId)
            this.showWaitingContinue = false
            await this.loadHand()
            this.resetCumulativeResults()
            uni.showToast({ title: '已续开，开始下一局', icon: 'success' })
          } catch (e) {
            uni.showToast({ title: e.error || '续开失败', icon: 'none' })
          }
        } else {
          // 非房主：显示等待续开
          this.showWaitingContinue = true
        }
      } else {
        await this.loadHand()
      }
    },

    // 结算页退出房间
    exitRoom() {
      this.confirmLeaveRoom()
    },

    // 关闭比牌面板
    closeComparePanel() {
      this.showComparePanel = false
      this.compareChallenger = null
      this.compareDefender = null
      this.compareChallengerCards = []
      this.compareDefenderCards = []
      this.compareChallengerHand = ''
      this.compareDefenderHand = ''
      this.compareWinnerId = null
      this.compareWinAmount = 0
      this.compareCountdown = 0
      if (this._compareTimer) {
        clearInterval(this._compareTimer)
        this._compareTimer = null
      }
    },

    // 触发比牌（炸金花/三公）
    triggerCompare(challenger, defender, challengerCards, defenderCards, winnerId, winAmount) {
      this.compareChallenger = challenger
      this.compareDefender = defender
      this.compareChallengerCards = challengerCards || []
      this.compareDefenderCards = defenderCards || []
      this.compareWinnerId = winnerId
      this.compareWinAmount = winAmount || 0
      this.compareCountdown = 3
      this.showComparePanel = true

      // 倒计时
      this._compareTimer = setInterval(() => {
        this.compareCountdown--
        if (this.compareCountdown <= 0) {
          clearInterval(this._compareTimer)
          this._compareTimer = null
        }
      }, 1000)
    },

    confirmLeaveRoom() {
      if (this.isLeavingRoom) return
      uni.showModal({
        title: '确认离开',
        content: '离开后将退出房间并退回桌上筹码，确定继续吗？',
        success: async (res) => {
          if (!res.confirm || this.isLeavingRoom) return
          this.isLeavingRoom = true
          try {
            await leaveRoom(this.roomId)
            try {
              getRoomSocket().leaveRoom(this.roomId)
            } catch (e) {}
            uni.reLaunch({ url: '/pages/lobby/lobby' })
          } catch (e) {
            uni.showToast({ title: e.error || '退出房间失败，请重试', icon: 'none' })
          } finally {
            this.isLeavingRoom = false
          }
        }
      })
    },

    // 返回
    goBack() {
      this.confirmLeaveRoom()
    }
  }
}
</script>

<style lang="scss" scoped>
.room-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* renderjs 命令传递视图（不可见，仅用于通讯） */
.render-cmd-bridge {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

/* Canvas 游戏层 */
.canvas-stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  pointer-events: none;
}

.canvas-stage canvas {
  display: block;
}

/* 子弹时间遮罩 */
.bullet-time-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, transparent 20%, rgba(0, 0, 0, 0.9) 80%);
  animation: bulletTime 1.2s ease both;
  z-index: 6;
  pointer-events: none;
}

@keyframes bulletTime {
  0% { opacity: 0; }
  25% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; }
}

/* 独立倒计时（固定显示在牌桌顶部中央） */
.fixed-countdown {
  position: fixed;
  top: calc(var(--header-height, 7vh) + 2vh);
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5vh;
  pointer-events: none;
}
.countdown-ring {
  width: 7vh;
  height: 7vh;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: 0.3vh solid var(--color-gold);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 2vh rgba(255, 215, 0, 0.4);
  backdrop-filter: blur(4px);
}
.countdown-num {
  font-size: var(--text-2xl);
  font-weight: 900;
  color: var(--color-gold);
  text-shadow: 0 0 1vh rgba(255, 215, 0, 0.6);
}
.countdown-label {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.5);
  padding: 0.2vh 1vh;
  border-radius: 0.5vh;
}
.fixed-countdown.warning .countdown-ring {
  border-color: var(--color-danger);
  box-shadow: 0 0 2vh rgba(220, 38, 38, 0.6);
  animation: countdownPulse 0.5s ease infinite alternate;
}
.fixed-countdown.warning .countdown-num {
  color: var(--color-danger);
  text-shadow: 0 0 1vh rgba(220, 38, 38, 0.6);
}
@keyframes countdownPulse {
  from { transform: scale(1); }
  to { transform: scale(1.12); }
}

/* 顶部 HUD（沉浸式模式，绝对定位，过渡动画） */
.room-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height, 7vh);
  min-height: var(--header-height, 7vh);
  padding: 0 var(--content-padding-h, 3vw);
  padding-left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  padding-right: calc(var(--content-padding-h, 3vw) + var(--safe-right, 0px));
  padding-top: var(--safe-top, 0px);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: transform 0.3s ease, opacity 0.3s ease;
  transform: translateY(0);
  opacity: 1;
}

.room-hud.hud-hidden {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}

/* 顶部呼出区域（透明，点击显示 HUD） */
.hud-trigger-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: max(5vh, 56px);
  z-index: 15;
  background: transparent;
}

/* 聊天框包装器（沉浸式模式） */
.chat-wrapper {
  position: absolute;
  left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  bottom: calc(12vh + var(--safe-bottom, 0px));
  z-index: 25;
  display: flex;
  align-items: flex-end;
  gap: 1vh;
}

.chat-toggle-btn {
  position: relative;
  width: max(5vh, 48px);
  height: max(5vh, 48px);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.1vh solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.chat-badge {
  position: absolute;
  top: -0.5vh;
  right: -0.5vh;
  min-width: 2vh;
  height: 2vh;
  padding: 0 0.5vh;
  border-radius: 1vh;
  background: var(--color-danger);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.host-control-bar {
  position: absolute;
  z-index: 30;
  top: calc(var(--header-height, 7vh) + 1vh);
  right: calc(var(--content-padding-h, 3vw) + var(--safe-right, 0px));
  display: flex;
  align-items: center;
  gap: 0.8vh;
  padding: 0.8vh 1vh;
  border: 0.1vh solid rgba(255, 215, 0, 0.25);
  border-radius: 0.8vh;
  background: rgba(10, 10, 10, 0.78);
  backdrop-filter: blur(10px);
}

.host-label { color: var(--color-gold); font-size: var(--text-xs, 1.6vh); font-weight: 600; }

.host-action {
  padding: 0 1.5vh;
  min-height: 44px;
  display: flex;
  align-items: center;
  border-radius: 0.6vh;
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.08);
  font-size: var(--text-xs, 1.6vh);
}

.host-action.danger { color: #fca5a5; background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.4); gap: 0.5vh; }
.host-action.primary { background: var(--color-gold); color: #1a1a1a; font-weight: 700; }

/* 房主面板折叠 */
.host-collapsed {
  padding: 0.5vh;
  gap: 0;
}
.host-collapse-btn {
  width: max(4vh, 36px);
  height: max(4vh, 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.6vh;
  background: rgba(255,215,0,0.12);
  border: 0.1vh solid rgba(255,215,0,0.3);
}
.host-collapse-icon {
  color: var(--color-gold);
  font-size: 2vh;
  font-weight: 700;
}

.player-ready-bar {
  position: absolute;
  z-index: 30;
  bottom: 18vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
}
.player-ready-btn {
  padding: 1.5vh 6vh;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3vh;
  background: linear-gradient(135deg, var(--color-gold), #e6a800);
  color: #1a1a1a;
  font-size: var(--text-base, 2vh);
  font-weight: 700;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
}
.player-ready-btn.ready {
  background: rgba(255,255,255,0.15);
  color: var(--color-gold);
  border: 2px solid var(--color-gold);
  box-shadow: none;
}

.chip-adjust-modal { width: min(68vw, 72vh); max-height: 72vh; overflow: hidden; background: rgba(20,20,20,.98); border: .1vh solid rgba(255,255,255,.12); border-radius: 1vh; }
.chip-player-list { max-height: 32vh; padding: 1vh 2vh; box-sizing: border-box; }
.chip-player { display: flex; justify-content: space-between; align-items: center; padding: 1.2vh; margin-bottom: .6vh; border-radius: .7vh; background: rgba(255,255,255,.05); color: rgba(255,255,255,.72); font-size: var(--text-sm, 1.9vh); }
.chip-player.active { border: .1vh solid rgba(255,215,0,.55); color: #fff; background: rgba(255,215,0,.1); }
.chip-adjust-form { padding: 1.5vh 2vh 2vh; border-top: .1vh solid rgba(255,255,255,.08); }.chip-amount-input { height: max(5vh, 44px); padding: 0 1.2vh; border-radius: .7vh; background: rgba(255,255,255,.08); color: #fff; font-size: var(--text-sm, 1.9vh); }.chip-adjust-actions { display: flex; justify-content: flex-end; gap: 1vh; margin-top: 1vh; }.chip-adjust-actions .host-action { min-width: 10vh; text-align: center; }

/* 踢出玩家弹窗 */
.kick-modal { width: min(60vw, 64vh); max-height: 70vh; overflow: hidden; background: rgba(20,20,20,.98); border: .1vh solid rgba(255,255,255,.12); border-radius: 1vh; padding: 2vh; box-sizing: border-box; }
.kick-player-list { max-height: 40vh; }
.kick-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5vh; text-align: center; padding: 4vh 0; color: rgba(255,255,255,.4); font-size: var(--text-sm, 1.9vh); }
.kick-player-item { display: flex; justify-content: space-between; align-items: center; padding: 1.4vh 1.2vh; margin-bottom: .8vh; border-radius: .7vh; background: rgba(255,255,255,.05); }
.kick-player-item.kicking { opacity: .6; }
.kick-player-info { display: flex; flex-direction: column; gap: .3vh; }
.kick-player-name { color: var(--color-text); font-size: var(--text-sm, 1.9vh); font-weight: 600; }
.kick-player-points { color: rgba(255,255,255,.5); font-size: var(--text-xs, 1.6vh); }
.kick-btn { padding: .8vh 2vh; border-radius: .6vh; background: rgba(248,113,113,.18); color: #fca5a5; font-size: var(--text-sm, 1.9vh); font-weight: 600; }
.kick-btn:active { background: rgba(248,113,113,.3); }
.kick-btn.disabled { opacity: .5; }

/* 游戏记录弹窗 */
.history-modal { width: min(65vw, 70vh); max-height: 75vh; overflow: hidden; background: rgba(20,20,20,.98); border: .1vh solid rgba(255,255,255,.12); border-radius: 1vh; padding: 2vh; box-sizing: border-box; }
.history-list { max-height: 55vh; }
.history-loading, .history-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 30vh; gap: 2vh; text-align: center; padding: 4vh 0; color: rgba(255,255,255,.4); font-size: var(--text-sm, 1.9vh); }
.history-item { display: flex; justify-content: space-between; align-items: center; padding: 1.4vh 1.2vh; margin-bottom: .8vh; border-radius: .7vh; background: rgba(255,255,255,.05); }
.history-left { display: flex; flex-direction: column; gap: .3vh; }
.history-round { color: var(--color-text); font-size: var(--text-sm, 1.9vh); font-weight: 600; }
.history-game { color: rgba(255,215,0,.7); font-size: var(--text-xs, 1.6vh); }
.history-time { color: rgba(255,255,255,.4); font-size: var(--text-xs, 1.5vh); }
.history-right { display: flex; flex-direction: column; align-items: flex-end; gap: .3vh; min-width: 80px; }
.history-winner { color: rgba(255,255,255,.6); font-size: var(--text-xs, 1.6vh); }
.history-winner-name { color: rgba(255,215,0,.8); font-size: var(--text-xs, 1.6vh); }
.history-amount { font-size: var(--text-sm, 1.9vh); font-weight: 700; }
.history-amount.profit { color: var(--color-success); }
.history-amount.loss { color: var(--color-danger); }
.history-pot { color: rgba(255,255,255,.4); font-size: var(--text-xs, 1.5vh); }
/* 游戏记录tab */
.history-tabs { display: flex; gap: 2vh; padding: 1vh 2vh; border-bottom: .1vh solid rgba(255,255,255,.1); }
.history-tab { padding: .6vh 2vh; font-size: var(--text-sm, 1.8vh); color: rgba(255,255,255,.5); border-radius: 2vh; }
.history-tab.active { color: var(--color-gold); background: rgba(255,215,0,.1); }
/* 全部玩家明细 */
.all-hands { margin-top: 1vh; padding-top: 1vh; border-top: .1vh dashed rgba(255,255,255,.1); }
.all-hand-item { display: flex; justify-content: space-between; align-items: center; padding: .5vh 0; }
.all-hand-name { font-size: var(--text-xs, 1.5vh); color: var(--color-text-secondary); flex: 1; }
.all-hand-type { font-size: var(--text-xs, 1.5vh); color: rgba(255,255,255,.4); margin: 0 2vh; }
.all-hand-amount { font-size: var(--text-sm, 1.8vh); font-weight: 600; }
.all-hand-amount.profit { color: var(--color-success); }
.all-hand-amount.loss { color: var(--color-danger); }

/* 弹幕层 */
.danmaku-layer {
  position: fixed;
  top: 8%;
  left: 0;
  width: 100%;
  height: 35%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
}
.danmaku-item {
  position: absolute;
  right: -100%;
  white-space: nowrap;
  animation: danmaku-scroll linear forwards;
  text-shadow: 0 0 8rpx rgba(0,0,0,0.8), 0 0 4rpx rgba(0,0,0,0.9);
}
.danmaku-sender {
  color: var(--color-gold);
  font-size: var(--text-base);
  font-weight: 600;
  margin-right: 0.5vh;
}
.danmaku-content {
  color: #fff;
  font-size: var(--text-base);
}
@keyframes danmaku-scroll {
  from { right: -30%; }
  to { right: 110%; }
}

.hud-left, .hud-right {
  display: flex;
  align-items: center;
  gap: 1.5vh;
}

.back-btn {
  width: max(5vh, 48px);
  height: max(5vh, 48px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(0.95);
}

.room-info {
  display: flex;
  flex-direction: column;
}

.room-name {
  font-size: var(--text-sm, 1.9vh);
  font-weight: 600;
  color: var(--color-text, var(--color-text));
}

.room-game {
  font-size: var(--text-xs, 1.6vh);
  color: var(--color-text-muted, rgba(255,255,255,0.5));
}

/* 倒计时 */
.countdown {
  width: 5.5vh;
  height: 5.5vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid var(--color-gold);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.countdown-warning {
  background: rgba(255, 107, 107, 0.2);
  border-color: var(--color-danger);
  animation: countdownPulse 0.5s ease infinite;
}

@keyframes countdownPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.countdown-num {
  font-size: var(--text-base, 2.2vh);
  font-weight: 700;
  color: var(--color-gold);
}

.countdown-warning .countdown-num {
  color: var(--color-danger);
}

.user-points-hud {
  display: flex;
  align-items: center;
  gap: 0.8vh;
  background: rgba(0, 0, 0, 0.5);
  padding: 0.8vh 1.5vw;
  border-radius: 3vh;
  border: 1px solid rgba(255,215,0,0.2);
}

.points-value {
  font-size: var(--text-sm, 1.9vh);
  font-weight: 600;
  color: var(--color-gold);
  font-family: 'JetBrainsMono', monospace;
}

.settings-btn {
  width: max(5vh, 48px);
  height: max(5vh, 48px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.settings-btn:active {
  background: rgba(255, 255, 255, 0.2);
  transform: rotate(45deg);
}

/* 牌桌区域（沉浸式模式，占满全屏） */
.poker-table {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100vh;
  perspective: 1200px;
}

.table-ellipse {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotateX(8deg);
  width: 78%;
  max-width: 120vh;
  height: 70%;
  transform-style: preserve-3d;
}

.table-inner {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  border-radius: 50%;
  box-shadow:
    inset 0 0 12vh rgba(0, 0, 0, 0.6),
    inset 0 2vh 4vh rgba(255,255,255,0.05),
    0 3vh 8vh rgba(0, 0, 0, 0.7),
    0 1vh 2vh rgba(0,0,0,0.5);
  position: relative;
  overflow: hidden;
}

/* 毛毡纹理叠加 */
.table-inner::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background:
    repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px),
    repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px);
  border-radius: 50%;
  pointer-events: none;
}

.table-border {
  position: absolute;
  top: -1.8vh;
  left: -1.8vh;
  right: -1.8vh;
  bottom: -1.8vh;
  border-radius: 50%;
  background:
    linear-gradient(135deg, #A0522D 0%, #8B4513 25%, #654321 50%, #8B4513 75%, #A0522D 100%);
  z-index: -1;
  box-shadow:
    0 0.5vh 1vh rgba(0,0,0,0.5),
    inset 0 0.2vh 0.5vh rgba(255,255,255,0.2),
    inset 0 -0.3vh 0.6vh rgba(0,0,0,0.4);
}

/* 桌边内圈高光 */
.table-border::after {
  content: '';
  position: absolute;
  top: 0.5vh; left: 0.5vh; right: 0.5vh; bottom: 0.5vh;
  border-radius: 50%;
  border: 0.2vh solid rgba(255, 215, 0, 0.15);
  pointer-events: none;
}

.table-highlight {
  position: absolute;
  top: 8%;
  left: 12%;
  width: 76%;
  height: 35%;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 60%, rgba(255,215,0,0.08) 0%, transparent 60%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
}

/* V-POKER 品牌浮雕（牌桌中央） */
.brand-emboss {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
  z-index: 2;
  opacity: 0.07;
}
.brand-text {
  display: block;
  font-size: 8vh;
  font-weight: 900;
  letter-spacing: 0.5vh;
  color: #FFD700;
  text-shadow:
    0 1px 0 rgba(255,255,255,0.3),
    0 -1px 0 rgba(0,0,0,0.5),
    0 0 30px rgba(255,215,0,0.3);
  font-family: 'PlayfairDisplay', Georgia, serif;
}
.brand-subtitle {
  display: block;
  font-size: 1.8vh;
  letter-spacing: 0.8vh;
  color: rgba(255,215,0,0.6);
  margin-top: 0.5vh;
  font-weight: 300;
}

/* 底池区域 */
.pot-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

/* 座位容器 */
.seats-container {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 8;
  pointer-events: none;
}

/* HUD隐藏时的常驻迷你余额条 */
.mini-points-bar {
  position: absolute;
  top: calc(var(--safe-top, 0px) + 1vh);
  left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  z-index: 18;
  display: flex;
  align-items: center;
  gap: 0.8vh;
  padding: 0.6vh 1.5vh;
  background: rgba(0,0,0,0.5);
  border: 0.1vh solid rgba(255,215,0,0.2);
  border-radius: 3vh;
  backdrop-filter: blur(8px);
  transition: opacity 0.3s ease;
}
.mini-points-value {
  font-size: var(--text-sm, 1.9vh);
  font-weight: 600;
  color: var(--color-gold);
  font-family: 'JetBrainsMono', monospace;
}

/* 操作栏（适配底部安全区） */
.action-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 1.5vh var(--content-padding-h, 3vw);
  padding-bottom: calc(1.5vh + var(--safe-bottom, 0px));
  padding-left: calc(var(--content-padding-h, 3vw) + var(--safe-left, 0px));
  padding-right: calc(var(--content-padding-h, 3vw) + var(--safe-right, 0px));
  background: linear-gradient(transparent, rgba(0,0,0,0.8) 40%);
  display: flex;
  justify-content: center;
}

/* 操作栏内部按钮组宽度约束（P2修复：防止横屏宽屏按钮间距过大） */
.action-bar > * {
  max-width: 60vh;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding-left: var(--safe-left, 0px);
  padding-right: var(--safe-right, 0px);
  padding-top: var(--safe-top, 0px);
  padding-bottom: var(--safe-bottom, 0px);
}

.modal-content {
  width: min(50vw, 480px);
  min-width: 300px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2vh;
}

.modal-title {
  font-size: var(--text-lg, 2.6vh);
  font-weight: 700;
  color: var(--color-text, var(--color-text));
}

.modal-close {
  font-size: var(--text-base, 2.2vh);
  color: var(--color-text-muted, rgba(255,255,255,0.5));
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5vh 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.setting-label {
  font-size: var(--text-sm, 1.9vh);
  color: var(--color-text, var(--color-text));
}

/* 等待续开遮罩 */
.waiting-continue-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}
.waiting-continue-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5vh;
  padding: 5vh 6vh;
  background: rgba(20, 20, 30, 0.95);
  border: 0.15vh solid rgba(255, 215, 0, 0.3);
  border-radius: 2vh;
  box-shadow: 0 0 4vh rgba(255, 215, 0, 0.15);
}
.waiting-icon {
  animation: spin 2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.waiting-title {
  font-size: var(--text-xl, 3vh);
  font-weight: 700;
  color: var(--color-gold);
}
.waiting-desc {
  font-size: var(--text-sm, 1.9vh);
  color: rgba(255, 255, 255, 0.6);
}

/* 掷骰子浮动卡片（牌桌中央，非全屏遮罩） */
.dice-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 150;
  pointer-events: none;
}
.dice-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5vh;
  padding: 2.5vh 4vh;
  background: rgba(20, 20, 30, 0.92);
  border: 0.15vh solid rgba(255, 215, 0, 0.4);
  border-radius: 2vh;
  box-shadow: 0 1vh 3vh rgba(0,0,0,0.5), 0 0 2vh rgba(255,215,0,0.2);
  backdrop-filter: blur(8px);
  animation: diceCardIn 0.3s ease-out;
}
@keyframes diceCardIn {
  from { opacity: 0; transform: scale(0.8) translateY(-2vh); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.dice-title {
  font-size: var(--text-lg, 2.5vh);
  font-weight: 700;
  color: var(--color-gold);
}
.dice-container {
  perspective: 600px;
}
.dice {
  width: 12vh;
  height: 12vh;
  background: linear-gradient(145deg, #fff, #e0e0e0);
  border-radius: 1.5vh;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0.5vh 2vh rgba(0, 0, 0, 0.4), inset 0 0 1vh rgba(0,0,0,0.1);
}
.dice-rolling {
  animation: dice-shake 0.15s ease-in-out infinite;
}
.dice-result {
  animation: dice-bounce 0.5s ease-out;
}
.dice-face {
  font-size: var(--text-3xl);
  font-weight: 900;
  color: var(--color-bg-card);
}
.dice-result-text {
  font-size: var(--text-xl, 3vh);
  font-weight: 700;
  color: var(--color-gold);
}
.dice-rolling-text {
  font-size: var(--text-sm, 1.9vh);
  color: rgba(255, 255, 255, 0.5);
}
.orientation-blocker {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2vh;
  color: #fff;
  font-size: var(--text-lg, 2.6vh);
  background: var(--color-bg);
}
.orientation-back-btn {
  margin-top: 2vh;
  padding: 1.2vh 3vh;
  border-radius: 1vh;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  font-size: var(--text-base);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1vh;
  min-height: 44px;
}
@keyframes dice-shake {
  0%, 100% { transform: rotate(-5deg) translateY(0); }
  50% { transform: rotate(5deg) translateY(-0.5vh); }
}
@keyframes dice-bounce {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
</style>

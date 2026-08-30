<template>
  <view class="dynamic-actions">
    <view
      v-for="(opt, idx) in options"
      :key="idx"
      class="dyn-btn touch-active"
      :class="[getBtnClass(opt.action), { disabled: disabled, pressed: pressedIndex === idx }]"
      @click="handleClick(opt, idx, $event)"
      @touchstart="onTouchStart(idx, $event)"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <text class="dyn-label">{{ opt.label }}</text>
      <text v-if="opt.amount" class="dyn-amount">{{ formatAmount(opt.amount) }}</text>
      <!-- 点击波纹效果 -->
      <view v-for="(ripple, rIdx) in (ripples[idx] || [])" :key="rIdx" class="btn-ripple touch-active" :style="{ left: ripple.x + 'px', top: ripple.y + 'px' }"></view>
    </view>

    <!-- 加注滑块组件 -->
    <RaiseSlider
      v-if="showRaiseSlider"
      :visible="showRaiseSlider"
      :min="raiseMin"
      :max="raiseMax"
      :call-amount="raiseCallAmount"
      :pot="raisePot"
      :default-value="raiseDefault"
      @cancel="cancelRaise"
      @confirm="confirmRaise"
    />
  </view>
</template>

<script>
import RaiseSlider from '../game/RaiseSlider.vue'
/**
 * 通用动态操作组件
 * 根据后端返回的 options（ActionOption[]）渲染操作按钮
 * 五个游戏共用，操作列表由后端驱动
 *
 * ActionOption 结构: { action, label, amount?, min?, max?, chips?, baseBet? }
 */
export default {
  name: 'DynamicActions',
  components: { RaiseSlider },
  props: {
    // 后端返回的可用操作列表
    options: {
      type: Array,
      default: () => []
    },
    disabled: {
      type: Boolean,
      default: false
    },
    // 当前底池（用于加注滑块计算）
    pot: {
      type: Number,
      default: 0
    },
    // 当前跟注金额
    callAmount: {
      type: Number,
      default: 0
    },
    // 玩家当前筹码（作为加注上限）
    playerPoints: {
      type: Number,
      default: 1000
    }
  },
  emits: ['action'],
  data() {
    return {
      showRaiseSlider: false,
      raiseMin: 10,
      raiseMax: 1000,
      raiseCallAmount: 0,
      raisePot: 0,
      raiseDefault: 0,
      pressedIndex: -1,
      ripples: {}
    }
  },
  methods: {
    handleClick(opt, idx, event) {
      if (this.disabled) return
      // 创建波纹效果
      this.createRipple(idx, event)
      // 加注操作：显示滑块选择金额
      if (opt.action === 'raise') {
        this.raiseMin = opt.min || 10
        this.raiseMax = opt.max || this.playerPoints || 1000
        this.raiseCallAmount = this.callAmount || opt.amount || 0
        this.raisePot = this.pot || 0
        this.raiseDefault = opt.amount || this.raiseCallAmount * 2 || this.raiseMin
        this.showRaiseSlider = true
        return
      }
      this.$emit('action', opt.action, opt.amount)
    },
    onTouchStart(idx, event) {
      if (this.disabled) return
      this.pressedIndex = idx
    },
    onTouchEnd() {
      this.pressedIndex = -1
    },
    createRipple(idx, event) {
      if (!this.ripples[idx]) this.ripples[idx] = []
      const touch = event.touches ? event.touches[0] : event
      const target = event.currentTarget || event.target
      const rect = target ? target.getBoundingClientRect() : { left: 0, top: 0, width: 100, height: 50 }
      const x = (touch ? touch.clientX : rect.width / 2) - rect.left
      const y = (touch ? touch.clientY : rect.height / 2) - rect.top
      const ripple = { x, y, id: Date.now() }
      this.ripples[idx].push(ripple)
      // 600ms后移除波纹
      setTimeout(() => {
        this.ripples[idx] = this.ripples[idx].filter(r => r.id !== ripple.id)
      }, 600)
    },
    cancelRaise() {
      this.showRaiseSlider = false
    },
    confirmRaise(amount) {
      this.showRaiseSlider = false
      this.$emit('action', 'raise', amount)
    },
    formatAmount(val) {
      if (!val) return ''
      if (val >= 10000) return (val / 10000).toFixed(1) + '万'
      return val.toString()
    },
    // 根据 action 名分配按钮颜色样式
    getBtnClass(action) {
      const map = {
        // 炸金花
        look: 'btn-look',
        blind: 'btn-blind',
        call: 'btn-call',
        raise: 'btn-raise',
        compare: 'btn-compare',
        fold: 'btn-fold',
        // 德州
        check: 'btn-check',
        allin: 'btn-allin',
        // 牛牛/三公
        roll: 'btn-roll',
        bet: 'btn-bet',
        undo_bet: 'btn-undo',
        confirm_bet: 'btn-confirm',
        confirm: 'btn-confirm',
        // 通比牛牛
        start: 'btn-start',
        toggle_auto: 'btn-auto',
      }
      return map[action] || 'btn-default'
    }
  }
}
</script>

<style lang="scss" scoped>
.dynamic-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2vh;
  flex-wrap: wrap;
  max-width: 90vw;
  margin: 0 auto;
}

/* 7个按钮（炸金花）：固定2行布局，第一行4个，第二行3个 */
.dynamic-actions:has(.dyn-btn:nth-child(7)) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1vh 1.2vh;
  max-width: 80vw;
  
  .dyn-btn:nth-child(5),
  .dyn-btn:nth-child(6),
  .dyn-btn:nth-child(7) {
    grid-column: span 1;
  }
  
  /* 第二行3个按钮居中 */
  .dyn-btn:nth-child(5) { margin-left: 50%; }
}

.dyn-btn {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 12vh;
  min-height: 7vh;
  height: 7vh;
  padding: 0 2vh;
  border-radius: 1vh;
  transition: all 0.15s ease;
  box-shadow: 0 0.5vh 1.2vh rgba(0, 0, 0, 0.35);
  border: 0.2vh solid rgba(255,255,255,0.1);

  &:active, &.pressed { 
    transform: scale(0.94); 
    box-shadow: 0 0.2vh 0.6vh rgba(0,0,0,0.3);
    filter: brightness(0.9);
  }
  &.disabled { opacity: 0.35; pointer-events: none; }
}

/* 点击波纹效果 */
.btn-ripple {
  position: absolute;
  width: 2vh;
  height: 2vh;
  margin-left: -1vh;
  margin-top: -1vh;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transform: scale(0);
  animation: rippleExpand 0.6s ease-out forwards;
  pointer-events: none;
  z-index: 10;
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }
  100% {
    transform: scale(15);
    opacity: 0;
  }
}

.dyn-label {
  font-size: var(--text-lg);
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 0.1vh 0.2vh rgba(0,0,0,0.3);
}

/* 炸金花 */
.btn-look   { background: linear-gradient(145deg, var(--color-info), #2563eb); }
.btn-blind  { background: linear-gradient(145deg, #f59e0b, #d97706); .dyn-label { color: var(--color-bg-card); } }
.btn-call   { background: linear-gradient(145deg, var(--color-success), var(--color-success)); }
.btn-raise  { background: linear-gradient(145deg, var(--color-gold), var(--color-gold-dark)); .dyn-label { color: var(--color-bg-card); } }
.btn-compare{ background: linear-gradient(145deg, #a855f7, #9333ea); }
.btn-fold   { background: linear-gradient(145deg, #ef4444, #dc2626); }

/* 德州 */
.btn-check  { background: linear-gradient(145deg, var(--color-text-muted), #4b5563); }
.btn-allin  { background: linear-gradient(145deg, #f97316, #ea580c); }

/* 牛牛/三公 */
.btn-roll   { background: linear-gradient(145deg, #8b5cf6, #7c3aed); }
.btn-bet    { background: linear-gradient(145deg, var(--color-success), var(--color-success)); }
.btn-undo   { background: linear-gradient(145deg, #78716c, #57534e); }
.btn-confirm{ background: linear-gradient(145deg, var(--color-gold), var(--color-gold-dark)); .dyn-label { color: var(--color-bg-card); } }

/* 通比牛牛 */
.btn-start  { background: linear-gradient(145deg, var(--color-success), var(--color-success)); }
.btn-auto   { background: linear-gradient(145deg, #06b6d4, #0891b2); }

.btn-default { background: linear-gradient(145deg, #475569, #334155); }
</style>

<template>
  <view v-if="visible" class="raise-slider-panel glass">
    <view class="slider-header">
      <text class="slider-title">加注金额</text>
      <text class="slider-value">{{ formatAmount(currentValue) }}</text>
    </view>
    <view class="slider-track">
      <view class="slider-fill" :style="{ width: fillPercent + '%' }"></view>
      <view class="slider-thumb" :style="{ left: fillPercent + '%' }">
        <text class="thumb-value">{{ formatAmount(currentValue) }}</text>
      </view>
    </view>
    <view class="slider-marks">
      <text class="mark-text" @click="setQuick(min)">{{ formatAmount(min) }}</text>
      <text class="mark-text" @click="setQuick(Math.floor((min + max) / 2))">1/2</text>
      <text class="mark-text" @click="setQuick(max)">{{ formatAmount(max) }}</text>
    </view>
    <view class="slider-quick-btns">
      <view class="quick-btn touch-active" @click="setQuick(callAmount)"><text>跟注</text></view>
      <view class="quick-btn touch-active" @click="setQuick(Math.floor(pot * 0.5))"><text>1/2池</text></view>
      <view class="quick-btn touch-active" @click="setQuick(pot)"><text>满池</text></view>
      <view class="quick-btn allin touch-active" @click="setQuick(max)"><text>全下</text></view>
    </view>
    <view class="slider-actions">
      <view class="action-btn cancel touch-active" @click="$emit('cancel')"><text>取消</text></view>
      <view class="action-btn confirm touch-active" @click="confirmRaise"><text>确认加注</text></view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'RaiseSlider',
  props: {
    visible: { type: Boolean, default: false },
    min: { type: Number, default: 10 },
    max: { type: Number, default: 1000 },
    callAmount: { type: Number, default: 0 },
    pot: { type: Number, default: 0 },
    defaultValue: { type: Number, default: 0 }
  },
  emits: ['cancel', 'confirm'],
  data() {
    return {
      currentValue: 0,
      isDragging: false
    }
  },
  computed: {
    fillPercent() {
      if (this.max <= this.min) return 0
      return Math.min(100, Math.max(0, ((this.currentValue - this.min) / (this.max - this.min)) * 100))
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.currentValue = this.defaultValue || this.callAmount || Math.floor((this.min + this.max) / 2)
      }
    }
  },
  methods: {
    formatAmount(val) {
      if (val >= 10000) return (val / 10000).toFixed(1) + '万'
      return val.toString()
    },
    setQuick(val) {
      this.currentValue = Math.min(this.max, Math.max(this.min, val))
    },
    confirmRaise() {
      this.$emit('confirm', this.currentValue)
    }
  }
}
</script>

<style lang="scss" scoped>
.raise-slider-panel {
  position: fixed;
  bottom: 12vh;
  left: 50%;
  transform: translateX(-50%);
  width: 80vw;
  max-width: 600px;
  padding: 2vh 3vw;
  border-radius: 2vh;
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(12px);
  border: 0.15vh solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 -1vh 3vh rgba(0,0,0,0.5);
  z-index: 120;
  animation: sliderIn 0.3s ease-out;
}

@keyframes sliderIn {
  from { opacity: 0; transform: translateX(-50%) translateY(3vh); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2vh;
}

.slider-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}

.slider-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-gold);
  font-family: 'JetBrainsMono', monospace;
}

.slider-track {
  position: relative;
  height: 1.5vh;
  background: rgba(255,255,255,0.1);
  border-radius: 1vh;
  margin: 3vh 0 2vh;
}

.slider-fill {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--color-gold), var(--color-gold-dark));
  border-radius: 1vh;
  transition: width 0.1s ease;
}

.slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4vh;
  height: 4vh;
  background: linear-gradient(145deg, #fff, #e0e0e0);
  border-radius: 50%;
  box-shadow: 0 0.3vh 0.8vh rgba(0,0,0,0.4), 0 0 1vh rgba(255,215,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 0.1s ease;
}

.thumb-value {
  font-size: 1vh;
  font-weight: 700;
  color: var(--color-bg-card);
  white-space: nowrap;
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2vh;
}

.mark-text {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.5);
  padding: 0.5vh 1vh;
  border-radius: 0.5vh;
  transition: all 0.2s ease;
  
  &:active {
    background: rgba(255,215,0,0.2);
    color: var(--color-gold);
  }
}

.slider-quick-btns {
  display: flex;
  gap: 1vh;
  margin-bottom: 2vh;
}

.quick-btn {
  flex: 1;
  padding: 1vh 0;
  background: rgba(255,255,255,0.08);
  border-radius: 0.8vh;
  text-align: center;
  border: 0.1vh solid rgba(255,255,255,0.1);
  transition: all 0.2s ease;
  
  text {
    font-size: var(--text-sm);
    color: var(--color-text);
    font-weight: 500;
  }
  
  &:active {
    background: rgba(255,215,0,0.2);
    border-color: var(--color-gold);
    text { color: var(--color-gold); }
  }
  
  &.allin {
    background: rgba(220, 38, 38, 0.15);
    border-color: rgba(220, 38, 38, 0.3);
    text { color: var(--color-danger); }
    
    &:active {
      background: rgba(220, 38, 38, 0.3);
    }
  }
}

.slider-actions {
  display: flex;
  gap: 2vh;
}

.action-btn {
  flex: 1;
  padding: 1.5vh 0;
  border-radius: 1vh;
  text-align: center;
  transition: all 0.2s ease;
  
  text {
    font-size: var(--text-base);
    font-weight: 600;
  }
  
  &.cancel {
    background: rgba(255,255,255,0.1);
    text { color: rgba(255,255,255,0.7); }
    &:active { background: rgba(255,255,255,0.15); }
  }
  
  &.confirm {
    background: linear-gradient(145deg, var(--color-gold), var(--color-gold-dark));
    box-shadow: 0 0.4vh 1vh rgba(255,215,0,0.4);
    text { color: var(--color-bg-card); }
    &:active { transform: scale(0.98); }
  }
}
</style>

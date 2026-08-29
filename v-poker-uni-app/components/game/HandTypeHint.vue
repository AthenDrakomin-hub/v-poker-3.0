<template>
  <view v-if="visible" class="hand-type-hint" :class="position">
    <view class="hint-card glass">
      <view class="hint-icon">
        <text class="icon-text">{{ handIcon }}</text>
      </view>
      <view class="hint-info">
        <text class="hint-label">{{ label }}</text>
        <text class="hint-type" :class="typeClass">{{ handType }}</text>
      </view>
      <view v-if="probability > 0" class="hint-prob">
        <text class="prob-value">{{ probability }}%</text>
        <text class="prob-label">胜率</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'HandTypeHint',
  props: {
    visible: { type: Boolean, default: false },
    handType: { type: String, default: '' },
    probability: { type: Number, default: 0 },
    position: { type: String, default: 'bottom-center' },
    label: { type: String, default: '当前牌型' }
  },
  computed: {
    handIcon() {
      const icons = {
        '皇家同花顺': '👑', '同花顺': '♠', '四条': '4', '葫芦': '🎃',
        '同花': '♥', '顺子': '📏', '三条': '3', '两对': '22',
        '一对': '1', '高牌': 'A', '牛牛': '🐂', '牛九': '9', '牛八': '8',
        '三公': '👑', '二公': '2', '一公': '1', '无公': '0',
        '豹子': '🎲', '顺金': '♠', '金花': '♥', '顺子': '📏', '对子': '1'
      }
      return icons[this.handType] || '🃏'
    },
    typeClass() {
      const strongTypes = ['皇家同花顺', '同花顺', '四条', '葫芦', '牛牛', '三公', '豹子', '顺金']
      return strongTypes.includes(this.handType) ? 'type-strong' : 'type-normal'
    }
  }
}
</script>

<style lang="scss" scoped>
.hand-type-hint {
  position: fixed;
  z-index: 55;
  pointer-events: none;
  
  &.bottom-center {
    bottom: 18vh;
    left: 50%;
    transform: translateX(-50%);
  }
  &.top-center {
    top: 15vh;
    left: 50%;
    transform: translateX(-50%);
  }
  &.left-center {
    top: 50%;
    left: 2vw;
    transform: translateY(-50%);
  }
  &.right-center {
    top: 50%;
    right: 2vw;
    transform: translateY(-50%);
  }
}

.hint-card {
  display: flex;
  align-items: center;
  gap: 1.2vh;
  padding: 1vh 1.5vh;
  border-radius: 1vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border: 0.1vh solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 0.5vh 1.5vh rgba(0,0,0,0.4);
  animation: hintIn 0.3s ease-out;
}

@keyframes hintIn {
  from { opacity: 0; transform: translateY(1vh) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.hint-icon {
  width: 4vh;
  height: 4vh;
  border-radius: 0.8vh;
  background: linear-gradient(145deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-text {
  font-size: 2.2vh;
}

.hint-info {
  display: flex;
  flex-direction: column;
  gap: 0.2vh;
}

.hint-label {
  font-size: 1.4vh;
  color: rgba(255,255,255,0.6);
}

.hint-type {
  font-size: 2vh;
  font-weight: 700;
  
  &.type-strong {
    color: var(--color-gold);
    text-shadow: 0 0 1vh rgba(255,215,0,0.5);
    animation: typeGlow 1s ease infinite alternate;
  }
  &.type-normal {
    color: var(--color-text);
  }
}

@keyframes typeGlow {
  from { text-shadow: 0 0 0.5vh rgba(255,215,0,0.3); }
  to { text-shadow: 0 0 1.5vh rgba(255,215,0,0.7); }
}

.hint-prob {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-left: 1.2vh;
  border-left: 0.1vh solid rgba(255,255,255,0.15);
  margin-left: 0.5vh;
}

.prob-value {
  font-size: 2vh;
  font-weight: 700;
  color: var(--color-success);
}

.prob-label {
  font-size: 1.2vh;
  color: rgba(255,255,255,0.5);
}
</style>

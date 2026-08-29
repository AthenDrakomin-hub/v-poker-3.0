<template>
  <view v-if="active" class="open-card-effect" :class="effectClass">
    <!-- 金光炸裂（紫禁之巅） -->
    <view v-if="effectType === 'gold_burst'" class="gold-burst-effect">
      <view class="burst-center"></view>
      <view
        v-for="i in 24"
        :key="i"
        class="burst-ray"
        :style="getRayStyle(i)"
      ></view>
      <view class="screen-flash"></view>
    </view>

    <!-- 水墨晕染（江南百景） -->
    <view v-else-if="effectType === 'ink_spread'" class="ink-spread-effect">
      <view
        v-for="i in 3"
        :key="i"
        class="ink-ripple"
        :style="{ animationDelay: (i * 150) + 'ms' }"
      ></view>
    </view>

    <!-- 机械臂冲压（机械迷城） -->
    <view v-else-if="effectType === 'mechanical_stamp'" class="mechanical-stamp-effect">
      <view class="stamp-arm"></view>
      <view class="stamp-plate"></view>
      <view class="metal-flash"></view>
    </view>

    <!-- 聚光灯收窄（雾都夜话） -->
    <view v-else-if="effectType === 'spotlight_narrow'" class="spotlight-narrow-effect">
      <view class="spotlight-circle"></view>
      <view class="surrounding-dim"></view>
    </view>

    <!-- 网格线亮起（华尔街之狼） -->
    <view v-else-if="effectType === 'grid_lightup'" class="grid-lightup-effect">
      <view class="grid-overlay"></view>
      <view class="data-flash"></view>
    </view>

    <!-- 通用震屏 -->
    <view v-if="screenShake" class="screen-shake" :style="shakeStyle"></view>
  </view>
</template>

<script>
export default {
  name: 'OpenCardEffect',
  props: {
    // 动画类型：gold_burst/ink_spread/mechanical_stamp/spotlight_narrow/grid_lightup
    effectType: {
      type: String,
      default: 'gold_burst'
    },
    // 是否激活
    active: {
      type: Boolean,
      default: false
    },
    // 持续时间（ms）
    duration: {
      type: Number,
      default: 600
    },
    // 主题颜色
    color: {
      type: String,
      default: 'var(--color-gold)'
    },
    // 是否震屏
    screenShake: {
      type: Boolean,
      default: true
    },
    // 震屏强度
    shakeIntensity: {
      type: Number,
      default: 5
    },
  },
  data() {
    return {
      shakeX: 0,
      shakeY: 0,
      shakeTimer: null,
    }
  },
  computed: {
    effectClass() {
      return 'effect-' + this.effectType
    },
    shakeStyle() {
      return {
        transform: `translate(${this.shakeX}px, ${this.shakeY}px)`,
      }
    }
  },
  watch: {
    active(newVal) {
      if (newVal) {
        this.playEffect()
      }
    }
  },
  methods: {
    // 播放效果
    playEffect() {
      // 震屏
      if (this.screenShake) {
        this.startShake()
      }

      // 自动结束
      setTimeout(() => {
        this.$emit('complete')
      }, this.duration)
    },

    // 震屏动画
    startShake() {
      let frame = 0
      const totalFrames = Math.floor(this.duration / 16)

      const shake = () => {
        if (frame >= totalFrames) {
          this.shakeX = 0
          this.shakeY = 0
          return
        }

        const progress = frame / totalFrames
        const decay = 1 - progress
        this.shakeX = (Math.random() - 0.5) * this.shakeIntensity * 2 * decay
        this.shakeY = (Math.random() - 0.5) * this.shakeIntensity * 2 * decay

        frame++
        this.shakeTimer = setTimeout(shake, 16)
      }

      shake()
    },

    // 获取光线样式（金光炸裂）
    getRayStyle(index) {
      const angle = (360 / 24) * index
      return {
        transform: `rotate(${angle}deg)`,
        background: `linear-gradient(to top, ${this.color}, transparent)`,
        animationDelay: (index * 10) + 'ms',
      }
    },
  },
  beforeUnmount() {
    if (this.shakeTimer) {
      clearTimeout(this.shakeTimer)
    }
  }
}
</script>

<style lang="scss" scoped>
.open-card-effect {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 150;
  overflow: hidden;
}

/* ========== 金光炸裂 ========== */
.gold-burst-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
}

.burst-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100rpx;
  height: 100rpx;
  background: radial-gradient(circle, var(--color-gold) 0%, var(--color-gold-dark) 50%, transparent 100%);
  border-radius: 50%;
  animation: burstCenter 0.6s ease-out forwards;
}

@keyframes burstCenter {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(3); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(5); opacity: 0; }
}

.burst-ray {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6rpx;
  height: 400rpx;
  margin-left: -3rpx;
  margin-top: -200rpx;
  transform-origin: center bottom;
  animation: burstRay 0.6s ease-out forwards;
}

@keyframes burstRay {
  0% { height: 0; opacity: 1; }
  50% { height: 400rpx; opacity: 0.8; }
  100% { height: 500rpx; opacity: 0; }
}

.screen-flash {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 215, 0, 0.3);
  animation: screenFlash 0.3s ease-out forwards;
}

@keyframes screenFlash {
  0% { opacity: 0.5; }
  100% { opacity: 0; }
}

/* ========== 水墨晕染 ========== */
.ink-spread-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.ink-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100rpx;
  height: 100rpx;
  border: 4rpx solid rgba(44, 95, 109, 0.6);
  border-radius: 50%;
  animation: inkRipple 0.8s ease-out forwards;
}

@keyframes inkRipple {
  0% { width: 0; height: 0; opacity: 1; border-width: 8rpx; }
  100% { width: 600rpx; height: 600rpx; opacity: 0; border-width: 1rpx; }
}

/* ========== 机械臂冲压 ========== */
.mechanical-stamp-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.stamp-arm {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  width: 200rpx;
  height: 60%;
  background: linear-gradient(180deg, #8B4513 0%, #654321 100%);
  border: 4rpx solid #CD7F32;
  border-radius: 0 0 20rpx 20rpx;
  animation: stampDown 0.4s ease-in forwards;
}

@keyframes stampDown {
  0% { top: -100%; }
  70% { top: 30%; }
  85% { top: 25%; }
  100% { top: 30%; }
}

.stamp-plate {
  position: absolute;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  width: 300rpx;
  height: 40rpx;
  background: linear-gradient(180deg, #CD7F32 0%, #8B4513 100%);
  border: 4rpx solid #B8860B;
  border-radius: 8rpx;
  opacity: 0;
  animation: plateAppear 0.4s ease-in 0.25s forwards;
}

@keyframes plateAppear {
  0% { opacity: 0; transform: translateX(-50%) scaleY(0); }
  100% { opacity: 1; transform: translateX(-50%) scaleY(1); }
}

.metal-flash {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(205, 127, 50, 0.4);
  animation: metalFlash 0.2s ease-out 0.3s forwards;
  opacity: 0;
}

@keyframes metalFlash {
  0% { opacity: 0.6; }
  100% { opacity: 0; }
}

/* ========== 聚光灯收窄 ========== */
.spotlight-narrow-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.spotlight-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60%;
  height: 60%;
  background: radial-gradient(circle, rgba(255,215,0,0.2) 0%, transparent 70%);
  border-radius: 50%;
  animation: spotlightNarrow 0.8s ease-in-out forwards;
}

@keyframes spotlightNarrow {
  0% { width: 80%; height: 80%; opacity: 0.3; }
  50% { width: 30%; height: 30%; opacity: 0.8; }
  100% { width: 25%; height: 25%; opacity: 0.6; }
}

.surrounding-dim {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  animation: dimSurroundings 0.8s ease-in-out forwards;
}

@keyframes dimSurroundings {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* ========== 网格线亮起 ========== */
.grid-lightup-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    linear-gradient(rgba(0, 212, 255, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.3) 1px, transparent 1px);
  background-size: 40rpx 40rpx;
  animation: gridPulse 0.6s ease-in-out forwards;
  opacity: 0;
}

@keyframes gridPulse {
  0% { opacity: 0; }
  30% { opacity: 1; }
  70% { opacity: 0.8; }
  100% { opacity: 0; }
}

.data-flash {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 212, 255, 0.3) 50%, transparent 100%);
  animation: dataSweep 0.5s ease-out forwards;
  transform: translateX(-100%);
}

@keyframes dataSweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ========== 震屏 ========== */
.screen-shake {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>

<template>
  <view class="theme-background" :class="themeClass">
    <!-- 基础渐变背景 -->
    <view class="bg-base" :style="baseStyle"></view>

    <!-- 主题背景图 -->
    <image
      v-if="theme.backgroundImage"
      class="bg-image"
      :src="theme.backgroundImage"
      mode="aspectFill"
    ></image>
    <!-- 背景图遮罩（确保牌桌和文字清晰） -->
    <view v-if="theme.backgroundImage" class="bg-image-overlay"></view>

    <!-- 牌桌椭圆 -->
    <view class="table-ellipse">
      <view class="table-felt" :style="feltStyle"></view>
      <view class="table-border" :style="borderStyle"></view>
      <!-- 牌桌纹理覆盖层 -->
      <view class="table-texture" :style="textureStyle"></view>
    </view>

    <!-- 暗角遮罩 -->
    <view class="bg-vignette"></view>

    <!-- 聚光灯（雾都夜话专属） -->
    <view v-if="theme.id === 'noir' && theme.spotlight?.enabled" class="spotlight-overlay">
      <view class="spotlight-circle" :style="spotlightStyle"></view>
    </view>

    <!-- 粒子效果层 -->
    <ParticleSystem
      v-if="showParticles"
      :config="theme.particles"
      :enabled="particlesEnabled"
    />
  </view>
</template>

<script>
import ParticleSystem from '../ui/ParticleSystem.vue'
import { getThemeByGameType } from '../../themes/themeConfig.js'

export default {
  name: 'ThemeBackground',
  components: {
    ParticleSystem
  },
  props: {
    // 游戏类型
    gameType: {
      type: String,
      default: 'niuniu'
    },
    // 是否显示粒子
    showParticles: {
      type: Boolean,
      default: true
    },
    // 粒子是否启用
    particlesEnabled: {
      type: Boolean,
      default: true
    },
  },
  computed: {
    theme() {
      return getThemeByGameType(this.gameType)
    },
    themeClass() {
      return 'theme-' + this.theme.id
    },
    baseStyle() {
      return {
        background: this.theme.colors.bgGradient,
      }
    },
    feltStyle() {
      return {
        background: `radial-gradient(ellipse at center, ${this.theme.colors.tableFelt} 0%, ${this.darkenColor(this.theme.colors.tableFelt, 30)} 100%)`,
      }
    },
    borderStyle() {
      return {
        background: `linear-gradient(135deg, ${this.theme.colors.tableBorder}, ${this.darkenColor(this.theme.colors.tableBorder, 20)})`,
      }
    },
    textureStyle() {
      const tex = this.theme.tableTexture
      if (!tex) return {}

      let backgroundImage = ''
      switch (tex.type) {
        case 'spider_web':
          backgroundImage = `radial-gradient(circle at center, transparent 30%, ${tex.color} 31%, transparent 32%),
                            radial-gradient(circle at center, transparent 50%, ${tex.color} 51%, transparent 52%),
                            radial-gradient(circle at center, transparent 70%, ${tex.color} 71%, transparent 72%)`
          break
        case 'water_ripple':
          backgroundImage = `repeating-radial-gradient(circle at center, transparent 0, transparent 40rpx, ${tex.color} 40rpx, ${tex.color} 41rpx)`
          break
        case 'gear_pattern':
          backgroundImage = `repeating-conic-gradient(${tex.color} 0deg 10deg, transparent 10deg 30deg)`
          break
        case 'perspective_grid':
          backgroundImage = `linear-gradient(${tex.color} 1px, transparent 1px),
                            linear-gradient(90deg, ${tex.color} 1px, transparent 1px)`
          break
        default:
          backgroundImage = 'none'
      }

      return {
        backgroundImage,
        opacity: tex.opacity || 0.1,
        backgroundSize: tex.type === 'perspective_grid' ? '40rpx 40rpx' : '100% 100%',
      }
    },
    spotlightStyle() {
      const sp = this.theme.spotlight
      return {
        background: `radial-gradient(circle, ${sp.color} 0%, transparent ${sp.radius})`,
      }
    },
  },
  methods: {
    // 加深颜色
    darkenColor(color, percent) {
      // 简单处理：如果是hex颜色，加深
      if (color.startsWith('#')) {
        const num = parseInt(color.slice(1), 16)
        const amt = Math.round(2.55 * percent)
        const R = Math.max(0, (num >> 16) - amt)
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt)
        const B = Math.max(0, (num & 0x0000FF) - amt)
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
      }
      return color
    },
  }
}
</script>

<style lang="scss" scoped>
.theme-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
}

.bg-base {
  position: absolute;
  width: 100%;
  height: 100%;
}

/* 主题背景图 */
.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.bg-image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1;
}

/* 牌桌椭圆 */
.table-ellipse {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 85%;
  height: 65%;
}

.table-felt {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: inset 0 0 100rpx rgba(0, 0, 0, 0.5), 0 20rpx 60rpx rgba(0, 0, 0, 0.6);
}

.table-border {
  position: absolute;
  top: -12rpx;
  left: -12rpx;
  right: -12rpx;
  bottom: -12rpx;
  border-radius: 50%;
  z-index: -1;
}

.table-texture {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
}

/* 暗角遮罩 */
.bg-vignette {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.7) 100%);
  pointer-events: none;
  z-index: 2;
}

/* 聚光灯（雾都夜话） */
.spotlight-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.spotlight-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 80%;
  border-radius: 50%;
}

/* 主题特定样式 */
.theme-forbidden_city {
  .table-felt {
    box-shadow: inset 0 0 80rpx rgba(139, 0, 0, 0.3), 0 20rpx 60rpx rgba(0, 0, 0, 0.8);
  }
}

.theme-jiangnan {
  .table-felt {
    box-shadow: inset 0 0 60rpx rgba(44, 95, 109, 0.2), 0 10rpx 40rpx rgba(0, 0, 0, 0.3);
  }
}

.theme-steampunk {
  .table-border {
    box-shadow: 0 0 20rpx rgba(205, 127, 50, 0.3);
  }
}

.theme-noir {
  .table-felt {
    box-shadow: inset 0 0 100rpx rgba(0, 0, 0, 0.8), 0 0 60rpx rgba(0, 0, 0, 0.9);
  }
}

.theme-wallstreet {
  .table-texture {
    animation: gridBreathing 3s ease-in-out infinite;
  }
}

@keyframes gridBreathing {
  0%, 100% { opacity: 0.05; }
  50% { opacity: 0.15; }
}
</style>

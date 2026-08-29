<template>
  <view
    class="svg-card"
    :class="[
      'size-' + size,
      {
        'card-dealt': isDealt,
        'card-winner': isWinner,
        'card-loser': isLoser,
        'card-clickable': clickable,
        'card-selected': selected
      }
    ]"
    :style="cardStyle"
    @click="onClick"
  >
    <!-- 3D 翻牌容器 -->
    <view class="card-flipper" :class="{ 'is-flipped': !faceUp }">
      <!-- 正面 -->
      <view class="card-face card-front">
        <image
          class="card-image"
          :src="cardImage"
          mode="aspectFit"
          lazy-load
        />
      </view>
      <!-- 背面 -->
      <view class="card-face card-back-face">
        <image
          class="card-image"
          :src="$cdn('/static/images/cards/back.svg')"
          mode="aspectFit"
          lazy-load
        />
      </view>
    </view>
    <!-- 选中标记 -->
    <view v-if="selected" class="card-selected-badge">
      <text class="badge-text">✓</text>
    </view>
  </view>
</template>

<script>
import { getCardImage, isValidCard, getRank, getSuit, isRedSuit } from '../../utils/cards.js'

export default {
  name: 'SVGCard',
  props: {
    /**
     * 卡牌标签，后端编码格式
     * 如: "As"(黑桃A), "Kh"(红桃K), "10d"(方片10), "Qc"(梅花Q), "back"(牌背)
     */
    label: {
      type: String,
      default: 'back'
    },
    /**
     * 是否正面朝上
     * true=显示牌面, false=显示牌背
     */
    faceUp: {
      type: Boolean,
      default: true
    },
    /**
     * 预设尺寸: xs/sm/md/lg/xl
     */
    size: {
      type: String,
      default: 'md'
    },
    /**
     * 自定义宽度（vh单位），不传则用size预设
     */
    width: {
      type: [Number, String],
      default: ''
    },
    /**
     * 是否已发牌（触发发牌动画）
     */
    isDealt: {
      type: Boolean,
      default: false
    },
    /**
     * 发牌延迟（ms），用于依次发牌的 stagger 效果
     */
    dealDelay: {
      type: Number,
      default: 0
    },
    /**
     * 是否赢家牌（金色高光）
     */
    isWinner: {
      type: Boolean,
      default: false
    },
    /**
     * 是否输家牌（灰度变暗）
     */
    isLoser: {
      type: Boolean,
      default: false
    },
    /**
     * 是否可点击
     */
    clickable: {
      type: Boolean,
      default: false
    },
    /**
     * 是否被选中（比牌/选牌场景）
     */
    selected: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click'],
  computed: {
    cardImage() {
      return getCardImage(this.label)
    },
    cardStyle() {
      const style = {}
      // 自定义宽度
      if (this.width) {
        const w = parseFloat(this.width)
        style.width = w + 'vh'
        style.height = (w * 1.447) + 'vh' // 扑克牌比例 1:1.447
      }
      // 发牌延迟
      if (this.dealDelay) {
        style.animationDelay = this.dealDelay + 'ms'
      }
      return style
    },
    // 暴露给父组件的便捷属性
    rank() { return getRank(this.label) },
    suit() { return getSuit(this.label) },
    isRed() { return isRedSuit(this.label) },
    valid() { return isValidCard(this.label) }
  },
  methods: {
    onClick() {
      if (this.clickable) {
        this.$emit('click', {
          label: this.label,
          rank: this.rank,
          suit: this.suit
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
/* ========== 卡牌容器 ========== */
.svg-card {
  position: relative;
  display: inline-block;
  border-radius: 0.6vh;
  /* 3D 透视 */
  perspective: 1000px;
  transform-style: preserve-3d;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, filter 0.25s ease;
}

/* 尺寸预设（横屏 vh 单位） */
.size-xs { width: 5vh;  height: 7.2vh; }
.size-sm { width: 7vh;  height: 10.1vh; }
.size-md { width: 9vh;  height: 13.0vh; }
.size-lg { width: 12vh; height: 17.4vh; }
.size-xl { width: 15vh; height: 21.7vh; }

/* ========== 3D 翻牌 ========== */
.card-flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-flipper.is-flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 0.6vh;
  overflow: hidden;
  box-shadow: 0 0.3vh 1vh rgba(0, 0, 0, 0.45);
}

.card-front {
  background: #FFF;
}

.card-back-face {
  transform: rotateY(180deg);
  background: var(--color-bg);
}

.card-image {
  width: 100%;
  height: 100%;
  display: block;
}

/* ========== 可点击交互（3D 按压） ========== */
.card-clickable {
  cursor: pointer;
}

.card-clickable:active {
  transform: perspective(800px) translateZ(-10px) scale(0.95);
}

/* ========== 选中状态（3D 抬起） ========== */
.card-selected {
  transform: perspective(800px) translateZ(20px) translateY(-1.5vh);
  box-shadow: 0 1vh 3vh rgba(255, 215, 0, 0.5), 0 0 2vh rgba(255, 215, 0, 0.7);
}

.card-selected-badge {
  position: absolute;
  top: -0.8vh;
  right: -0.8vh;
  width: 2.4vh;
  height: 2.4vh;
  background: linear-gradient(135deg, var(--color-gold), #ffaa00);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 0.2vh 0.6vh rgba(0, 0, 0, 0.4);
}

.badge-text {
  color: var(--color-bg-card);
  font-size: var(--text-xs);
  font-weight: bold;
}

/* ========== 发牌动画（3D 抛物线轨迹） ========== */
.card-dealt {
  animation: dealCard3D 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes dealCard3D {
  0% {
    transform: perspective(1000px) translate3d(-8vh, -14vh, 60px) rotateX(-25deg) rotate(-20deg) scale(0.5);
    opacity: 0;
  }
  40% {
    transform: perspective(1000px) translate3d(-3vh, -7vh, 30px) rotateX(-12deg) rotate(-8deg) scale(0.75);
    opacity: 0.9;
  }
  70% {
    transform: perspective(1000px) translate3d(0.5vh, -1.5vh, 10px) rotateX(-4deg) rotate(2deg) scale(0.92);
    opacity: 1;
  }
  100% {
    transform: perspective(1000px) translate3d(0, 0, 0) rotateX(0) rotate(0deg) scale(1);
    opacity: 1;
  }
}

/* ========== 赢家高光（3D 凸起+金色脉动） ========== */
.card-winner {
  box-shadow:
    0 1vh 4vh rgba(255, 215, 0, 0.5),
    0 0 1.5vh rgba(255, 215, 0, 0.8),
    0 0 3vh rgba(255, 215, 0, 0.4);
  transform: perspective(800px) translateZ(25px) scale(1.08);
  z-index: 10;
  animation: winnerPulse3D 1.5s ease-in-out infinite;
}

@keyframes winnerPulse3D {
  0%, 100% {
    box-shadow:
      0 1vh 4vh rgba(255, 215, 0, 0.5),
      0 0 1.5vh rgba(255, 215, 0, 0.8),
      0 0 3vh rgba(255, 215, 0, 0.4);
    transform: perspective(800px) translateZ(25px) scale(1.08);
  }
  50% {
    box-shadow:
      0 1.5vh 6vh rgba(255, 215, 0, 0.7),
      0 0 2.5vh rgba(255, 215, 0, 1),
      0 0 5vh rgba(255, 215, 0, 0.6);
    transform: perspective(800px) translateZ(35px) scale(1.1);
  }
}

/* ========== 输家灰度 ========== */
.card-loser {
  filter: grayscale(0.7) brightness(0.7);
  opacity: 0.6;
}

/* ========== 牌背图案增强 ========== */
.card-back-face .card-image {
  /* 牌背 SVG 已有图案，这里确保不被拉伸 */
}
</style>

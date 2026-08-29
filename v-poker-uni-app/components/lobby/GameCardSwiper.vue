<template>
  <view class="game-swiper-wrap">
    <swiper
      class="game-swiper"
      :current="currentIndex"
      :previous-margin="'18%'"
      :next-margin="'18%'"
      :circular="true"
      :duration="400"
      :acceleration="false"
      @change="onSwiperChange"
    >
      <swiper-item v-for="(game, index) in gameList" :key="game.id">
        <view
          class="swiper-item-inner"
          :class="getCardPositionClass(index)"
        >
          <!-- 简化厚度层 -->
          <view class="card-thickness card-thickness-right"></view>
          <view class="card-thickness card-thickness-bottom"></view>

          <GameCard
            :info="game"
            :active="currentIndex === index"
            @enter="$emit('enter', $event)"
            @rules="$emit('rules', $event)"
            @click="$emit('click', $event)"
          />

          <!-- 只用静态光泽，去掉动画 -->
          <view v-if="currentIndex === index" class="card-gloss"></view>
        </view>
      </swiper-item>
    </swiper>

    <view class="swiper-dots">
      <view
        v-for="(game, index) in gameList"
        :key="game.id"
        class="dot"
        :class="{ active: currentIndex === index }"
        :style="currentIndex === index ? { background: game.color, width: '2.4vh' } : {}"
      ></view>
    </view>
  </view>
</template>

<script>
import GameCard from './GameCard.vue'

export default {
  name: 'GameCardSwiper',
  components: { GameCard },
  props: {
    gameList: {
      type: Array,
      required: true
    },
    currentIndex: {
      type: Number,
      default: 0
    }
  },
  methods: {
    onSwiperChange(e) {
      this.$emit('change', e.detail.current)
    },

    getCardPositionClass(index) {
      const n = this.gameList.length
      const diff = ((index - this.currentIndex) % n + n) % n
      if (diff === 0) return 'pos-active'
      if (diff === 1) return 'pos-right-1'
      if (diff === 2) return 'pos-right-2'
      if (diff === n - 1) return 'pos-left-1'
      if (diff === n - 2) return 'pos-left-2'
      return 'pos-far'
    }
  }
}
</script>

<style lang="scss" scoped>
.game-swiper-wrap {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1vh 0;
  perspective: 1200px;
  perspective-origin: 50% 50%;
}

.game-swiper {
  flex: 1;
  width: 100%;
}

.swiper-item-inner {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 1.5vh 0.5vh 1.5vh;
  box-sizing: border-box;
  transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 0.4s ease;
  transform-style: preserve-3d;
  will-change: transform, opacity;

  /* 阴影精简：只保留一个主阴影，不用多重drop-shadow */
  &.pos-active {
    filter: drop-shadow(0 2vh 4vh rgba(0, 0, 0, 0.5));
  }
  &.pos-left-1,
  &.pos-right-1,
  &.pos-left-2,
  &.pos-right-2,
  &.pos-far {
    filter: drop-shadow(0 1vh 2vh rgba(0, 0, 0, 0.25));
  }

  /* 用 CSS 类代替 JS 动态样式，减少重计算 */
  &.pos-active {
    transform: perspective(1200px) rotateY(0deg) translateZ(40px) scale(1);
    opacity: 1;
    z-index: 10;
  }
  &.pos-left-1 {
    transform: perspective(1200px) rotateY(18deg) translateZ(-10px) scale(0.9);
    opacity: 0.85;
    z-index: 9;
  }
  &.pos-right-1 {
    transform: perspective(1200px) rotateY(-18deg) translateZ(-10px) scale(0.9);
    opacity: 0.85;
    z-index: 9;
  }
  &.pos-left-2 {
    transform: perspective(1200px) rotateY(28deg) translateZ(-40px) scale(0.78);
    opacity: 0.55;
    z-index: 8;
  }
  &.pos-right-2 {
    transform: perspective(1200px) rotateY(-28deg) translateZ(-40px) scale(0.78);
    opacity: 0.55;
    z-index: 8;
  }
  &.pos-far {
    transform: perspective(1200px) rotateY(0deg) translateZ(-70px) scale(0.65);
    opacity: 0.3;
    z-index: 7;
  }
}

/* 厚度层简化 */
.card-thickness-right {
  position: absolute;
  top: 1.5vh;
  right: 0.2vh;
  width: 0.8vh;
  height: calc(100% - 3vh);
  background: linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, transparent 100%);
  border-radius: 0 0.8vh 0.8vh 0;
  transform: rotateY(90deg) translateX(0.4vh);
  transform-origin: left center;
  z-index: -1;
  pointer-events: none;
}

.card-thickness-bottom {
  position: absolute;
  bottom: 1.5vh;
  left: 0.2vh;
  width: calc(100% - 0.4vh);
  height: 0.8vh;
  background: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 100%);
  border-radius: 0 0 0.8vh 0.8vh;
  transform: rotateX(-90deg) translateY(0.4vh);
  transform-origin: top center;
  z-index: -1;
  pointer-events: none;
}

/* 光泽层：去掉动态扫光，只保留静态高光 */
.card-gloss {
  position: absolute;
  top: 1.5vh;
  left: 0.2vh;
  right: 0.2vh;
  bottom: 1.5vh;
  border-radius: 1.5vh;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.04) 30%,
    transparent 55%
  );
  pointer-events: none;
  z-index: 5;
  mask-image: linear-gradient(135deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 60%);
  -webkit-mask-image: linear-gradient(135deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 60%);
}

.swiper-dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1vh;
  padding: 0.6vh 0;
  flex-shrink: 0;
}

.dot {
  width: 1.2vh;
  height: 1.2vh;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;

  &.active {
    border-radius: 0.4vh;
    box-shadow: 0 0 1vh rgba(255, 215, 0, 0.3);
  }
}
</style>
<template>
  <view
    class="game-card"
    :class="{ active: active }"
    :style="{ '--game-color': info.color, '--game-gradient': info.gradient }"
    @click="onCardClick"
  >
    <!-- 游戏场景大图（清晰可见） -->
    <image
      v-if="info.sceneImage"
      class="card-bg"
      :src="info.sceneImage"
      mode="aspectFill"
    />
    <!-- 底部渐变遮罩（仅底部，保证文字可读，背景图清晰） -->
    <view class="card-overlay"></view>

    <!-- 左侧色条 -->
    <view class="card-accent"></view>

    <!-- 顶部信息区 -->
    <view class="card-top">
      <view class="card-icon-box">
        <VIcon :name="info.iconName" :size="5.2" color="#fff" />
      </view>
      <view class="card-titles">
        <text class="card-name">{{ info.name }}</text>
        <text class="card-desc">{{ info.desc }}</text>
      </view>
    </view>

    <!-- 右上角在线人数 -->
    <view class="card-online">
      <view class="online-dot"></view>
      <text class="online-text">{{ info.onlineCount }}</text>
    </view>

    <!-- 底部加入按钮 -->
    <view class="card-bottom">
      <view class="rules-btn" @click.stop="$emit('rules', info.id)">
        <VIcon name="help" :size="2.4" color="rgba(255,255,255,0.8)" />
        <text class="rules-text">规则</text>
      </view>
      <view class="enter-btn" @click.stop="$emit('enter', info.id)">
        <text class="enter-text">加入房间</text>
        <VIcon name="arrow-right" :size="2.4" color="var(--color-bg-card)" />
      </view>
    </view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'

export default {
  name: 'GameCard',
  components: { VIcon },
  props: {
    info: {
      type: Object,
      required: true
    },
    active: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    onCardClick() {
      this.$emit('click', this.info.id)
    }
  }
}
</script>

<style lang="scss" scoped>
.game-card {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 2vh;
  overflow: hidden;
  background: rgba(20, 20, 20, 0.92);
  border: 0.15vh solid rgba(255, 255, 255, 0.12);
  transition: border-color 0.3s ease,
              box-shadow 0.3s ease;
  /* 内阴影增加立体感 */
  box-shadow:
    inset 0 0.2vh 0.5vh rgba(255, 255, 255, 0.08),
    inset 0 -0.2vh 0.5vh rgba(0, 0, 0, 0.3);

  &.active {
    border-color: var(--game-color);
    box-shadow:
      0 0 2.5vh var(--game-color),
      0 0 5vh rgba(255, 200, 50, 0.15),
      inset 0 0.2vh 0.5vh rgba(255, 255, 255, 0.12),
      inset 0 -0.2vh 0.5vh rgba(0, 0, 0, 0.3);
  }

  &:active {
    opacity: 0.92;
  }
}

/* 背景图 - 清晰可见 */
.card-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 0;
}

/* 底部渐变遮罩 - 仅底部加深，顶部透明露出背景图 */
.card-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 1;
  background:
    linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.75) 100%),
    linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 30%);
}

/* 左侧色条（放大50%） */
.card-accent {
  position: absolute;
  top: 0; left: 0;
  width: 0.8vh;
  height: 100%;
  background: var(--game-color);
  z-index: 5;
  box-shadow: 0 0 1.5vh var(--game-color);
}

/* 顶部信息区（放大50%，调整间距，右侧留出在线人数空间） */
.card-top {
  position: absolute;
  top: 3vh;
  left: 3vh;
  right: 20vh;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 2.2vh;
}

.card-icon-box {
  width: 9vh;
  height: 9vh;
  border-radius: 2.2vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 0.15vh solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  box-shadow: 0 0.8vh 2.2vh rgba(0,0,0,0.4);
}

.card-titles {
  display: flex;
  flex-direction: column;
  gap: 0.5vh;
  min-width: 0;
  flex: 1;
}

.card-name {
  font-size: var(--text-xl);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0.3vh 0.9vh rgba(0,0,0,0.8);
  letter-spacing: 0.08vh;
  line-height: 1.2;
}

.card-desc {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 0.15vh 0.45vh rgba(0,0,0,0.8);
  line-height: 1.3;
}

/* 右上角在线人数（放大50%） */
.card-online {
  position: absolute;
  top: 3vh;
  right: 3vh;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 0.9vh;
  padding: 1vh 1.8vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 3vh;
  border: 0.15vh solid rgba(74, 222, 128, 0.3);
}

.online-dot {
  width: 1.4vh;
  height: 1.4vh;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 1.2vh var(--color-success);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.online-text {
  font-size: var(--text-sm);
  color: var(--color-success);
  font-weight: 600;
}

/* 底部按钮区（放大50%，调整间距） */
.card-bottom {
  position: absolute;
  bottom: 3vh;
  left: 3vh;
  right: 3vh;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.5vh;
}

.rules-btn {
  display: flex;
  align-items: center;
  gap: 0.8vh;
  padding: 1.8vh 2.5vh;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 0.15vh solid rgba(255, 255, 255, 0.2);
  border-radius: 1.5vh;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.93);
    background: rgba(255, 255, 255, 0.18);
  }
}

.rules-text {
  font-size: var(--text-base);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.enter-btn {
  display: flex;
  align-items: center;
  gap: 0.9vh;
  padding: 1.8vh 3.8vh;
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  border-radius: 1.5vh;
  box-shadow:
    0 0.8vh 2.2vh rgba(255, 215, 0, 0.4),
    inset 0 0.15vh 0 rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.93);
    box-shadow: 0 0.3vh 1.2vh rgba(255, 215, 0, 0.3);
  }
}

.enter-text {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-bg-card);
  letter-spacing: 0.08vh;
}
</style>

<template>
  <view class="join-modal-overlay" @click="onOverlayClick">
    <view class="join-modal glass" @click.stop>
      <!-- 顶部装饰条 -->
      <view class="modal-top-bar"></view>

      <!-- 头部 -->
      <view class="modal-header">
        <view class="header-icon">
          <VIcon name="search" :size="3" color="var(--color-gold)" />
        </view>
        <text class="modal-title">加入房间</text>
        <text class="modal-subtitle">输入房间号和密码快速加入</text>
      </view>

      <!-- 表单 -->
      <view class="modal-body">
        <!-- 房间号 -->
        <view class="form-group">
          <view class="form-label-row">
            <VIcon name="cards" :size="1.8" color="rgba(255,255,255,0.5)" />
            <text class="form-label">房间号</text>
          </view>
          <view class="input-wrap" :class="{ focus: focusField === 'code' }">
            <input
              class="form-input"
              type="number"
              v-model="roomCode"
              placeholder="请输入6位房间号"
              placeholder-class="input-placeholder"
              maxlength="6"
              @focus="focusField = 'code'"
              @blur="focusField = ''"
            />
            <view v-if="roomCode" class="input-clear" @click="roomCode = ''">
              <VIcon name="close" :size="1.5" color="rgba(255,255,255,0.4)" />
            </view>
          </view>
        </view>

        <!-- 房间密码 -->
        <view class="form-group">
          <view class="form-label-row">
            <VIcon name="lock" :size="1.8" color="rgba(255,255,255,0.5)" />
            <text class="form-label">房间密码</text>
            <text class="form-optional">（选填）</text>
          </view>
          <view class="input-wrap" :class="{ focus: focusField === 'password' }">
            <input
              class="form-input"
              :password="!showPassword"
              v-model="roomPassword"
              placeholder="无密码可不填"
              placeholder-class="input-placeholder"
              maxlength="20"
              @focus="focusField = 'password'"
              @blur="focusField = ''"
            />
            <view class="input-suffix" @click="showPassword = !showPassword">
              <VIcon :name="showPassword ? 'eye' : 'eye-off'" :size="1.8" color="rgba(255,255,255,0.4)" />
            </view>
          </view>
        </view>

        <!-- 错误提示 -->
        <view v-if="errorMsg" class="error-tip">
          <VIcon name="warning" :size="1.5" color="var(--color-danger)" />
          <text>{{ errorMsg }}</text>
        </view>
      </view>

      <!-- 底部按钮 -->
      <view class="modal-footer">
        <view class="btn btn-cancel" @click="$emit('close')">
          <text>取消</text>
        </view>
        <view
          class="btn btn-join"
          :class="{ disabled: !canJoin || isJoining }"
          @click="onJoin"
        >
          <view v-if="isJoining" class="join-spinner"></view>
          <text>{{ isJoining ? '加入中...' : '加入房间' }}</text>
          <VIcon v-if="!isJoining" name="arrow-right" :size="1.8" color="var(--color-bg-card)" />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'
import { joinRoom } from '../../api/rooms.js'

export default {
  name: 'JoinRoomModal',
  components: { VIcon },
  data() {
    return {
      roomCode: '',
      roomPassword: '',
      showPassword: false,
      focusField: '',
      isJoining: false,
      errorMsg: ''
    }
  },
  computed: {
    canJoin() {
      return this.roomCode && this.roomCode.length >= 4
    }
  },
  methods: {
    onOverlayClick() {
      if (!this.isJoining) {
        this.$emit('close')
      }
    },

    async onJoin() {
      if (!this.canJoin || this.isJoining) return

      this.errorMsg = ''
      this.isJoining = true

      try {
        const data = await joinRoom(this.roomCode.trim(), this.roomPassword.trim(), false)
        uni.showToast({ title: '加入成功', icon: 'success' })
        this.$emit('close')
        setTimeout(() => {
          const roomId = data.room?.id || data.roomId || data.id
          uni.navigateTo({ url: `/pages/room/room?id=${roomId}` })
        }, 600)
      } catch (e) {
        this.errorMsg = e.error || e.message || '加入失败，请检查房间号和密码'
        uni.vibrateShort && uni.vibrateShort({ type: 'heavy' })
      } finally {
        this.isJoining = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.join-modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 500;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: fadeIn 0.2s ease;
  padding: 0;
  box-sizing: border-box;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.join-modal {
  width: 100%;
  max-width: 100%;
  max-height: 85vh;
  background: rgba(28, 28, 30, 0.95);
  border-radius: 3vh 3vh 0 0;
  border: 0.1vh solid rgba(255, 255, 255, 0.12);
  border-bottom: none;
  overflow: hidden;
  box-shadow:
    0 -2vh 6vh rgba(0, 0, 0, 0.5),
    0 0 0 0.1vh rgba(255, 255, 255, 0.05) inset;
  animation: drawerIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 横屏适配：左右分栏抽屉 */
@media (orientation: landscape) and (min-width: 600px) {
  .join-modal-overlay {
    align-items: center;
    justify-content: flex-end;
    padding-right: env(safe-area-inset-right);
  }
  .join-modal {
    width: 45vw;
    max-width: 500px;
    max-height: 90vh;
    border-radius: 3vh 0 0 3vh;
    border-right: none;
    animation: drawerRightIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    padding-bottom: 0;
    padding-right: env(safe-area-inset-right);
  }
}

@keyframes drawerIn {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes drawerRightIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 抽屉顶部把手 */
.join-modal::before {
  content: '';
  position: absolute;
  top: 1vh;
  left: 50%;
  transform: translateX(-50%);
  width: 6vh;
  height: 0.5vh;
  background: rgba(255,255,255,0.2);
  border-radius: 0.3vh;
  z-index: 10;
}

.glass {
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
}

/* 顶部装饰条 */
.modal-top-bar {
  height: 0.4vh;
  background: linear-gradient(90deg, var(--color-gold), var(--color-gold-dark), var(--color-gold));
  background-size: 200% 100%;
  animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* 头部 */
.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3vh 3vh 2vh;
}

.header-icon {
  width: 7vh;
  height: 7vh;
  border-radius: 50%;
  background: rgba(255, 215, 0, 0.12);
  border: 0.1vh solid rgba(255, 215, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5vh;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 800;
  color: #fff;
  margin-bottom: 0.5vh;
  letter-spacing: 0.1vh;
}

.modal-subtitle {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
}

/* 表单 */
.modal-body {
  padding: 0 3vh 2vh;
}

.form-group {
  margin-bottom: 2vh;
}

.form-label-row {
  display: flex;
  align-items: center;
  gap: 0.6vh;
  margin-bottom: 0.8vh;
}

.form-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.form-optional {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
  margin-left: 0.3vh;
}

.input-wrap {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border: 0.1vh solid rgba(255, 255, 255, 0.1);
  border-radius: 1.2vh;
  padding: 0 1.5vh;
  transition: all 0.2s ease;

  &.focus {
    border-color: rgba(255, 215, 0, 0.5);
    background: rgba(255, 215, 0, 0.06);
    box-shadow: 0 0 0 0.3vh rgba(255, 215, 0, 0.1);
  }
}

.form-input {
  flex: 1;
  height: 5.5vh;
  font-size: var(--text-sm);
  color: #fff;
  background: transparent;
  letter-spacing: 0.2vh;
}

.input-placeholder {
  color: rgba(255, 255, 255, 0.25);
  letter-spacing: 0;
}

.input-clear,
.input-suffix {
  width: 4vh;
  height: 4vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 错误提示 */
.error-tip {
  display: flex;
  align-items: center;
  gap: 0.6vh;
  padding: 1vh 1.5vh;
  background: rgba(248, 113, 113, 0.1);
  border: 0.1vh solid rgba(248, 113, 113, 0.2);
  border-radius: 0.8vh;
  font-size: var(--text-xs);
  color: var(--color-danger);
  margin-top: 1vh;
}

/* 底部按钮 */
.modal-footer {
  display: flex;
  gap: 1.5vh;
  padding: 2vh 3vh 3vh;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6vh;
  height: 5.5vh;
  border-radius: 1.2vh;
  font-size: var(--text-xs);
  font-weight: 700;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.97);
  }

  &.btn-cancel {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    border: 0.1vh solid rgba(255, 255, 255, 0.1);
  }

  &.btn-join {
    background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
    color: var(--color-bg-card);
    box-shadow: 0 0.5vh 2vh rgba(255, 215, 0, 0.3);

    &.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
  }
}

.join-spinner {
  width: 2vh;
  height: 2vh;
  border: 0.25vh solid rgba(26, 26, 26, 0.2);
  border-top-color: var(--color-bg-card);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

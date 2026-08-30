<template>
  <ImmersivePage :show-header="false" page-class="register-page">
    <template #background>
      <view class="bg-decoration">
        <view class="bg-image" :style="{ backgroundImage: 'url(' + cdnUrl('/static/login-background.jpg') + ')' }"></view>
        <view class="bg-gradient"></view>
        <view class="bg-vignette"></view>
        <view class="bg-particles">
          <view v-for="(p, i) in particles" :key="i" class="particle" :style="p.style"></view>
        </view>
      </view>
    </template>

    <view class="auth-content">
      <!-- 左侧：只放 Logo -->
      <view class="brand-area">
        <image class="brand-logo" :src="cdnUrl('/static/logo.png')" mode="aspectFit"></image>
      </view>

      <!-- 右侧表单卡 -->
      <view class="form-card">
        <view class="form-header">
          <text class="form-title">创建账户</text>
          <text class="form-subtitle">填写注册信息，开启 V-POKER 竞技之旅！</text>
        </view>

        <!-- 用普通 view 替代 scroll-view，避免 flex 高度计算问题 -->
        <view class="form-body">
          <view class="form-group">
            <text class="form-label">账号</text>
            <view class="input-wrapper">
              <VIcon name="user" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                type="text"
                v-model="form.account"
                placeholder="至少 3 个字符"
                placeholder-class="input-placeholder"
                :disabled="isLoading"
                @confirm="handleRegister"
              />
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">密码</text>
            <view class="input-wrapper">
              <VIcon name="lock" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                :password="!showPassword"
                v-model="form.password"
                placeholder="至少 6 位"
                placeholder-class="input-placeholder"
                :disabled="isLoading"
                @confirm="handleRegister"
              />
              <view class="input-toggle" @click="showPassword = !showPassword">
                <VIcon :name="showPassword ? 'eye-off' : 'eye'" :size="3" color="rgba(255,255,255,0.5)" />
              </view>
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">确认密码</text>
            <view class="input-wrapper">
              <VIcon name="lock" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                :password="!showConfirmPassword"
                v-model="form.confirmPassword"
                placeholder="再次输入密码"
                placeholder-class="input-placeholder"
                :disabled="isLoading"
                @confirm="handleRegister"
              />
              <view class="input-toggle" @click="showConfirmPassword = !showConfirmPassword">
                <VIcon :name="showConfirmPassword ? 'eye-off' : 'eye'" :size="3" color="rgba(255,255,255,0.5)" />
              </view>
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">昵称（选填）</text>
            <view class="input-wrapper">
              <VIcon name="user" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                type="text"
                v-model="form.nickname"
                placeholder="默认使用账号"
                placeholder-class="input-placeholder"
                :disabled="isLoading"
                @confirm="handleRegister"
              />
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">安全码（选填）</text>
            <view class="input-wrapper">
              <VIcon name="lock" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                :password="!showSecurityCode"
                v-model="form.securityCode"
                placeholder="请输入安全码"
                placeholder-class="input-placeholder"
                :disabled="isLoading"
                @confirm="handleRegister"
              />
              <view class="input-toggle" @click="showSecurityCode = !showSecurityCode">
                <VIcon :name="showSecurityCode ? 'eye-off' : 'eye'" :size="3" color="rgba(255,255,255,0.5)" />
              </view>
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">邀请码</text>
            <view class="input-wrapper">
              <VIcon name="more" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                type="text"
                v-model="form.inviteCode"
                placeholder="请输入上级提供的邀请码"
                placeholder-class="input-placeholder"
                :disabled="isLoading"
                @confirm="handleRegister"
              />
            </view>
          </view>

          <view v-if="error" class="form-error">
            <VIcon name="warning" :size="2.7" color="var(--color-danger)" />
            <text class="error-text">{{ error }}</text>
          </view>
        </view>

        <view class="form-footer">
          <view class="btn-primary touch-active" :class="{ loading: isLoading }" @click="handleRegister">
            <view v-if="isLoading" class="btn-spinner touch-active"></view>
            <text v-else class="btn-text touch-active">注 册</text>
          </view>
          <view class="form-link-row">
            <text class="form-link-hint">已有账号？</text>
            <text class="form-link" @click="goLogin">返回登录</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部版权 -->
    <view class="auth-footer">
      <text class="copyright">© 2026 V-POKER · 仅供娱乐竞技 · 理性游戏 · 禁止未成年人参与</text>
    </view>
  </ImmersivePage>
</template>

<script>
import { cdnUrl } from '../../utils/cdn.js'
import { register } from '../../api/auth.js'
import { initUserState, updateUserInfo } from '../../store/user.js'

export default {
  data() {
    const particles = Array.from({ length: 20 }, (_, i) => ({
      style: {
        left: ((i * 5 + (i * 3) % 7) % 100) + '%',
        top: ((i * 7 + (i * 5) % 9) % 100) + '%',
        width: (2 + (i % 5)) + 'px',
        height: (2 + (i % 5)) + 'px',
        animationDelay: ((i * 0.3) % 5) + 's',
        animationDuration: (3 + (i % 4)) + 's',
      }
    }))
    return {
      particles,
      form: {
        account: '',
        password: '',
        confirmPassword: '',
        nickname: '',
        securityCode: '',
        inviteCode: '',
      },
      showPassword: false,
      showConfirmPassword: false,
      showSecurityCode: false,
      isLoading: false,
      error: '',
    }
  },
  methods: {
    cdnUrl,
    validateForm() {
      const account = this.form.account.trim()
      const inviteCode = this.form.inviteCode.trim()

      if (!account) {
        this.error = '请输入账号'
        return false
      }
      if (account.length < 3) {
        this.error = '账号至少需要 3 个字符'
        return false
      }
      if (!this.form.password) {
        this.error = '请输入密码'
        return false
      }
      if (this.form.password.length < 6) {
        this.error = '密码至少需要 6 位'
        return false
      }
      if (!this.form.confirmPassword) {
        this.error = '请确认密码'
        return false
      }
      if (this.form.password !== this.form.confirmPassword) {
        this.error = '两次输入的密码不一致'
        return false
      }
      if (!inviteCode) {
        this.error = '请输入邀请码'
        return false
      }

      this.error = ''
      return true
    },

    async handleRegister() {
      if (this.isLoading || !this.validateForm()) return

      this.isLoading = true
      this.error = ''

      try {
        const data = await register({
          account: this.form.account.trim(),
          password: this.form.password,
          confirmPassword: this.form.confirmPassword,
          nickname: this.form.nickname.trim() || undefined,
          securityCode: this.form.securityCode.trim() || undefined,
          inviteCode: this.form.inviteCode.trim(),
        })

        if (data.token) {
          initUserState()
          updateUserInfo(data.user)
          uni.showToast({ title: '注册成功', icon: 'success', duration: 1200 })
          setTimeout(() => uni.reLaunch({ url: '/pages/lobby/lobby' }), 1000)
        } else {
          uni.showToast({ title: '注册成功，请登录', icon: 'success', duration: 1200 })
          setTimeout(() => uni.redirectTo({ url: '/pages/login/login' }), 1000)
        }
      } catch (e) {
        this.error = e.error || '注册失败，请稍后重试'
      } finally {
        this.isLoading = false
      }
    },

    goLogin() {
      uni.redirectTo({ url: '/pages/login/login' })
    },
  },
}
</script>

<style lang="scss">
.register-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* ===== 背景 ===== */
.bg-decoration {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 0;
  pointer-events: none;
}

.bg-image {
  position: absolute;
  width: 100%; height: 100%;
  background-color: #080705;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
}

.bg-gradient {
  position: absolute;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, rgba(8,8,14,0.08) 0%, rgba(8,8,14,0.2) 54%, rgba(6,6,12,0.55) 100%);
}

.bg-vignette {
  position: absolute;
  width: 100%; height: 100%;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%);
}

.bg-particles {
  position: absolute;
  width: 100%; height: 100%;
}

.particle {
  position: absolute;
  background: rgba(255, 215, 0, 0.5);
  border-radius: 50%;
  animation: float-particle 5s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
}

@keyframes float-particle {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
  50% { transform: translateY(-20px) translateX(8px); opacity: 0.7; }
}

/* ===== 主内容 ===== */
.auth-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: calc(3vh + var(--safe-top, 0px)) calc(3vw + var(--safe-right, 0px)) calc(5vh + var(--safe-bottom, 0px)) calc(3vw + var(--safe-left, 0px));
  gap: clamp(20px, 4vw, 60px);
  box-sizing: border-box;
}

/* ===== 左侧：只放 Logo ===== */
.brand-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: clamp(10px, 2vw, 30px);
}

.brand-logo {
  width: clamp(180px, 22vw, 300px);
  height: clamp(180px, 22vw, 300px);
  object-fit: contain;
  margin-right: clamp(30px, 6vw, 80px);
  filter: drop-shadow(0 6px 18px rgba(0,0,0,0.55));
}

/* ===== 右侧表单卡 ===== */
.form-card {
  flex: 0 0 320px;
  width: 320px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 18px 20px 16px;
  box-sizing: border-box;
  background: rgba(22, 22, 32, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  backdrop-filter: blur(20px);
}

.form-header {
  flex: 0 0 auto;
  margin-bottom: 10px;
}

.form-title {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  line-height: 1.4;
  margin-bottom: 2px;
}

.form-subtitle {
  display: block;
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  line-height: 1.5;
}

/* 直接用普通 view + overflow-y: auto，不依赖 scroll-view 的 flex 计算 */
.form-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding-right: 2px; /* 给滚动条留空间 */
  margin-bottom: 4px;
}

.form-group {
  margin-bottom: 10px;
}

.form-label {
  display: block;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 4px;
  font-weight: 500;
}

.input-wrapper {
  display: flex;
  align-items: center;
  height: 46px;
  min-height: 46px;
  padding: 0 14px;
  gap: 10px;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: rgba(255,215,0,0.6);
  background: rgba(255,215,0,0.05);
  box-shadow: 0 0 0 3px rgba(255,215,0,0.1);
}

.input-field {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none !important;
  background: transparent !important;
  font-size: 15px;
  color: #fff;
  padding: 0 !important;
  outline: none;
  box-sizing: border-box;
}

.input-placeholder {
  color: rgba(255,255,255,0.3);
  font-size: 15px;
}

.input-toggle {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.input-toggle:active {
  background: rgba(255,255,255,0.08);
}

.form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(255,77,79,0.08);
  border: 1px solid rgba(255,77,79,0.25);
  border-radius: 8px;
}

.error-text {
  font-size: 13px;
  color: #ff6b6b;
}

.form-footer {
  flex: 0 0 auto;
  margin-top: 6px;
}

.btn-primary {
  width: 100%;
  height: 46px;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-radius: 12px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(255,215,0,0.25);
}

.btn-primary:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(255,215,0,0.2);
}

.btn-primary.loading {
  opacity: 0.7;
  pointer-events: none;
}

.btn-text {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 4px;
}

.btn-spinner {
  width: 22px;
  height: 22px;
  border: 2.5px solid rgba(26,26,26,0.2);
  border-top-color: #1a1a1a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.form-link-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
}

.form-link-hint {
  font-size: 13px;
  color: rgba(255,255,255,0.45);
}

.form-link {
  font-size: 13px;
  color: #FFD700;
  font-weight: 600;
}

/* ===== 底部版权 ===== */
.auth-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 24px;
  padding-bottom: calc(10px + var(--safe-bottom, 0px));
  text-align: center;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(transparent, rgba(0,0,0,0.5));
}

.copyright {
  font-size: 12px;
  color: rgba(255,255,255,0.35);
  line-height: 1.5;
  max-width: 600px;
  margin: 0 auto;
  display: block;
}
</style>
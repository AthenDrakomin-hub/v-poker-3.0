<template>
  <ImmersivePage :show-header="false" page-class="login-page">
    <!-- 背景装饰 -->
    <template #background>
      <view class="bg-decoration">
        <view class="bg-image" :style="{ backgroundImage: 'url(/static/login-background.jpg)' }"></view>
        <view class="bg-gradient"></view>
        <view class="bg-vignette"></view>
        <view class="bg-particles">
          <view v-for="(p, i) in particles" :key="i" class="particle" :style="p.style"></view>
        </view>
      </view>
    </template>

    <!-- 主内容 -->
    <view class="auth-content">
      <!-- 左侧：只放 Logo -->
      <view class="brand-area">
        <image class="brand-logo" src="/static/logo.png" mode="aspectFit"></image>
      </view>

      <!-- 右侧表单卡 -->
      <view class="form-card">
        <view class="form-header">
          <text class="form-title">欢迎回来</text>
          <text class="form-subtitle">登录您的账户开启 V-POKER 竞技之旅！</text>
        </view>

        <view class="form-body">
          <view class="form-group">
            <text class="form-label">账号</text>
            <view class="input-wrapper">
              <VIcon name="user" :size="3" color="rgba(255,255,255,0.5)" />
              <input
                class="input-field"
                type="text"
                v-model="form.account"
                placeholder="请输入账号"
                placeholder-class="input-placeholder"
                :disabled="isLoading || isAutoLogining"
                maxlength="20"
                @confirm="handleLogin"
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
                placeholder="请输入密码"
                placeholder-class="input-placeholder"
                :disabled="isLoading || isAutoLogining"
                maxlength="20"
                @confirm="handleLogin"
              />
              <view class="input-toggle" @click="showPassword = !showPassword">
                <VIcon :name="showPassword ? 'eye-off' : 'eye'" :size="3" color="rgba(255,255,255,0.5)" />
              </view>
            </view>
          </view>

          <view class="agreement-section" @click="toggleAgreement">
            <view class="agreement-checkbox" :class="{ checked: agreedToTerms }">
              <VIcon v-if="agreedToTerms" name="check" :size="2.5" color="#1a1a1a" />
            </view>
            <text class="agreement-text">
              我已阅读并同意
              <text class="agreement-link" @click.stop="showAgreement('user')">《用户协议》</text>
              和
              <text class="agreement-link" @click.stop="showAgreement('privacy')">《隐私政策》</text>
            </text>
          </view>

          <view v-if="error" class="form-error">
            <VIcon name="warning" :size="2.7" color="var(--color-danger)" />
            <text class="error-text">{{ error }}</text>
          </view>
        </view>

        <view class="form-footer">
          <view
            class="btn-primary"
            :class="{ loading: isLoading || isAutoLogining }"
            @click="handleLogin"
          >
            <view v-if="isLoading || isAutoLogining" class="btn-spinner"></view>
            <text v-else class="btn-text">登 录</text>
          </view>
          <view class="form-link-row">
            <text class="form-link-hint">还没有账号？</text>
            <text class="form-link" @click="goRegister">立即注册</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部版权 -->
    <view class="auth-footer">
      <text class="copyright">© 2026 V-POKER · 仅供娱乐竞技 · 理性游戏 · 禁止未成年人参与</text>
    </view>
  </ImmersivePage>

  <!-- 协议弹窗 -->
  <view v-if="showAgreementModal" class="agreement-modal" @click="closeAgreement">
    <view class="agreement-modal-content" @click.stop>
      <view class="agreement-modal-header">
        <text class="agreement-modal-title">{{ agreementTitle }}</text>
        <view class="agreement-modal-close" @click="closeAgreement">
          <VIcon name="close" :size="3" color="rgba(255,255,255,0.6)" />
        </view>
      </view>
      <scroll-view class="agreement-modal-body" scroll-y>
        <text class="agreement-modal-text">{{ agreementContent }}</text>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import { login, initUserState, fetchUserInfo, userState } from '../../store/user.js'
import { USER_AGREEMENT, PRIVACY_POLICY } from '../../utils/agreements.js'

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
      userState,
      particles,
      form: { account: '', password: '' },
      showPassword: false,
      isLoading: false,
      isAutoLogining: false,
      error: '',
      agreedToTerms: true,
      showAgreementModal: false,
      agreementTitle: '',
      agreementContent: '',
    }
  },
  onLoad() {
    initUserState()
    const token = uni.getStorageSync('vpoker_token')
    if (token) this.autoLogin()
  },
  methods: {
    async autoLogin() {
      if (this.isAutoLogining) return
      this.isAutoLogining = true
      try {
        await fetchUserInfo()
        const role = this.userState?.role || 'player'
        uni.reLaunch({ url: role === 'customer_service' ? '/pages/customer-service/customer-service' : '/pages/lobby/lobby' })
      } catch (e) {
        console.log('[Login] 自动登录失败')
      } finally {
        this.isAutoLogining = false
      }
    },
    async handleLogin() {
      if (!this.form.account.trim()) { this.error = '请输入账号'; return }
      if (!this.form.password) { this.error = '请输入密码'; return }
      if (!this.agreedToTerms) { this.error = '请先阅读并同意用户协议和隐私政策'; return }
      if (this.isAutoLogining) return

      this.isLoading = true
      this.error = ''
      try {
        await login(this.form.account.trim(), this.form.password)
        uni.showToast({ title: '登录成功', icon: 'success', duration: 1500 })
        setTimeout(() => {
          const role = this.userState?.role || 'player'
          uni.reLaunch({ url: role === 'customer_service' ? '/pages/customer-service/customer-service' : '/pages/lobby/lobby' })
        }, 1000)
      } catch (e) {
        this.error = e.error || '登录失败，请检查账号密码'
      } finally {
        this.isLoading = false
      }
    },
    goRegister() {
      uni.navigateTo({ url: '/pages/register/register' })
    },
    toggleAgreement() {
      this.agreedToTerms = !this.agreedToTerms
      if (this.error) this.error = ''
    },
    showAgreement(type) {
      this.agreementTitle = type === 'user' ? '用户协议' : '隐私政策'
      this.agreementContent = type === 'user' ? USER_AGREEMENT : PRIVACY_POLICY
      this.showAgreementModal = true
    },
    closeAgreement() {
      this.showAgreementModal = false
    },
  },
}
</script>

<style lang="scss">
.login-page {
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
  /* 👇 左移对齐背景图人物中心，数值越大越靠左 */
  margin-right: clamp(30px, 6vw, 80px);
  filter: drop-shadow(0 6px 18px rgba(0,0,0,0.55));
}

/* ===== 右侧表单卡 ===== */
.form-card {
  flex: 0 0 320px;
  width: 320px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 18px;
  box-sizing: border-box;
  background: rgba(22, 22, 32, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  backdrop-filter: blur(20px);
}

.form-header {
  flex: 0 0 auto;
  margin-bottom: 12px;
}

.form-title {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.4;
  margin-bottom: 2px;
}

.form-subtitle {
  display: block;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  line-height: 1.5;
}

.form-body {
  flex: 0 0 auto;
}

.form-group {
  margin-bottom: 12px;
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
  height: 48px;
  min-height: 48px;
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

.agreement-section {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 4px 0;
  margin-top: 2px;
}

.agreement-checkbox {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1.5px solid rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.agreement-checkbox.checked {
  background: #FFD700;
  border-color: #FFD700;
}

.agreement-text {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  line-height: 18px;
  color: rgba(255,255,255,0.55);
}

.agreement-link {
  color: #FFD700;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
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
  margin-top: 12px;
}

.btn-primary {
  width: 100%;
  height: 48px;
  min-height: 48px;
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
  margin-top: 10px;
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

/* ===== 协议弹窗 ===== */
.agreement-modal {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.75);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(16px + var(--safe-top, 0px)) calc(16px + var(--safe-right, 0px)) calc(16px + var(--safe-bottom, 0px)) calc(16px + var(--safe-left, 0px));
  box-sizing: border-box;
}

.agreement-modal-content {
  width: 100%;
  max-width: min(80vw, 560px);
  max-height: 82vh;
  height: auto;
  display: flex;
  flex-direction: column;
  background: rgba(22,22,32,0.98);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  overflow: hidden;
}

.agreement-modal-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.agreement-modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
}

.agreement-modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.agreement-modal-close:active {
  background: rgba(255,255,255,0.08);
}

.agreement-modal-body {
  flex: 1 1 auto;
  height: 0;
  min-height: 0;
  padding: 16px 20px;
  box-sizing: border-box;
  overflow: hidden;
}

.agreement-modal-text {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 520px;
  margin: 0 auto;
  display: block;
}
</style>
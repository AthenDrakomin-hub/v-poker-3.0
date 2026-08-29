<script>
import { initUserState, userState, fetchUserInfo } from './store/user.js'
import { canAccessPage } from './utils/authGuard.js'
import { initHaptic, setVibrationEnabled } from './utils/haptic.js'
import { initFontScale } from './utils/fontScale.js'
import { getSoundManager, getVoiceManager } from './utils/sound.js'
import { initAppSettings } from './utils/appSettings.js'
import { initNetworkMonitor } from './utils/network.js'

export default {
  onLaunch: function() {
    // 初始化网络状态监听（离线提示/恢复自动刷新）
    initNetworkMonitor()

    const appSettings = initAppSettings()
    // 初始化用户状态（从本地存储恢复Token）
    initUserState()

    // 如果已有Token，拉取用户信息（获取角色用于权限判断）
    if (userState.isLoggedIn) {
      fetchUserInfo().catch((e) => {
        console.warn('[App] 自动获取用户信息失败', e)
      })
    }

    // iOS 触觉反馈初始化 + 震动设置同步
    initHaptic()
    try {
      const savedSettings = uni.getStorageSync('vpoker_settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        if (typeof parsed.vibrationEnabled === 'boolean') {
          setVibrationEnabled(parsed.vibrationEnabled)
        }
      }
    } catch (e) {
      console.warn('[App] 读取震动设置失败', e)
    }

    // 字体缩放初始化（从本地存储读取并广播）
    const initScale = initFontScale()
    // 同步到全局 CSS 变量
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.style.setProperty('--font-scale', initScale)
      }
    } catch (e) {
      console.warn('[App] 字体缩放初始化失败', e)
    }

    // 音效管理器初始化（预加载常用音效）
    try {
      const theme = appSettings.theme
      const soundEnabled = appSettings.soundEnabled
      const musicEnabled = appSettings.musicEnabled
      const soundVolume = appSettings.soundVolume / 100
      const sm = getSoundManager()
      sm.init(theme)
      sm.setEnabled(soundEnabled)
      sm.setVolume(soundVolume)
      if (musicEnabled) sm.playBackground()

      // 语音包管理器初始化（预加载5套VIP头像语音）
      const vm = getVoiceManager()
      vm.init()
      vm.setEnabled(soundEnabled)
    } catch (e) {
      console.warn('[App] 音效初始化失败', e)
    }

    // 横屏锁定 + 全屏沉浸。iOS 方向由 Info.plist 决定，运行时 lockOrientation 作为保险。
    // #ifdef APP-PLUS
    let landscapeRetryCount = 0
    const lockLandscape = () => {
      try {
        if (typeof plus !== 'undefined' && plus.screen) {
          // iOS 优先用 landscape-primary，兼容部分版本
          plus.screen.lockOrientation('landscape-primary')
          setTimeout(() => {
            try { plus.screen.lockOrientation('landscape') } catch (e) {}
          }, 100)
          plus.navigator.setFullscreen(true)
        }
      } catch (e) {
        console.warn('[App] 横屏锁定失败', e)
      }
      // 最多重试 5 次，间隔递增，确保 plus 就绪后能锁定
      if (landscapeRetryCount < 5) {
        landscapeRetryCount++
        setTimeout(lockLandscape, 300 * landscapeRetryCount)
      }
    }
    const initImmersive = () => {
      try {
        plus.screen.lockOrientation('landscape-primary')
        plus.navigator.setFullscreen(true)
        plus.navigator.setStatusBarBackground('#000000')
        // iOS 状态栏文字设为白色（深色背景必须，否则黑字不可见）
        try { plus.navigator.setStatusBarStyle('light') } catch (e) {}
        // iOS 内存警告监听：plus 就绪后注册，避免 plus 未注入时闪退
        plus.globalEvent.addEventListener('memorywarning', () => {
          console.warn('[iOS] 内存警告，触发全局降级')
          uni.$emit('app:memoryWarning')
          try {
            plus.cache.clear(() => {})
          } catch (e) {
            console.warn('[App] 清理缓存失败:', e)
          }
        })
      } catch (e) {
        console.warn('[App] 沉浸式初始化失败', e)
      }
    }
    if (typeof plus !== 'undefined') {
      initImmersive()
    }
    // 原生环境可能稍晚完成初始化，启动多重重试
    lockLandscape()
    // #endif

    // 全局路由拦截：权限校验
    const interceptMethods = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab']
    interceptMethods.forEach(method => {
      uni.addInterceptor(method, {
        invoke(args) {
          // 提取路径（去掉query参数）
          const path = args.url ? args.url.split('?')[0] : ''
          if (path && !canAccessPage(path)) {
            uni.showToast({
              title: '无权限访问该页面',
              icon: 'none',
              duration: 2000,
            })
            return false // 阻止跳转
          }
          return true
        },
        fail(err) {
          console.warn(`[AuthGuard] ${method} 拦截失败:`, err)
        }
      })
    })
  },
  onShow: function() {
    // #ifdef APP-PLUS
    try {
      if (typeof plus !== 'undefined' && plus.screen) {
        plus.screen.lockOrientation('landscape-primary')
        setTimeout(() => {
          try { plus.screen.lockOrientation('landscape') } catch (e) {}
        }, 100)
        plus.navigator.setFullscreen(true)
      }
    } catch(e) {
      console.warn('[App] 横屏锁定失败:', e)
    }
    // #endif
  },
  onHide: function() {
  }
}
</script>

<style>
/* 全局横屏适配规范（iOS优先，iPhone 11横屏1792×828基准） */
@import "@/styles/landscape.css";

/* ===== 自定义字体声明（子集化版本，体积减少87%） ===== */
@font-face {
  font-family: 'ZCOOLXiaoWei';
  src: url('~@/static/fonts/subset/ZCOOLXiaoWei-Regular-subset.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MaShanZheng';
  src: url('~@/static/fonts/subset/MaShanZheng-Regular-subset.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'ShareTechMono';
  src: url('~@/static/fonts/subset/ShareTechMono-Regular-subset.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrainsMono';
  src: url('~@/static/fonts/subset/JetBrainsMono-Regular-subset.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrainsMono';
  src: url('~@/static/fonts/subset/JetBrainsMono-Bold-subset.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'PlayfairDisplay';
  src: url('~@/static/fonts/subset/PlayfairDisplay-Regular-subset.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* 全局样式重置 */
/* 根元素定义字体缩放变量（JS动态设置，page继承） */
:root {
  --font-scale: 1;
  /* 主题变量默认值（JS applyTheme 会覆盖，此处为启动前兜底） */
  --color-bg: #0A0A0A;
  --color-bg-card: #1A1A2E;
  --color-text: #E8E8E8;
  --color-text-muted: rgba(255,255,255,0.6);
  --color-gold-dark: #FFA500;
  --color-danger: #FF6B6B;
  --color-success: #4ADE80;
  --color-info: #60A5FA;
  --color-border: rgba(255,215,0,0.3);
  --color-gold: #FFD700;
  --theme-primary: #FFD700;
  --theme-secondary: #FFA500;
  --theme-bg: #0A0A0A;
  --theme-table: #1a0a0a;
  --theme-table-border: #8B0000;
  --theme-text: #E8E8E8;
}
page {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  /* 全局文字尺寸变量（已整体放大约15%，乘以字体缩放） */
  --text-xs: clamp(10px, calc(1.5vh * var(--font-scale)), 16px);
  --text-sm: clamp(12px, calc(1.8vh * var(--font-scale)), 18px);
  --text-base: clamp(14px, calc(2.1vh * var(--font-scale)), 22px);
  --text-lg: clamp(16px, calc(2.6vh * var(--font-scale)), 26px);
  --text-xl: clamp(18px, calc(3.2vh * var(--font-scale)), 32px);
  --text-2xl: clamp(22px, calc(4vh * var(--font-scale)), 40px);
  --text-3xl: clamp(28px, calc(5vh * var(--font-scale)), 52px);
}

/* 通用工具类 */
.flex { display: flex; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-col { display: flex; flex-direction: column; }
.text-center { text-align: center; }
.text-gold { color: var(--color-gold); }
.text-amber { color: var(--color-gold); }
.text-muted { color: rgba(255,255,255,0.5); }
.bg-glass { background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); }
.rounded-lg { border-radius: 12rpx; }
.rounded-full { border-radius: 9999rpx; }

/* ========== 3D 透视工具类（路线B：CSS 3D 渐进增强） ========== */
.perspective-800 { perspective: 800px; }
.perspective-1000 { perspective: 1000px; }
.perspective-1200 { perspective: 1200px; }
.preserve-3d { transform-style: preserve-3d; }
.backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
/* 3D 翻转入场：从下方翻起 */
.animate-flip-in { animation: flipIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes flipIn {
  0% { opacity: 0; transform: perspective(800px) rotateX(-90deg) translateY(40rpx); }
  100% { opacity: 1; transform: perspective(800px) rotateX(0) translateY(0); }
}
/* 3D 弹出：从近处放大 */
.animate-pop-3d { animation: pop3d 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes pop3d {
  0% { opacity: 0; transform: perspective(800px) translateZ(-100px) scale(0.8); }
  100% { opacity: 1; transform: perspective(800px) translateZ(0) scale(1); }
}
/* 3D 悬浮凸起 */
.hover-lift-3d { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease; }
.hover-lift-3d:active { transform: perspective(800px) translateZ(20px) scale(1.02); }

/* 毛玻璃卡片 */
.glass-card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16rpx;
}

/* 金色渐变文字 */
.gold-text {
  background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 50%, #FF8C00 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 按钮基础样式 */
.btn-primary {
  background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%);
  color: var(--color-bg-card);
  font-weight: 700;
  border-radius: 12rpx;
  padding: 0 40rpx;
  border: none;
  transition: all 0.2s ease;
}
.btn-primary:active {
  transform: scale(0.96);
  opacity: 0.9;
}

.btn-ghost {
  background: rgba(255,255,255,0.08);
  color: var(--color-text);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 12rpx;
  padding: 0 40rpx;
  transition: all 0.2s ease;
}
.btn-ghost:active {
  background: rgba(255,255,255,0.15);
}

/* 输入框样式 */
.input-field {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  color: var(--color-text);
  font-size: var(--text-2xl);
}
.input-field:focus {
  border-color: var(--color-gold);
  background: rgba(255,215,0,0.05);
}
</style>

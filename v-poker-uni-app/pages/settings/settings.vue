<template>
  <ImmersivePage title="设置" :show-header="true" :scrollable="true" :page-style="{ '--font-scale': fontScale }">
    <template #header-left>
      <view class="back-btn touch-active" @click="goBack">
        <VIcon name="back" :size="2.2" color="var(--color-text)" />
      </view>
    </template>

    <!-- 工作台分栏布局（横屏核心） -->
    <view class="workbench-grid">
      <!-- ===== 左侧：游戏设置 + 音效调节 ===== -->
      <view class="workbench-left">
        <!-- 游戏设置 -->
        <view class="settings-group">
          <text class="group-title">游戏设置</text>
          <view class="settings-list">
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-yellow"><VIcon name="volume" :size="3" color="var(--color-gold)" /></view>
                <text class="setting-name">音效</text>
              </view>
              <switch class="setting-switch" :checked="settings.soundEnabled" @change="toggleSound" color="var(--color-gold)" />
            </view>
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-blue"><VIcon name="volume" :size="3" color="var(--color-info)" /></view>
                <text class="setting-name">背景音乐</text>
              </view>
              <switch class="setting-switch" :checked="settings.musicEnabled" @change="toggleMusic" color="var(--color-gold)" />
            </view>
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-green"><VIcon name="more" :size="3" color="var(--color-success)" /></view>
                <text class="setting-name">震动反馈</text>
              </view>
              <switch class="setting-switch" :checked="settings.vibrationEnabled" @change="toggleVibration" color="var(--color-gold)" />
            </view>
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-purple"><VIcon name="cards" :size="3" color="#A78BFA" /></view>
                <text class="setting-name">开牌动画</text>
              </view>
              <switch class="setting-switch" :checked="settings.animationEnabled" @change="toggleAnimation" color="var(--color-gold)" />
            </view>
          </view>
        </view>

        <!-- 音效调节（依赖音效开关） -->
        <view class="settings-group" v-if="settings.soundEnabled">
          <text class="group-title">音效调节</text>
          <view class="settings-list">
            <view class="setting-item setting-slider">
              <view class="slider-header">
                <text class="slider-label">音效音量</text>
                <text class="slider-value">{{ settings.soundVolume }}%</text>
              </view>
              <slider class="volume-slider" :value="settings.soundVolume" :min="0" :max="100" :step="5" activeColor="var(--color-gold)" backgroundColor="rgba(255,255,255,0.08)" block-size="18" @change="onSoundVolumeChange" />
            </view>
            <view class="setting-item setting-slider" v-if="settings.musicEnabled">
              <view class="slider-header">
                <text class="slider-label">音乐音量</text>
                <text class="slider-value">{{ settings.musicVolume }}%</text>
              </view>
              <slider class="volume-slider" :value="settings.musicVolume" :min="0" :max="100" :step="5" activeColor="var(--color-gold)" backgroundColor="rgba(255,255,255,0.08)" block-size="18" @change="onMusicVolumeChange" />
            </view>
            <view class="setting-item setting-slider">
              <view class="slider-header">
                <text class="slider-label">语音音量</text>
                <text class="slider-value">{{ settings.voiceVolume }}%</text>
              </view>
              <slider class="volume-slider" :value="settings.voiceVolume" :min="0" :max="100" :step="5" activeColor="var(--color-gold)" backgroundColor="rgba(255,255,255,0.08)" block-size="18" @change="onVoiceVolumeChange" />
            </view>
          </view>
        </view>
      </view>

      <!-- ===== 右侧：显示设置 + 系统设置 + 关于 ===== -->
      <view class="workbench-right">
        <!-- 显示设置 -->
        <view class="settings-group">
          <text class="group-title">显示设置</text>
          <view class="settings-list">
            <!-- 游戏主题 -->
            <view class="setting-item" @click="showThemeSelector = true">
              <view class="setting-left">
                <view class="setting-icon icon-pink"><VIcon name="more" :size="3" color="#F472B6" /></view>
                <text class="setting-name">游戏主题</text>
              </view>
              <view class="setting-right">
                <text class="setting-value">{{ getThemeName(settings.theme) }}</text>
                <VIcon name="arrow-right" :size="1.8" color="rgba(255,255,255,0.3)" />
              </view>
            </view>
            <!-- 画质 -->
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-cyan"><VIcon name="more" :size="3" color="#22D3EE" /></view>
                <text class="setting-name">画质</text>
              </view>
              <view class="quality-options">
                <view v-for="q in qualityOptions" :key="q.value" class="quality-btn touch-active" :class="{ active: settings.quality === q.value }" @click="setQuality(q.value)">
                  <text>{{ q.label }}</text>
                </view>
              </view>
            </view>
            <!-- 屏幕常亮 -->
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-orange"><VIcon name="more" :size="3" color="#FB923C" /></view>
                <text class="setting-name">屏幕常亮</text>
              </view>
              <switch class="setting-switch" :checked="settings.keepScreenOn" @change="toggleKeepScreenOn" color="var(--color-gold)" />
            </view>
            <!-- 字体大小 -->
            <view class="setting-item setting-font">
              <view class="setting-left">
                <view class="setting-icon icon-yellow"><VIcon name="more" :size="3" color="var(--color-gold)" /></view>
                <text class="setting-name">字体大小</text>
              </view>
              <view class="font-options">
                <view
                  v-for="opt in fontScaleOptions"
                  :key="opt.value"
                  class="font-btn touch-active"
                  :class="{ active: Math.abs(fontScale - opt.value) < 0.01 }"
                  :style="{ fontSize: (1.6 * opt.value) + 'vh' }"
                  @click="setFontScaleOption(opt.value)"
                >
                  <text>{{ opt.label }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 系统设置 -->
        <view class="settings-group">
          <text class="group-title">系统设置</text>
          <view class="settings-list">
            <view class="setting-item" @click="clearCache">
              <view class="setting-left">
                <view class="setting-icon icon-gray"><VIcon name="more" :size="3" color="var(--color-text-muted)" /></view>
                <text class="setting-name">清除缓存</text>
              </view>
              <view class="setting-right">
                <text class="setting-value">{{ cacheSize }}</text>
                <VIcon name="arrow-right" :size="1.8" color="rgba(255,255,255,0.3)" />
              </view>
            </view>
          </view>
        </view>

        <!-- 关于 -->
        <view class="settings-group">
          <text class="group-title">关于</text>
          <view class="settings-list">
            <view class="setting-item">
              <view class="setting-left">
                <view class="setting-icon icon-indigo"><VIcon name="more" :size="3" color="var(--theme-primary)" /></view>
                <text class="setting-name">版本号</text>
              </view>
              <text class="setting-value">v1.0.4</text>
            </view>
            <view class="setting-item" @click="checkUpdate">
              <view class="setting-left">
                <view class="setting-icon icon-teal"><VIcon name="refresh" :size="3" color="#2DD4BF" /></view>
                <text class="setting-name">检查更新</text>
              </view>
              <VIcon name="arrow-right" :size="1.8" color="rgba(255,255,255,0.3)" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-spacing"></view>

    <!-- ===== 主题选择弹窗（保留，未改动） ===== -->
    <view v-if="showThemeSelector" class="modal-overlay" @click="showThemeSelector = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">选择游戏主题</text>
          <view class="modal-close-btn touch-active" @click="showThemeSelector = false">
            <VIcon name="close" :size="3" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
        <scroll-view class="theme-list" scroll-y>
          <view v-for="theme in themeOptions" :key="theme.value" class="theme-item" :class="{ active: settings.theme === theme.value }" @click="selectTheme(theme.value)">
            <view class="theme-preview" :style="{ background: theme.gradient }">
              <VIcon :name="theme.iconName" :size="2.5" color="#fff" />
            </view>
            <view class="theme-info">
              <text class="theme-name">{{ theme.name }}</text>
              <text class="theme-desc">{{ theme.desc }}</text>
            </view>
            <view v-if="settings.theme === theme.value" class="theme-check">
              <VIcon name="check" :size="1.8" color="var(--color-bg-card)" />
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </ImmersivePage>
</template>

<script>
import { getSoundManager, getVoiceManager } from '../../utils/sound.js'
import { setVibrationEnabled } from '../../utils/haptic.js'
import ImmersivePage from '../../components/ui/ImmersivePage.vue'
import VIcon from '../../components/ui/VIcon.vue'
import { FONT_SCALE_OPTIONS, getFontScale, setFontScale } from '../../utils/fontScale.js'
import { DEFAULT_SETTINGS, getAppSettings, saveAppSettings } from '../../utils/appSettings.js'

export default {
  name: 'SettingsPage',
  components: { ImmersivePage, VIcon },
  data() {
    return {
      showThemeSelector: false,
      cacheSize: '计算中...',
      soundManager: null,
      voiceManager: null,
      fontScale: 1.0,
      fontScaleOptions: FONT_SCALE_OPTIONS,
      settings: { ...DEFAULT_SETTINGS },
      qualityOptions: [
        { label: '低', value: 'low' },
        { label: '中', value: 'medium' },
        { label: '高', value: 'high' },
      ],
      themeOptions: [
        { value: 'default', name: '经典黑金', desc: '默认主题，沉稳大气', iconName: 'spade', gradient: 'linear-gradient(135deg, var(--color-bg-card), #2d2d2d)' },
        { value: 'forbidden_city', name: '紫禁之巅', desc: '黑金帝王气场', iconName: 'trophy', gradient: 'linear-gradient(135deg, #2d1810, #4a2c1a)' },
        { value: 'jiangnan', name: '江南百景', desc: '水墨意境', iconName: 'fan', gradient: 'linear-gradient(135deg, #4A90A4, #2C5F6D)' },
        { value: 'steampunk', name: '机械迷城', desc: '蒸汽朋克', iconName: 'gear', gradient: 'linear-gradient(135deg, #3d2817, #5c3d2e)' },
        { value: 'noir', name: '雾都夜话', desc: '暗黑悬疑', iconName: 'fan', gradient: 'linear-gradient(135deg, var(--color-bg), #16213e)' },
        { value: 'wallstreet', name: '华尔街', desc: '金融交易', iconName: 'coin', gradient: 'linear-gradient(135deg, #0a1929, #132f4c)' },
      ],
    }
  },
  onLoad() {
    this.loadSettings()
    this.soundManager = getSoundManager()
    this.voiceManager = getVoiceManager()
    this.syncSoundSettings()
    this.fontScale = getFontScale()
    uni.$on('fontScaleChange', this.onFontScaleChange)
    this.calcCacheSize()
  },
  onUnload() {
    uni.$off('fontScaleChange', this.onFontScaleChange)
  },
  methods: {
    syncSoundSettings() {
      if (this.soundManager) {
        this.soundManager.setEnabled(this.settings.soundEnabled)
        this.soundManager.setVibrateEnabled(this.settings.vibrationEnabled)
        this.soundManager.setVolume(this.settings.soundVolume / 100)
        this.soundManager.setBackgroundVolume(this.settings.musicVolume / 100)
      }
      if (this.voiceManager) {
        this.voiceManager.setEnabled(this.settings.voiceEnabled)
        this.voiceManager.setVolume(this.settings.voiceVolume / 100)
      }
    },
    loadSettings() {
      this.settings = getAppSettings()
    },
    saveSettings() {
      this.settings = saveAppSettings(this.settings)
    },
    goBack() {
      uni.navigateBack()
    },
    toggleSound(e) {
      this.soundManager?.markUserInteraction()
      this.settings.soundEnabled = e.detail.value
      this.saveSettings()
      if (this.soundManager) {
        this.soundManager.setEnabled(this.settings.soundEnabled)
        if (this.settings.soundEnabled) this.soundManager.playButton()
      }
    },
    toggleMusic(e) {
      this.soundManager?.markUserInteraction()
      this.settings.musicEnabled = e.detail.value
      this.saveSettings()
      if (this.soundManager) {
        if (this.settings.musicEnabled) {
          this.soundManager.setBackgroundVolume((this.settings.musicVolume || 50) / 100)
          this.soundManager.playBackground()
        } else {
          this.soundManager.stopBackground()
        }
      }
    },
    toggleVibration(e) {
      this.settings.vibrationEnabled = e.detail.value
      this.saveSettings()
      setVibrationEnabled(this.settings.vibrationEnabled)
      if (this.soundManager) {
        this.soundManager.setVibrateEnabled(this.settings.vibrationEnabled)
        if (this.settings.vibrationEnabled) this.soundManager.vibrate('light')
      }
    },
    toggleAnimation(e) {
      this.settings.animationEnabled = e.detail.value
      this.saveSettings()
    },
    onFontScaleChange(scale) {
      this.fontScale = scale
    },
    setFontScaleOption(scale) {
      if (this.fontScale === scale) return
      setFontScale(scale)
      this.fontScale = scale
      uni.showToast({ title: '字体大小已更新', icon: 'none' })
    },
    onSoundVolumeChange(e) {
      this.settings.soundVolume = e.detail.value
      this.saveSettings()
      if (this.soundManager) this.soundManager.setVolume(this.settings.soundVolume / 100)
    },
    onMusicVolumeChange(e) {
      this.settings.musicVolume = e.detail.value
      this.saveSettings()
      if (this.soundManager) {
        this.soundManager.setBackgroundVolume(this.settings.musicVolume / 100)
      }
    },
    onVoiceVolumeChange(e) {
      this.settings.voiceVolume = e.detail.value
      this.saveSettings()
      if (this.voiceManager) {
        this.voiceManager.setVolume(this.settings.voiceVolume / 100)
      }
    },
    getThemeName(theme) {
      const found = this.themeOptions.find(t => t.value === theme)
      return found ? found.name : '经典黑金'
    },
    selectTheme(theme) {
      this.soundManager?.markUserInteraction()
      this.settings.theme = theme
      this.saveSettings()
      if (this.soundManager) {
        this.soundManager.setTheme(theme)
        if (this.settings.musicEnabled && this.settings.soundEnabled) {
          this.soundManager.playBackground()
        }
      }
      this.showThemeSelector = false
      uni.showToast({ title: '主题已切换', icon: 'success' })
    },
    setQuality(quality) {
      this.settings.quality = quality
      this.saveSettings()
    },
    toggleKeepScreenOn(e) {
      this.settings.keepScreenOn = e.detail.value
      this.saveSettings()
    },
    calcCacheSize() {
      try {
        const info = uni.getStorageInfoSync()
        const kb = info.currentSize || 0
        if (kb >= 1024) {
          this.cacheSize = (kb / 1024).toFixed(2) + 'MB'
        } else {
          this.cacheSize = kb.toFixed(0) + 'KB'
        }
      } catch (e) {
        this.cacheSize = '0KB'
      }
    },
    clearCache() {
      uni.showModal({
        title: '清除缓存',
        content: '确定要清除缓存吗？这不会删除您的登录状态和游戏数据。',
        success: (res) => {
          if (res.confirm) {
            try {
              const token = uni.getStorageSync('vpoker_token')
              const deviceId = uni.getStorageSync('vpoker_device_id')
              const fontScale = uni.getStorageSync('vpoker_font_scale')
              uni.clearStorageSync()
              if (token) uni.setStorageSync('vpoker_token', token)
              if (deviceId) uni.setStorageSync('vpoker_device_id', deviceId)
              if (fontScale) uni.setStorageSync('vpoker_font_scale', fontScale)
            } catch (e) {
              console.error('[Settings] 清除缓存失败', e)
            }
            this.calcCacheSize()
            uni.showToast({ title: '缓存已清除', icon: 'success' })
          }
        }
      })
    },
    checkUpdate() {
      uni.showToast({ title: '当前已是最新版本', icon: 'none' })
    },
  },
}
</script>

<style lang="scss" scoped>
/* ===== 工作台左右分栏布局（横屏核心） ===== */
.workbench-grid {
  display: flex;
  gap: 3vh;
  padding: 2vh 0;
  /* 安全区兜底 */
  padding-left: max(2vh, env(safe-area-inset-left, 0px));
  padding-right: max(2vh, env(safe-area-inset-right, 0px));
  box-sizing: border-box;
}

.workbench-left {
  width: 32%;        /* 与 profile 保持一致 */
  min-width: 26vh;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2.5vh;
}

.workbench-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2.5vh;
}

/* 窄屏回退为垂直排列 */
@media (max-width: 900px) {
  .workbench-grid {
    flex-direction: column;
  }
  .workbench-left {
    width: 100%;
  }
}

/* ===== 返回按钮 ===== */
.back-btn {
  width: max(4.5vh, 44px);
  height: max(4.5vh, 44px);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
}

/* ===== 设置分组 ===== */
.settings-group {
  /* 靠父级 gap 分隔，无需额外 margin */
}

.group-title {
  display: block;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.35);
  margin-bottom: 0.8vh;
  padding-left: 0.8vh;
  font-weight: 600;
  letter-spacing: 0.2vh;
  text-transform: uppercase;
}

.settings-list {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 1.6vh;
  overflow: hidden;
}

/* ===== 设置项 ===== */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.6vh 1.6vh;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s ease;
  min-height: 6.4vh;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:active {
  background: rgba(255,255,255,0.04);
}

.setting-left {
  display: flex;
  align-items: center;
  gap: 1.2vh;
}

.setting-icon {
  width: 4.4vh;
  height: 4.4vh;
  min-width: 36px;
  min-height: 36px;
  border-radius: 1vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-yellow { background: rgba(255, 215, 0, 0.12); }
.icon-blue   { background: rgba(96, 165, 250, 0.12); }
.icon-green  { background: rgba(74, 222, 128, 0.12); }
.icon-purple { background: rgba(167, 139, 250, 0.12); }
.icon-pink   { background: rgba(244, 114, 182, 0.12); }
.icon-cyan   { background: rgba(34, 211, 238, 0.12); }
.icon-orange { background: rgba(251, 146, 60, 0.12); }
.icon-red    { background: rgba(248, 113, 113, 0.12); }
.icon-gray   { background: rgba(156, 163, 175, 0.12); }
.icon-indigo { background: rgba(129, 140, 248, 0.12); }
.icon-teal   { background: rgba(45, 212, 191, 0.12); }

.setting-name {
  font-size: var(--text-sm);
  color: var(--color-text);
  font-weight: 500;
}

.setting-right {
  display: flex;
  align-items: center;
  gap: 0.8vh;
}

.setting-value {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
}

.setting-switch {
  transform: scale(0.85);
  min-width: 48px;
  min-height: 28px;
}

/* ===== 音量滑条 ===== */
.setting-slider {
  flex-direction: column;
  align-items: stretch;
  gap: 0.6vh;
  padding: 1.2vh 1.6vh 1.6vh 1.6vh;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-label {
  font-size: var(--text-sm);
  color: rgba(255,255,255,0.6);
}

.slider-value {
  font-size: var(--text-sm);
  color: var(--color-gold);
  font-weight: 600;
}

.volume-slider {
  width: 100%;
}

/* ===== 画质选项 ===== */
.quality-options {
  display: flex;
  gap: 0.6vw;
}

.quality-btn {
  padding: 0.4vh 1.2vw;
  min-height: 3.6vh;
  min-width: 4vw;
  text-align: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.6vh;
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.4);
  transition: all 0.2s;
}

.quality-btn.active {
  background: rgba(255, 215, 0, 0.12);
  border-color: var(--color-gold);
  color: var(--color-gold);
}

.quality-btn:active {
  transform: scale(0.95);
}

/* ===== 字体大小选项 ===== */
.setting-font {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.8vh;
  padding: 1.2vh 1.6vh 1.6vh 1.6vh;
}

.setting-font .setting-left {
  width: 100%;
}

.font-options {
  display: flex;
  gap: 0.6vw;
  width: 100%;
}

.font-btn {
  padding: 0.4vh 1vw;
  min-height: 3.6vh;
  min-width: 4vw;
  text-align: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.6vh;
  color: rgba(255,255,255,0.4);
  transition: all 0.2s;
  flex: 1;
}

.font-btn.active {
  background: rgba(255, 215, 0, 0.12);
  border-color: var(--color-gold);
  color: var(--color-gold);
  font-weight: 600;
}

.font-btn:active {
  transform: scale(0.95);
}

/* ===== 底部留白 ===== */
.bottom-spacing {
  height: calc(3vh + env(safe-area-inset-bottom));
  min-height: 28px;
}

/* ===== 弹窗（全部保留，仅微调样式） ===== */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 2vh;
  padding-top: calc(2vh + var(--safe-top, 0px));
  padding-bottom: calc(2vh + var(--safe-bottom, 0px));
  padding-left: calc(2vh + var(--safe-left, 0px));
  padding-right: calc(2vh + var(--safe-right, 0px));
  box-sizing: border-box;
}

.modal-content {
  width: min(80%, 420px);
  min-width: 300px;
  max-height: 75vh;
  background: linear-gradient(145deg, #1f1f35, #1a1a2e);
  border-radius: 2vh;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 2.5vh 2.5vw;
  box-shadow: 0 1vh 4vh rgba(0,0,0,0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2vh;
  padding-bottom: 1.2vh;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
}

.modal-close-btn {
  width: max(4vh, 44px);
  height: max(4vh, 44px);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border-radius: 50%;
}

.theme-list {
  max-height: 50vh;
}

.theme-item {
  display: flex;
  align-items: center;
  padding: 1.2vh 1.2vw;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 1.2vh;
  gap: 1.2vw;
  margin-bottom: 0.8vh;
  transition: all 0.2s;
}

.theme-item.active {
  border-color: var(--color-gold);
  background: rgba(255, 215, 0, 0.08);
}

.theme-item:active {
  transform: scale(0.98);
}

.theme-preview {
  width: 5vh;
  height: 5vh;
  min-width: 36px;
  min-height: 36px;
  border-radius: 1vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.theme-info {
  flex: 1;
  min-width: 0;
}

.theme-name {
  display: block;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.2vh;
}

.theme-desc {
  font-size: var(--text-xs);
  color: rgba(255,255,255,0.35);
}

.theme-check {
  width: 3.2vh;
  height: 3.2vh;
  min-width: 24px;
  min-height: 24px;
  background: var(--color-gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>

import { GAME_THEMES } from '../themes/themeConfig.js'

export const SETTINGS_KEY = 'vpoker_settings'

export const DEFAULT_SETTINGS = {
  soundEnabled: true,
  musicEnabled: false,
  vibrationEnabled: true,
  animationEnabled: true,
  soundVolume: 70,
  musicVolume: 50,
  voiceEnabled: true,
  voiceVolume: 80,
  theme: 'default',
  quality: 'high',
  keepScreenOn: true,
}

export function getAppSettings() {
  try {
    const saved = uni.getStorageSync(SETTINGS_KEY)
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS }
  } catch (e) {
    return { ...DEFAULT_SETTINGS }
  }
}

export function applyTheme(themeId) {
  const theme = GAME_THEMES[themeId] || GAME_THEMES.forbidden_city
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const style = document.documentElement.style
      style.setProperty('--color-bg', theme.colors.bgPrimary)
      style.setProperty('--color-bg-card', theme.colors.bgSecondary)
      style.setProperty('--color-text', theme.colors.text)
      style.setProperty('--color-text-muted', theme.colors.textMuted)
      style.setProperty('--color-border', theme.colors.border)
      style.setProperty('--color-gold', theme.colors.primary)
      style.setProperty('--theme-primary', theme.colors.primary)
      style.setProperty('--theme-secondary', theme.colors.secondary)
      style.setProperty('--theme-bg', theme.colors.bgPrimary)
      style.setProperty('--theme-table', theme.colors.tableFelt)
      style.setProperty('--theme-table-border', theme.colors.tableBorder)
      style.setProperty('--theme-text', theme.colors.text)
    }
  } catch (e) {}
  // iOS 状态栏同步：全主题均为深色背景，统一白色文字
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.navigator) {
      plus.navigator.setStatusBarBackground('#000000')
      plus.navigator.setStatusBarStyle('light')
    }
  } catch (e) {}
  // #endif
}

export function saveAppSettings(patch) {
  const settings = { ...getAppSettings(), ...patch }
  try {
    uni.setStorageSync(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('[Settings] 保存失败', e)
  }
  applyTheme(settings.theme)
  uni.$emit('appSettingsChange', settings)
  return settings
}

export function initAppSettings() {
  const settings = getAppSettings()
  applyTheme(settings.theme)
  return settings
}

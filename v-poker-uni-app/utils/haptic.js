/**
 * V-Poker 触觉反馈工具（纯 uni-app 实现，零 plus 依赖）
 * 统一使用 uni.vibrateShort，跨平台兼容
 *
 * 使用场景：
 * - haptic.light()  按钮点击、卡牌轻触
 * - haptic.medium() 筹码下注、确认操作
 * - haptic.heavy()  胜利、比牌、重要操作
 * - haptic.success() 操作成功
 * - haptic.warning() 警告提示
 * - haptic.error()   操作失败
 * - haptic.selection() 选择器切换、滑块
 */

// 初始化状态
let initialized = false

// 用户设置缓存
let vibrationEnabled = true

/**
 * 初始化触觉反馈（在 App.vue onLaunch 调用，幂等）
 */
export function initHaptic() {
  if (initialized) return
  initialized = true
  // 纯 uni-app 实现，无需原生初始化
}

/**
 * 原生触觉是否可用（保留接口兼容，纯uni实现恒为false）
 */
export function isHapticNativeAvailable() {
  return false
}

/**
 * 设置震动开关（从 settings 页面同步）
 */
export function setVibrationEnabled(enabled) {
  vibrationEnabled = enabled
}

/**
 * 检查是否可以触发触觉反馈
 * H5 端不震动（浏览器限制），App/小程序端震动
 */
function canTrigger() {
  if (!vibrationEnabled) return false
  // #ifdef H5
  return false
  // #endif
  // #ifndef H5
  return true
  // #endif
}

/**
 * 统一震动入口
 * @param {string} type - light/medium/heavy
 */
function vibrate(type) {
  if (!canTrigger()) return
  try {
    uni.vibrateShort({ type: type || 'light' })
  } catch (e) {
    // 忽略
  }
}

/**
 * 轻触觉（按钮点击、卡牌轻触）
 */
export function hapticLight() {
  vibrate('light')
}

/**
 * 中触觉（筹码下注、确认操作）
 */
export function hapticMedium() {
  vibrate('medium')
}

/**
 * 重触觉（胜利、比牌、重要操作）
 */
export function hapticHeavy() {
  vibrate('heavy')
}

/**
 * 成功反馈
 */
export function hapticSuccess() {
  vibrate('medium')
}

/**
 * 警告反馈
 */
export function hapticWarning() {
  vibrate('medium')
}

/**
 * 错误反馈
 */
export function hapticError() {
  vibrate('heavy')
}

/**
 * 选择反馈（选择器切换、滑块）
 */
export function hapticSelection() {
  vibrate('light')
}

export default {
  initHaptic,
  setVibrationEnabled,
  isHapticNativeAvailable,
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  selection: hapticSelection,
}

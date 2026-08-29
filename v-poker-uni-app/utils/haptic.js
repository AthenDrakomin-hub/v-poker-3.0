/**
 * V-Poker iOS 触觉反馈工具
 * 封装 UIImpactFeedbackGenerator / UINotificationFeedbackGenerator / UISelectionFeedbackGenerator
 * 非 iOS 平台降级到 uni.vibrateShort
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

import { isIOS, isApp } from './device.js'

// 单例缓存，避免重复创建 generator
let impactLight = null
let impactMedium = null
let impactHeavy = null
let notificationGen = null
let selectionGen = null

// 初始化状态：防止重复初始化 / 重入
let initialized = false
let nativeAvailable = false

// 用户设置缓存
let vibrationEnabled = true

/**
 * 安全创建 iOS 原生对象
 * 优先使用 Class.alloc().initXxx()，失败时回退 plus.ios.newObject()
 * @param {string} className  类名
 * @param {string} initMethod 初始化方法名（如 'initWithStyle:'），传 null 表示 init
 * @param {Array}  args       初始化参数
 * @returns {object|null} 原生实例或 null
 */
function createNativeObject(className, initMethod, args) {
  // #ifdef APP-PLUS
  try {
    if (typeof plus === 'undefined' || !plus.ios || typeof plus.ios.import !== 'function') {
      return null
    }
    const Cls = plus.ios.import(className)
    if (!Cls) {
      console.warn(`[Haptic] plus.ios.import('${className}') 返回空`)
      return null
    }

    // 方式一：alloc().initXxx()（标准方式，但部分基座版本 alloc 可能缺失）
    if (typeof Cls.alloc === 'function') {
      let instance
      if (initMethod) {
        // 解析方法名：'initWithStyle:' → 'initWithStyle'
        const methodName = initMethod.replace(/:$/, '')
        if (typeof Cls.alloc()[methodName] === 'function') {
          instance = Cls.alloc()[methodName](...(args || []))
        }
      } else {
        instance = Cls.alloc().init()
      }
      if (instance) return instance
    }

    // 方式二：plus.ios.newObject()（备选，等价于 alloc+init）
    if (typeof plus.ios.newObject === 'function') {
      try {
        const instance = plus.ios.newObject(className, ...(args || []))
        if (instance) return instance
      } catch (e2) {
        console.warn(`[Haptic] newObject('${className}') 失败`, e2)
      }
    }

    console.warn(`[Haptic] 无法创建 ${className} 实例（alloc=${typeof Cls.alloc}）`)
    return null
  } catch (e) {
    console.warn(`[Haptic] 创建 ${className} 异常`, e)
    return null
  }
  // #endif
  // #ifndef APP-PLUS
  return null
  // #endif
}

/**
 * 初始化触觉反馈（在 App.vue onLaunch 调用）
 * 幂等：重复调用直接跳过
 */
export function initHaptic() {
  if (initialized) return
  initialized = true

  if (!isIOS() || !isApp()) {
    nativeAvailable = false
    return
  }

  // #ifdef APP-PLUS
  try {
    // UIImpactFeedbackStyle: Light=0, Medium=1, Heavy=2, Soft=3, Rigid=4
    impactLight = createNativeObject('UIImpactFeedbackGenerator', 'initWithStyle:', [0])
    impactMedium = createNativeObject('UIImpactFeedbackGenerator', 'initWithStyle:', [1])
    impactHeavy = createNativeObject('UIImpactFeedbackGenerator', 'initWithStyle:', [2])
    notificationGen = createNativeObject('UINotificationFeedbackGenerator', null, [])
    selectionGen = createNativeObject('UISelectionFeedbackGenerator', null, [])

    nativeAvailable = !!(impactLight || impactMedium || impactHeavy || notificationGen || selectionGen)

    // prepare 预加载，减少首次调用延迟（逐个 try，避免一个失败影响全部）
    ;[impactLight, impactMedium, impactHeavy, notificationGen, selectionGen].forEach(g => {
      if (g && typeof g.prepare === 'function') {
        try { g.prepare() } catch (e) { /* ignore */ }
      }
    })

    if (nativeAvailable) {
      // 原生触觉反馈初始化成功
    } else {
      console.warn('[Haptic] 原生触觉反馈不可用，全部降级到 vibrateShort')
    }
  } catch (e) {
    console.warn('[Haptic] 初始化异常，降级到 vibrateShort', e)
    impactLight = impactMedium = impactHeavy = null
    notificationGen = selectionGen = null
    nativeAvailable = false
  }
  // #endif
}

/**
 * 原生触觉是否可用（用于外部诊断）
 */
export function isHapticNativeAvailable() {
  return nativeAvailable
}

/**
 * 设置震动开关（从 settings 页面同步）
 */
export function setVibrationEnabled(enabled) {
  vibrationEnabled = enabled
}

/**
 * 检查是否可以触发触觉反馈
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
 * 轻触觉（按钮点击、卡牌轻触）
 */
export function hapticLight() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && impactLight) {
    try {
      impactLight.impactOccurred()
      impactLight.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('light')
}

/**
 * 中触觉（筹码下注、确认操作）
 */
export function hapticMedium() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && impactMedium) {
    try {
      impactMedium.impactOccurred()
      impactMedium.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('medium')
}

/**
 * 重触觉（胜利、比牌、重要操作）
 */
export function hapticHeavy() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && impactHeavy) {
    try {
      impactHeavy.impactOccurred()
      impactHeavy.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('heavy')
}

/**
 * 成功反馈
 */
export function hapticSuccess() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && notificationGen) {
    try {
      // UINotificationFeedbackTypeSuccess = 0
      notificationGen.notificationOccurred(0)
      notificationGen.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('success')
}

/**
 * 警告反馈
 */
export function hapticWarning() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && notificationGen) {
    try {
      // UINotificationFeedbackTypeWarning = 1
      notificationGen.notificationOccurred(1)
      notificationGen.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('warning')
}

/**
 * 错误反馈
 */
export function hapticError() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && notificationGen) {
    try {
      // UINotificationFeedbackTypeError = 2
      notificationGen.notificationOccurred(2)
      notificationGen.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('error')
}

/**
 * 选择反馈（选择器切换、滑块）
 */
export function hapticSelection() {
  if (!canTrigger()) return
  if (isIOS() && isApp() && selectionGen) {
    try {
      selectionGen.selectionChanged()
      selectionGen.prepare()
      return
    } catch (e) { /* fallback */ }
  }
  fallbackVibrate('selection')
}

/**
 * 降级方案：非 iOS 平台使用 uni.vibrateShort
 */
function fallbackVibrate(type) {
  try {
    const typeMap = {
      light: 'light',
      medium: 'medium',
      heavy: 'heavy',
      success: 'medium',
      warning: 'medium',
      error: 'heavy',
      selection: 'light',
    }
    uni.vibrateShort({ type: typeMap[type] || 'light' })
  } catch (e) {
    // 忽略
  }
}

export default {
  initHaptic,
  setVibrationEnabled,
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  selection: hapticSelection,
}

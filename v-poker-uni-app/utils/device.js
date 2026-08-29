/**
 * V-Poker 设备信息工具
 */

/**
 * 获取系统信息
 */
export function getSystemInfo() {
  try {
    return uni.getSystemInfoSync()
  } catch (e) {
    return {
      windowWidth: 375,
      windowHeight: 667,
      platform: 'devtools',
      system: 'unknown',
    }
  }
}

/**
 * 获取屏幕宽度
 */
export function getScreenWidth() {
  return getSystemInfo().windowWidth
}

/**
 * 获取屏幕高度
 */
export function getScreenHeight() {
  return getSystemInfo().windowHeight
}

/**
 * 是否是横屏
 */
export function isLandscape() {
  const info = getSystemInfo()
  return info.windowWidth > info.windowHeight
}

/**
 * 是否是iOS
 */
export function isIOS() {
  const info = getSystemInfo()
  return info.platform === 'ios' || /iOS|iPhone|iPad/i.test(info.system)
}

/**
 * 是否是Android
 */
export function isAndroid() {
  const info = getSystemInfo()
  return info.platform === 'android' || /Android/i.test(info.system)
}

/**
 * 是否是APP端
 */
export function isApp() {
  // #ifdef APP-PLUS
  return true
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/**
 * 是否是H5
 */
export function isH5() {
  // #ifdef H5
  return true
  // #endif
  // #ifndef H5
  return false
  // #endif
}

/**
 * 获取安全区域
 */
export function getSafeArea() {
  const info = getSystemInfo()
  return {
    top: info.safeAreaInsets?.top || 0,
    bottom: info.safeAreaInsets?.bottom || 0,
    left: info.safeAreaInsets?.left || 0,
    right: info.safeAreaInsets?.right || 0,
  }
}

/**
 * 获取设备唯一ID
 */
export function getDeviceId() {
  try {
    let deviceId = uni.getStorageSync('vpoker_device_id')
    if (!deviceId) {
      deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      uni.setStorageSync('vpoker_device_id', deviceId)
    }
    return deviceId
  } catch (e) {
    return 'dev_unknown'
  }
}

/**
 * 获取设备型号
 */
export function getDeviceModel() {
  return getSystemInfo().model || 'unknown'
}

/**
 * 获取APP版本
 */
export function getAppVersion() {
  return '1.0.0'
}

/**
 * 震动反馈
 */
export function vibrate(duration = 15) {
  try {
    uni.vibrateShort({ type: 'light' })
  } catch (e) {
    // 忽略
  }
}

/**
 * 长震动
 */
export function vibrateLong() {
  try {
    uni.vibrateLong()
  } catch (e) {
    // 忽略
  }
}

/**
 * 保持屏幕常亮
 */
export function keepScreenOn(keepOn = true) {
  // #ifdef APP-PLUS
  try {
    plus.device.setWakelock(keepOn)
  } catch (e) {
    // 忽略
  }
  // #endif
}

export default {
  getSystemInfo,
  getScreenWidth,
  getScreenHeight,
  isLandscape,
  isIOS,
  isAndroid,
  isApp,
  isH5,
  getSafeArea,
  getDeviceId,
  getDeviceModel,
  getAppVersion,
  vibrate,
  vibrateLong,
  keepScreenOn,
}

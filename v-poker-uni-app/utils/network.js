/**
 * V-Poker 网络状态监听
 * 监听网络变化，离线时显示提示，恢复时自动刷新
 */

let isListening = false
let currentStatus = 'unknown'
const listeners = []

/**
 * 初始化网络监听（在 App.vue onLaunch 中调用一次）
 */
export function initNetworkMonitor() {
  if (isListening) return
  isListening = true

  // 获取初始网络状态
  uni.getNetworkType({
    success: (res) => {
      currentStatus = res.networkType
      notifyListeners()
    }
  })

  // 监听网络变化
  uni.onNetworkStatusChange((res) => {
    const wasOffline = currentStatus === 'none'
    currentStatus = res.networkType

    if (!res.isConnected && !wasOffline) {
      // 刚断开网络
      uni.showToast({
        title: '网络已断开，请检查网络连接',
        icon: 'none',
        duration: 3000
      })
    } else if (res.isConnected && wasOffline) {
      // 网络恢复
      uni.showToast({
        title: '网络已恢复',
        icon: 'success',
        duration: 1500
      })
    }
    notifyListeners()
  })
}

/**
 * 当前是否在线
 */
export function isOnline() {
  return currentStatus !== 'none' && currentStatus !== 'unknown'
}

/**
 * 订阅网络状态变化
 * @param {Function} callback - (isConnected, networkType) => void
 * @returns {Function} 取消订阅函数
 */
export function onNetworkChange(callback) {
  listeners.push(callback)
  return () => {
    const idx = listeners.indexOf(callback)
    if (idx > -1) listeners.splice(idx, 1)
  }
}

function notifyListeners() {
  const connected = currentStatus !== 'none'
  listeners.forEach(cb => {
    try { cb(connected, currentStatus) } catch (e) {}
  })
}

export default {
  initNetworkMonitor,
  isOnline,
  onNetworkChange
}

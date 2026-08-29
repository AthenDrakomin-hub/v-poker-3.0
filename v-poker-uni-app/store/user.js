/**
 * V-Poker 用户状态管理
 * Vue3 reactive 实现
 */
import { reactive, ref } from 'vue'
import { getMe, logout as apiLogout } from '../api/auth.js'
import { setUserPermissions, clearUserPermissions } from '../utils/featurePermissions.js'

// 用户状态
export const userState = reactive({
  // 用户信息
  id: null,
  account: '',
  nickname: '',
  role: 'player', // player / agent / top_agent / admin / customer_service
  avatar: '',
  points: 0, // 筹码余额
  invitedById: null,
  mustChangePassword: false,

  // 登录状态
  isLoggedIn: false,
  isLoading: false,
  error: null,

  // 设备信息
  deviceId: '',
})

// Token
export const token = ref('')

/**
 * 初始化用户状态（从本地存储恢复）
 */
export function initUserState() {
  try {
    const savedToken = uni.getStorageSync('vpoker_token')
    if (savedToken) {
      token.value = savedToken
      userState.isLoggedIn = true
    }
    const savedDeviceId = uni.getStorageSync('vpoker_device_id')
    if (savedDeviceId) {
      userState.deviceId = savedDeviceId
    }
  } catch (e) {
    console.error('[Store] 初始化用户状态失败', e)
  }
}

/**
 * 登录
 */
export async function login(account, password) {
  userState.isLoading = true
  userState.error = null

  try {
    const data = await apiLogin(account, password)

    // 保存Token
    if (data.token) {
      token.value = data.token
      uni.setStorageSync('vpoker_token', data.token)
    }

    // 更新用户信息
    if (data.user) {
      updateUserInfo(data.user)
    }

    userState.isLoggedIn = true
    userState.mustChangePassword = data.mustChangePassword || false

    return data
  } catch (e) {
    userState.error = e.error || '登录失败'
    throw e
  } finally {
    userState.isLoading = false
  }
}

// 避免循环引用，单独导入
import { login as apiLogin } from '../api/auth.js'

/**
 * 获取当前用户信息
 */
export async function fetchUserInfo() {
  if (!token.value) return null

  userState.isLoading = true
  try {
    const data = await getMe()
    updateUserInfo(data.user || data)
    // 设置服务器返回的功能权限缓存
    if (data.permissions) {
      setUserPermissions(data.permissions)
    }
    userState.isLoggedIn = true
    return data
  } catch (e) {
    // Token失效
    if (e.statusCode === 401) {
      clearUserState()
    }
    throw e
  } finally {
    userState.isLoading = false
  }
}

/**
 * 更新用户信息
 */
export function updateUserInfo(data) {
  if (!data) return
  userState.id = data.id || userState.id
  userState.account = data.account || userState.account
  userState.nickname = data.nickname || data.account || userState.nickname
  userState.role = data.role || userState.role
  userState.avatar = data.avatar || userState.avatar
  userState.points = typeof data.points === 'number' ? data.points : userState.points
  userState.invitedById = data.invitedById ?? userState.invitedById
}

/**
 * 更新筹码
 */
export function updatePoints(newPoints) {
  userState.points = newPoints
}

/**
 * 登出
 */
export function logout() {
  apiLogout()
  clearUserState()
  uni.reLaunch({ url: '/pages/login/login' })
}

/**
 * 清除用户状态
 */
export function clearUserState() {
  token.value = ''
  userState.id = null
  userState.account = ''
  userState.nickname = ''
  userState.role = 'player'
  userState.avatar = ''
  userState.points = 0
  userState.invitedById = null
  userState.isLoggedIn = false
  userState.mustChangePassword = false
  userState.error = null
  clearUserPermissions()
  uni.removeStorageSync('vpoker_token')
}

/**
 * 检查是否有指定角色
 */
export function hasRole(role) {
  return userState.role === role
}

/**
 * 检查是否是代理及以上
 */
export function isAgentOrAbove() {
  return ['agent', 'top_agent', 'admin'].includes(userState.role)
}

/**
 * 检查是否是管理员
 */
export function isAdmin() {
  return userState.role === 'admin'
}

export default {
  userState,
  token,
  initUserState,
  login,
  fetchUserInfo,
  updateUserInfo,
  updatePoints,
  logout,
  clearUserState,
  hasRole,
  isAgentOrAbove,
  isAdmin,
}

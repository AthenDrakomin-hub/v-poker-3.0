/**
 * V-Poker API 请求封装
 * 支持 Token 认证、错误处理、设备ID、自动重试
 */
import { API_CONFIG } from './config.js'

// 401跳转防抖标记，避免重复reLaunch导致导航冲突
let isRedirectingToLogin = false

// 可重试的状态码（网络错误/5xx/429限流）
const RETRYABLE_STATUSES = [0, 429, 500, 502, 503, 504]
const DEFAULT_RETRY_COUNT = 2
const DEFAULT_RETRY_DELAY = 800
const NETWORK_ERROR_INTERVAL = 2000
let lastNetworkErrorTime = 0

// 获取Token
function getToken() {
  try {
    return uni.getStorageSync(API_CONFIG.tokenKey) || ''
  } catch (e) {
    return ''
  }
}

// 保存Token
export function setToken(token) {
  try {
    uni.setStorageSync(API_CONFIG.tokenKey, token)
  } catch (e) {
    console.error('[API] 保存Token失败', e)
  }
}

// 清除Token
export function clearToken() {
  try {
    uni.removeStorageSync(API_CONFIG.tokenKey)
  } catch (e) {
    console.error('[API] 清除Token失败', e)
  }
}

// 获取设备ID
function getDeviceId() {
  try {
    let deviceId = uni.getStorageSync(API_CONFIG.deviceIdKey)
    if (!deviceId) {
      // 生成唯一设备ID
      deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      uni.setStorageSync(API_CONFIG.deviceIdKey, deviceId)
    }
    return deviceId
  } catch (e) {
    return 'dev_unknown'
  }
}

// 请求拦截器
function requestInterceptor(options) {
  const token = getToken()
  const deviceId = getDeviceId()

  // 设置请求头
  options.header = options.header || {}

  // Content-Type
  if (!options.header['Content-Type']) {
    options.header['Content-Type'] = 'application/json'
  }

  // Token认证（优先Authorization，兼容x-vpoker-token）
  if (token) {
    options.header['Authorization'] = 'Bearer ' + token
    options.header['x-vpoker-token'] = token
  }

  // 设备ID
  options.header['x-device-id'] = deviceId

  // APP版本
  options.header['x-app-version'] = '1.0.0'

  return options
}

// 响应拦截器
function responseInterceptor(response, options = {}) {
  const { statusCode, data } = response

  // 网络错误
  if (statusCode === 0) {
    return {
      success: false,
      error: '网络连接失败，请检查网络',
      statusCode: 0
    }
  }

  // 401未授权
  if (statusCode === 401) {
    if (!options.skipAuthRedirect) {
      clearToken()
      // 防抖：避免多个请求同时401导致重复reLaunch导航冲突
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true
        uni.reLaunch({ url: '/pages/login/login' })
        setTimeout(() => { isRedirectingToLogin = false }, 2000)
      }
    }
    return {
      success: false,
      error: data?.error || (options.skipAuthRedirect ? '账号或密码错误' : '登录已过期，请重新登录'),
      statusCode: 401
    }
  }

  // 403禁止访问
  if (statusCode === 403) {
    return {
      success: false,
      error: data?.error || '没有权限执行此操作',
      statusCode: 403
    }
  }

  // 404
  if (statusCode === 404) {
    return {
      success: false,
      error: '请求的资源不存在',
      statusCode: 404
    }
  }

  // 500服务器错误
  if (statusCode >= 500) {
    return {
      success: false,
      error: '服务器繁忙，请稍后重试',
      statusCode: statusCode
    }
  }

  // 成功响应
  if (statusCode >= 200 && statusCode < 300) {
    // 如果后端返回了error字段
    if (data && data.error) {
      return {
        success: false,
        error: data.error,
        data: data,
        statusCode: statusCode
      }
    }
    return {
      success: true,
      data: data,
      statusCode: statusCode
    }
  }

  // 其他状态码
  return {
    success: false,
    error: data?.error || '请求失败',
    data: data,
    statusCode: statusCode
  }
}

// 核心请求方法（支持重试）
function request(options, attempt = 0) {
  return new Promise((resolve, reject) => {
    // 请求拦截
    const finalOptions = requestInterceptor({
      url: API_CONFIG.baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: options.header || {},
      timeout: API_CONFIG.timeout,
    })

    uni.request({
      ...finalOptions,
      success: (response) => {
        const result = responseInterceptor(response, options)
        if (result.success) {
          resolve(result.data)
        } else {
          // 判断是否可重试
          const retryCount = options.retry ?? DEFAULT_RETRY_COUNT
          const canRetry = RETRYABLE_STATUSES.includes(result.statusCode) && attempt < retryCount && !options.silent
          if (canRetry) {
            const delay = (options.retryDelay || DEFAULT_RETRY_DELAY) * Math.pow(2, attempt)
            setTimeout(() => {
              request(options, attempt + 1).then(resolve).catch(reject)
            }, delay)
            return
          }
          // 显示错误提示（除非静默；404资源不存在静默处理，避免工作台频繁弹toast）
          if (!options.silent && result.statusCode !== 404) {
            uni.showToast({
              title: result.error,
              icon: 'none',
              duration: 2000
            })
          }
          if (result.statusCode === 404) {
            console.warn('[Request] 资源不存在(404):', options.url)
          }
          reject(result)
        }
      },
      fail: (error) => {
        // 网络失败也可重试
        const retryCount = options.retry ?? DEFAULT_RETRY_COUNT
        const canRetry = attempt < retryCount && !options.silent
        if (canRetry) {
          const delay = (options.retryDelay || DEFAULT_RETRY_DELAY) * Math.pow(2, attempt)
          setTimeout(() => {
            request(options, attempt + 1).then(resolve).catch(reject)
          }, delay)
          return
        }
        const result = {
          success: false,
          error: '网络连接失败，请检查网络',
          statusCode: 0,
          raw: error
        }
        if (!options.silent) {
          const now = Date.now()
          if (now - lastNetworkErrorTime > NETWORK_ERROR_INTERVAL) {
            lastNetworkErrorTime = now
            uni.showToast({
              title: '网络连接失败，请检查网络',
              icon: 'none',
              duration: 2000
            })
          }
        }
        reject(result)
      }
    })
  })
}

// GET请求
export function get(url, data, options = {}) {
  return request({ url, method: 'GET', data, ...options })
}

// POST请求
export function post(url, data, options = {}) {
  return request({ url, method: 'POST', data, ...options })
}

// PUT请求
export function put(url, data, options = {}) {
  return request({ url, method: 'PUT', data, ...options })
}

// PATCH请求
export function patch(url, data, options = {}) {
  return request({ url, method: 'PATCH', data, ...options })
}

// DELETE请求
export function del(url, data, options = {}) {
  return request({ url, method: 'DELETE', data, ...options })
}

export default {
  get,
  post,
  put,
  patch,
  del,
  setToken,
  clearToken,
  getToken: () => getToken()
}

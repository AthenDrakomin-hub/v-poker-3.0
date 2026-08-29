/**
 * V-Poker 认证 API
 */
import { post, get, setToken, clearToken } from './request.js'

// 登录
export function login(account, password) {
  // 登录失败的 401 是凭证错误，不应触发全局的登录过期跳转。
  return post('/api/auth/login', { account, password }, { skipAuthRedirect: true })
    .then(data => {
      // 保存Token
      if (data.token) {
        setToken(data.token)
      }
      return data
    })
}

// 注册
export function register(payload) {
  return post('/api/auth/register', payload, { silent: true })
    .then(data => {
      if (data.token) {
        setToken(data.token)
      }
      return data
    })
}

// 获取当前用户信息
export function getMe() {
  return get('/api/auth/me')
}

// 登出
export function logout() {
  return post('/api/auth/logout')
    .finally(() => {
      clearToken()
    })
}

// 修改密码
export function changePassword(oldPassword, newPassword, confirmPassword) {
  return post('/api/profile/password', {
    oldPassword,
    newPassword,
    confirmPassword
  })
}

// 检查登录状态
export function checkAuth() {
  return get('/api/auth/me', {}, { silent: true })
    .then(data => ({ isLoggedIn: true, user: data }))
    .catch(() => ({ isLoggedIn: false, user: null }))
}

export default {
  login,
  register,
  getMe,
  logout,
  changePassword,
  checkAuth
}

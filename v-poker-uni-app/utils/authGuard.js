/**
 * V-Poker 权限守卫系统
 * 角色：player / agent / top_agent / customer_service / admin
 * 纯横屏APP版本，所有页面均需横屏
 */

import { userState } from '../store/user.js'

// 角色层级（数值越大权限越高）
export const ROLE_LEVEL = {
  player: 0,
  agent: 1,
  top_agent: 2,
  customer_service: 3,
  admin: 99,
}

// 页面权限配置：路径 -> 允许的角色列表
export const PAGE_PERMISSIONS = {
  '/pages/workbench/workbench': ['agent', 'top_agent', 'admin'],
  '/pages/customer-service/customer-service': ['customer_service', 'admin'],
  '/pages/promotion/promotion': ['top_agent', 'admin'],
  '/pages/admin/admin': ['admin'],
}

// 角色对应的工作台入口配置
export const ROLE_WORKBENCH = {
  agent: {
    path: '/pages/workbench/workbench',
    name: '代理工作台',
    icon: '💼',
    color: '#FFBF00',
  },
  top_agent: {
    path: '/pages/promotion/promotion',
    name: '总代推广中心',
    icon: '👑',
    color: '#A78BFA',
  },
  customer_service: {
    path: '/pages/customer-service/customer-service',
    name: '客服工作台',
    icon: '🎧',
    color: '#63B3ED',
  },
  admin: {
    path: '/pages/admin/admin',
    name: '管理后台',
    icon: '⚙️',
    color: '#F87171',
  },
}

/**
 * 检查当前用户是否有权限访问指定页面
 * @param {string} path - 页面路径
 * @returns {boolean}
 */
export function canAccessPage(path) {
  const allowedRoles = PAGE_PERMISSIONS[path]
  if (!allowedRoles) return true // 未配置权限的页面默认可访问
  return allowedRoles.includes(userState.role)
}

/**
 * 检查当前用户角色是否达到指定层级
 * @param {string} role - 目标角色
 * @returns {boolean}
 */
export function hasRoleLevel(role) {
  const current = ROLE_LEVEL[userState.role] || 0
  const target = ROLE_LEVEL[role] || 0
  return current >= target
}

/**
 * 获取当前用户可用的工作台入口列表
 * @returns {Array}
 */
export function getAvailableWorkbenches() {
  const result = []
  // admin 可以看到所有工作台
  if (userState.role === 'admin') {
    Object.values(ROLE_WORKBENCH).forEach(w => result.push(w))
    return result
  }
  // 其他角色只看到自己的工作台
  const workbench = ROLE_WORKBENCH[userState.role]
  if (workbench) result.push(workbench)
  return result
}

/**
 * 权限拦截：尝试访问无权限页面时跳转
 * @param {string} path - 目标页面路径
 * @returns {boolean} - 是否允许跳转
 */
export function guardNavigation(path) {
  if (!canAccessPage(path)) {
    uni.showToast({
      title: '无权限访问该页面',
      icon: 'none',
      duration: 2000,
    })
    return false
  }
  return true
}

export default {
  ROLE_LEVEL,
  PAGE_PERMISSIONS,
  ROLE_WORKBENCH,
  canAccessPage,
  hasRoleLevel,
  getAvailableWorkbenches,
  guardNavigation,
}

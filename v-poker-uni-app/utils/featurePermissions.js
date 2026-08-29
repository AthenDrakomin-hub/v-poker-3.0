/**
 * V-Poker 功能权限引擎
 * 按角色管控大厅功能的显隐与可用性
 *
 * 权限存储结构:
 *   {
 *     "player":  { "game.niuniu": true, "tab.rooms": true, ... },
 *     "agent":   { ... },
 *     "top_agent": { ... },
 *     "customer_service": { ... }
 *   }
 *
 * 未配置的角色回退到 DEFAULT_ROLE_PERMISSIONS
 * 未配置的功能 key 默认为 true（兼容新增功能）
 */

import { userState } from '../store/user.js'

// ========== 服务器权限缓存 ==========
// 从 /api/auth/me 获取的当前用户权限，优先于默认值和本地存储
let userPermCache = null

/**
 * 设置当前用户的权限缓存（从服务器 /api/auth/me 获取）
 * @param {Object} perms - { featureKey: boolean }
 */
export function setUserPermissions(perms) {
  // 严格类型检查：只接受纯对象，拒绝数组、null、undefined等
  if (!perms || typeof perms !== 'object' || Array.isArray(perms)) {
    console.warn('[FeaturePerm] 忽略无效的权限缓存格式:', typeof perms)
    return
  }
  // 只保留值为布尔类型的权限项，过滤掉无效数据
  const validPerms = {}
  Object.keys(perms).forEach(key => {
    if (typeof perms[key] === 'boolean') {
      validPerms[key] = perms[key]
    }
  })
  userPermCache = Object.keys(validPerms).length > 0 ? validPerms : null
}

/**
 * 清除用户权限缓存（登出时调用）
 */
export function clearUserPermissions() {
  userPermCache = null
}

// ========== 功能注册表 ==========
// 所有可被权限管控的大厅功能，管理员界面据此渲染矩阵
export const FEATURE_REGISTRY = [
  // --- 游戏入口 ---
  { key: 'game.niuniu',  category: '游戏入口', label: '抢庄牛牛',  icon: 'bull' },
  { key: 'game.sangong', category: '游戏入口', label: '抢庄三公',  icon: 'cards' },
  { key: 'game.tbnn',    category: '游戏入口', label: '通比牛牛',  icon: 'bull' },
  { key: 'game.jinhua',  category: '游戏入口', label: '炸金花',    icon: 'fan' },
  { key: 'game.texas',   category: '游戏入口', label: '德州扑克',  icon: 'spade' },

  // --- 底部导航 ---
  { key: 'tab.rooms',   category: '底部导航', label: '房间大厅', icon: 'cards' },
  { key: 'tab.mine',    category: '底部导航', label: '我的房间', icon: 'user' },
  { key: 'tab.wallet',  category: '底部导航', label: '我的钱包', icon: 'coin' },
  { key: 'tab.profile', category: '底部导航', label: '个人中心', icon: 'gear' },
  { key: 'tab.workbench',    category: '底部导航', label: '代理工作台', icon: 'gear' },
  { key: 'tab.topWorkbench', category: '底部导航', label: '总代理工作台', icon: 'trophy' },
  { key: 'tab.admin',        category: '底部导航', label: '管理工作台', icon: 'gear' },
  { key: 'tab.csWorkbench', category: '底部导航', label: '客服工作台', icon: 'headset' },

  // --- 右侧悬浮 ---
  { key: 'float.join',    category: '右侧悬浮', label: '加入房间', icon: 'search' },
  { key: 'float.service', category: '右侧悬浮', label: '客服',     icon: 'headset' },
  { key: 'float.help',    category: '右侧悬浮', label: '帮助',     icon: 'help' },
  { key: 'float.notify',  category: '右侧悬浮', label: '消息',     icon: 'warning' },
]

// 按分类分组的便捷视图
export function getFeaturesByCategory() {
  const map = {}
  FEATURE_REGISTRY.forEach(f => {
    if (!map[f.category]) map[f.category] = []
    map[f.category].push(f)
  })
  return map
}

// ========== 默认角色权限 ==========
// admin 不受此表限制，始终全开
const ALL_FEATURES = FEATURE_REGISTRY.reduce((acc, f) => {
  acc[f.key] = true
  return acc
}, {})

export const DEFAULT_ROLE_PERMISSIONS = {
  // 普通玩家：基础游戏 + 基础导航，无代理功能，不可见客服入口
  player: {
    ...ALL_FEATURES,
    'float.service': false,
    'tab.workbench': false,
    'tab.topWorkbench': false,
    'tab.admin': false,
  },
  // 代理：可创建房间、查看佣金，有代理工作台
  agent: {
    ...ALL_FEATURES,
    'tab.topWorkbench': false,
    'tab.admin': false,
  },
  // 总代：全部开放，有总代理工作台
  top_agent: {
    ...ALL_FEATURES,
    'tab.admin': false,
  },
  // 客服：无游戏入口，只有客服工作台+个人中心
  customer_service: {
    ...ALL_FEATURES,
    'game.niuniu': false,
    'game.sangong': false,
    'game.tbnn': false,
    'game.jinhua': false,
    'game.texas': false,
    'tab.rooms': false,
    'tab.mine': false,
    'tab.wallet': false,
    'tab.workbench': false,
    'tab.topWorkbench': false,
    'tab.admin': false,
    'tab.csWorkbench': true,
    'float.join': false,
    'float.service': false,
  },
}

// ========== 持久化 ==========
const STORAGE_KEY = 'vpoker_role_permissions'

function loadStoredPermissions() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('[FeaturePerm] 读取权限配置失败', e)
  }
  return {}
}

function saveStoredPermissions(config) {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.error('[FeaturePerm] 保存权限配置失败', e)
  }
}

// ========== 核心查询 ==========

/**
 * 获取指定角色的完整权限表（合并默认值 + 管理员覆盖）
 * @param {string} role
 * @returns {Object} { featureKey: boolean }
 */
export function getRolePermissions(role) {
  if (role === 'admin') {
    // admin 永远全开
    return { ...ALL_FEATURES }
  }
  // 优先使用服务器返回的用户权限缓存
  let perms
  if (userPermCache) {
    perms = { ...ALL_FEATURES, ...userPermCache }
  } else {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.player
    const stored = loadStoredPermissions()
    const overrides = stored[role] || {}
    perms = { ...defaults, ...overrides }
  }
  // 安全兜底：非客服角色强制开放所有游戏入口（防止权限配置错误导致大厅空白）
  if (role !== 'customer_service') {
    perms['game.niuniu'] = true
    perms['game.sangong'] = true
    perms['game.tbnn'] = true
    perms['game.jinhua'] = true
    perms['game.texas'] = true
    perms['tab.rooms'] = true
  }
  return perms
}

/**
 * 检查当前用户是否拥有指定功能权限
 * @param {string} featureKey
 * @returns {boolean}
 */
export function hasFeature(featureKey) {
  const role = userState.role || 'player'
  const perms = getRolePermissions(role)
  // 未注册的功能 key 默认放行
  return perms[featureKey] !== false
}

/**
 * 检查指定角色是否拥有某功能
 */
export function roleHasFeature(role, featureKey) {
  const perms = getRolePermissions(role)
  return perms[featureKey] !== false
}

/**
 * 获取当前用户可见的功能 key 列表
 */
export function getVisibleFeatures() {
  const role = userState.role || 'player'
  const perms = getRolePermissions(role)
  return FEATURE_REGISTRY.filter(f => perms[f.key] !== false).map(f => f.key)
}

/**
 * 过滤数组：根据权限保留项（每项需有 permissionKey 字段）
 * @param {Array} items
 * @returns {Array}
 */
export function filterByPermission(items) {
  return items.filter(item => {
    if (!item.permissionKey) return true
    return hasFeature(item.permissionKey)
  })
}

// ========== 管理员配置 ==========

/**
 * 获取所有角色的权限配置（用于管理后台展示）
 * @returns {Object} { role: { featureKey: boolean } }
 */
export function getAllRolePermissions() {
  const result = {}
  const stored = loadStoredPermissions()
  ;['player', 'agent', 'top_agent', 'customer_service'].forEach(role => {
    result[role] = getRolePermissions(role)
  })
  return result
}

/**
 * 更新指定角色的单个功能权限
 * @param {string} role
 * @param {string} featureKey
 * @param {boolean} enabled
 */
export function setRoleFeature(role, featureKey, enabled) {
  if (role === 'admin') return // admin 不可修改
  const stored = loadStoredPermissions()
  if (!stored[role]) stored[role] = {}
  stored[role][featureKey] = enabled
  saveStoredPermissions(stored)
}

/**
 * 批量更新指定角色的权限
 * @param {string} role
 * @param {Object} permissions - { featureKey: boolean }
 */
export function setRolePermissions(role, permissions) {
  if (role === 'admin') return
  const stored = loadStoredPermissions()
  stored[role] = { ...permissions }
  saveStoredPermissions(stored)
}

/**
 * 重置指定角色为默认权限
 * @param {string} role
 */
export function resetRolePermissions(role) {
  if (role === 'admin') return
  const stored = loadStoredPermissions()
  delete stored[role]
  saveStoredPermissions(stored)
}

/**
 * 重置全部角色权限为默认
 */
export function resetAllPermissions() {
  try {
    uni.removeStorageSync(STORAGE_KEY)
  } catch (e) {}
}

export default {
  FEATURE_REGISTRY,
  getFeaturesByCategory,
  DEFAULT_ROLE_PERMISSIONS,
  getRolePermissions,
  hasFeature,
  roleHasFeature,
  getVisibleFeatures,
  filterByPermission,
  getAllRolePermissions,
  setRoleFeature,
  setRolePermissions,
  resetRolePermissions,
  resetAllPermissions,
  setUserPermissions,
  clearUserPermissions,
}

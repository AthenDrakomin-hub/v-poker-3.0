/**
 * V-Poker 角色权限 API
 * 对接后端 /api/admin/permissions 系列接口（feature key 模型）
 */
import { get, put, del } from './request.js'

/**
 * 获取所有角色的权限配置
 * 后端: GET /api/admin/permissions
 * @returns {Promise<Object>} { permissions: { role: { featureKey: boolean } }, featureKeys: string[] }
 */
export function getAllPermissions() {
  return get('/api/admin/permissions')
}

/**
 * 获取指定角色的权限
 * @param {string} role
 * @returns {Promise<Object>} { featureKey: boolean }
 */
export function getRolePermissions(role) {
  return getAllPermissions().then(data => {
    return (data.permissions && data.permissions[role]) || {}
  })
}

/**
 * 批量更新指定角色的权限
 * 后端: PUT /api/admin/permissions/:role
 * @param {string} role
 * @param {Object} permissions - { featureKey: boolean }
 */
export function updateRolePermissions(role, permissions) {
  return put(`/api/admin/permissions/${role}`, permissions)
}

/**
 * 重置指定角色为默认权限
 * 后端: DELETE /api/admin/permissions/:role
 * @param {string} role
 */
export function resetRolePermissions(role) {
  return del(`/api/admin/permissions/${role}`)
}

/**
 * 重置全部角色权限为默认
 * 逐个删除所有非 admin 角色的权限配置
 */
export function resetAllPermissions() {
  const roles = ['player', 'agent', 'top_agent', 'customer_service']
  return Promise.all(roles.map(role => resetRolePermissions(role)))
}

export default {
  getAllPermissions,
  getRolePermissions,
  updateRolePermissions,
  resetRolePermissions,
  resetAllPermissions,
}

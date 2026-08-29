/**
 * V-Poker 管理后台 API
 */
import { get, post, put, patch, del } from './request.js'

// 获取平台统计数据
export function getAdminStats() {
  return get('/api/admin/stats')
}

// 获取用户列表
export function getUserList(params) {
  return get('/api/admin/users', params)
}

// 获取用户详情
export function getUserDetail(userId) {
  return get(`/api/admin/users/${userId}`)
}

// 获取用户运营详情（登录日志、风险标签等）
export function getUserAdminDetails(userId) {
  return get(`/api/admin/users/${userId}/details`)
}

// 创建用户
export function createUser(data) {
  return post('/api/admin/users', data)
}

// 更新用户
export function updateUser(userId, data) {
  return patch('/api/admin/users', { userId, ...data })
}

// 按管理接口更新用户字段
export function patchUser(data) {
  return patch('/api/admin/users', data)
}

// 删除用户
export function deleteUser(userId) {
  return post(`/api/admin/users/${userId}/soft-delete`)
}

// 恢复软删除用户
export function restoreUser(userId) {
  return post(`/api/admin/users/${userId}/restore`)
}

// 获取风险标签字典
export function getRiskTags() {
  return get('/api/admin/risk-tags')
}

// 添加用户风险标签
export function addUserRiskTag(userId, data) {
  return post(`/api/admin/users/${userId}/risk-tag`, data)
}

// 移除用户风险标签
export function removeUserRiskTag(userId, tagId) {
  return del(`/api/admin/users/${userId}/risk-tag/${tagId}`)
}

// 获取登录日志
export function getLoginLogs(params) {
  return get('/api/admin/login-logs', params)
}

// 调整用户筹码
export function adjustUserPoints(userId, amount, note) {
  return post('/api/admin/adjust-points', {
    userId,
    amount,
    note
  })
}

// 获取客服操作记录
export function getCsOperations(params) {
  return get('/api/admin/cs-operations', params)
}

// 获取房间列表
export function getAdminRoomList(params) {
  return get('/api/admin/rooms', params)
}

// 获取管理端房间汇总列表
export function getAdminRoomHistory(params) {
  return get('/api/admin/room-history', params)
}

// 获取指定房间的逐局审计记录
export function getAdminRoomRounds(roomNo, params) {
  return get(`/api/admin/rooms/${roomNo}/rounds`, params)
}

// 获取待复核请求
export function getPendingApprovals(params) {
  return get('/api/admin/approvals/pending', params)
}

export function approveRequest(id, note) {
  return post(`/api/admin/approvals/${id}/approve`, { note })
}

export function rejectRequest(id, reason) {
  return post(`/api/admin/approvals/${id}/reject`, { reason })
}

export function getRoomAnomalies(roomId, params) {
  return get(`/api/admin/rooms/${roomId}/anomalies`, params)
}

export function createRoomAnomaly(roomId, data) {
  return post(`/api/admin/rooms/${roomId}/anomalies`, data)
}

export function getCsConversations(params) {
  return get('/api/admin/cs/conversations', params)
}

export function getAgentTree(params) {
  return get('/api/admin/agents/tree', params)
}

export function getAgentCommissionReport(agentId, params) {
  return get(`/api/admin/agents/${agentId}/commission-report`, params)
}

export function getConfigHistory(params) {
  return get('/api/admin/config/history', params)
}

export function createConfigDraft(data) {
  return post('/api/admin/config/draft', data)
}

export function publishConfigDraft(id) {
  return put(`/api/admin/config/draft/${id}/publish`)
}

export function rollbackConfig(data) {
  return post('/api/admin/config/rollback', data)
}

// 强制结束房间
export function forceEndRoom(roomId) {
  return post(`/api/admin/rooms/${roomId}/force-end`)
}

// 获取审计日志
export function getAuditLogs(params) {
  return get('/api/admin/audit-logs', params)
}

// 获取系统配置
export function getSystemConfig() {
  return get('/api/admin/config')
}

// 更新系统配置
export function updateSystemConfig(config) {
  return put('/api/admin/config', config)
}

// 设置用户角色
export function setUserRole(userId, role) {
  return post('/api/admin/set-role', { userId, role })
}

// 冻结用户
export function freezeUser(userId) {
  return post(`/api/admin/users/${userId}/freeze`)
}

// 解冻用户
export function unfreezeUser(userId) {
  return post(`/api/admin/users/${userId}/unfreeze`)
}

// 获取权限配置
export function getPermissions() {
  return get('/api/admin/permissions')
}

// 更新角色权限（批量更新）
export function updatePermission(role, permissions) {
  return put(`/api/admin/permissions/${role}`, permissions)
}

// 重置角色权限
export function deletePermission(role) {
  return del(`/api/admin/permissions/${role}`)
}

// 获取平台账本
export function getAdminLedger(params) {
  return get('/api/admin/ledger', params)
}

// 获取客服人员列表
export function getCsStaff(params) {
  return get('/api/admin/cs-staff', params)
}

// 获取客服报表
export function getCsReport(params) {
  return get('/api/admin/cs-report', params)
}

// 客服操作（封禁/解封/警告等）
export function csOperation(data) {
  return post('/api/admin/cs-operations', data)
}

// 设置客服接待状态（online/offline）
export function setCsStatus(csId, status) {
  return put(`/api/admin/cs-status/${csId}`, { status })
}

// 获取经济模型配置列表（后端在/api/economy/*）
export function getEconomyV2Games() {
  return get('/api/admin/economy-v2/games')
}

// 获取单个游戏经济模型配置
export function getEconomyV2Game(gameType) {
  return get(`/api/admin/economy-v2/games/${gameType}`)
}

// 获取经济模型变更历史
export function getEconomyV2History(params) {
  return get('/api/admin/economy-v2/history', params)
}

// 重载经济模型配置
export function reloadEconomyV2() {
  return post('/api/admin/economy-v2/reload')
}

// 获取经济模型模板列表
export function getEconomyV2Templates() {
  return get('/api/admin/economy-v2/templates')
}

// 获取单个经济模型模板
export function getEconomyV2Template(templateCode, gameType) {
  return get(`/api/admin/economy-v2/templates/${templateCode}`, { gameType })
}

// 更新游戏经济配置
export function updateEconomyV2Game(gameType, data) {
  return put(`/api/admin/economy-v2/games/${gameType}`, data)
}

// 更新房间模板配置
export function updateEconomyV2Template(templateCode, data) {
  return put(`/api/admin/economy-v2/templates/${templateCode}`, data)
}

export default {
  getAdminStats,
  getUserList,
  getUserDetail,
  getUserAdminDetails,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  restoreUser,
  getRiskTags,
  addUserRiskTag,
  removeUserRiskTag,
  getLoginLogs,
  adjustUserPoints,
  getAdminRoomList,
  getAdminRoomHistory,
  getAdminRoomRounds,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  getRoomAnomalies,
  createRoomAnomaly,
  getCsConversations,
  getAgentTree,
  getAgentCommissionReport,
  getConfigHistory,
  createConfigDraft,
  publishConfigDraft,
  rollbackConfig,
  forceEndRoom,
  getAuditLogs,
  getSystemConfig,
  updateSystemConfig,
  setUserRole,
  freezeUser,
  unfreezeUser,
  getPermissions,
  updatePermission,
  deletePermission,
  getAdminLedger,
  getCsStaff,
  getCsReport,
  getCsOperations,
  csOperation,
  setCsStatus,
  getEconomyV2Games,
  getEconomyV2Game,
  getEconomyV2History,
  reloadEconomyV2,
  getEconomyV2Templates,
  getEconomyV2Template,
  updateEconomyV2Game,
  updateEconomyV2Template
}

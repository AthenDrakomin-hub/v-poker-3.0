/**
 * V-Poker 代理 API
 */
import { get, post } from './request.js'

// 获取下级玩家列表
export function getAgentPlayers(params) {
  return get('/api/agent/players', params)
}

// 获取推广数据
export function getPromotionData() {
  return get('/api/agent/promotion')
}

// 升级玩家为代理
export function promotePlayer(userId) {
  return post('/api/agent/promote', { userId })
}

// 给直招玩家上下分
export function adjustPlayerChips(userId, amount, note) {
  return post('/api/agent/players', { userId, amount, note })
}

// 调整下线代理筹码（一级代理调二级代理，总代理调所有下线代理）
// 从调用者账户转出，不是凭空发行
export function adjustPlayerPoints(targetId, amount, note) {
  return post('/api/agent/adjust-points', {
    targetId,
    amount,
    note
  })
}

// 获取玩家详情
export function getPlayerDetail(userId) {
  return get(`/api/agent/players/${userId}`)
}

// 获取邀请码
export function getInviteCode() {
  return get('/api/agent/invite-code')
}

// 生成新邀请码（重新生成，覆盖旧码）
export function generateInviteCode() {
  return post('/api/agent/invite-code/regenerate')
}

// 获取房间级分配明细
export function getDistributionRecords(params) {
  return get('/api/agent/distribution-records', params)
}

// 获取代理筹码交易记录
export function getAgentChipTransactions(params) {
  return get('/api/agent/chip-transactions', params)
}

// 获取代理历史记录
export function getAgentHistory(params) {
  return get('/api/agent/history', params)
}

// 获取代理账本
export function getAgentLedger(params) {
  return get('/api/agent/ledger', params)
}

// 冻结/解冻下线代理（总代理专用）
export function freezeAgent(agentId, action) {
  return post(`/api/agent/freeze/${agentId}`, { action })
}

export default {
  getAgentPlayers,
  getPromotionData,
  promotePlayer,
  adjustPlayerChips,
  adjustPlayerPoints,
  getPlayerDetail,
  getInviteCode,
  generateInviteCode,
  getDistributionRecords,
  getAgentChipTransactions,
  getAgentHistory,
  getAgentLedger,
  freezeAgent
}

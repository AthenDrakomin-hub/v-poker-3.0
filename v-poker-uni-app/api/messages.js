/**
 * V-Poker 客服消息 API
 * 代理 <-> 客服 通信
 */
import { get, post } from './request.js'

// 获取客服列表（代理联系客服用）
export function getCsList() {
  return get('/api/messages/cs-list')
}

// 获取与某人的聊天记录（支持分页：beforeId 加载更早消息）
export function getMessages(peerId, beforeId = null, limit = 50) {
  const params = { peerId, limit }
  if (beforeId) params.beforeId = beforeId
  return get('/api/messages', params)
}

// 获取联系人列表
export function getContacts() {
  return get('/api/messages/contacts')
}

// 获取未读消息总数
export function getUnreadCount() {
  return get('/api/messages/unread-count')
}

// 发送消息
export function sendMessage(receiverId, content, type = 'text', relatedData = null) {
  const body = { receiverId, content, type }
  if (relatedData) body.relatedData = relatedData
  return post('/api/messages', body)
}

// 批量标记与某人的对话为已读
export function markMessagesRead(peerId) {
  return post('/api/messages/read', { peerId })
}

// 标记筹码申请为已处理（客服专用）
export function processChipRequest(messageId) {
  return post(`/api/messages/${messageId}/process`, {})
}

// 自动分配客服（优先在线、会话最少）
export function assignCs() {
  return get('/api/messages/assign-cs')
}

// 客服转接会话
export function transferSession(userId, targetCsId, reason = '') {
  return post('/api/messages/transfer', { userId, targetCsId, reason })
}

// 管理员查询所有聊天记录（支持筛选+分页）
export function getAdminMessages(params = {}) {
  return get('/api/admin/messages', params)
}

// 管理员查看客服聊天统计
export function getAdminMessageStats(days = 7) {
  return get('/api/admin/messages/stats', { days })
}

export default {
  getCsList,
  getMessages,
  getContacts,
  getUnreadCount,
  sendMessage,
  markMessagesRead,
  processChipRequest,
  assignCs,
  transferSession,
  getAdminMessages,
  getAdminMessageStats,
}

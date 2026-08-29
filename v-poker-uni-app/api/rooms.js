/**
 * V-Poker 房间 API
 */
import { get, post, put } from './request.js'

// 创建房间
export function createRoom(gameType, config) {
  return post('/api/rooms/create', {
    gameType,
    ...config
  })
}

// 加入房间（通过房间号+密码）
export function joinRoom(roomNo, password = '', spectate = false) {
  return post('/api/rooms/join', { roomNo, password, spectate })
}

// 离开房间
export function leaveRoom(roomId) {
  return post('/api/rooms/leave', { roomId })
}

// 获取房间详情
export function getRoom(roomId) {
  return get(`/api/rooms/${roomId}`)
}

// 获取房间牌局状态
export function getRoomHand(roomId) {
  return get(`/api/rooms/${roomId}/hand`)
}

// 获取牌局快照（断线重连或 Socket 事件跳号时使用）
export function getRoomHandSnapshot(roomId, afterSequence) {
  const data = afterSequence == null ? {} : { afterSequence }
  return get(`/api/rooms/${roomId}/hand/snapshot`, data)
}

// 开始新一局（房主调用，发牌）
export function startHand(roomId) {
  return post(`/api/rooms/${roomId}/hand`)
}

// 执行游戏操作
export function performAction(roomId, action, data) {
  return put(`/api/rooms/${roomId}/hand`, {
    action,
    ...data
  })
}

// 获取我创建的房间
export function getMyRooms() {
  return get('/api/rooms/mine')
}

// 获取我加入的房间
export function getJoinedRooms() {
  return get('/api/rooms/joined')
}

// 获取下属代理创建的房间列表（总代理专用）
export function getSubordinateRooms(params) {
  return get('/api/rooms', { scope: 'subordinate', ...params })
}

// 获取房间列表（大厅）
export function getRoomList(params) {
  return get('/api/rooms/mine', params)
}

// 获取房间聊天记录
export function getRoomChat(roomId) {
  return get(`/api/rooms/${roomId}/chat`)
}

// 发送聊天消息
export function sendRoomChat(roomId, message) {
  return post(`/api/rooms/${roomId}/chat`, { content: message })
}

// 解散房间（房主）
export function dissolveRoom(roomId) {
  return post(`/api/rooms/${roomId}/dissolve`)
}

// 踢出玩家（房主）
export function kickPlayer(roomId, userId) {
  return post(`/api/rooms/${roomId}/kick`, { targetUserId: userId })
}

// 添加机器人到房间（房主）
export function addBotToRoom(roomId) {
  return post(`/api/bot/rooms/${roomId}/add`, {})
}

// 移除房间内机器人（房主）
export function removeBotFromRoom(roomId, botUserId) {
  return post(`/api/bot/rooms/${roomId}/remove`, { botUserId })
}

// 获取房间内机器人列表
export function getRoomBots(roomId) {
  return get(`/api/bot/rooms/${roomId}/list`)
}

// 获取可用机器人数量
export function getAvailableBots() {
  return get('/api/bot/available')
}

// 获取房间模板配置
export function getRoomTemplates(gameType) {
  return get(`/api/rooms/templates/${gameType}`)
}

// 获取房间历史记录（用户参与过的已结束房间列表）
export function getRoomHistory(params) {
  return get('/api/rooms/history', params)
}

// 获取房间内每局记录（单个房间的25局详情）
export function getRoomRounds(roomId) {
  return get(`/api/rooms/${roomId}/rounds`)
}

// 准备游戏
export function readyRoom(roomId) {
  return post(`/api/rooms/${roomId}/ready`)
}

// 准备下一局
export function readyNext(roomId) {
  return post(`/api/rooms/${roomId}/ready_next`)
}

// 设置自动玩
export function setAutoPlay(roomId, enabled) {
  return post(`/api/rooms/${roomId}/auto-play`, { autoPlay: enabled })
}

// 观战
export function spectateRoom(roomId) {
  return post(`/api/rooms/${roomId}/spectate`)
}

// 送礼/房间内上下分
export function adjustRoomPoints(roomId, targetUserId, amount) {
  return post(`/api/rooms/${roomId}/gift`, { targetUserId, amount })
}

// 重新生成一次性邀请凭据
export function regenerateRoomInvite(roomId) {
  return post(`/api/rooms/${roomId}/regenerate-invite`)
}

// 通过一次性邀请凭据加入房间
export function joinRoomByToken(token) {
  return post('/api/rooms/join-by-token', { token })
}

// 获取房间筹码交易记录
export function getRoomChipTransactions(roomId, params) {
  return get(`/api/rooms/${roomId}/chip-transactions`, params)
}

// 提前结算
export function earlySettle(roomId) {
  return post(`/api/rooms/${roomId}/early-settle`)
}

// 继续游戏（25局结束后续开）
export function continueRoom(roomId) {
  return post(`/api/rooms/${roomId}/continue`)
}

// 暂停游戏
export function pauseRoom(roomId) {
  return post(`/api/rooms/${roomId}/pause`)
}

// 恢复游戏
export function resumeRoom(roomId) {
  return post(`/api/rooms/${roomId}/resume`)
}

export default {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  getRoomHand,
  getRoomHandSnapshot,
  startHand,
  performAction,
  getMyRooms,
  getJoinedRooms,
  getSubordinateRooms,
  getRoomList,
  getRoomChat,
  sendRoomChat,
  dissolveRoom,
  kickPlayer,
  getRoomTemplates,
  getRoomHistory,
  getRoomRounds,
  readyRoom,
  readyNext,
  setAutoPlay,
  spectateRoom,
  adjustRoomPoints,
  regenerateRoomInvite,
  joinRoomByToken,
  getRoomChipTransactions,
  earlySettle,
  continueRoom,
  pauseRoom,
  resumeRoom
}

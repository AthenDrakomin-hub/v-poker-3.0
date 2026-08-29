/**
 * V-Poker 个人资料 API
 */
import { get, post, put } from './request.js'

// 获取个人资料（含游戏历史、战绩统计）
export function getProfile() {
  return get('/api/profile')
}

// 获取当前用户按房间聚合的历史战绩
export function getMyGameHistory(params) {
  return get('/api/profile/room-history', params)
}

// 获取当前用户在指定房间的逐局记录
export function getMyRoomRounds(roomNo, params) {
  return get(`/api/profile/room-history/${roomNo}/rounds`, params)
}

// 修改昵称
export function updateNickname(nickname) {
  return put('/api/profile/nickname', { nickname })
}

// 修改头像
export function updateAvatar(avatar) {
  return put('/api/profile/avatar', { avatar })
}

// 获取登录设备列表
export function getMyDevices() {
  return get('/api/profile/devices')
}

// 强制修改密码（首次登录）
export function forceChangePassword() {
  return post('/api/profile/force-change-password')
}

export default {
  getProfile,
  getMyGameHistory,
  getMyRoomRounds,
  updateNickname,
  updateAvatar,
  getMyDevices,
  forceChangePassword
}

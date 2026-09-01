/**
 * V-Poker WebSocket 连接管理
 * 使用 socket.io-client 标准库，兼容 H5 / Android / iOS
 */
import { io, Socket } from 'socket.io-client'
import { API_CONFIG } from '../api/config.js'

let socketInstance = null
let connected = false
let currentRoomId = null

function getSocketUrl() {
  const base = API_CONFIG.baseUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '')
  return `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${base}`
}

export function getSocket() {
  if (socketInstance) return socketInstance

  const token = uni.getStorageSync(API_CONFIG.tokenKey) || ''

  socketInstance = io(getSocketUrl(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  })

  socketInstance.on('connect', () => {
    connected = true
    console.log('[WS] 已连接, id:', socketInstance.id)
  })

  socketInstance.on('disconnect', (reason) => {
    connected = false
    console.log('[WS] 已断开:', reason)
  })

  socketInstance.on('connect_error', (err) => {
    console.warn('[WS] 连接错误:', err.message)
    uni.showToast({ title: '网络连接失败', icon: 'none' })
  })

  // 重连成功后自动重新加入房间
  socketInstance.on('reconnect', (attemptNum) => {
    console.log(`[WS] 重连成功，第 ${attemptNum} 次`)
    if (currentRoomId !== null) {
      emitWithRequestId('join_room', { roomId: currentRoomId })
    }
  })

  return socketInstance
}

export function isSocketConnected() {
  return connected
}

export function getCurrentRoomId() {
  return currentRoomId
}

export function setCurrentRoomId(roomId) {
  currentRoomId = roomId
}

export function emitWithRequestId(event, data, callback) {
  if (!socketInstance) return false
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
  const payload = { ...data, client_request_id: requestId }
  socketInstance.emit(event, payload, callback)
  return requestId
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
    connected = false
    currentRoomId = null
  }
}

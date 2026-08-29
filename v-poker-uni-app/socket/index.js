/**
 * V-Poker WebSocket 封装
 * Socket.io v4 协议 over WebSocket，兼容 uni-app APP/H5
 *
 * 协议流程：
 *   1. WebSocket 连接 ws://host/socket.io/?EIO=4&transport=websocket
 *   2. 服务端发 Engine.IO open 包: 0{"sid":"...","pingInterval":25000,"pingTimeout":60000}
 *   3. 客户端发 Socket.IO 连接包(带auth): 40{"token":"xxx"}
 *   4. 服务端发连接确认: 40 或 40{...}
 *   5. 事件: 42["event_name", data]
 *   6. 心跳: 服务端发 2(ping)，客户端回 3(pong)
 */
import { API_CONFIG } from '../api/config.js'

// Socket 单例
let socketInstance = null
let reconnectTimer = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10

/**
 * 获取 Token
 */
function getToken() {
  try {
    return uni.getStorageSync(API_CONFIG.tokenKey) || ''
  } catch (e) {
    return ''
  }
}

/**
 * 创建 WebSocket 连接
 * Socket.io 挂在根路径 /socket.io，不在 /api 下
 */
function createSocket() {
  const wsBase = API_CONFIG.baseUrl.replace('/api', '').replace(/^http/, 'ws')
  const wsUrl = wsBase + '/socket.io/?EIO=4&transport=websocket'

  return uni.connectSocket({
    url: wsUrl,
    protocols: [],
    complete: () => {}
  })
}

/**
 * Socket 管理器
 */
class SocketManager {
  constructor() {
    this.socketTask = null
    this.connected = false       // Socket.IO 握手完成标志
    this.socketId = null
    this.heartbeatTimer = null
    this.eventHandlers = {}
    this._manualDisconnect = false
    this._connectResolve = null
    this._connectReject = null
  }

  /**
   * 连接（等待 Socket.IO 握手完成后 resolve）
   */
  connect() {
    if (this.connected) {
      return Promise.resolve()
    }
    this._manualDisconnect = false

    return new Promise((resolve, reject) => {
      this._connectResolve = resolve
      this._connectReject = reject

      try {
        this.socketTask = createSocket()

        // WebSocket 已开 — 等待 Engine.IO open 包（0包），不设 connected
        this.socketTask.onOpen(() => {})

        // 接收消息
        this.socketTask.onMessage((res) => {
          this.handleMessage(res.data)
        })

        // 连接关闭
        this.socketTask.onClose(() => {
          this.connected = false
          this.stopHeartbeat()
          this.emit('disconnect', {})

          // 连接未建立就关闭，reject
          if (this._connectReject) {
            this._connectReject(new Error('Socket closed before handshake'))
            this._connectReject = null
            this._connectResolve = null
          }

          // 非主动断开则自动重连
          if (!this._manualDisconnect) {
            this.tryReconnect()
          }
        })

        // 连接错误
        this.socketTask.onError((err) => {
          console.error('[Socket] 连接错误', err)
          this.emit('error', err)
          if (this._connectReject) {
            this._connectReject(err)
            this._connectReject = null
            this._connectResolve = null
          }
        })

      } catch (e) {
        console.error('[Socket] 创建连接失败', e)
        reject(e)
      }
    })
  }

  /**
   * 处理消息（Socket.IO v4 协议解析）
   */
  handleMessage(data) {
    if (typeof data !== 'string') return
    try {
      // Engine.IO open 包: 0{"sid":"...","pingInterval":25000,"pingTimeout":60000}
      if (data.startsWith('0{')) {
        const info = JSON.parse(data.substring(1))
        this.socketId = info.sid
        // 发送 Socket.IO namespace 连接包，带 auth token
        // 后端从 socket.handshake.auth.token 读取
        const token = getToken()
        const connectPacket = token ? '40' + JSON.stringify({ token }) : '40'
        this.send(connectPacket)
        return
      }

      // Socket.IO 连接确认: 40 或 40{...}
      if (data.startsWith('40')) {
        const wasReconnect = reconnectAttempts > 0
        this.connected = true
        reconnectAttempts = 0
        this.emit('connect', { socketId: this.socketId })
        // 重连成功后额外 emit reconnect，让上层重新订阅房间事件
        if (wasReconnect) {
          this.emit('reconnect', { socketId: this.socketId })
        }
        if (this._connectResolve) {
          this._connectResolve()
          this._connectResolve = null
          this._connectReject = null
        }
        return
      }

      // 事件消息: 42["event_name", data]
      if (data.startsWith('42')) {
        const parsed = JSON.parse(data.substring(2))
        const eventName = parsed[0]
        const eventData = parsed[1]
        this.emit(eventName, eventData)
        return
      }

      // Engine.IO Ping: 2（服务端发起，客户端回 pong）
      if (data === '2') {
        this.send('3')
        return
      }

      // Socket.IO 错误: 44
      if (data.startsWith('44')) {
        this.emit('error', { message: data.substring(2) })
      }
    } catch (e) {
      console.error('[Socket] 消息解析失败', e, data)
    }
  }

  /**
   * 发送原始数据
   */
  send(data) {
    if (!this.socketTask) {
      console.warn('[Socket] 未连接，无法发送')
      return false
    }
    try {
      this.socketTask.send({ data })
      return true
    } catch (e) {
      console.error('[Socket] 发送失败', e)
      return false
    }
  }

  /**
   * 发送 Socket.IO 事件
   */
  emitEvent(eventName, data, callback) {
    if (!this.connected) {
      console.warn('[Socket] Socket.IO 未握手完成，无法发送事件:', eventName)
      return false
    }
    const message = '42' + JSON.stringify([eventName, data || {}])
    const result = this.send(message)

    if (callback && result) {
      // 简单的 ack 机制（等待一次响应）
      const ackEvent = '__ack_' + eventName + '_' + Date.now()
      const handler = (res) => {
        this.off(ackEvent, handler)
        callback(res)
      }
      this.on(ackEvent, handler)
      setTimeout(() => {
        this.off(ackEvent, handler)
      }, 10000)
    }

    return result
  }

  /**
   * 监听事件
   */
  on(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = []
    }
    this.eventHandlers[eventName].push(handler)
  }

  /**
   * 取消监听
   */
  off(eventName, handler) {
    if (!this.eventHandlers[eventName]) return
    if (handler) {
      this.eventHandlers[eventName] = this.eventHandlers[eventName].filter(h => h !== handler)
    } else {
      delete this.eventHandlers[eventName]
    }
  }

  /**
   * 触发事件
   */
  emit(eventName, data) {
    const handlers = this.eventHandlers[eventName]
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (e) {
          console.error('[Socket] 事件处理错误', eventName, e)
        }
      })
    }
  }

  /**
   * 心跳（Socket.IO v4 由服务端发起 ping，客户端只需回 pong）
   * 保留空实现以兼容旧调用
   */
  startHeartbeat() {
    this.stopHeartbeat()
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 尝试重连（指数退避）
   */
  tryReconnect() {
    if (this._manualDisconnect) return
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('reconnect_failed', {})
      return
    }
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
    reconnectAttempts++
    reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {})
    }, delay)
  }

  /**
   * 主动断开连接（不触发自动重连）
   */
  disconnect() {
    this._manualDisconnect = true
    this.stopHeartbeat()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (this.socketTask) {
      // 发送 Socket.IO 断开包
      try { this.send('41') } catch (e) {}
      this.socketTask.close()
      this.socketTask = null
    }
    this.connected = false
    this.eventHandlers = {}
  }
}

/**
 * 获取 Socket 单例
 */
export function getSocket() {
  if (!socketInstance) {
    socketInstance = new SocketManager()
  }
  return socketInstance
}

/**
 * 连接 Socket
 */
export function connectSocket() {
  return getSocket().connect()
}

/**
 * 断开 Socket
 */
export function disconnectSocket() {
  getSocket().disconnect()
  socketInstance = null
}

export default {
  getSocket,
  connectSocket,
  disconnectSocket
}

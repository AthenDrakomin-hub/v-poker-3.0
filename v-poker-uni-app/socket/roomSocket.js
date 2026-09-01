/**
 * V-Poker 房间 WebSocket 事件封装
 * 基于 socket.io-client 标准库
 */
import { getSocket, setCurrentRoomId, emitWithRequestId } from './index.js'

class RoomSocketManager {
  constructor() {
    this.currentRoomId = null
    this.roomHandlers = {}
  }

  joinRoom(roomId, callback) {
    if (this.currentRoomId && this.currentRoomId !== roomId) {
      this.leaveRoom(this.currentRoomId)
    }
    this.currentRoomId = roomId
    setCurrentRoomId(roomId)

    return emitWithRequestId('join_room', { roomId }, (ack) => {
      if (callback) callback(ack)
    })
  }

  leaveRoom(roomId, callback) {
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null
      setCurrentRoomId(null)
    }
    this.clearRoomHandlers()
    return emitWithRequestId('leave_room', { roomId }, (ack) => {
      if (callback) callback(ack)
    })
  }

  on(eventName, handler) {
    const socket = getSocket()
    socket.on(eventName, handler)
    this.roomHandlers[eventName] = handler
  }

  off(eventName, handler) {
    const socket = getSocket()
    if (handler) {
      socket.off(eventName, handler)
      if (this.roomHandlers[eventName] === handler) {
        delete this.roomHandlers[eventName]
      }
    } else {
      socket.off(eventName)
      delete this.roomHandlers[eventName]
    }
  }

  onRoomUpdate(handler) {
    this.on('room_update', handler)
    this.on('room:update', handler)
  }

  onHandUpdate(handler) {
    this.on('hand_update', handler)
    this.on('hand:update', handler)
  }

  onChatMessage(handler) {
    this.on('chat_message', handler)
    this.on('chat:new', handler)
    this.on('chat:message', handler)
  }

  onStateChanged(handler) {
    this.on('state_changed', handler)
    this.on('state:changed', handler)
  }

  onGameStarting(handler) {
    this.on('game_starting', handler)
    this.on('game:starting', handler)
  }

  onActionRequired(handler) {
    this.on('action_required', handler)
    this.on('action:required', handler)
  }

  onHandFinished(handler) {
    this.on('hand_finished', handler)
    this.on('hand:finished', handler)
  }

  onPlayerJoin(handler) {
    this.on('player_join', handler)
    this.on('player:join', handler)
  }

  onPlayerLeave(handler) {
    this.on('player_leave', handler)
    this.on('player:leave', handler)
  }

  onError(handler) {
    this.on('error', handler)
    this.on('game_error', handler)
  }

  sendChat(roomId, message) {
    return emitWithRequestId('chat_message', { roomId, message })
  }

  performAction(roomId, action, data, callback) {
    return emitWithRequestId('game_action', { roomId, action, ...data }, (ack) => {
      if (callback) callback(ack)
    })
  }

  clearRoomHandlers() {
    const socket = getSocket()
    Object.keys(this.roomHandlers).forEach(eventName => {
      socket.off(eventName, this.roomHandlers[eventName])
    })
    this.roomHandlers = {}
  }

  destroy() {
    if (this.currentRoomId) {
      this.leaveRoom(this.currentRoomId)
    }
    this.clearRoomHandlers()
  }
}

let roomSocketInstance = null

export function getRoomSocket() {
  if (!roomSocketInstance) {
    roomSocketInstance = new RoomSocketManager()
  }
  return roomSocketInstance
}

export function destroyRoomSocket() {
  if (roomSocketInstance) {
    roomSocketInstance.destroy()
    roomSocketInstance = null
  }
}

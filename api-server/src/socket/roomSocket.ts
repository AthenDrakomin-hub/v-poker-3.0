import { Server, Socket } from "socket.io";
import { verifyToken } from "../lib/auth";
import { db } from "../db";
import { roomPlayers } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { withEventLog } from "./eventLogger";

// 全局io实例，供其他模块调用广播
let ioInstance: Server | null = null;

/**
 * 设置房间WebSocket
 * 事件：
 *   join_room { roomId, client_request_id }  -> 加入房间
 *   leave_room { roomId, client_request_id } -> 离开房间
 *   game_starting { roomId, seconds, client_request_id } -> 游戏开始倒计时广播
 * 服务端推送：
 *   room_update { room }  -> 房间状态更新
 *   hand_update { hand }  -> 牌局状态更新
 *   chat_message { msg }  -> 聊天消息
 *   state_changed { roomId, ts } -> 状态变更信号
 */
export function setupRoomSockets(io: Server) {
  ioInstance = io;

  io.on("connection", (socket: Socket) => {
    // 从握手认证中获取用户
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers?.cookie?.match(/token=([^;]+)/)?.[1] || "");

    let userId: number | null = null;
    try {
      if (token) {
        const payload = verifyToken(token);
        if (payload) userId = payload.id;
      }
    } catch {
      // 未认证连接，允许连接但只能接收广播
    }

    socket.data.userId = userId;

    // 加入房间（带事件日志 + ack）
    socket.on(
      "join_room",
      withEventLog("join_room", async (socket, payload, ack) => {
        const roomId = payload.roomId as number;
        const userId = socket.data.userId as number | null;

        // 权限校验：用户必须是房间成员（玩家或观众）
        const member = await db
          .select()
          .from(roomPlayers)
          .where(eq(roomPlayers.roomId, roomId))
          .limit(1);
        if (member.length === 0) {
          console.warn(`[WS] join_room 拒绝: 用户${userId} 不在房间${roomId}`);
          socket.emit("error", { message: "您不在该房间中，无法加入" });
          if (ack) ack({ ok: false, error: "您不在该房间中，无法加入" });
          return;
        }
        socket.join(`room:${roomId}`);
        console.log(
          `[WS] 用户${userId} 成功加入房间 ${roomId}, socketId=${socket.id}, 房间用户数=${member.length}`
        );
        if (ack) ack({ ok: true, roomId });
      })
    );

    // 离开房间（带事件日志 + ack）
    socket.on(
      "leave_room",
      withEventLog("leave_room", (socket, payload, ack) => {
        const roomId = payload.roomId as number;
        const userId = socket.data.userId as number | null;
        socket.leave(`room:${roomId}`);
        console.log(`[WS] 用户${userId} 离开房间 ${roomId}`);
        if (ack) ack({ ok: true, roomId });
      })
    );

    // 游戏开始倒计时广播（房主触发，所有玩家同步显示倒计时）（带事件日志 + ack）
    socket.on(
      "game_starting",
      withEventLog("game_starting", (socket, payload, ack) => {
        const roomId = payload.roomId as number;
        const seconds = payload.seconds as number;
        console.log(`[WS] game_starting 广播, roomId=${roomId}, seconds=${seconds}`);
        io.to(`room:${roomId}`).emit("game_starting", { roomId, seconds });
        if (ack) ack({ ok: true, roomId, seconds });
      })
    );

    socket.on("disconnect", () => {
      console.log(`[WS] 用户${userId} 断开连接`);
      // 清理该用户的观战记录（直接关页面的观战玩家残留），玩家记录保留避免网络波动误删
      if (userId) {
        db.delete(roomPlayers)
          .where(and(eq(roomPlayers.userId, userId), eq(roomPlayers.isSpectator, true)))
          .then((result) => {
            if (result.rowCount && result.rowCount > 0) {
              console.log(`[WS] 断开清理: 用户${userId} 的 ${result.rowCount} 条观战记录已清理`);
            }
          })
          .catch((e) => console.error(`[WS] 断开清理观战记录失败:`, e));
      }
    });
  });
}

/**
 * 广播房间状态更新给房间内所有玩家
 */
export function broadcastRoomUpdate(roomId: number, room: any) {
  if (!ioInstance) return;
  ioInstance.to(`room:${roomId}`).emit("room_update", room);
}

/**
 * 广播牌局状态更新
 */
export function broadcastHandUpdate(roomId: number, hand: any) {
  if (!ioInstance) return;
  ioInstance.to(`room:${roomId}`).emit("hand_update", hand);
}

/**
 * 广播聊天消息
 */
export function broadcastChatMessage(roomId: number, message: any) {
  if (!ioInstance) return;
  ioInstance.to(`room:${roomId}`).emit("chat_message", message);
}

/**
 * 广播状态变更信号（前端收到后自动重新load获取自己视角的完整状态）
 * 这是最简单可靠的方式，避免不同玩家视角的牌可见性问题
 */
export function broadcastStateChanged(roomId: number) {
  if (!ioInstance) {
    console.warn(`[WS] broadcastStateChanged 失败: ioInstance 未初始化, roomId=${roomId}`);
    return;
  }
  // 获取房间内当前连接的 socket 数量
  ioInstance
    .fetchSockets()
    .then((sockets) => {
      const roomMembers = Array.from(sockets).filter((s) =>
        s.rooms.has(`room:${roomId}`)
      );
      console.log(
        `[WS] broadcastStateChanged 发送, roomId=${roomId}, 房间socket数=${roomMembers.length}`
      );
    })
    .catch(() => {
      console.log(`[WS] broadcastStateChanged 发送, roomId=${roomId}`);
    });
  ioInstance.to(`room:${roomId}`).emit("state_changed", { roomId, ts: Date.now() });
}

// ==================== Phase 3: 有序 Socket 事件 ====================

/**
 * Phase 3: 广播有序事件（带信封结构）
 * 事件格式：
 * {
 *   roomId,
 *   eventId,
 *   sequence,
 *   version,
 *   serverTime,
 *   actorUserId,
 *   clientActionId,
 *   data: { hand, options, ... }
 * }
 */
export async function broadcastOrderedEvent(
  roomId: number,
  eventData: {
    type: string;
    actorUserId?: number;
    clientActionId?: string;
    version: number;
    sequence: number;
    serverTime: number;
    data: any;
  }
): Promise<void> {
  if (!ioInstance) {
    console.warn(`[WS] broadcastOrderedEvent 失败: ioInstance 未初始化, roomId=${roomId}`);
    return;
  }

  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const envelope = {
    roomId,
    eventId,
    sequence: eventData.sequence,
    version: eventData.version,
    serverTime: eventData.serverTime,
    actorUserId: eventData.actorUserId,
    clientActionId: eventData.clientActionId,
    data: eventData.data,
  };

  console.log(
    `[WS] broadcastOrderedEvent 发送, roomId=${roomId}, type=${eventData.type}, sequence=${eventData.sequence}, version=${eventData.version}`
  );

  ioInstance.to(`room:${roomId}`).emit("hand_update", envelope);
}

/**
 * Phase 3: 生成有序事件ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

import { Socket } from "socket.io";
import { db } from "../db";
import { eventLogs } from "../db/schema";

/**
 * Socket 事件日志记录器
 *
 * 规则：append-only，只插入不更新不删除。
 * 任何客户端→服务端的 emit 到达时，先写入 event_logs 表，再执行业务逻辑。
 */

export interface EventLogPayload {
  roomId?: number;
  playerId?: number;
  eventType: string;
  payload: Record<string, unknown>;
  clientRequestId?: string;
}

/**
 * 写入一条事件日志（fire-and-forget with error logging）
 * 写入失败不阻塞业务逻辑，但会记录错误到控制台。
 */
export async function logSocketEvent(data: EventLogPayload): Promise<void> {
  try {
    await db.insert(eventLogs).values({
      roomId: data.roomId ?? null,
      playerId: data.playerId ?? null,
      eventType: data.eventType,
      payload: data.payload as Record<string, unknown>,
      clientRequestId: data.clientRequestId ?? null,
    });
  } catch (err) {
    // 日志写入失败不应该影响业务逻辑，但需要记录以便排查
    console.error(
      `[eventLogger] 写入 event_logs 失败: event=${data.eventType}, player=${data.playerId}, room=${data.roomId}`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * 从 Socket 事件参数中分离 payload 和 ack 回调
 * Socket.io 约定：如果最后一个参数是函数，则为 ack 回调。
 */
export function parseSocketArgs(args: unknown[]): {
  payload: Record<string, unknown>;
  ack?: (response: unknown) => void;
} {
  if (args.length === 0) {
    return { payload: {} };
  }
  const lastArg = args[args.length - 1];
  if (typeof lastArg === "function") {
    const payload = (args[0] as Record<string, unknown>) || {};
    return { payload, ack: lastArg as (response: unknown) => void };
  }
  return { payload: (args[0] as Record<string, unknown>) || {} };
}

/**
 * 包装 Socket 事件处理器：先写事件日志，再执行业务逻辑
 *
 * @param eventType 事件名称（如 join_room / leave_room / game_starting）
 * @param handler 原始业务处理器，接收 (socket, payload, ack)
 * @returns 可直接传给 socket.on 的包装函数
 */
export function withEventLog(
  eventType: string,
  handler: (
    socket: Socket,
    payload: Record<string, unknown>,
    ack?: (response: unknown) => void
  ) => void | Promise<void>
) {
  return async function wrappedHandler(this: Socket, ...args: unknown[]) {
    const socket = this;
    const { payload, ack } = parseSocketArgs(args);

    // 提取追踪信息
    const clientRequestId = (payload.client_request_id as string) || undefined;
    const playerId = (socket.data.userId as number) ?? undefined;
    const roomId = (payload.roomId as number) ?? undefined;

    // 先写入事件日志（等待写入完成，确保审计完整性）
    await logSocketEvent({
      roomId,
      playerId,
      eventType,
      payload,
      clientRequestId,
    });

    // 包装 ack：原样带回 client_request_id
    const wrappedAck = ack
      ? (response: unknown) => {
          if (response && typeof response === "object" && !Array.isArray(response)) {
            ack({ ...(response as Record<string, unknown>), client_request_id: clientRequestId });
          } else {
            ack({ ok: true, client_request_id: clientRequestId });
          }
        }
      : undefined;

    // 执行业务逻辑
    try {
      await handler(socket, payload, wrappedAck);
    } catch (err) {
      console.error(
        `[eventLogger] 事件处理异常: event=${eventType}, player=${playerId}, room=${roomId}`,
        err instanceof Error ? err.stack : err
      );
      if (wrappedAck) {
        wrappedAck({
          ok: false,
          error: err instanceof Error ? err.message : "Internal error",
        });
      }
    }
  };
}

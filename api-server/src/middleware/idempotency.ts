/**
 * Phase 3: 幂等操作检查中间件
 * 
 * 功能：
 * 1. 验证 clientActionId 是否已存在（幂等性）
 * 2. 验证 expectedVersion 是否过期（冲突检测）
 * 3. 记录操作响应快照
 */

import { db } from "@/db";
import { clientActions, handStates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface IdempotencyResult {
  isIdempotent: boolean;      // 是否已处理过
  isConflict: boolean;        // 版本是否冲突
  previousResponse?: any;     // 之前的响应快照
  currentVersion?: number;    // 当前版本号
  currentSequence?: number;   // 当前序列号
}

/**
 * 检查操作幂等性和版本冲突
 */
export async function checkIdempotency(
  roomId: number,
  userId: number,
  clientActionId: string,
  expectedVersion: number
): Promise<IdempotencyResult> {
  const result: IdempotencyResult = {
    isIdempotent: false,
    isConflict: false,
  };

  try {
    // 1. 检查是否已存在相同操作
    const existingAction = await db
      .select()
      .from(clientActions)
      .where(
        and(
          eq(clientActions.roomId, roomId),
          eq(clientActions.userId, userId),
          eq(clientActions.clientActionId, clientActionId)
        )
      )
      .limit(1);

    if (existingAction.length > 0) {
      result.isIdempotent = true;
      result.previousResponse = existingAction[0].responseSnapshot;
      return result;
    }

    // 2. 获取当前牌局版本
    const currentHand = await db
      .select()
      .from(handStates)
      .where(eq(handStates.roomId, roomId))
      .limit(1);

    if (currentHand.length > 0) {
      const currentVersion = currentHand[0].version || 0;
      result.currentVersion = currentVersion;
      result.currentSequence = currentHand[0].sequence || 0;

      // 检查版本是否冲突
      if (expectedVersion !== currentVersion) {
        result.isConflict = true;
      }
    }

    return result;
  } catch (error) {
    console.error("[Idempotency Check] 错误:", error);
    // 出错时不阻断请求，让业务逻辑继续处理
    return result;
  }
}

/**
 * 记录操作响应快照
 */
export async function recordActionResult(
  roomId: number,
  userId: number,
  clientActionId: string,
  actionVersion: number,
  responseSnapshot: any
): Promise<void> {
  try {
    await db.insert(clientActions).values({
      roomId,
      userId,
      clientActionId,
      actionVersion,
      responseSnapshot,
    });
  } catch (error: any) {
    // 唯一约束冲突时忽略（幂等操作）
    if (error.code !== '23505') { // PostgreSQL 唯一约束违反
      console.debug("[Record Action] 已存在相同操作，忽略:", clientActionId);
    }
  }
}

/**
 * 生成客户端操作ID
 */
export function generateClientActionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `act_${timestamp}_${random}`;
}

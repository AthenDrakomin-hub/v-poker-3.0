/**
 * 房间自动回收服务
 *
 * 职责：定期扫描超时未续开/未活跃的房间，自动结束并清理关联数据，
 * 确保 100 房间池可循环复用，防止数据库记录无限增长。
 *
 * 回收规则：
 * - waiting_continue 超过 WAITING_CONTINUE_TIMEOUT_MS → 自动结束（25局已结算，仅清理残留）
 * - waiting 超过 WAITING_TIMEOUT_MS 且无玩家 → 自动结束（空房闲置）
 * - paused 不自动回收（可能有未结算牌局筹码，由房主手动恢复/结算）
 *
 * 并发控制：
 * - recyclingRooms Set 防止同一房间被重复处理
 * - 每个房间的清理在独立事务中执行，失败不影响其他房间
 */
import { db } from "@/db";
import { rooms, roomPlayers, handStates, users, chipTransactions, gameRounds } from "@/db/schema";
import { eq, and, lt, desc } from "drizzle-orm";
import { broadcastStateChanged } from "@/socket/roomSocket";

// ============================================================
// 超时配置（可通过环境变量覆盖）
// ============================================================
/** 待续开超时：25局结束后代理未续开，30分钟后自动结束 */
const WAITING_CONTINUE_TIMEOUT_MS = Number(
  process.env.ROOM_WAITING_CONTINUE_TIMEOUT_MS || 30 * 60 * 1000
);
/** 空房闲置超时：创建后无人开始游戏，24小时后自动结束 */
const WAITING_TIMEOUT_MS = Number(
  process.env.ROOM_WAITING_TIMEOUT_MS || 24 * 60 * 60 * 1000
);
/** 回收扫描间隔：每60秒一次 */
const RECYCLE_INTERVAL_MS = Number(
  process.env.ROOM_RECYCLE_INTERVAL_MS || 60 * 1000
);

/** 正在回收中的房间ID集合（防止并发重复处理） */
const recyclingRooms = new Set<number>();

/**
 * 退回房间内玩家的剩余筹码到钱包（waiting/paused 状态未结算时使用）
 * 在事务内执行，保证数据一致性。
 */
async function refundPlayersInTx(
  tx: any,
  roomId: number,
  roomNo: string
): Promise<number> {
  const rps = await tx
    .select()
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, roomId));

  let refundedCount = 0;
  for (const rp of rps) {
    if (rp.isSpectator || rp.points <= 0) continue;
    const ur = await tx
      .select()
      .from(users)
      .where(eq(users.id, rp.userId))
      .limit(1);
    if (!ur.length) continue;
    const next = ur[0].points + rp.points;
    await tx.update(users).set({ points: next }).where(eq(users.id, rp.userId));
    await tx.insert(chipTransactions).values({
      userId: rp.userId,
      amount: rp.points,
      balanceAfter: next,
      type: "cashout",
      note: `房间 ${roomNo} 超时自动结束，退回筹码`,
      roomId,
    });
    refundedCount++;
  }
  return refundedCount;
}

/**
 * 回收单个房间：标记为 finished，清理关联数据
 * @param needRefund 是否需要退回玩家筹码（waiting_continue 已结算则不需要）
 */
async function recycleRoom(
  roomId: number,
  roomNo: string,
  needRefund: boolean,
  reason: string
): Promise<boolean> {
  if (recyclingRooms.has(roomId)) return false;
  recyclingRooms.add(roomId);

  try {
    await db.transaction(async (tx) => {
      // 二次确认状态（避免并发冲突）
      const current = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      if (!current.length || current[0].status === "finished") return;

      // 需要退回筹码的场景（waiting/paused 未经过结算）
      if (needRefund) {
        await refundPlayersInTx(tx, roomId, roomNo);
      }

      // 清理关联数据
      await tx.delete(roomPlayers).where(eq(roomPlayers.roomId, roomId));
      await tx.delete(handStates).where(eq(handStates.roomId, roomId));

      // 标记房间为已结束（可被复用）
      await tx
        .update(rooms)
        .set({
          status: "finished",
          settled: true,
          archivedAt: new Date(),
        })
        .where(eq(rooms.id, roomId));
    });

    console.log(
      `[房间回收] room=${roomId} (${roomNo}) 已自动结束，原因: ${reason}`
    );
    broadcastStateChanged(roomId);
    return true;
  } catch (e) {
    console.error(`[房间回收] room=${roomId} 失败:`, e);
    return false;
  } finally {
    recyclingRooms.delete(roomId);
  }
}

/**
 * 主回收函数：扫描各类超时房间并执行回收
 */
async function recycleCheck() {
  const now = Date.now();

  try {
    // ----------------------------------------------------------
    // 1. waiting_continue 超时：25局结束后代理未续开
    //    此状态已完成结算（cashOutAll + settleRoom），无需退筹码
    //    rooms 表无 updatedAt 字段，用该房间最新一局 gameRounds.createdAt 作为结束时间
    // ----------------------------------------------------------
    const wcCutoff = now - WAITING_CONTINUE_TIMEOUT_MS;
    const wcRooms = await db
      .select({ id: rooms.id, roomNo: rooms.roomNo })
      .from(rooms)
      .where(eq(rooms.status, "waiting_continue"))
      .limit(20);

    for (const room of wcRooms) {
      // 查询该房间最新一局的创建时间（即最后一局结束时间）
      const latestRound = await db
        .select({ createdAt: gameRounds.createdAt })
        .from(gameRounds)
        .where(eq(gameRounds.roomId, room.id))
        .orderBy(desc(gameRounds.roundNo))
        .limit(1);
      const endTime = latestRound[0]?.createdAt;
      // 无对局记录的 waiting_continue 房间（异常数据）直接回收
      if (endTime && endTime.getTime() > wcCutoff) continue;
      await recycleRoom(room.id, room.roomNo, false, "waiting_continue 超时未续开");
    }

    // ----------------------------------------------------------
    // 2. waiting 超时且无玩家：创建后长时间无人开始游戏
    //    需要退回已带入的筹码
    // ----------------------------------------------------------
    const waitingCutoff = new Date(now - WAITING_TIMEOUT_MS);
    const waitingRooms = await db
      .select({ id: rooms.id, roomNo: rooms.roomNo })
      .from(rooms)
      .where(and(eq(rooms.status, "waiting"), lt(rooms.createdAt, waitingCutoff)))
      .limit(20);

    for (const room of waitingRooms) {
      // 检查是否有真实玩家（非观众、非房主管理席位）
      const players = await db
        .select({ id: roomPlayers.id })
        .from(roomPlayers)
        .where(
          and(
            eq(roomPlayers.roomId, room.id),
            eq(roomPlayers.isSpectator, false)
          )
        )
        .limit(1);
      // 有真实玩家的 waiting 房间不自动回收（可能玩家正在准备）
      if (players.length > 0) continue;
      await recycleRoom(room.id, room.roomNo, true, "waiting 超时且无玩家");
    }

    // ----------------------------------------------------------
    // 注意：paused 状态不自动回收。
    // 暂停时可能存在未结算的牌局筹码（pot/streetBet），
    // 直接清理会导致玩家筹码丢失。paused 房间由房主手动恢复或提前结算。
    // ----------------------------------------------------------
  } catch (e) {
    console.error("[房间回收] 扫描失败:", e);
  }
}

/**
 * 启动房间回收服务（在服务器启动时调用）
 */
export function startRoomRecycler() {
  setInterval(recycleCheck, RECYCLE_INTERVAL_MS);
  console.log(
    `[V-POKER API] 房间自动回收已启动 (间隔${RECYCLE_INTERVAL_MS / 1000}s, ` +
      `待续开超时${WAITING_CONTINUE_TIMEOUT_MS / 60000}min, ` +
      `空房超时${WAITING_TIMEOUT_MS / 3600000}h)`
  );
}

/**
 * 手动触发一次回收检查（供测试/管理接口调用）
 */
export async function triggerRecycleOnce() {
  await recycleCheck();
}

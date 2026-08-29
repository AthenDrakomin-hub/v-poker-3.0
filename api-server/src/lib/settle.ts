import { db } from "@/db";
import {
  rooms,
  roomPlayers,
  gameRounds,
  users,
  chipTransactions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { HandState } from "./hand";
import { calcRoomSettlement, round2 } from "./economy";
import { getAgentHierarchy } from "./agentHierarchy";
import { broadcastStateChanged } from "@/socket/roomSocket";
import { archiveRoom } from "@/lib/roomHistory";

/** 事务类型：drizzle node-postgres 事务实例（用 any 避免复杂泛型不兼容） */
type Tx = any;
/** 数据库执行器：事务实例或全局 db */
type DbExec = Tx | typeof db;

export const UNLIMITED = 1_000_000_000;

/**
 * 持久化一局结束的结果：玩家筹码、回合记录、房间累计统计，
 * 并在最后一局执行筹码退回和信用分结算。
 *
 * 【事务保证】所有数据库操作在同一事务中执行，任一失败全部回滚。
 * 事务提交成功后才广播状态变更，避免回滚时误发通知。
 */
export async function commitHand(roomId: number, st: HandState) {
  // 前置检查：无结果则不开启事务
  if (!st.result) return null;

  let result: {
    roundNo: number;
    isLast: boolean;
    totalRake: number;
    totalFlow: number;
    settlement: any;
    brokePlayers: number[];
  } | null = null;

  try {
    result = await db.transaction(async (tx) => {
      const roomRows = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      const room = roomRows[0];
      if (!room) return null;

      const rps = await tx
        .select()
        .from(roomPlayers)
        .where(eq(roomPlayers.roomId, roomId));

      // 更新每个座位的筹码
      for (const seat of st.seats) {
        const rp = rps.find((r) => r.userId === seat.userId && !r.isSpectator);
        if (rp) {
          await tx
            .update(roomPlayers)
            .set({ points: Math.max(0, seat.points) })
            .where(eq(roomPlayers.id, rp.id));
        }
      }

      // 结算后筹码为0的玩家自动转为观战（房主除外）
      const brokePlayers: number[] = [];
      for (const seat of st.seats) {
        const rp = rps.find((r) => r.userId === seat.userId && !r.isSpectator);
        if (rp && seat.points <= 0 && rp.userId !== room.agentId) {
          await tx
            .update(roomPlayers)
            .set({ isSpectator: true, ready: false })
            .where(eq(roomPlayers.id, rp.id));
          brokePlayers.push(rp.userId);
        }
      }
      if (brokePlayers.length > 0) {
        console.log(`[结算] 筹码不足转为观战: room=${roomId} players=${brokePlayers.join(",")}`);
      }

      const roundNo = room.currentRound + 1;
      // 事务内类型收窄：将 st.result 赋值给局部变量
      const handResult = st.result!;
      // 根据不同游戏类型计算turnover
      // 通比牛牛、炸金花：turnover = pot (底池)
      // 德州扑克、抢庄牛牛、三公：turnover = flow (Σ赢家盈利)
      const turnover = (room.gameType === 'tbnn' || room.gameType === 'jinhua') ? handResult.pot : handResult.flow;
      console.log(`[结算] 写入game_rounds: room=${roomId}, round=${roundNo}, gameType=${room.gameType}, pot=${handResult.pot}, flow=${handResult.flow}, turnover=${turnover}`);
      await tx.insert(gameRounds).values({
        roomId,
        roomNo: room.roomNo, // 记录当前房间号，房间ID复用时可区分历史归属
        roundNo,
        gameType: room.gameType,
        result: handResult,
        winnerUserId: handResult.winnerUserId,
        potBeforeRake: handResult.pot,
        rake: handResult.rake,
        turnover: turnover,
      });

      const totalRake = round2(room.totalRake + handResult.rake);
      const totalFlow = round2(room.totalFlow + handResult.flow);
      const isLast = roundNo >= room.totalRounds;

      await tx
        .update(rooms)
        .set({
          currentRound: roundNo,
          totalRake,
          totalFlow,
          // 25局结束进入"待续开"状态，代理确认后续开，玩家不用重新进房
          status: isLast ? "waiting_continue" : "playing",
          settled: isLast,
        })
        .where(eq(rooms.id, roomId));

      let settlement = null;

      // 总局结束：把桌上筹码退回玩家钱包 + 结算信用分 + 归档历史战绩（在同一事务内）
      if (isLast) {
        await cashOutAll(roomId, room.roomNo, tx);
        settlement = await settleRoom(
          roomId,
          room.agentId,
          totalRake,
          totalFlow,
          room.gameType,
          tx
        );
        // 归档房间历史战绩（永久保留，不随 rooms 表复用丢失）
        await archiveRoom(
          {
            roomNo: room.roomNo,
            agentId: room.agentId,
            gameType: room.gameType,
            level: room.level,
            currentRound: roundNo,
            totalRake,
            totalFlow,
            createdAt: room.createdAt,
          },
          "normal",
          settlement
            ? { agentNetCost: settlement.agentNetCost, platformIncome: settlement.platformNetIncome }
            : undefined,
          tx
        );
      }

      return { roundNo, isLast, totalRake, totalFlow, settlement, brokePlayers };
    });
  } catch (err) {
    console.error(`[结算] commitHand 事务失败 room=${roomId}:`, err);
    // 事务已自动回滚，不广播
    return null;
  }

  // 事务提交成功后才广播状态变更
  if (result) {
    broadcastStateChanged(roomId);
  }

  return result;
}

/**
 * 把房内所有玩家的剩余筹码退回其钱包
 * @param tx 可选事务实例，传入则在事务内执行
 */
export async function cashOutAll(roomId: number, roomNo: string, tx?: Tx) {
  const exec: DbExec = tx ?? db;
  const rps = await exec
    .select()
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, roomId));

  for (const rp of rps) {
    if (rp.isSpectator || rp.points <= 0) continue;
    const ur = await exec
      .select()
      .from(users)
      .where(eq(users.id, rp.userId))
      .limit(1);
    if (!ur.length) continue;
    const next = ur[0].points + rp.points;
    await exec.update(users).set({ points: next }).where(eq(users.id, rp.userId));
    await exec.insert(chipTransactions).values({
      userId: rp.userId,
      amount: rp.points,
      balanceAfter: next,
      type: "cashout",
      note: `房间 ${roomNo} 结算带出筹码`,
      roomId,
    });
    await exec
      .update(roomPlayers)
      .set({ points: 0 })
      .where(eq(roomPlayers.id, rp.id));
  }
}

/**
 * 房间结算（V3 单一货币 + 多级返佣）
 *
 * 【V3 经济模型】全系统只用筹码(points)：
 * - 每局抽水已从赢家筹码扣除，累计为 totalRake
 * - 房间结束时，totalRake 按层级分配到各代理筹码账户：
 *   - 开房代理（最底层）：1/3
 *   - 一级代理：0.5/3（存在时）
 *   - 总代理：0.5/3（存在时）
 *   - 平台：剩余1/3（不写入用户账户，仅统计）
 * - 不再扣信用分房费，credit 字段已从数据库移除
 * - 不再使用 commission 账户，返佣直接进 points
 *
 * @param tx 可选事务实例，传入则在事务内执行
 */
export async function settleRoom(
  roomId: number,
  agentId: number,
  totalRake: number,
  totalFlow: number,
  gameType: string,
  tx?: Tx
) {
  const exec: DbExec = tx ?? db;
  const agentRows = await exec
    .select()
    .from(users)
    .where(eq(users.id, agentId))
    .limit(1);
  const agent = agentRows[0];
  if (!agent) return null;

  // 追溯多级代理层级链
  const hierarchy = await getAgentHierarchy(agentId, exec);

  // 计算多级返佣分配（V3：抽水即分成）
  const settlement = calcRoomSettlement(totalRake, hierarchy, gameType);
  const { agentRebate, level1Rebate, topAgentRebate, platformIncome, totalDistributed } = settlement;

  // === 1. 开房代理（最底层）返佣：直接进筹码 ===
  if (agentRebate > 0) {
    const newPoints = round2(agent.points + agentRebate);
    await exec.update(users).set({ points: newPoints }).where(eq(users.id, agentId));
    await exec.insert(chipTransactions).values({
      userId: agentId,
      amount: agentRebate,
      balanceAfter: newPoints,
      type: "room_rake",
      note: `房间#${roomId} 抽水返佣（最底层代理，流水${totalFlow}，抽水${totalRake}，分得${agentRebate}）`,
      roomId,
    });
  }

  // === 2. 一级代理返佣：直接进筹码 ===
  if (level1Rebate > 0 && hierarchy.level1Id) {
    const l1Rows = await exec
      .select()
      .from(users)
      .where(eq(users.id, hierarchy.level1Id))
      .limit(1);
    const l1 = l1Rows[0];
    if (l1) {
      const newPoints = round2(l1.points + level1Rebate);
      await exec.update(users).set({ points: newPoints }).where(eq(users.id, l1.id));
      await exec.insert(chipTransactions).values({
        userId: l1.id,
        amount: level1Rebate,
        balanceAfter: newPoints,
        type: "room_rake",
        note: `下线 ${agent.account} 房间#${roomId} 一级代理返佣（流水${totalFlow}，分得${level1Rebate}）`,
        roomId,
      });
    }
  }

  // === 3. 总代理返佣：直接进筹码 ===
  if (topAgentRebate > 0 && hierarchy.topAgentId && hierarchy.topAgentId !== agentId) {
    const taRows = await exec
      .select()
      .from(users)
      .where(eq(users.id, hierarchy.topAgentId))
      .limit(1);
    const ta = taRows[0];
    if (ta) {
      const newPoints = round2(ta.points + topAgentRebate);
      await exec.update(users).set({ points: newPoints }).where(eq(users.id, ta.id));
      await exec.insert(chipTransactions).values({
        userId: ta.id,
        amount: topAgentRebate,
        balanceAfter: newPoints,
        type: "room_rake",
        note: `下线 ${agent.account} 房间#${roomId} 总代理返佣（流水${totalFlow}，分得${topAgentRebate}）`,
        roomId,
      });
    }
  }

  // === 4. 平台收入：仅记录，不写入用户账户 ===
  // 平台收入 = totalRake - 各方返佣，已在 calcRoomSettlement 中倒挤计算
  // 未来可接入平台专用账户或财务统计模块

  return {
    deductAmt: 0, // V3无房费
    totalRake,
    totalFlow,
    deductSuccess: true,
    agentCommission: agentRebate,
    level1Commission: level1Rebate,
    topAgentCommission: topAgentRebate,
    platformNetIncome: platformIncome,
    agentNetCost: 0, // V3无信用分成本
    totalDistributed,
    hierarchy, // 返回层级链供前端展示
  };
}

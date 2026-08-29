/**
 * 房间历史战绩归档
 *
 * 房间结束时将汇总数据写入 room_history 表，永久保留。
 * rooms 表被复用后旧房间数据会被覆盖，room_history 是唯一的历史战绩来源。
 *
 * 写入时机：
 * - commitHand 最后一局正常结束 → endReason='normal'
 * - early-settle 代理提前结算 → endReason='early_settle'
 * - 玩家全部离开 → endReason='player_left'
 * - admin force-end 强制结束 → endReason='force_end'
 */
import { db } from "@/db";
import { roomHistory } from "@/db/schema";

export type EndReason = "normal" | "early_settle" | "player_left" | "force_end";

export interface ArchiveRoomInput {
  roomNo: string;
  agentId: number;
  gameType: string;
  level: string;
  currentRound: number; // 已完成局数
  totalRake: number;
  totalFlow: number;
  createdAt: Date; // 房间创建时间
}

export interface ArchiveSettlement {
  agentNetCost?: number; // 代理净成本（房费 - 返佣）
  platformIncome?: number; // 平台净收益
}

/**
 * 归档房间历史战绩
 * @param room 房间数据
 * @param endReason 结束原因
 * @param settlement 结算结果（可选，含代理净成本和平台收益）
 * @param tx 数据库事务（在已有事务中调用时传入）
 */
export async function archiveRoom(
  room: ArchiveRoomInput,
  endReason: EndReason,
  settlement?: ArchiveSettlement,
  tx?: any
): Promise<void> {
  // 没有实际对局的房间不归档（空房）
  if (room.currentRound <= 0 && room.totalFlow <= 0) {
    return;
  }

  const record = {
    roomNo: room.roomNo,
    agentId: room.agentId,
    gameType: room.gameType,
    level: room.level,
    totalRounds: room.currentRound,
    totalRake: room.totalRake,
    totalFlow: room.totalFlow,
    agentNetCost: settlement?.agentNetCost ?? null,
    platformIncome: settlement?.platformIncome ?? null,
    endReason,
    createdAt: room.createdAt,
    endedAt: new Date(),
  };

  const executor = tx || db;
  try {
    await executor.insert(roomHistory).values(record);
  } catch (e: any) {
    // 归档失败不影响房间结算主流程（如 room_history 表未创建时）
    console.error(`[房间归档失败] roomNo=${room.roomNo} reason=${endReason}:`, e?.message ?? e);
    return;
  }

  console.log(
    `[房间归档] roomNo=${room.roomNo} agent=${room.agentId} ` +
      `rounds=${room.currentRound} flow=${room.totalFlow} rake=${room.totalRake} ` +
      `reason=${endReason}`
  );
}

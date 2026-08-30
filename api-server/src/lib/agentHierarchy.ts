/**
 * 多级代理层级追溯模块
 *
 * 层级定义（通过 invitedById 向上追溯，无需额外字段）：
 * - L0 总代理 (top_agent)：role=top_agent
 * - L1 一级代理 (agent)：role=agent，邀请人是 top_agent
 * - L2 二级代理 (agent)：role=agent，邀请人是一级代理
 * - 玩家 (player)：不参与返佣分配
 *
 * 返佣分配规则（A保守型，抽水3%为基数）：
 * - 最底层代理（开房者）：1/3 抽水 ≈ 流水1%
 * - 往上每一层：0.5/3 抽水 ≈ 流水0.5%
 * - 平台：剩余 1/3 抽水 ≈ 流水1%
 * - 跳过层的份额归上一层（总代直接发展二级→总代拿1/3+0.5/3=1.5/3）
 *
 * 设计原则：
 * 1. 层级动态计算，通过 invitedById 向上追溯最多2层
 * 2. 不依赖额外数据库字段，避免数据不一致
 * 3. 结算时一次性追溯，性能影响可忽略
 */

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/** 代理层级链 */
export interface AgentHierarchy {
  /** 开房代理ID（最底层，L1或L2） */
  roomAgentId: number;
  /** 开房代理角色 */
  roomAgentRole: string;
  /** 一级代理ID（可能为null，表示总代直接发展二级） */
  level1Id: number | null;
  /** 总代理ID（可能为null，表示无总代） */
  topAgentId: number | null;
  /** 实际层级数（1-3） */
  levelCount: number;
}

/** 事务类型 */
type Tx = any;
type DbExec = Tx | typeof db;

/**
 * 追溯代理层级链
 * 从开房代理向上追溯 invitedById，最多2层
 *
 * @param agentId 开房代理ID
 * @param exec 数据库执行器（事务或全局db）
 * @returns 层级链信息
 */
export async function getAgentHierarchy(
  agentId: number,
  exec?: DbExec
): Promise<AgentHierarchy> {
  const dbExec: DbExec = exec ?? db;

  // 查询开房代理
  const agentRows = await dbExec
    .select()
    .from(users)
    .where(eq(users.id, agentId))
    .limit(1);
  const agent = agentRows[0];

  if (!agent) {
    return {
      roomAgentId: agentId,
      roomAgentRole: "unknown",
      level1Id: null,
      topAgentId: null,
      levelCount: 0,
    };
  }

  // 如果开房者本身就是总代理，层级链只有1层
  if (agent.role === "top_agent") {
    return {
      roomAgentId: agentId,
      roomAgentRole: "top_agent",
      level1Id: null,
      topAgentId: agentId,
      levelCount: 1,
    };
  }

  // 如果开房者是管理员，无层级
  if (agent.role === "admin") {
    return {
      roomAgentId: agentId,
      roomAgentRole: "admin",
      level1Id: null,
      topAgentId: null,
      levelCount: 0,
    };
  }

  // 代理(agent)：向上追溯第一层
  let level1Id: number | null = null;
  let topAgentId: number | null = null;
  let levelCount = 1; // 至少有开房代理自己

  if (agent.invitedById) {
    const up1Rows = await dbExec
      .select()
      .from(users)
      .where(eq(users.id, agent.invitedById))
      .limit(1);
    const up1 = up1Rows[0];

    if (up1) {
      if (up1.role === "top_agent") {
        // 开房代理是一级代理（邀请人是总代）
        topAgentId = up1.id;
        levelCount = 2;
      } else if (up1.role === "agent") {
        // 开房代理是二级代理（邀请人是一级代理）
        level1Id = up1.id;
        levelCount = 2;

        // 继续向上追溯第二层（一级代理的邀请人）
        if (up1.invitedById) {
          const up2Rows = await dbExec
            .select()
            .from(users)
            .where(eq(users.id, up1.invitedById))
            .limit(1);
          const up2 = up2Rows[0];

          if (up2 && up2.role === "top_agent") {
            topAgentId = up2.id;
            levelCount = 3;
          }
        }
      }
      // 如果邀请人是玩家或其他角色，忽略（不应该发生，但容错）
    }
  }

  return {
    roomAgentId: agentId,
    roomAgentRole: agent.role,
    level1Id,
    topAgentId,
    levelCount,
  };
}

/**
 * 计算多级返佣分配（A保守型）
 *
 * 分配规则（以 totalRake 抽水总额为基数）：
 * - 最底层代理：1/3
 * - 一级代理：0.5/3（存在时）
 * - 总代理：0.5/3（存在时）
 * - 平台：剩余（倒挤，确保守恒）
 * - 跳过层份额归上层：
 *   - 无一级时，总代拿 0.5/3 + 0.5/3 = 1/3
 *   - 无总代时，一级拿 0.5/3 + 0.5/3 = 1/3（但这种情况 rare）
 *   - 总代自己开房时，拿全部 2/3（最底层1/3 + 一级0.5/3 + 总代0.5/3）
 *
 * @param totalRake 房间抽水总额（实际从玩家处收集的钱）
 * @param hierarchy 层级链
 * @returns 各方分配金额
 */
/** 分润费率配置（以抽水总额为基数） */
export interface RebateRates {
  agentRebateRate: number;
  level1RebateRate: number;
  topAgentRebateRate: number;
}

/** 默认费率（与硬编码旧逻辑等价：1/3, 0.5/3, 0.5/3） */
export const DEFAULT_REBATE_RATES: RebateRates = {
  agentRebateRate: 1 / 3,
  level1RebateRate: 0.5 / 3,
  topAgentRebateRate: 0.5 / 3,
};
export function calcMultiLevelRebate(
  totalRake: number,
  hierarchy: AgentHierarchy,
  rates?: RebateRates
): {
  roomAgentRebate: number;   // 开房代理（最底层）
  level1Rebate: number;      // 一级代理
  topAgentRebate: number;     // 总代理
  platformIncome: number;     // 平台收入（倒挤）
  totalDistributed: number;   // 分配总额（应等于totalRake）
} {
  if (totalRake <= 0) {
    return {
      roomAgentRebate: 0,
      level1Rebate: 0,
      topAgentRebate: 0,
      platformIncome: 0,
      totalDistributed: 0,
    };
  }

  // 基础比例（以抽水为基数，A保守型）
  const r = rates ?? DEFAULT_REBATE_RATES;
  const BASE_AGENT_RATIO = r.agentRebateRate;    // 最底层代理 1/3 ≈ 流水1%
  const LEVEL1_RATIO = r.level1RebateRate;       // 一级代理 0.5/3 ≈ 流水0.5%
  const TOP_AGENT_RATIO = r.topAgentRebateRate;    // 总代理 0.5/3 ≈ 流水0.5%

  let roomAgentRatio = BASE_AGENT_RATIO;
  let level1Ratio = 0;
  let topAgentRatio = 0;

  if (hierarchy.roomAgentRole === "top_agent") {
    // 总代自己开房：拿最底层 + 一级 + 总代 = 1/3 + 0.5/3 + 0.5/3 = 2/3
    roomAgentRatio = BASE_AGENT_RATIO + LEVEL1_RATIO + TOP_AGENT_RATIO;
  } else if (hierarchy.level1Id && hierarchy.topAgentId) {
    // 三级完整：二级(开房)1/3 + 一级0.5/3 + 总代0.5/3
    level1Ratio = LEVEL1_RATIO;
    topAgentRatio = TOP_AGENT_RATIO;
  } else if (hierarchy.level1Id && !hierarchy.topAgentId) {
    // 有一级但无总代（rare）：一级拿总代的份额
    level1Ratio = LEVEL1_RATIO + TOP_AGENT_RATIO;
  } else if (!hierarchy.level1Id && hierarchy.topAgentId) {
    // 总代直接发展二级（跳过一级）：总代拿一级的份额
    topAgentRatio = TOP_AGENT_RATIO + LEVEL1_RATIO;
  }
  // 都没有：只有开房代理，拿1/3，平台拿2/3（这种情况代理是独立发展的）

  // 计算金额（保留2位小数）
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const roomAgentRebate = round2(totalRake * roomAgentRatio);
  const level1Rebate = hierarchy.level1Id ? round2(totalRake * level1Ratio) : 0;
  const topAgentRebate = hierarchy.topAgentId && hierarchy.roomAgentRole !== "top_agent"
    ? round2(totalRake * topAgentRatio)
    : 0;

  // 平台收入倒挤（确保守恒，尾差归平台）
  const distributed = roomAgentRebate + level1Rebate + topAgentRebate;
  const platformIncome = round2(totalRake - distributed);

  return {
    roomAgentRebate,
    level1Rebate,
    topAgentRebate,
    platformIncome,
    totalDistributed: round2(distributed + platformIncome),
  };
}

/**
 * V-Poker 经济模型计算工具（V2 两层配置体系）
 *
 * 核心原则：
 * 1. 所有抽水/分成计算，一律先算总账（底池/流水×抽水比例）
 * 2. 再用「减法倒挤」算出赢家到账和各方净收益
 * 3. 确保玩家筹码、代理抽水、信用分结算三者严格守恒
 * 4. 所有金额保留2位小数，尾差归平台
 * 5. 配置值从 game_economy_config 表（V2）动态读取，按游戏类型区分
 *
 * V2 重构：从旧 econ_config（866项细粒度）→ game_economy_config（5游戏配置）
 * 抽水/分润绑定游戏类型维度，同游戏全局一套规则
 */

import { getGameEconomy } from "./gameEconomy";
import { AgentHierarchy, calcMultiLevelRebate } from "./agentHierarchy";

/** 保留2位小数 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 计算每局抽水和赢家到账
 *
 * @param pot 底池总额
 * @param rakeRate 抽水比例（百分比，可选，不传则从V2配置读取）
 * @param gameType 游戏类型（可选，默认texas），用于从V2配置读取对应游戏的抽水比例
 * @returns { totalRake, winnerNet } 总抽水和赢家到账（倒挤）
 */
export function calcHandRake(pot: number, rakeRate?: number, gameType: string = "texas"): {
  totalRake: number;
  winnerNet: number;
} {
  if (pot <= 0) return { totalRake: 0, winnerNet: 0 };

  // 从V2配置读取抽水比例（默认3%）
  const rate = rakeRate !== undefined ? rakeRate : getGameEconomy(gameType).rakeRate * 100;

  // 先算总账：底池 × 抽水比例
  const totalRake = round2(pot * rate / 100);
  // 用减法倒挤：赢家到账 = 底池 - 抽水
  const winnerNet = round2(pot - totalRake);

  return { totalRake, winnerNet };
}

/**
 * 按赢家盈利比例分配抽水（多个赢家时）
 * 最后一个赢家的抽水用减法倒挤，确保守恒
 *
 * @param totalRake 总抽水
 * @param winnerGrosses 各赢家的盈利数组
 * @returns 各赢家应承担的抽水数组
 */
export function allocateRake(totalRake: number, winnerGrosses: number[]): number[] {
  if (winnerGrosses.length === 0) return [];
  if (winnerGrosses.length === 1) return [totalRake];

  const totalGross = winnerGrosses.reduce((a, b) => a + b, 0);
  if (totalGross <= 0) return winnerGrosses.map(() => 0);

  const rakes: number[] = [];
  let allocated = 0;

  for (let i = 0; i < winnerGrosses.length; i++) {
    if (i === winnerGrosses.length - 1) {
      // 最后一个赢家：用减法倒挤
      rakes.push(round2(totalRake - allocated));
    } else {
      const rake = round2(totalRake * winnerGrosses[i] / totalGross);
      rakes.push(rake);
      allocated = round2(allocated + rake);
    }
  }

  return rakes;
}

/**
 * 计算房间结算（V3 单一货币 + 多级返佣）
 *
 * 【V3 经济模型】全系统只用筹码(points)一种货币：
 * - 每局从底池抽水 X%（默认3%），从赢家筹码扣除
 * - 房间结束时，抽水总额(totalRake)按层级分配：
 *   - 最底层代理（开房者）：1/3 ≈ 流水1%
 *   - 一级代理：0.5/3 ≈ 流水0.5%（存在时）
 *   - 总代理：0.5/3 ≈ 流水0.5%（存在时）
 *   - 平台：剩余 1/3 ≈ 流水1%（倒挤）
 * - 跳过层份额归上层（总代直接发展二级→总代拿1/3+0.5/3）
 * - 不再扣信用分房费，credit 仅做开房门槛校验
 * - 返佣直接进筹码(points)，不再使用 commission 账户
 *
 * @param totalRake 房间抽水总额（实际从玩家处收集的筹码）
 * @param hierarchy 代理层级链（从 agentHierarchy.getAgentHierarchy 获取）
 * @param gameType 游戏类型（保留参数，未来按游戏差异化配置）
 * @returns 各方分配金额
 */
export function calcRoomSettlement(
  totalRake: number,
  hierarchy: AgentHierarchy,
  gameType: string = "texas"
): {
  fee: number;               // 兼容字段：房费=0（V3不再扣房费）
  agentRebate: number;       // 开房代理返佣（最底层）
  level1Rebate: number;      // 一级代理返佣（V3新增）
  topAgentRebate: number;    // 总代理返佣
  platformIncome: number;     // 平台净收益（倒挤）
  agentNetCost: number;       // 兼容字段：代理净成本=0（V3无信用分成本）
  totalDistributed: number;   // 分配总额（应等于totalRake）
} {
  if (totalRake <= 0) {
    return {
      fee: 0,
      agentRebate: 0,
      level1Rebate: 0,
      topAgentRebate: 0,
      platformIncome: 0,
      agentNetCost: 0,
      totalDistributed: 0,
    };
  }

  // 调用多级返佣计算（核心逻辑在 agentHierarchy.ts）
  const rebate = calcMultiLevelRebate(totalRake, hierarchy);

  return {
    fee: 0, // V3不再扣房费
    agentRebate: rebate.roomAgentRebate,
    level1Rebate: rebate.level1Rebate,
    topAgentRebate: rebate.topAgentRebate,
    platformIncome: rebate.platformIncome,
    agentNetCost: 0, // V3无信用分成本
    totalDistributed: rebate.totalDistributed,
  };
}

/**
 * 计算中途结算（V3 单一货币 + 多级返佣）
 *
 * 中途结算场景：房间未到总局数时提前结束（如强制结束）
 * V3模型：不再扣信用分房费，抽水按层级分配，违约金从开房代理筹码扣除
 *
 * @param completedRake 已完成局的抽水总额
 * @param hierarchy 代理层级链
 * @param penaltyRate 违约金比例（百分比，可选，默认0.5%，基于已完成局流水）
 * @param completedFlow 已完成局总流水（用于计算违约金基数）
 * @param gameType 游戏类型
 * @returns 中途结算各项金额
 */
export function calcMidwaySettlement(
  completedRake: number,
  hierarchy: AgentHierarchy,
  penaltyRate?: number,
  completedFlow: number = 0,
  gameType: string = "texas"
): {
  fee: number;
  agentRebate: number;
  level1Rebate: number;
  topAgentRebate: number;
  platformIncome: number;
  penalty: number;
  agentNetCost: number;
  agentTotalIncome: number;
  totalDistributed: number;
} {
  if (completedRake <= 0 && completedFlow <= 0) {
    return {
      fee: 0,
      agentRebate: 0,
      level1Rebate: 0,
      topAgentRebate: 0,
      platformIncome: 0,
      penalty: 0,
      agentNetCost: 0,
      agentTotalIncome: 0,
      totalDistributed: 0,
    };
  }

  // 抽水按层级分配
  const base = calcRoomSettlement(completedRake, hierarchy, gameType);

  // 中途违约金（默认0.5%，基于已完成局流水）
  const rate = penaltyRate !== undefined ? penaltyRate : 0.5;
  const penalty = completedFlow > 0 ? round2(completedFlow * rate / 100) : 0;

  // 代理净成本 = 违约金（V3无房费成本）
  const agentNetCost = penalty;

  // 代理总收益 = 开房代理返佣 - 违约金
  const agentTotalIncome = round2(base.agentRebate - penalty);

  return {
    ...base,
    penalty,
    agentNetCost,
    agentTotalIncome,
  };
}

/**
 * 经济模型配置 V2 - 两层配置体系
 *
 * 第一层：游戏维度配置（game_economy_config）- 抽水 & 分润模型
 * 第二层：房间模板配置（room_template_config）- 对局准入约束
 *
 * 设计原则：
 * 1. 服务启动加载全部配置到内存缓存
 * 2. 业务计算优先读取缓存配置
 * 3. 配置修改后主动刷新缓存，无需重启服务
 * 4. 如果数据库配置为空，fallback 回旧 econ_config，再 fallback 到硬编码常量
 * 5. 第一版目标：业务输出结果100%和旧版本保持一致
 */

import { db } from "@/db";
import { gameEconomyConfig, roomTemplateConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

// 游戏类型
export type GameTypeV2 = "texas" | "jinhua" | "sangong" | "niuniu" | "tbnn";
export type TemplateCode = "junior" | "senior" | "top";

export const GAME_TYPES_V2: GameTypeV2[] = ["texas", "jinhua", "sangong", "niuniu", "tbnn"];
export const TEMPLATE_CODES: TemplateCode[] = ["junior", "senior", "top"];

export const GAME_LABELS_V2: Record<GameTypeV2, string> = {
  texas: "德州扑克",
  jinhua: "炸金花",
  sangong: "抢庄三公",
  niuniu: "抢庄斗牛",
  tbnn: "通比牛牛",
};

export const TEMPLATE_LABELS: Record<TemplateCode, string> = {
  junior: "初级局",
  senior: "高级局",
  top: "顶级局",
};

// 游戏经济配置类型
export interface GameEconomy {
  id: number;
  gameType: string;
  gameName: string;
  rakeMode: string; // percentage | pot_cap
  rakeRate: number; // 抽水比例（0.03=3%）
  rakeCap: number; // 单局抽水封顶，0=不封顶
  rakeBaseType: string; // 抽水基数类型：pot | flow
  rakeBaseDesc: string; // 抽水基数描述
  minRakePot: number; // 起抽门槛，0=不限制
  agentRebateRate: number; // 代理分润比例
  topAgentRebateRate: number; // 总代理分润比例
  platformRate: number; // 平台留存比例
  rebateCapEnabled: boolean; // 是否启用返佣上限
  rebateCap: number; // 单局代理返佣上限
  isActive: boolean;
}

// 房间模板配置类型
export interface RoomTemplate {
  id: number;
  templateName: string;
  templateCode: string;
  minBuyIn: number;
  maxBuyIn: number;
  chipDenomination: number; // deprecated
  maxBetPerRound: number; // deprecated
  chips: number[]; // 下注选项数组（按游戏语义不同）
  cap: number; // 单注/累计上限
  baseBet: number; // 基础注额
  gameType: string;
  defaultRounds: number;
  maxSeats: number;
  creditRequirement: number; // V3: 开房筹码门槛
  isActive: boolean;
  sortOrder: number;
}

// 内存缓存
const gameEconomyCache = new Map<string, GameEconomy>();
const roomTemplateCache = new Map<string, RoomTemplate>();
let cacheLoaded = false;

/**
 * 加载全部配置到内存缓存（服务启动时调用）
 */
export async function loadGameEconomyConfig() {
  // 加载游戏经济配置
  const gameRows = await db.select().from(gameEconomyConfig).where(eq(gameEconomyConfig.isActive, true));
  gameEconomyCache.clear();
  for (const row of gameRows) {
    gameEconomyCache.set(row.gameType, {
      id: row.id,
      gameType: row.gameType,
      gameName: row.gameName,
      rakeMode: row.rakeMode,
      rakeRate: Number(row.rakeRate),
      rakeCap: Number(row.rakeCap),
      rakeBaseType: (row as any).rakeBaseType || "pot",
      rakeBaseDesc: (row as any).rakeBaseDesc || "",
      minRakePot: Number((row as any).minRakePot || 0),
      agentRebateRate: Number(row.agentRebateRate),
      topAgentRebateRate: Number(row.topAgentRebateRate),
      platformRate: Number(row.platformRate),
      rebateCapEnabled: row.rebateCapEnabled,
      rebateCap: Number(row.rebateCap),
      isActive: row.isActive,
    });
  }

  // 加载房间模板配置
  const templateRows = await db.select().from(roomTemplateConfig).where(eq(roomTemplateConfig.isActive, true));
  roomTemplateCache.clear();
  for (const row of templateRows) {
    // 复合键：gameType:templateCode，因为每个游戏都有 junior/senior/top 三套模板
    const cacheKey = `${row.gameType}:${row.templateCode}`;
    roomTemplateCache.set(cacheKey, {
      id: row.id,
      templateName: row.templateName,
      templateCode: row.templateCode,
      minBuyIn: Number(row.minBuyIn),
      maxBuyIn: Number(row.maxBuyIn),
      chipDenomination: Number(row.chipDenomination),
      maxBetPerRound: Number(row.maxBetPerRound),
      chips: Array.isArray((row as any).chips) ? (row as any).chips.map(Number) : [],
      cap: Number((row as any).cap ?? 0),
      baseBet: Number((row as any).baseBet ?? 0),
      gameType: row.gameType,
      defaultRounds: row.defaultRounds,
      maxSeats: row.maxSeats,
      creditRequirement: Number((row as any).creditRequirement || 0),
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    });
  }

  cacheLoaded = true;
  console.log(`[economy_v2] 已加载 ${gameEconomyCache.size} 个游戏经济配置, ${roomTemplateCache.size} 个房间模板`);
}

/**
 * 获取游戏经济配置（从缓存）
 * 如果缓存未加载或未找到，返回默认值（兼容旧硬编码）
 */
export function getGameEconomy(gameType: string): GameEconomy {
  const defaultConfig: GameEconomy = {
    id: 0,
    gameType,
    gameName: GAME_LABELS_V2[gameType as GameTypeV2] || gameType,
    rakeMode: "percentage",
    rakeRate: 0.03, // 默认3%抽水
    rakeCap: 0,
    rakeBaseType: "pot",
    rakeBaseDesc: "",
    minRakePot: 0,
    agentRebateRate: 0.01, // 默认1%代理返佣
    topAgentRebateRate: 0.01, // 默认1%总代返佣
    platformRate: 0.01, // 默认1%平台
    rebateCapEnabled: false,
    rebateCap: 0,
    isActive: true,
  };

  if (!cacheLoaded) {
    console.warn(`[economy_v2] 缓存未加载，返回默认配置: ${gameType}`);
    return defaultConfig;
  }

  return gameEconomyCache.get(gameType) || defaultConfig;
}

/**
 * 获取全部房间模板（按sortOrder排序）
 */
export function getAllRoomTemplates(): RoomTemplate[] {
  return Array.from(roomTemplateCache.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 获取全部游戏经济配置
 */
export function getAllGameEconomies(): GameEconomy[] {
  return Array.from(gameEconomyCache.values());
}

/**
 * 刷新单个游戏经济配置缓存
 */
export function refreshGameEconomyCache(gameType: string, config: GameEconomy) {
  gameEconomyCache.set(gameType, config);
}

/**
 * 刷新单个房间模板缓存（使用 gameType:templateCode 复合键）
 */
export function refreshRoomTemplateCache(template: RoomTemplate) {
  const cacheKey = `${template.gameType}:${template.templateCode}`;
  roomTemplateCache.set(cacheKey, template);
}

/**
 * 从数据库重新加载全部配置（用于批量更新后刷新）
 */
export async function reloadAllEconomyConfig() {
  await loadGameEconomyConfig();
}

/**
 * 快捷访问：抽水比例
 */
export function getRakeRate(gameType: string): number {
  return getGameEconomy(gameType).rakeRate;
}

/**
 * 快捷访问：代理返佣比例
 */
export function getAgentRebateRate(gameType: string): number {
  return getGameEconomy(gameType).agentRebateRate;
}

/**
 * 快捷访问：总代理返佣比例
 */
export function getTopAgentRebateRate(gameType: string): number {
  return getGameEconomy(gameType).topAgentRebateRate;
}

/**
 * 获取房间模板（按游戏类型 + 级别）
 * 每款游戏都有 junior/senior/top 三套模板，共15套
 * @param gameType 游戏类型：texas/jinhua/sangong/niuniu/tbnn
 * @param level 房间级别：junior/senior/top
 */
export function getRoomTemplate(gameType: string, level: string): RoomTemplate {
  // 数据库 template_code 可能是 "junior" 或 "texas_junior" 两种格式，兼容查找
  const cacheKey = `${gameType}:${level}`;
  const cacheKeyFull = `${gameType}:${gameType}_${level}`;
  const cached = roomTemplateCache.get(cacheKey) || roomTemplateCache.get(cacheKeyFull);
  if (cached) return cached;

  // 默认模板兜底（防止数据库为空时服务崩溃）
  const defaultCreditReq = level === "top" ? 3000 : level === "senior" ? 1000 : 100;
  const defaultMin = level === "top" ? 10000 : level === "senior" ? 1000 : 100;
  const defaultMax = level === "top" ? 100000 : level === "senior" ? 10000 : 1000;

  return {
    id: 0,
    templateName: `${gameType}-${level}`,
    templateCode: level,
    minBuyIn: defaultMin,
    maxBuyIn: defaultMax,
    chipDenomination: 1,
    maxBetPerRound: 0,
    chips: [],
    cap: 0,
    baseBet: 0,
    gameType,
    defaultRounds: 25,
    maxSeats: 8,
    creditRequirement: defaultCreditReq,
    isActive: true,
    sortOrder: level === "top" ? 3 : level === "senior" ? 2 : 1,
  };
}

/**
 * 获取某款游戏的全部模板（3套：初级/高级/顶级）
 */
export function getRoomTemplatesByGame(gameType: string): RoomTemplate[] {
  return ["junior", "senior", "top"]
    .map((level) => getRoomTemplate(gameType, level))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

import { db } from "@/db";
import { users, gameEconomyConfig, roomTemplateConfig } from "@/db/schema";
import { inArray, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

/**
 * 平台唯一内置账号：超级管理员。
 * 其余所有账号（客服 / 代理 / 玩家）均由管理员在后台创建。
 * 任何时候 admin 缺失都会自动补建，避免数据库清空后无法登录。
 */
export const SEED_ACCOUNTS: {
  account: string;
  password: string;
  role: string;
  inviteCode: string;
  invitedByCode: string | null;
  nickname: string;
}[] = [
  {
    account: "admin",
    password: "admin888",
    role: "admin",
    inviteCode: "VPOKER01",
    invitedByCode: null,
    nickname: "超级管理员",
  },
];

/**
 * 游戏经济配置默认值（V3：单一筹码，抽水按代理层级分配）
 * 依据 README 规范：
 * - 抽水比例 3%，代理分润 1%，总代理分润 1%，平台留存 1%
 * - texas 抽水基数为 flow（赢家盈利总和），其余为 pot（底池）
 */
const DEFAULT_GAME_ECONOMIES = [
  {
    gameType: "texas",
    gameName: "德州扑克",
    rakeMode: "percentage",
    rakeRate: 0.03,
    rakeCap: 0,
    rakeBaseType: "flow",
    rakeBaseDesc: "赢家盈利总和",
    minRakePot: 0,
    agentRebateRate: 1/3,
    level1RebateRate: 0.5/3,
    topAgentRebateRate: 0.5/3,
    platformRate: 1/3,
    rebateCapEnabled: false,
    rebateCap: 0,
    isActive: true,
  },
  {
    gameType: "jinhua",
    gameName: "炸金花",
    rakeMode: "percentage",
    rakeRate: 0.03,
    rakeCap: 0,
    rakeBaseType: "pot",
    rakeBaseDesc: "最终底池",
    minRakePot: 0,
    agentRebateRate: 1/3,
    level1RebateRate: 0.5/3,
    topAgentRebateRate: 0.5/3,
    platformRate: 1/3,
    rebateCapEnabled: false,
    rebateCap: 0,
    isActive: true,
  },
  {
    gameType: "sangong",
    gameName: "抢庄三公",
    rakeMode: "percentage",
    rakeRate: 0.03,
    rakeCap: 0,
    rakeBaseType: "pot",
    rakeBaseDesc: "下注x赔率总和",
    minRakePot: 0,
    agentRebateRate: 1/3,
    level1RebateRate: 0.5/3,
    topAgentRebateRate: 0.5/3,
    platformRate: 1/3,
    rebateCapEnabled: false,
    rebateCap: 0,
    isActive: true,
  },
  {
    gameType: "niuniu",
    gameName: "抢庄牛牛",
    rakeMode: "percentage",
    rakeRate: 0.03,
    rakeCap: 0,
    rakeBaseType: "pot",
    rakeBaseDesc: "下注x赔率总和",
    minRakePot: 0,
    agentRebateRate: 1/3,
    level1RebateRate: 0.5/3,
    topAgentRebateRate: 0.5/3,
    platformRate: 1/3,
    rebateCapEnabled: false,
    rebateCap: 0,
    isActive: true,
  },
  {
    gameType: "tbnn",
    gameName: "通比牛牛",
    rakeMode: "percentage",
    rakeRate: 0.03,
    rakeCap: 0,
    rakeBaseType: "pot",
    rakeBaseDesc: "底池",
    minRakePot: 0,
    agentRebateRate: 1/3,
    level1RebateRate: 0.5/3,
    topAgentRebateRate: 0.5/3,
    platformRate: 1/3,
    rebateCapEnabled: false,
    rebateCap: 0,
    isActive: true,
  },
];

/**
 * 房间模板默认值（每款游戏 3 个级别：初级/高级/顶级）
 * 依据 README 房间级别门槛规范：
 * - 初级 junior：筹码门槛 100，带入 100-1000，6 座位
 * - 高级 senior：筹码门槛 1000，带入 500-5000，6 座位
 * - 顶级 top：筹码门槛 5000，带入 5000-50000，6 座位
 */
const LEVEL_CONFIG = {
  junior: {
    templateName: "初级局",
    minBuyIn: 100,
    maxBuyIn: 1000,
    creditRequirement: 100,
    sortOrder: 1,
    chips: [10, 20, 50, 100],
    baseBet: 10,
  },
  senior: {
    templateName: "高级局",
    minBuyIn: 500,
    maxBuyIn: 5000,
    creditRequirement: 1000,
    sortOrder: 2,
    chips: [20, 50, 100, 200],
    baseBet: 20,
  },
  top: {
    templateName: "特级局",
    minBuyIn: 5000,
    maxBuyIn: 50000,
    creditRequirement: 5000,
    sortOrder: 3,
    chips: [50, 100, 200, 500],
    baseBet: 50,
  },
};

// 各游戏的单注/累计上限（cap）：texas=单注封顶，jinhua=看上上限，牛/三公=累计下注上限，tbnn=0(通比无上限)
const GAME_CAP = {
  texas: { junior: 100, senior: 500, top: 2000 },
  jinhua: { junior: 100, senior: 500, top: 2000 },
  sangong: { junior: 500, senior: 2000, top: 10000 },
  niuniu: { junior: 500, senior: 2000, top: 10000 },
  tbnn: { junior: 0, senior: 0, top: 0 },
};

const GAME_NAMES: Record<string, string> = {
  texas: "德州扑克",
  jinhua: "炸金花",
  sangong: "抢庄三公",
  niuniu: "抢庄牛牛",
  tbnn: "通比牛牛",
};

function buildRoomTemplates() {
  const templates: any[] = [];
  for (const gameType of Object.keys(GAME_NAMES)) {
    for (const level of ["junior", "senior", "top"] as const) {
      const lc = LEVEL_CONFIG[level];
      templates.push({
        templateName: `${GAME_NAMES[gameType]}·${lc.templateName}`,
        templateCode: level,
        minBuyIn: lc.minBuyIn,
        maxBuyIn: lc.maxBuyIn,
        chipDenomination: 1,
        maxBetPerRound: 0,
        chips: lc.chips,
        cap: GAME_CAP[gameType as keyof typeof GAME_CAP][level],
        baseBet: lc.baseBet,
        gameType,
        defaultRounds: 25,
        maxSeats: 6,
        creditRequirement: lc.creditRequirement,
        isActive: true,
        sortOrder: lc.sortOrder,
      });
    }
  }
  return templates;
}

/**
 * 初始化经济配置和房间模板（数据库为空时自动写入默认值）
 * 依据 README V3 经济模型规范，确保服务启动后经济配置非空。
 */
export async function ensureEconomySeed() {
  try {
    // 1. 游戏经济配置：为空时写入 5 款游戏默认配置
    const existingGames = await db.select({ gameType: gameEconomyConfig.gameType }).from(gameEconomyConfig);
    if (existingGames.length === 0) {
      console.log("[seed] 游戏经济配置为空，写入 5 款游戏默认配置");
      for (const config of DEFAULT_GAME_ECONOMIES) {
        await db.insert(gameEconomyConfig).values(config).onConflictDoNothing();
      }
    }

    // 2. 房间模板：为空时写入 15 套默认模板（5 游戏 x 3 级别）
    const existingTemplates = await db.select({ id: roomTemplateConfig.id }).from(roomTemplateConfig);
    if (existingTemplates.length === 0) {
      console.log("[seed] 房间模板为空，写入 15 套默认模板（5游戏x3级别）");
      const templates = buildRoomTemplates();
      for (const tpl of templates) {
        await db.insert(roomTemplateConfig).values(tpl).onConflictDoNothing();
      }
    }
  } catch (e) {
    console.warn("[seed] 经济配置初始化失败（不阻塞启动）:", e instanceof Error ? e.message : e);
  }
}

export async function ensureSeed() {
  try {
    const accounts = SEED_ACCOUNTS.map((a) => a.account);
    const existing = await db
      .select({ account: users.account })
      .from(users)
      .where(inArray(users.account, accounts));
    const have = new Set(existing.map((e) => e.account));

    const missing = SEED_ACCOUNTS.filter((a) => !have.has(a.account));
    if (!missing.length) return;

    for (const a of missing) {
      await db
        .insert(users)
        .values({
          account: a.account,
          password: hashPassword(a.password),
          securityCode: "8888",
          role: a.role,
          nickname: a.nickname,
          avatar: "1",
          inviteCode: a.inviteCode,
          invitedByCode: a.invitedByCode,
          points: 0,
          mustChangePassword: true,
        })
        .onConflictDoNothing();
    }
  } catch {
    // 初始化失败不阻塞登录流程
  }
}

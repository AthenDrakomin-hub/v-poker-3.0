/**
 * 经济模型配置 V2 路由
 * 两层配置体系：游戏经济配置 + 房间模板配置
 *
 * 权限：只有管理员可以修改；客服角色只能查看
 */

import { Router, Request, Response } from "express";
import { db } from "@/db";
import { gameEconomyConfig, roomTemplateConfig, gameEconomyHistory } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { round2 } from "@/lib/economy";
import {
  loadGameEconomyConfig,
  getAllGameEconomies,
  getAllRoomTemplates,
  getGameEconomy,
  getRoomTemplate,
  refreshGameEconomyCache,
  refreshRoomTemplateCache,
  type GameEconomy,
  type RoomTemplate,
} from "@/lib/gameEconomy";

const router = Router();

/**
 * 安全解析数字：空值/NaN 时回退到旧值，避免 Number("")=0、Number(undefined)=NaN 意外覆盖配置
 */
function safeNum(value: any, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 小数比例转百分比显示（0.03 → "3.0%"） */
function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// 权限校验中间件
async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return false;
  }
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可修改经济配置" });
    return false;
  }
  return true;
}

async function requireAdminOrCs(req: Request, res: Response): Promise<boolean> {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return false;
  }
  if (u.role !== "admin" && u.role !== "customer_service") {
    res.status(403).json({ error: "无权限访问" });
    return false;
  }
  return true;
}

// ============================================================
// 游戏经济配置（第一层）
// ============================================================

// GET /api/admin/economy-v2/games - 获取全部游戏经济配置
router.get("/games", async (req: Request, res: Response) => {
  if (!(await requireAdminOrCs(req, res))) return;
  try {
    const games = getAllGameEconomies();
    res.json({ games });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/economy-v2/games/:gameType - 获取单个游戏经济配置
router.get("/games/:gameType", async (req: Request, res: Response) => {
  if (!(await requireAdminOrCs(req, res))) return;
  try {
    const { gameType } = req.params;
    const config = getGameEconomy(gameType);
    res.json({ config });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/economy-v2/games/:gameType - 更新游戏经济配置
router.put("/games/:gameType", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { gameType } = req.params;
    const u = await getCurrentUser(req);
    const body = req.body || {};

    // 获取旧值用于历史记录
    const oldConfig = getGameEconomy(gameType);

    // 安全解析数字字段（空值/NaN 回退旧值，防止意外清零）
    const newRakeRate = safeNum(body.rakeRate, oldConfig.rakeRate);
    const newRakeCap = safeNum(body.rakeCap, oldConfig.rakeCap);
    const newMinRakePot = safeNum(body.minRakePot, oldConfig.minRakePot);
    const newAgentRebateRate = safeNum(body.agentRebateRate, oldConfig.agentRebateRate);
    const newLevel1RebateRate = safeNum(body.level1RebateRate, (oldConfig as any).level1RebateRate ?? 0.1667);
    const newTopAgentRebateRate = safeNum(body.topAgentRebateRate, oldConfig.topAgentRebateRate);
    const newRebateCap = safeNum(body.rebateCap, oldConfig.rebateCap);
    // platformRate 为展示字段（实际平台收益=房费-代理返佣-总代返佣），自动计算
    const newPlatformRate = Math.max(0, round2(1 - newAgentRebateRate - newLevel1RebateRate - newTopAgentRebateRate));

    // 校验：抽水比例不能为负；为0时记录警告（可能是误操作）
    if (newRakeRate < 0) {
      res.status(400).json({ error: "抽水比例不能为负数" });
      return;
    }
    if (newRakeRate === 0 && oldConfig.rakeRate > 0) {
      console.warn(`[economy_v2] 警告：${gameType} 抽水比例从 ${oldConfig.rakeRate} 被设为 0，将导致无抽水！`);
    }

    // 硬约束：分润比例之和不能超过房费比例（3%固定）
    const totalRebate = newAgentRebateRate + newLevel1RebateRate + newTopAgentRebateRate;
    if (totalRebate > 1 + 0.0001) {
      res.status(400).json({
        error: `分润比例之和(${pct(totalRebate)})超过100%(抽水总额)，平台将亏损！请降低返佣比例。`,
      });
      return;
    }

    // 校验：抽水基数类型必须是 pot 或 flow
    const newRakeBaseType = body.rakeBaseType || oldConfig.rakeBaseType;
    if (newRakeBaseType !== "pot" && newRakeBaseType !== "flow") {
      res.status(400).json({ error: `抽水基数类型必须是 pot 或 flow，收到: ${newRakeBaseType}` });
      return;
    }

    // 更新数据库
    const updateData: Record<string, any> = {
      gameName: body.gameName || oldConfig.gameName,
      rakeMode: body.rakeMode || oldConfig.rakeMode,
      rakeRate: newRakeRate,
      rakeCap: newRakeCap,
      rakeBaseType: newRakeBaseType,
      rakeBaseDesc: body.rakeBaseDesc ?? oldConfig.rakeBaseDesc,
      minRakePot: newMinRakePot,
      agentRebateRate: newAgentRebateRate,
      level1RebateRate: newLevel1RebateRate,
      topAgentRebateRate: newTopAgentRebateRate,
      platformRate: newPlatformRate,
      rebateCapEnabled: body.rebateCapEnabled ?? oldConfig.rebateCapEnabled,
      rebateCap: newRebateCap,
      updatedBy: u?.id,
      updatedAt: new Date(),
    };

    await db.update(gameEconomyConfig).set(updateData).where(eq(gameEconomyConfig.gameType, gameType));

    // 刷新缓存
    const newConfig: GameEconomy = {
      ...oldConfig,
      ...updateData,
      gameType,
    };
    refreshGameEconomyCache(gameType, newConfig);

    // 记录历史
    await db.insert(gameEconomyHistory).values({
      configType: "game_economy",
      targetId: oldConfig.id,
      oldValue: oldConfig as any,
      newValue: newConfig as any,
      reason: body.reason || "管理员修改游戏经济配置",
      operatorId: u?.id || 0,
    });

    res.json({ success: true, config: newConfig });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 房间模板配置（第二层）
// ============================================================

// GET /api/admin/economy-v2/templates - 获取全部房间模板
router.get("/templates", async (req: Request, res: Response) => {
  if (!(await requireAdminOrCs(req, res))) return;
  try {
    const templates = getAllRoomTemplates();
    res.json({ templates });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/economy-v2/templates/:templateCode - 获取单个房间模板
// 需要传 gameType 查询参数，因为每款游戏都有 junior/senior/top 三套模板
router.get("/templates/:templateCode", async (req: Request, res: Response) => {
  if (!(await requireAdminOrCs(req, res))) return;
  try {
    const { templateCode } = req.params;
    const gameType = (req.query.gameType as string) || "texas";
    const template = getRoomTemplate(gameType, templateCode);
    if (!template || template.id === 0) {
      res.status(404).json({ error: "模板不存在" });
      return;
    }
    res.json({ template });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/economy-v2/templates/:templateCode - 更新房间模板
// 从 body 中读取 gameType，因为 templateCode 不再唯一
router.put("/templates/:templateCode", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { templateCode } = req.params;
    const u = await getCurrentUser(req);
    const body = req.body || {};
    const gameType = body.gameType || "texas";

    const oldTemplate = getRoomTemplate(gameType, templateCode);
    if (!oldTemplate || oldTemplate.id === 0) {
      res.status(404).json({ error: "模板不存在" });
      return;
    }

    // 校验最小/最大带入（安全解析，空值回退旧值）
    const minBuyIn = safeNum(body.minBuyIn, oldTemplate.minBuyIn);
    const maxBuyIn = safeNum(body.maxBuyIn, oldTemplate.maxBuyIn);
    if (minBuyIn > maxBuyIn) {
      res.status(400).json({ error: "最小带入不能大于最大带入" });
      return;
    }

    // 更新数据库
    const updateData: Record<string, any> = {
      templateName: body.templateName || oldTemplate.templateName,
      minBuyIn,
      maxBuyIn,
      chipDenomination: safeNum(body.chipDenomination, oldTemplate.chipDenomination),
      maxBetPerRound: safeNum(body.maxBetPerRound, oldTemplate.maxBetPerRound),
      chips: Array.isArray(body.chips) ? body.chips.map(Number) : oldTemplate.chips,
      cap: safeNum(body.cap, oldTemplate.cap),
      baseBet: safeNum(body.baseBet, oldTemplate.baseBet),
      gameType: body.gameType || oldTemplate.gameType,
      defaultRounds: safeNum(body.defaultRounds, oldTemplate.defaultRounds),
      maxSeats: safeNum(body.maxSeats, oldTemplate.maxSeats),
      creditRequirement: safeNum(body.creditRequirement, oldTemplate.creditRequirement), // V3: 开房筹码门槛
      sortOrder: safeNum(body.sortOrder, oldTemplate.sortOrder),
      updatedBy: u?.id,
      updatedAt: new Date(),
    };

    await db.update(roomTemplateConfig).set(updateData).where(and(eq(roomTemplateConfig.templateCode, templateCode), eq(roomTemplateConfig.gameType, gameType)));

    // 刷新缓存
    const newTemplate: RoomTemplate = {
      ...oldTemplate,
      ...updateData,
      templateCode,
    };
    refreshRoomTemplateCache(newTemplate);

    // 记录历史
    await db.insert(gameEconomyHistory).values({
      configType: "room_template",
      targetId: oldTemplate.id,
      oldValue: oldTemplate as any,
      newValue: newTemplate as any,
      reason: body.reason || "管理员修改房间模板",
      operatorId: u?.id || 0,
    });

    res.json({ success: true, template: newTemplate });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 配置缓存管理
// ============================================================

// POST /api/admin/economy-v2/reload - 重新加载全部配置缓存
router.post("/reload", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    await loadGameEconomyConfig();
    res.json({ success: true, message: "配置缓存已重新加载" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/economy-v2/history - 获取配置修改历史
router.get("/history", async (req: Request, res: Response) => {
  if (!(await requireAdminOrCs(req, res))) return;
  try {
    const { configType, limit = "50" } = req.query as Record<string, string>;
    const rows = configType
      ? await db.select().from(gameEconomyHistory).where(eq(gameEconomyHistory.configType, configType)).limit(Number(limit))
      : await db.select().from(gameEconomyHistory).limit(Number(limit));
    rows.sort((a, b) => b.id - a.id);
    res.json({ history: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

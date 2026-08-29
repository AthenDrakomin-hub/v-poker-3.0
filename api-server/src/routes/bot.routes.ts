/**
 * 机器人陪玩 API 路由
 *
 * 接口：
 * - POST /api/bot/rooms/:id/add      - 房主添加机器人到房间
 * - POST /api/bot/rooms/:id/remove   - 房主移除房间内机器人
 * - GET  /api/bot/rooms/:id/list     - 获取房间内机器人列表
 * - GET  /api/bot/available          - 获取可用机器人数量
 */
import { Router, Request, Response } from "express";
import { getCurrentUser } from "@/lib/auth";
import { addBotToRoom, removeBotFromRoom, getRoomBots, getAvailableBots } from "@/services/botService";

const router = Router();

// POST /api/bot/rooms/:id/add - 添加机器人到房间
router.post("/rooms/:id/add", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const roomId = Number(req.params.id);
    if (!roomId || isNaN(roomId)) {
      res.status(400).json({ error: "房间ID无效" });
      return;
    }
    const result = await addBotToRoom(roomId, u.id);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      ok: true,
      bot: result.bot
        ? {
            id: result.bot.id,
            account: result.bot.account,
            nickname: result.bot.nickname,
            avatar: result.bot.avatar,
          }
        : null,
    });
  } catch (e: any) {
    console.error("[bot/add] error:", e);
    res.status(500).json({ error: e.message || "添加机器人失败" });
  }
});

// POST /api/bot/rooms/:id/remove - 移除房间内机器人
router.post("/rooms/:id/remove", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const roomId = Number(req.params.id);
    const { botUserId } = req.body || {};
    if (!roomId || isNaN(roomId) || !botUserId) {
      res.status(400).json({ error: "参数无效" });
      return;
    }
    const result = await removeBotFromRoom(roomId, Number(botUserId), u.id);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[bot/remove] error:", e);
    res.status(500).json({ error: e.message || "移除机器人失败" });
  }
});

// GET /api/bot/rooms/:id/list - 获取房间内机器人列表
router.get("/rooms/:id/list", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const roomId = Number(req.params.id);
    if (!roomId || isNaN(roomId)) {
      res.status(400).json({ error: "房间ID无效" });
      return;
    }
    const bots = await getRoomBots(roomId);
    res.json({
      ok: true,
      bots: bots.map((b) => ({
        id: b.id,
        account: b.account,
        nickname: b.nickname,
        avatar: b.avatar,
        points: b.points,
      })),
    });
  } catch (e: any) {
    console.error("[bot/list] error:", e);
    res.status(500).json({ error: e.message || "获取机器人列表失败" });
  }
});

// GET /api/bot/available - 获取可用机器人数量
router.get("/available", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const bots = await getAvailableBots(10);
    res.json({
      ok: true,
      available: bots.length,
      bots: bots.map((b) => ({
        id: b.id,
        account: b.account,
        nickname: b.nickname,
      })),
    });
  } catch (e: any) {
    console.error("[bot/available] error:", e);
    res.status(500).json({ error: e.message || "获取可用机器人失败" });
  }
});

export default router;

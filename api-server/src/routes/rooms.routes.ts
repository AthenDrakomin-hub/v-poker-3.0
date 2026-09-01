import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db } from "@/db";
import {
  rooms,
  roomPlayers,
  gameRounds,
  users,
  handStates,
  roomMessages,
  chipTransactions,
  roomHistory,
  roomInviteTokens,
  clientActions,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, gt, gte, lte } from "drizzle-orm";
import { getCurrentUser, genRoomNo, verifyPasswordNoMigrate, hashPassword } from "@/lib/auth";
import { HandState, publicState, optionsFor, createHand, applyAction, GameType } from "@/lib/hand";
import { loadState, saveState } from "@/lib/roomState";
import { startTimeoutChecker } from "@/services/timeoutChecker";
import { processingRooms } from "@/lib/roomLock";
import { triggerAutoPlay as triggerTbnnAutoPlay, settleHand as tbnnSettleHand } from "@/lib/games/tbnn/engine";

import { commitHand, settleRoom } from "@/lib/settle";
import { archiveRoom } from "@/lib/roomHistory";
import { getAgentHierarchy } from "@/lib/agentHierarchy";
import { getGameEconomy, getRoomTemplate, getRoomTemplatesByGame } from "@/lib/gameEconomy";
import { broadcastStateChanged, broadcastChatMessage, broadcastOrderedEvent } from "@/socket/roomSocket";
import { audit } from "@/lib/audit";
import { sql } from "drizzle-orm";
import { checkIdempotency, recordActionResult, generateClientActionId } from "@/middleware/idempotency";

const router = Router();

// 通比牛牛：发牌后延迟自动开牌结算的定时器管理（避免重复设置）
const tbnnSettlementTimers = new Map<number, NodeJS.Timeout>();

/**
 * 通比牛牛：发牌后延迟1.5秒自动开牌结算
 * 玩家可在此期间看公开的牌，然后自动比大小+分
 * 加 processingRooms 锁避免与其他操作并发冲突
 * 【防卡死】遇到房间锁占用时退避重试（最多5次，每次500ms），而非直接放弃
 */
const TBNN_SETTLE_MAX_RETRY = 5;
const TBNN_SETTLE_RETRY_DELAY = 500;

function scheduleTbnnSettlement(roomId: number, delayMs = 1500) {
  if (tbnnSettlementTimers.has(roomId)) return;
  const timer = setTimeout(async () => {
    tbnnSettlementTimers.delete(roomId);
    await tryTbnnSettle(roomId, 0);
  }, delayMs);
  tbnnSettlementTimers.set(roomId, timer);
}

async function tryTbnnSettle(roomId: number, attempt: number) {
  if (processingRooms.has(roomId)) {
    if (attempt < TBNN_SETTLE_MAX_RETRY) {
      console.log(`[tbnn自动开牌] room=${roomId} 房间锁占用，${TBNN_SETTLE_RETRY_DELAY}ms后重试（第${attempt + 1}/${TBNN_SETTLE_MAX_RETRY}次）`);
      setTimeout(() => tryTbnnSettle(roomId, attempt + 1), TBNN_SETTLE_RETRY_DELAY);
      return;
    }
    console.error(`[tbnn自动开牌] room=${roomId} 重试${TBNN_SETTLE_MAX_RETRY}次后仍被锁占用，放弃（将由timeoutChecker兜底）`);
    return;
  }
  processingRooms.add(roomId);
  try {
    const st = await loadState(roomId);
    if (!st || st.gameType !== "tbnn" || st.phase !== "dealt" || st.finished) return;
    tbnnSettleHand(st);
    await saveState(roomId, st);
    await commitHand(roomId, st);
    broadcastStateChanged(roomId);
  } catch (e: any) {
    console.error(`[tbnn自动开牌失败] room=${roomId}:`, e.message);
  } finally {
    processingRooms.delete(roomId);
  }
}

// 准备下一局状态：roomId -> Set<userId>（已准备的玩家）
const readyNextMap = new Map<number, Set<number>>();

// GET /api/rooms/templates/:gameType — 获取某游戏的3套房间模板（公开，代理创建房间用）
router.get("/templates/:gameType", async (req: Request, res: Response) => {
  try {
    const { gameType } = req.params;
    if (!["texas", "jinhua", "niuniu", "sangong", "tbnn"].includes(gameType)) {
      res.status(400).json({ error: "无效游戏类型" });
      return;
    }
    const templates = getRoomTemplatesByGame(gameType);
    res.json({ templates });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rooms — 房间列表（支持不同角色访问范围）
router.get("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const { gameType, status, agentId } = req.query;
  
  // 权限控制
  let agentIds: number[] | null = null;
  if (u.role === "top_agent") {
    // 总代理可查看自己+下线的房间
    const downs = await db.select({ id: users.id }).from(users).where(eq(users.invitedById, u.id));
    agentIds = [u.id, ...downs.map((d) => d.id)];
  } else if (u.role === "agent") {
    // 一级代理只能查看自己的房间
    agentIds = [u.id];
  } else if (u.role === "admin") {
    // 管理员可查看所有房间
    if (agentId) agentIds = [Number(agentId)];
  } else {
    // 普通玩家查看自己参与过的房间
    const joinedRooms = await db.select({ roomId: roomPlayers.roomId }).from(roomPlayers).where(eq(roomPlayers.userId, u.id));
    agentIds = null; // 不限制agentId，后续过滤
  }
  
  const conds: any[] = [];
  if (agentIds !== null && agentIds !== undefined) {
    conds.push(inArray(rooms.agentId, agentIds));
  }
  if (gameType) conds.push(eq(rooms.gameType, gameType as string));
  if (status) conds.push(eq(rooms.status, status as string));
  
  const rows = await db
    .select()
    .from(rooms)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(rooms.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  const totalRows = await db
    .select({ count: rooms.id })
    .from(rooms)
    .where(conds.length ? and(...conds) : undefined);
  const total = totalRows[0]?.count || 0;
  
  // 获取房主信息
  const ids = [...new Set(rows.map((r) => r.agentId))];
  const owners = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : [];
  const nameMap = new Map(owners.map((o) => [o.id, o.nickname || o.account]));
  
  res.json({
    data: rows.map((r) => ({
      ...r,
      ownerName: nameMap.get(r.agentId) || "-",
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// POST /api/rooms/create
router.post("/create", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const unlimited = u.role === "admin";
  if (!unlimited && u.role !== "agent" && u.role !== "top_agent") {
    res.status(403).json({ error: "无开房权限" });
    return;
  }
  const body = req.body || {};
  const { gameType, level, initialPoints, password, fixedAnte } = body;
  if (!["texas", "jinhua", "sangong", "niuniu", "tbnn"].includes(gameType)) {
    res.status(400).json({ error: "游戏类型无效" });
    return;
  }
  if (!["junior", "senior", "top"].includes(level)) {
    res.status(400).json({ error: "房间级别无效" });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "请设置房间密码" });
    return;
  }
  // 房间座位上限固定为8人（牌桌UI最多容纳8个座位）
  // 房间密码自动哈希存储
  const roomPassword = (password.startsWith("$2a$") || password.startsWith("$2b$"))
    ? password
    : hashPassword(password);
  // V3：开房门槛改用筹码余额，不再使用信用分
  if (!unlimited && u.points < 100) {
    res.status(403).json({ error: "筹码低于100，无法开房" });
    return;
  }
  // V3：从房间模板读取准入参数，门槛改用筹码余额（复用creditRequirement字段值）
  // 初级100/高级1000/顶级3000
  const tmpl = getRoomTemplate(gameType, level);
  if (!unlimited && u.points < tmpl.creditRequirement) {
    res.status(403).json({ error: `筹码需达到${tmpl.creditRequirement}才能开${tmpl.templateName}` });
    return;
  }
  const ip = isNaN(Number(initialPoints)) ? tmpl.minBuyIn : Math.max(tmpl.minBuyIn, Math.min(tmpl.maxBuyIn, Number(initialPoints)));
  if (ip < tmpl.minBuyIn || ip > tmpl.maxBuyIn) {
    res.status(400).json({ error: `${tmpl.templateName}初始筹码需在${tmpl.minBuyIn}-${tmpl.maxBuyIn}之间` });
    return;
  }
  // 房间 ID 不复用：最多 100 个活跃房间，超出则返回错误
  // 旧房间保留历史记录，不重复使用
  const MAX_ROOMS = 100;
  const activeRooms = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(sql`${rooms.status} != 'finished'`);
  if (activeRooms.length >= MAX_ROOMS) {
    res.status(503).json({ error: `房间已满（${MAX_ROOMS}个），请稍后再试` });
    return;
  }

  // 生成新房间号（确保唯一）
  let roomNo = genRoomNo();
  for (let i = 0; i < 10; i++) {
    const dup = await db.select().from(rooms).where(eq(rooms.roomNo, roomNo)).limit(1);
    if (!dup.length) break;
    roomNo = genRoomNo();
  }

  // 创建新房间
  const inserted = await db
    .insert(rooms)
    .values({ roomNo, password: roomPassword, gameType, level, initialPoints: ip, agentId: u.id, status: "waiting", currentRound: 0, totalRounds: tmpl.defaultRounds, totalRake: 0, totalFlow: 0, maxSeats: 8, fixedAnte: Number(fixedAnte) || 0, settled: false })
    .returning();
  const roomId = inserted[0].id;
  // 房主创建房间后以"管理席位"身份加入（spectator，不扣钱包，不参与游戏）
  await db.insert(roomPlayers).values({ roomId, userId: u.id, seat: 0, points: 0, isSpectator: true, ready: false });
  const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  
  // 生成临时邀请凭据（有效期24小时）
  const inviteToken = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(roomInviteTokens).values({
    roomId,
    token: inviteToken,
    expiresAt,
    createdBy: u.id,
  });
  
  res.json({ 
    room: room[0],
    inviteToken,
    inviteExpiresAt: expiresAt.toISOString(),
    inviteUrl: `https://goodspage.cn/join?token=${inviteToken}`
  });
});

// POST /api/rooms/join
router.post("/join", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const body = req.body || {};
  const roomNo = String(body?.roomNo || "").trim();
  const password = String(body?.password || "");
  const wantSpectate = Boolean(body?.spectate);
  if (!roomNo) {
    res.status(400).json({ error: "请输入房号" });
    return;
  }
  const rows = await db.select().from(rooms).where(eq(rooms.roomNo, roomNo)).limit(1);
  const room = rows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const privileged = u.role === "admin" || u.role === "top_agent" || room.agentId === u.id;
  if (!privileged) {
    if (!password) {
      res.status(400).json({ error: "请输入房间密码" });
      return;
    }
    const isPasswordValid = room.password.startsWith("$2a$") || room.password.startsWith("$2b$")
      ? await verifyPasswordNoMigrate(password, room.password)
      : room.password === password;
    if (!isPasswordValid) {
      res.status(401).json({ error: "房间密码错误" });
      return;
    }
  }
  if (room.status === "finished" || room.settled) {
    res.status(400).json({ error: "该房间已结束" });
    return;
  }
  // 房间互斥：普通玩家不能同时在多个未结束的房间中（观众身份不算）
  // 代理/总代理不受此限制，可以同时管理多个房间
  const isAgentOrAbove = u.role === "agent" || u.role === "top_agent" || u.role === "admin";
  if (!isAgentOrAbove) {
    const otherRooms = await db
      .select({ roomId: roomPlayers.roomId, status: rooms.status, roomNo: rooms.roomNo })
      .from(roomPlayers)
      .innerJoin(rooms, eq(roomPlayers.roomId, rooms.id))
      .where(and(eq(roomPlayers.userId, u.id), eq(roomPlayers.isSpectator, false)));
    const activeOther = otherRooms.filter((r) => r.roomId !== room.id && r.status !== "finished");
    if (activeOther.length) {
      res.status(400).json({ error: `你已在房间 ${activeOther[0].roomNo} 中，请先退出该房间` });
      return;
    }
  }
  const existing = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, u.id)))
    .limit(1);
  // 如果已在房间中：
  // - 房主/代理：直接返回（管理席位不参与游戏）
  // - 其他用户已是玩家：直接返回
  // - 是观众：删除观众记录，继续加入流程（观众转玩家）
  if (existing.length) {
    if (u.role === "agent" || u.role === "top_agent" || room.agentId === u.id) {
      res.json({ room });
      return;
    }
    if (!existing[0].isSpectator) {
      res.json({ room });
      return;
    }
    // 观众转玩家：删除观众记录
    await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, u.id)));
  }
  const current = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, room.id));
  const seated = current.filter((p) => !p.isSpectator);
  // 管理员和客服只能观战，不能加入游戏
  const isStaff = u.role === "admin" || u.role === "customer_service";
  // 默认加入观众席位；只有明确传wantSpectate=false且不是staff才能加入游戏
  const joinAsPlayer = wantSpectate === false && !isStaff;
  if (!joinAsPlayer) {
    await db.insert(roomPlayers).values({ roomId: room.id, userId: u.id, seat: 0, points: 0, isSpectator: true, ready: false });
    broadcastStateChanged(room.id); // 通知其他客户端有观众加入
    res.json({ room, seatType: "spectator" });
    return;
  }
  if (seated.length >= room.maxSeats) {
    res.status(400).json({ error: `房间已满（最多 ${room.maxSeats} 人）` });
    return;
  }
  // 玩家进房带筹码，根据房间模板限制进场筹码范围
  const tmpl = getRoomTemplate(room.gameType, room.level);
  const minBuyIn = tmpl.minBuyIn;
  const maxBuyIn = room.initialPoints;
  // 筹码不足时自动作为观众加入，代理上分后可再入座
  if (u.points < minBuyIn) {
    await db.insert(roomPlayers).values({ roomId: room.id, userId: u.id, seat: 0, points: 0, isSpectator: true, ready: false });
    broadcastStateChanged(room.id);
    res.json({ room, seatType: "spectator", message: `账户筹码不足（${tmpl.templateName}最低带入${minBuyIn}），已进入观众席，代理上分后可入座` });
    return;
  }
  const bringIn = Math.min(u.points, maxBuyIn);
  const nextBal = u.points - bringIn;
  if (bringIn > 0) {
    // 使用事务保证数据一致性
    await db.transaction(async (tx) => {
      await tx.update(users).set({ points: nextBal }).where(eq(users.id, u.id));
      await tx.insert(chipTransactions).values({
        userId: u.id, amount: -bringIn, balanceAfter: nextBal, type: "buyin",
        note: `房间 ${room.roomNo} 带入筹码（上限${maxBuyIn}）`, roomId: room.id,
      });
    });
  }
  const taken = new Set(seated.map((p) => p.seat));
  let seat = 1;
  while (taken.has(seat) && seat <= room.maxSeats) seat++;
  // 硬上限：牌桌最多8人，超过则拒绝加入（观众席位不受此限制）
  if (!joinAsPlayer && seated.length >= 8) {
    res.status(400).json({ error: `房间已满（最多 ${room.maxSeats} 人对战席位），请稍后再试` });
    return;
  }
  if (seated.length >= room.maxSeats) {
    res.status(400).json({ error: `房间已满（最多 ${room.maxSeats} 人）` });
    return;
  }
  await db.insert(roomPlayers).values({ roomId: room.id, userId: u.id, seat, points: bringIn, isSpectator: false, ready: false });
  broadcastStateChanged(room.id); // 通知其他客户端有新玩家加入
  res.json({ room, seatType: "player", seat, balance: nextBal, broughtIn: bringIn, maxBuyIn });
});

// GET /api/rooms/mine
router.get("/mine", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const gameType = req.query.gameType as string | undefined;
  let agentIds: number[] = [u.id];
  if (u.role === "top_agent") {
    const downs = await db.select({ id: users.id }).from(users).where(eq(users.invitedById, u.id));
    agentIds = [u.id, ...downs.map((d) => d.id)];
  }
  const conds = [];
  if (u.role !== "admin") conds.push(inArray(rooms.agentId, agentIds));
  if (gameType) conds.push(eq(rooms.gameType, gameType));
  const rows = await db
    .select()
    .from(rooms)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(rooms.createdAt))
    .limit(80);
  const ids = [...new Set(rows.map((r) => r.agentId))];
  const owners = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : [];
  const nameMap = new Map(owners.map((o) => [o.id, o.nickname || o.account]));
  res.json({
    rooms: rows.map((r) => {
      // 从 V2 房间模板配置补充筹码面额、单注上限、模板名称
      const tmpl = getRoomTemplate(r.gameType, r.level);
      // 从 V2 游戏经济配置读取分润比例，计算房间净收益（后端计算，前端不计算）
      const econ = getGameEconomy(r.gameType);
      const netProfit = r.totalRake - r.totalFlow * (0.03 - econ.agentRebateRate - econ.topAgentRebateRate);
      return {
        ...r,
        ownerName: nameMap.get(r.agentId) || "-",
        isMine: r.agentId === u.id,
        chipDenomination: tmpl.chipDenomination,
        maxBetPerRound: tmpl.maxBetPerRound,
        chips: tmpl.chips,
        cap: tmpl.cap,
        baseBet: tmpl.baseBet,
        templateName: tmpl.templateName,
        netProfit: Math.round(netProfit * 100) / 100,
      };
    }),
    canSpectateFree: u.role === "admin" || u.role === "top_agent",
  });
});

// GET /api/rooms/history — 代理历史房间战绩（永久保留，不随 rooms 表复用丢失）
// 权限：agent 看自己 / top_agent 看自己+下线 / admin 看全部（可指定 agentId）
router.get("/history", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (!["agent", "top_agent", "admin"].includes(u.role)) {
    res.status(403).json({ error: "无权限" });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const gameType = req.query.gameType as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  // 权限范围：确定可查看的 agentId 列表
  let agentIds: number[] | null = null; // null = 全部（admin）
  if (u.role === "agent") {
    agentIds = [u.id];
  } else if (u.role === "top_agent") {
    const downs = await db.select({ id: users.id }).from(users).where(eq(users.invitedById, u.id));
    agentIds = [u.id, ...downs.map((d) => d.id)];
  } else if (u.role === "admin" && req.query.agentId) {
    agentIds = [Number(req.query.agentId)];
  }

  // 构建查询条件
  const conds: any[] = [];
  if (agentIds) conds.push(inArray(roomHistory.agentId, agentIds));
  if (gameType) conds.push(eq(roomHistory.gameType, gameType));
  if (from) conds.push(gte(roomHistory.endedAt, new Date(from + "T00:00:00")));
  if (to) conds.push(lte(roomHistory.endedAt, new Date(to + "T23:59:59")));

  // 分页查询
  const rows = await db
    .select()
    .from(roomHistory)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(roomHistory.endedAt))
    .limit(pageSize)
    .offset(offset);

  // 总数
  const countRows = await db
    .select({ count: roomHistory.id })
    .from(roomHistory)
    .where(conds.length ? and(...conds) : undefined);
  const total = countRows.length;

  // 汇总统计（全量，不受分页影响）
  const allRows = await db
    .select({
      totalRounds: roomHistory.totalRounds,
      totalRake: roomHistory.totalRake,
      totalFlow: roomHistory.totalFlow,
      agentNetCost: roomHistory.agentNetCost,
      platformIncome: roomHistory.platformIncome,
    })
    .from(roomHistory)
    .where(conds.length ? and(...conds) : undefined);

  const summary = allRows.reduce(
    (acc, r) => ({
      totalRooms: acc.totalRooms + 1,
      totalRounds: acc.totalRounds + Number(r.totalRounds || 0),
      totalRake: acc.totalRake + Number(r.totalRake || 0),
      totalFlow: acc.totalFlow + Number(r.totalFlow || 0),
      totalAgentNetCost: acc.totalAgentNetCost + Number(r.agentNetCost || 0),
      totalPlatformIncome: acc.totalPlatformIncome + Number(r.platformIncome || 0),
    }),
    { totalRooms: 0, totalRounds: 0, totalRake: 0, totalFlow: 0, totalAgentNetCost: 0, totalPlatformIncome: 0 }
  );

  // 查询代理名称
  const agentIdSet = [...new Set(rows.map((r) => r.agentId))];
  const agents = agentIdSet.length ? await db.select().from(users).where(inArray(users.id, agentIdSet)) : [];
  const agentNameMap = new Map(agents.map((a) => [a.id, a.nickname || a.account]));

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      roomNo: r.roomNo,
      agentId: r.agentId,
      agentName: agentNameMap.get(r.agentId) || "-",
      gameType: r.gameType,
      level: r.level,
      totalRounds: Number(r.totalRounds),
      totalRake: Number(r.totalRake),
      totalFlow: Number(r.totalFlow),
      agentNetCost: r.agentNetCost != null ? Number(r.agentNetCost) : null,
      platformIncome: r.platformIncome != null ? Number(r.platformIncome) : null,
      endReason: r.endReason,
      createdAt: r.createdAt,
      endedAt: r.endedAt,
    })),
    summary,
    page,
    pageSize,
    total,
  });
});

// GET /api/rooms/joined — 当前用户已加入但未结束的房间（用于继续游戏）
router.get("/joined", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  // 查询用户加入的房间（玩家或观众）
  const joined = await db
    .select({
      id: rooms.id,
      roomNo: rooms.roomNo,
      gameType: rooms.gameType,
      level: rooms.level,
      initialPoints: rooms.initialPoints,
      fixedAnte: rooms.fixedAnte,
      status: rooms.status,
      currentRound: rooms.currentRound,
      totalRounds: rooms.totalRounds,
      agentId: rooms.agentId,
      isSpectator: roomPlayers.isSpectator,
      seat: roomPlayers.seat,
      points: roomPlayers.points,
    })
    .from(roomPlayers)
    .innerJoin(rooms, eq(roomPlayers.roomId, rooms.id))
    .where(eq(roomPlayers.userId, u.id))
    .orderBy(desc(rooms.createdAt))
    .limit(20);
  // 过滤未结束的房间：finished 和 waiting_continue（25局已结束待续开）都不显示在"继续游戏"列表中
  // waiting_continue 房间仅代理可在自己的房间管理页续开，玩家看到的应是游戏记录而非可进入房间
  const active = joined.filter(
    (r) => r.status !== "finished" && r.status !== "waiting_continue"
  );
  const agentIds = [...new Set(active.map((r) => r.agentId))];
  const agents = agentIds.length ? await db.select().from(users).where(inArray(users.id, agentIds)) : [];
  const nameMap = new Map(agents.map((a) => [a.id, a.nickname || a.account]));
  res.json({
    rooms: active.map((r) => ({ ...r, ownerName: nameMap.get(r.agentId) || "-" })),
  });
});

// GET /api/rooms/:id/rounds — 获取房间内每局记录（最多25局）
router.get("/:id/rounds", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  // 验证用户是否参与了该房间
  const rp = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id))).limit(1);
  if (rp.length === 0) {
    res.status(403).json({ error: "无权查看该房间记录" });
    return;
  }
  const rounds = await db.select().from(gameRounds).where(eq(gameRounds.roomId, roomId)).orderBy(asc(gameRounds.roundNo)).limit(25);
  res.json({
    rounds: rounds.map(r => ({
      id: r.id,
      roundNo: r.roundNo,
      gameType: r.gameType,
      winnerUserId: r.winnerUserId,
      pot: r.potBeforeRake,
      rake: r.rake,
      turnover: r.turnover,
      result: r.result,
      createdAt: r.createdAt,
    }))
  });
});

// GET /api/rooms/:id
router.get("/:id", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const rows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = rows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const rps = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const userIds = [...new Set(rps.map((r) => r.userId))];
  const uRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
  const nameMap = new Map(uRows.map((x) => [x.id, x.nickname || x.account]));
  const avaMap = new Map(uRows.map((x) => [x.id, x.avatar]));
  const players = rps.map((r) => ({
    userId: r.userId, account: nameMap.get(r.userId) || "?", avatar: avaMap.get(r.userId) || "1",
    seat: r.seat, points: r.points, isSpectator: r.isSpectator, ready: r.ready, autoPlay: r.autoPlay,
  }));
  // 查询当前房间实例的牌局记录：按 roomId + roomNo 过滤
  // roomNo 区分房间ID复用后的不同实例，旧记录永久保留不混淆
  const roundsRows = await db.select().from(gameRounds)
    .where(and(eq(gameRounds.roomId, roomId), eq(gameRounds.roomNo, room.roomNo)))
    .orderBy(desc(gameRounds.roundNo)).limit(25);
  const hsRows = await db.select().from(handStates).where(eq(handStates.roomId, roomId)).limit(1);
  const st = hsRows.length ? (hsRows[0].state as HandState) : null;
  const me = rps.find((r) => r.userId === u.id);
  const viewerIsSpectator = !me || me.isSpectator;
  const isAgent = room.agentId === u.id;
  // 注意：GET请求不触发broadcastStateChanged，否则会导致前端load→广播→load无限循环
  // 广播只在状态实际变更时触发（准备、开始游戏、操作等）
  // 从 V2 房间模板配置补充筹码面额、单注上限、模板名称
  const tmpl = getRoomTemplate(room.gameType, room.level);
  const roomWithTemplate = {
    ...room,
    chipDenomination: tmpl.chipDenomination,
    maxBetPerRound: tmpl.maxBetPerRound,
    chips: tmpl.chips,
    cap: tmpl.cap,
    baseBet: tmpl.baseBet,
    templateName: tmpl.templateName,
  };
  // 代理层级链（总结算抽水分配展示用）
  const hierarchy = await getAgentHierarchy(room.agentId);
  res.json({
    room: roomWithTemplate, players, rounds: roundsRows,
    me: me ? { seat: me.seat, points: me.points, isSpectator: me.isSpectator, ready: me.ready, autoPlay: me.autoPlay } : null,
    userPoints: u.points,
    isAgent, isHost: room.agentId === u.id, role: u.role, userId: u.id,
    hand: st ? publicState(st, u.id, viewerIsSpectator) : null,
    options: st && !viewerIsSpectator ? optionsFor(st, u.id) : [],
    hierarchy,
  });
});

// POST /api/rooms/:id/ready
router.post("/:id/ready", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const body = req.body || {};
  const want = typeof body?.ready === "boolean" ? body.ready : null;
  const rp = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (!rp.length) {
    res.status(400).json({ error: "你不在该房间" });
    return;
  }
  if (rp[0].isSpectator) {
    res.status(400).json({ error: "观众无需准备" });
    return;
  }
  // 0筹码玩家不能准备游戏，需等代理上分（房主除外）
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const isHost = roomRows[0]?.agentId === u.id;
  if (rp[0].points <= 0 && !isHost) {
    res.status(400).json({ error: "筹码为0，无法准备，请联系代理上分" });
    return;
  }
  const hs = await db.select().from(handStates).where(eq(handStates.roomId, roomId)).limit(1);
  if (hs.length) {
    const st = hs[0].state as HandState;
    if (!st.finished) {
      res.status(400).json({ error: "本局进行中" });
      return;
    }
  }
  const next = want === null ? !rp[0].ready : want;
  await db.update(roomPlayers).set({ ready: next }).where(eq(roomPlayers.id, rp[0].id));
  broadcastStateChanged(roomId);
  res.json({ ok: true, ready: next });
});

// POST /api/rooms/:id/auto-play (切换自动挂机状态，跨局持久化)
router.post("/:id/auto-play", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const body = req.body || {};
  const want = typeof body?.autoPlay === "boolean" ? body.autoPlay : null;
  const rp = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (!rp.length) {
    res.status(400).json({ error: "你不在该房间" });
    return;
  }
  if (rp[0].isSpectator) {
    res.status(400).json({ error: "观众无需挂机" });
    return;
  }
  const next = want === null ? !rp[0].autoPlay : want;
  await db.update(roomPlayers).set({ autoPlay: next }).where(eq(roomPlayers.id, rp[0].id));

  // 如果游戏进行中，通过 engine 的 toggle_auto 设置指定值并触发自动行动
  const hs = await loadState(roomId);
  if (hs && !hs.finished) {
    const seatIdx = hs.seats.findIndex((s) => s.userId === u.id);
    if (seatIdx >= 0 && hs.seats[seatIdx].autoPlay !== next) {
      applyAction(hs, u.id, "toggle_auto", next ? 1 : 0);
      await saveState(roomId, hs);
    }
  }

  broadcastStateChanged(roomId);
  res.json({ ok: true, autoPlay: next });
});

// DELETE /api/rooms/:id/ready (leave room)
router.delete("/:id/ready", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const room = roomRows[0];
  const mine = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (mine.length && !mine[0].isSpectator && mine[0].points > 0) {
    const refAmt = mine[0].points;
    const next = u.points + refAmt;
    // 使用事务保证提现数据一致性
    await db.transaction(async (tx) => {
      await tx.update(users).set({ points: next }).where(eq(users.id, u.id));
      await tx.insert(chipTransactions).values({
        userId: u.id, amount: refAmt, balanceAfter: next, type: "cashout",
        note: `离开房间 ${roomRows[0].roomNo} 带出筹码`, roomId,
      });
    });
  }
  // 游戏进行中玩家离开：自动弃牌，让游戏继续
  const hs = await loadState(roomId);
  if (hs && !hs.finished) {
    const seatIdx = hs.seats.findIndex((s) => s.userId === u.id);
    if (seatIdx >= 0 && !hs.seats[seatIdx].folded) {
      try {
        applyAction(hs, u.id, "fold");
        await saveState(roomId, hs);
        if (hs.finished) await commitHand(roomId, hs);
      } catch {}
    }
  }
  await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)));
  const remaining = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const activePlayers = remaining.filter((r) => !r.isSpectator);
  if (activePlayers.length === 0) {
    // 所有玩家离开：如果房间有已完成局，必须执行信用分结算（防止漏扣房费/抽水）
    let settlement = null;
    if (room.totalFlow > 0 || room.currentRound > 0) {
      settlement = await settleRoom(roomId, room.agentId, room.totalRake, room.totalFlow, room.gameType);
      // 归档房间历史战绩（永久保留）
      await archiveRoom(
        {
          roomNo: room.roomNo,
          agentId: room.agentId,
          gameType: room.gameType,
          level: room.level,
          currentRound: room.currentRound,
          totalRake: room.totalRake,
          totalFlow: room.totalFlow,
          createdAt: room.createdAt,
        },
        "player_left",
        settlement
          ? { agentNetCost: settlement.agentNetCost, platformIncome: settlement.platformNetIncome }
          : undefined
      );
    }
    await db.update(rooms).set({ status: "finished", settled: true, archivedAt: new Date() }).where(eq(rooms.id, roomId));
    await db.delete(handStates).where(eq(handStates.roomId, roomId));
  }
  broadcastStateChanged(roomId);
  res.json({ ok: true });
});

// POST /api/rooms/:id/spectate (切换到观战：玩家→观众，退回筹码)
router.post("/:id/spectate", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const room = roomRows[0];
  const rp = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (!rp.length) {
    res.status(400).json({ error: "你不在房间中" });
    return;
  }
  if (rp[0].isSpectator) {
    res.status(400).json({ error: "你已经是观众" });
    return;
  }
  // 游戏进行中不能切换到观战
  const hs = await db.select().from(handStates).where(eq(handStates.roomId, roomId)).limit(1);
  if (hs.length && !(hs[0].state as HandState).finished) {
    res.status(400).json({ error: "游戏进行中无法切换到观战" });
    return;
  }
  // 退回座位筹码到钱包
  if (rp[0].points > 0) {
    const ur = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
    if (ur.length) {
      const next = ur[0].points + rp[0].points;
      // 使用事务保证观战切换时筹码退回的一致性
      await db.transaction(async (tx) => {
        await tx.update(users).set({ points: next }).where(eq(users.id, u.id));
        await tx.insert(chipTransactions).values({
          userId: u.id, amount: rp[0].points, balanceAfter: next, type: "cashout",
          note: `切换到观战退回筹码`, roomId,
        });
      });
    }
  }
  // 转为观众
  await db.update(roomPlayers).set({ isSpectator: true, points: 0, ready: false, seat: 0 }).where(eq(roomPlayers.id, rp[0].id));
  broadcastStateChanged(roomId);
  res.json({ ok: true });
});

// GET /api/rooms/:id/chat
router.get("/:id/chat", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const since = Number(req.query.since || 0);
  const rows = await db
    .select()
    .from(roomMessages)
    .where(since ? and(eq(roomMessages.roomId, roomId), gt(roomMessages.id, since)) : eq(roomMessages.roomId, roomId))
    .orderBy(desc(roomMessages.id))
    .limit(40);
  const ids = [...new Set([...rows.map((r) => r.userId), ...rows.map((r) => r.targetUserId).filter((x): x is number => !!x)])];
  const uRows = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : [];
  const nameMap = new Map(uRows.map((x) => [x.id, x.nickname || x.account]));
  const avaMap = new Map(uRows.map((x) => [x.id, x.avatar]));
  res.json({
    messages: rows.map((r) => ({
      id: r.id, userId: r.userId, account: nameMap.get(r.userId) || "?", avatar: avaMap.get(r.userId) || "1",
      kind: r.kind, content: r.content, targetUserId: r.targetUserId,
      targetName: r.targetUserId ? nameMap.get(r.targetUserId) : null, createdAt: r.createdAt,
    })).reverse(),
  });
});

// POST /api/rooms/:id/chat
router.post("/:id/chat", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const me = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (!me) {
    res.status(403).json({ error: "你不在该房间" });
    return;
  }
  const KINDS = ["text", "quick", "emoji", "interact"];
  const b = req.body || {};
  const kind = String(b?.kind || "text");
  let content = String(b?.content ?? "").trim();
  const targetUserId = b?.targetUserId ? Number(b.targetUserId) : null;
  if (!KINDS.includes(kind)) {
    res.status(400).json({ error: "消息类型无效" });
    return;
  }
  if (!content) {
    res.status(400).json({ error: "内容为空" });
    return;
  }
  if (content.length > 60) content = content.slice(0, 60);
  const recent = await db
    .select({ id: roomMessages.id })
    .from(roomMessages)
    .where(and(eq(roomMessages.roomId, roomId), eq(roomMessages.userId, u.id), gt(roomMessages.createdAt, new Date(Date.now() - 3000))));
  if (recent.length >= 5) {
    res.status(429).json({ error: "发送太快了，歇一歇" });
    return;
  }
  const ins = await db.insert(roomMessages).values({ roomId, userId: u.id, kind, content, targetUserId }).returning();
  // 查询完整消息数据并通过 WebSocket 推送给房间内所有人（含观战者）
  const msgRow = ins[0];
  const userIds = [u.id, ...(targetUserId ? [targetUserId] : [])];
  const uRows = await db.select().from(users).where(inArray(users.id, userIds));
  const nameMap = new Map(uRows.map((x) => [x.id, x.nickname || x.account]));
  const avaMap = new Map(uRows.map((x) => [x.id, x.avatar]));
  const roleMap = new Map(uRows.map((x) => [x.id, x.role]));
  const roomRow = await db.select({ agentId: rooms.agentId }).from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const isOwner = roomRow[0]?.agentId === u.id;
  const senderRole = roleMap.get(u.id) || `player`;
  const msg = {
    id: msgRow.id,
    userId: msgRow.userId,
    senderId: msgRow.userId,
    account: nameMap.get(msgRow.userId) || `?`,
    senderName: nameMap.get(msgRow.userId) || `玩家`,
    avatar: avaMap.get(msgRow.userId) || `1`,
    kind: msgRow.kind,
    type: msgRow.kind,
    content: msgRow.content,
    targetUserId: msgRow.targetUserId,
    targetName: msgRow.targetUserId ? nameMap.get(msgRow.targetUserId) : null,
    createdAt: msgRow.createdAt,
    isOwner,
    role: senderRole,
  };
  broadcastChatMessage(roomId, msg);
  res.json({ ok: true, id: ins[0].id });
});

async function isSpectator(roomId: number, userId: number) {
  const rp = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)))
    .limit(1);
  return !rp.length || rp[0].isSpectator;
}

// GET /api/rooms/:id/hand
router.get("/:id/hand", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  if (isNaN(roomId) || roomId < 1) {
    res.status(400).json({ error: "房间ID无效" });
    return;
  }
  const st = await loadState(roomId);
  if (!st) {
    res.json({ hand: null, options: [] });
    return;
  }
  const spec = await isSpectator(roomId, u.id);
  res.json({ hand: publicState(st, u.id, spec), options: spec ? [] : optionsFor(st, u.id) });
});

// Phase 3: GET /api/rooms/:id/hand/snapshot - 重连快照接口
router.get("/:id/hand/snapshot", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const afterSequence = Number(req.query.afterSequence as string) || 0;

  // 获取当前牌局状态
  const [handRow] = await db
    .select()
    .from(handStates)
    .where(eq(handStates.roomId, roomId))
    .limit(1);

  if (!handRow) {
    res.json({ serverTime: Date.now(), sequence: 0, version: 0, hand: null, options: [] });
    return;
  }

  // 解析牌局状态
  const st = handRow.state as any;
  const currentVersion = handRow.version || 0;
  const currentSequence = handRow.sequence || 0;

  const spec = await isSpectator(roomId, u.id);

  // 返回快照
  res.json({
    serverTime: Date.now(),
    sequence: currentSequence,
    version: currentVersion,
    hand: publicState(st, u.id, spec),
    options: spec ? [] : optionsFor(st, u.id),
    since: afterSequence,
  });
});

// POST /api/rooms/:id/hand (start new hand)
router.post("/:id/hand", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  // 并发锁：防止同时开始
  if (processingRooms.has(roomId)) {
    res.status(429).json({ error: "操作过于频繁，请稍后重试" });
    return;
  }
  processingRooms.add(roomId);
  try {
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  if (room.settled || room.status === "finished") {
    res.status(400).json({ error: "该房间已结束" });
    return;
  }
  const existing = await loadState(roomId);
  if (existing && !existing.finished) {
    res.status(400).json({ error: "本局尚未结束" });
    return;
  }
  const rps = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  // 仅取有效玩家席位（排除管理席位/观众），所有玩家均需有筹码才能参与
  const seated = rps.filter((r) => !r.isSpectator && r.points > 0);
  if (seated.length < 2) {
    res.status(400).json({ error: "至少需要 2 名玩家才能开局" });
    return;
  }
  // 最多8人对战席位
  if (seated.length > 8) {
    res.status(400).json({ error: "对局玩家超过8人上限，请让部分玩家离开后重试" });
    return;
  }
  const isHost = room.agentId === u.id;
  // 第一局只有房主能手动开始；第2-25局自动开始，任何玩家端都可触发
  if (room.currentRound === 0 && !isHost) {
    res.status(403).json({ error: "只有房主可以开始对局" });
    return;
  }
  if (room.currentRound > 0) {
    const me = seated.find((r) => r.userId === u.id);
    // 第2-25局：房主（即使是观众）或在座位上的玩家都能自动开始
    if (!me && !isHost) {
      res.status(403).json({ error: "你不在座位上" });
      return;
    }
  }
  // 第一局需要所有玩家准备（房主豁免），之后的局自动开始不需要重新准备
  if (room.currentRound === 0) {
    const notReady = seated.filter((r) => !r.ready && r.userId !== room.agentId);
    if (notReady.length) {
      res.status(400).json({ error: `还有 ${notReady.length} 位玩家未准备` });
      return;
    }
  }
  const uRows = await db.select().from(users).where(inArray(users.id, seated.map((s) => s.userId)));
  const nameMap = new Map(uRows.map((x) => [x.id, x.account]));
  const players = seated.sort((a, b) => a.seat - b.seat).map((s) => ({
    userId: s.userId, account: nameMap.get(s.userId) || "?", points: s.points,
  }));
  // 炸金花/通比牛牛：使用房间创建时设定的固定底注（由各自的 engine 独立处理）
  const fixedAnte = room.fixedAnte ?? 0;
  // 从 V2 房间模板读取按游戏特性独立配置的 chips/cap/baseBet
  const tmpl = getRoomTemplate(room.gameType, room.level);
  const st = createHand(room.gameType as GameType, players, room.level, room.currentRound + 1, room.currentRound % players.length, fixedAnte, { chips: tmpl.chips, cap: tmpl.cap, baseBet: tmpl.baseBet });
  // 从 V2 配置（game_economy_config）读取抽水参数，按游戏类型区分
  const economy = getGameEconomy(room.gameType);
  st.rakeRate = economy.rakeRate * 100;
  st.rakeBaseType = economy.rakeBaseType; // 抽水基数：pot/flow，不硬编码
  (st as any).rakeCap = economy.rakeCap > 0 ? economy.rakeCap : Infinity;
  (st as any).minRakePot = economy.minRakePot;
  // 跨局持久化：从 room_players 读取挂机状态，设置到当前手牌的 seat.autoPlay
  const autoPlayMap = new Map(rps.map((r) => [r.userId, r.autoPlay]));
  st.seats.forEach((s) => { s.autoPlay = autoPlayMap.get(s.userId) ?? false; });
  // 创建手牌后触发挂机玩家自动开始（tbnn 等支持 autoPlay 的游戏）
  if (st.gameType === "tbnn") {
    triggerTbnnAutoPlay(st);
  }
  await saveState(roomId, st);
  for (const r of seated) {
    await db.update(roomPlayers).set({ ready: false }).where(eq(roomPlayers.id, r.id));
  }
  // 通比牛牛：若所有玩家均为挂机，创建手牌后已自动发牌(phase=dealt)，延迟自动开牌
  if (st.gameType === "tbnn" && st.phase === "dealt" && !st.finished) {
    scheduleTbnnSettlement(roomId);
  }
  broadcastStateChanged(roomId); // 通知所有客户端状态已变更
  const spec = await isSpectator(roomId, u.id);
  res.json({ hand: publicState(st, u.id, spec), options: spec ? [] : optionsFor(st, u.id) });
  } catch (e: any) {
    console.error(`[开始游戏失败] room=${roomId}:`, e.message);
    res.status(500).json({ error: `开始游戏失败: ${e.message}` });
  } finally {
    processingRooms.delete(roomId);
  }
});

// POST /api/rooms/:id/ready_next (准备下一局，所有玩家准备后自动开始)
router.post("/:id/ready_next", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  if (room.settled || room.status === "finished") {
    res.status(400).json({ error: "该房间已结束" });
    return;
  }
  // 第一局不需要准备下一局，由房主直接开始
  if (room.currentRound === 0) {
    res.status(400).json({ error: "第一局请由房主开始游戏" });
    return;
  }
  // 统一查询房间玩家（用于挂机状态判断和后续操作）
  const rps = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const existing = await loadState(roomId);
  // hand_states 不存在或已结束，都可以开始下一局
  if (existing && !existing.finished) {
    res.status(400).json({ error: "本局尚未结束" });
    return;
  }
  // 优先从 existing.seats 获取玩家列表，如果 hand_states 不存在则从 roomPlayers 表查询
  let gamePlayers: { userId: number; account: string; points: number }[];
  if (existing) {
    gamePlayers = existing.seats.filter((s) => s.points > 0);
  } else {
    gamePlayers = rps
      .filter((r) => !r.isSpectator && r.points > 0)
      .map((r) => ({ userId: r.userId, account: "?", points: r.points }));
  }
  if (gamePlayers.length < 2) {
    res.status(400).json({ error: "至少需要 2 名玩家才能开局" });
    return;
  }
  const me = gamePlayers.find((s) => s.userId === u.id);
  if (!me) {
    res.status(403).json({ error: "你不在游戏座位上" });
    return;
  }
  // 标记已准备
  if (!readyNextMap.has(roomId)) {
    readyNextMap.set(roomId, new Set());
  }
  const readySet = readyNextMap.get(roomId)!;
  readySet.add(u.id);
  // 跨局持久化：挂机玩家自动准备下一局
  const autoPlayers = gamePlayers.filter((s) => {
    const rp = rps.find((r) => r.userId === s.userId);
    return rp?.autoPlay;
  });
  for (const ap of autoPlayers) {
    readySet.add(ap.userId);
  }
  const readyCount = readySet.size;
  const totalCount = gamePlayers.length;
  // 检查是否所有游戏玩家都已准备
  const allReady = gamePlayers.every((s) => readySet.has(s.userId));
  if (allReady && !processingRooms.has(roomId)) {
    // 所有玩家都已准备，自动开始下一局
    processingRooms.add(roomId);
    try {
      const uRows = await db.select().from(users).where(inArray(users.id, gamePlayers.map((s) => s.userId)));
      const nameMap = new Map(uRows.map((x) => [x.id, x.account]));
      const players = gamePlayers.map((s) => ({
        userId: s.userId, account: nameMap.get(s.userId) || "?", points: s.points,
      }));
      // 炸金花/通比牛牛：使用房间创建时设定的固定底注（由各自的 engine 独立处理）
      const fixedAnte = room.fixedAnte ?? 0;
      // 从 V2 房间模板读取按游戏特性独立配置的 chips/cap/baseBet
      const tmpl2 = getRoomTemplate(room.gameType, room.level);
      const st = createHand(room.gameType as GameType, players, room.level, room.currentRound + 1, room.currentRound % players.length, fixedAnte, { chips: tmpl2.chips, cap: tmpl2.cap, baseBet: tmpl2.baseBet });
      // 从 V2 配置（game_economy_config）读取抽水参数，按游戏类型区分
      const economy = getGameEconomy(room.gameType);
      st.rakeRate = economy.rakeRate * 100;
      st.rakeBaseType = economy.rakeBaseType; // 抽水基数：pot/flow，不硬编码
      (st as any).rakeCap = economy.rakeCap > 0 ? economy.rakeCap : Infinity;
      (st as any).minRakePot = economy.minRakePot;
      // 跨局持久化：从 room_players 读取挂机状态，设置到当前手牌的 seat.autoPlay
      const autoPlayMap2 = new Map(rps.map((r) => [r.userId, r.autoPlay]));
      st.seats.forEach((s) => { s.autoPlay = autoPlayMap2.get(s.userId) ?? false; });
      // 创建手牌后触发挂机玩家自动开始
      if (st.gameType === "tbnn") {
        triggerTbnnAutoPlay(st);
      }
      await saveState(roomId, st);
      // 重置所有玩家的准备状态
      for (const rp of rps) {
        await db.update(roomPlayers).set({ ready: false }).where(eq(roomPlayers.id, rp.id));
      }
      // 通比牛牛：若所有玩家均为挂机，创建手牌后已自动发牌(phase=dealt)，延迟自动开牌
      if (st.gameType === "tbnn" && st.phase === "dealt" && !st.finished) {
        scheduleTbnnSettlement(roomId);
      }
      // 清除准备状态
      readyNextMap.delete(roomId);
      broadcastStateChanged(roomId);
    } catch (e: any) {
      console.error(`[自动开始下一局失败] room=${roomId}:`, e.message);
    } finally {
      processingRooms.delete(roomId);
    }
  }
  res.json({
    ready: true,
    readyCount,
    totalCount,
    allReady: allReady,
    message: allReady ? "所有玩家已准备，开始下一局" : `已准备 (${readyCount}/${totalCount})`,
  });
});

// PUT /api/rooms/:id/hand (perform action) - Phase 3: 幂等+版本控制
router.put("/:id/hand", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const body = req.body || {};
  const { action, amount, clientActionId: providedClientId, expectedVersion } = body;

  // Phase 3: 客户端操作ID（幂等性）
  const clientActionId = providedClientId || generateClientActionId();

  // Phase 3: 并发锁：防止同一个房间同时处理多个操作
  if (processingRooms.has(roomId)) {
    res.status(429).json({ error: "操作过于频繁，请稍后重试" });
    return;
  }
  processingRooms.add(roomId);

  try {
    if (!action) {
      res.status(400).json({ error: "缺少操作" });
      return;
    }
    if (await isSpectator(roomId, u.id)) {
      res.status(403).json({ error: "观众无法参与对局" });
      return;
    }

    // Phase 3: 幂等性检查和版本冲突检测
    if (providedClientId && expectedVersion !== undefined) {
      const idempotencyCheck = await checkIdempotency(roomId, u.id, providedClientId, expectedVersion as number);
      if (idempotencyCheck.isIdempotent) {
        // 幂等操作，返回之前的结果
        console.log(`[Phase3] 幂等操作命中: room=${roomId} actionId=${providedClientId}`);
        res.json(idempotencyCheck.previousResponse);
        return;
      }
      if (idempotencyCheck.isConflict) {
        // 版本冲突，返回 409
        console.log(`[Phase3] 版本冲突: room=${roomId} expected=${expectedVersion} current=${idempotencyCheck.currentVersion}`);
        const conflictHand = await loadState(roomId);
        res.status(409).json({
          error: "牌局状态已更新",
          code: "HAND_VERSION_CONFLICT",
          serverTime: Date.now(),
          hand: conflictHand ? publicState(conflictHand, u.id) : null,
          options: conflictHand ? optionsFor(conflictHand, u.id) : [],
        });
        return;
      }
    }

    // 【事务+行锁】加载牌局状态时使用 SELECT FOR UPDATE，防止并发行动覆盖
    const txResult = await db.transaction(async (tx) => {
      const st = await loadState(roomId, { tx, forUpdate: true });
      if (!st) return { error: "本局未开始", status: 400 } as const;
      if (st.finished) return { error: "本局已结束", status: 400 } as const;

      const result = applyAction(st, u.id, action, amount);
      if (!result.ok) return { error: result.error, status: 400 } as const;

      st.lastActionTime = Date.now();
      await saveState(roomId, st, tx);

      // Phase 3: 更新版本号（从数据库读取当前值）
      const currentHand = await tx.select()
        .from(handStates)
        .where(eq(handStates.roomId, roomId))
        .limit(1);
      const currentVersion = currentHand[0]?.version || 0;
      const currentSequence = currentHand[0]?.sequence || 0;
      const newVersion = currentVersion + 1;
      const newSequence = currentSequence + 1;
      await tx.update(handStates)
        .set({ version: newVersion, sequence: newSequence })
        .where(eq(handStates.roomId, roomId));

      // commitHand 内部有自己的事务，在外部事务提交后调用，避免嵌套事务复杂性
      return { ok: true, st, newVersion, newSequence } as const;
    });

    if (!txResult.ok) {
      res.status(txResult.status || 400).json({ error: txResult.error });
      return;
    }

    const st = txResult.st;
    let commit = null;
    if (st.finished) {
      commit = await commitHand(roomId, st);
    } else if (st.gameType === "tbnn" && st.phase === "dealt") {
      // 通比牛牛：所有玩家开始后发牌完成，延迟1.5秒自动开牌结算
      scheduleTbnnSettlement(roomId);
    }

    // Phase 3: 记录操作响应快照
    const responseSnapshot = {
      accepted: true,
      clientActionId,
      actionVersion: txResult.newVersion,
      serverTime: Date.now(),
      hand: publicState(st, u.id),
      options: optionsFor(st, u.id),
      commit,
    };

    await recordActionResult(roomId, u.id, clientActionId, txResult.newVersion, responseSnapshot);

    // WebSocket广播：通知房间内所有玩家状态已变更（有序信封）
    console.log(`[PUT /hand] 操作成功 user=${u.id} action=${action}, 准备广播 state_changed`);
    await broadcastOrderedEvent(roomId, {
      type: "hand_update",
      actorUserId: u.id,
      clientActionId,
      version: txResult.newVersion,
      sequence: txResult.newSequence,
      serverTime: Date.now(),
      data: {
        hand: publicState(st, u.id),
        options: optionsFor(st, u.id),
        commit,
      },
    });
    console.log(`[PUT /hand] 广播完成`);

    res.json(responseSnapshot);
  } catch (e: any) {
    console.error(`[游戏操作失败] room=${roomId} user=${u.id} action=${req.body?.action}:`, e.message);
    res.status(500).json({ error: `操作失败: ${e.message}` });
  } finally {
    processingRooms.delete(roomId);
  }
});

// POST /api/rooms/:id/gift — 房主给玩家上分/下分（原子操作+事务保护）
// amount > 0: 上分（从房主扣除，给玩家增加）
// amount < 0: 下分（从玩家扣除，还给房主）
router.post("/:id/gift", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const rows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = rows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  // 只有房主可操作（或管理员强制操作）
  const isHost = room.agentId === u.id;
  const isAdmin = u.role === "admin";
  if (!isHost && !isAdmin) {
    res.status(403).json({ error: "只有房主可赠送筹码" });
    return;
  }
  const body = req.body || {};
  const { targetUserId, amount } = body;
  const amt = Number(amount);
  if (!targetUserId || isNaN(amt) || amt === 0) {
    res.status(400).json({ error: "赠送参数无效" });
    return;
  }
  // 房主不能给自己上分（下分可以）
  if (!isHost && Number(targetUserId) === u.id) {
    res.status(400).json({ error: "代理不能给自己上分" });
    return;
  }
  // 查询目标玩家座位
  const rpRows = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, Number(targetUserId))))
    .limit(1);
  if (!rpRows.length) {
    res.status(400).json({ error: "目标玩家不在房间" });
    return;
  }
  const rp = rpRows[0];
  const maxSeat = room.initialPoints;
  let activationSeat = rp.seat;
  if (amt > 0 && rp.isSpectator) {
    const roomMembers = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
    const takenSeats = new Set(roomMembers.filter((member) => !member.isSpectator).map((member) => member.seat));
    activationSeat = 1;
    while (takenSeats.has(activationSeat) && activationSeat <= room.maxSeats) activationSeat++;
    if (activationSeat > room.maxSeats) {
      res.status(400).json({ error: `房间已满（最多 ${room.maxSeats} 人）` });
      return;
    }
  }
  
  // 使用事务保证原子性
  try {
    await db.transaction(async (tx) => {
      if (amt > 0) {
        // 上分：从房主账户扣除，玩家座位增加
        if (!isHost) {
          const userRows = await tx.select().from(users).where(eq(users.id, u.id)).limit(1);
          if (!userRows.length || userRows[0].points < amt) {
            throw new Error(`筹码不足，当前 ${userRows[0]?.points || 0}，需要 ${amt}`);
          }
          const agentNext = userRows[0].points - amt;
          await tx.update(users).set({ points: agentNext }).where(eq(users.id, u.id));
          await tx.insert(chipTransactions).values({
            userId: u.id, operatorId: u.id, amount: -amt,
            balanceAfter: agentNext, type: "agent_sub",
            note: `房间 ${room.roomNo} 给玩家上分`, roomId,
          });
        }
        const next = rp.points + amt;
        if (next > maxSeat) {
          throw new Error(`该玩家座位筹码已达上限（${maxSeat}），当前 ${rp.points}，最多可上 ${maxSeat - rp.points}`);
        }
        if (rp.isSpectator) {
          await tx.update(roomPlayers).set({
            isSpectator: false,
            seat: activationSeat,
            points: next,
          }).where(eq(roomPlayers.id, rp.id));
        } else {
          await tx.update(roomPlayers).set({ points: next }).where(eq(roomPlayers.id, rp.id));
        }
        await tx.insert(chipTransactions).values({
          userId: Number(targetUserId), operatorId: u.id, amount: amt,
          balanceAfter: next, type: "room_gift",
          note: `房间 ${room.roomNo} 内代理上分`, roomId,
        });
      } else {
        // 下分：从玩家座位扣除，还给房主
        const deductAmt = Math.abs(amt);
        if (rp.points < deductAmt) {
          throw new Error(`玩家筹码不足，当前 ${rp.points}，需要下分 ${deductAmt}`);
        }
        const next = rp.points - deductAmt;
        await tx.update(roomPlayers).set({ points: next }).where(eq(roomPlayers.id, rp.id));
        await tx.insert(chipTransactions).values({
          userId: Number(targetUserId), operatorId: u.id, amount: -deductAmt,
          balanceAfter: next, type: "room_gift",
          note: `房间 ${room.roomNo} 内代理下分`, roomId,
        });
        // 还回房主账户
        const userRows = await tx.select().from(users).where(eq(users.id, u.id)).limit(1);
        if (userRows.length) {
          const agentNext = userRows[0].points + deductAmt;
          await tx.update(users).set({ points: agentNext }).where(eq(users.id, u.id));
          await tx.insert(chipTransactions).values({
            userId: u.id, operatorId: u.id, amount: deductAmt,
            balanceAfter: agentNext, type: "agent_add",
            note: `房间 ${room.roomNo} 收回筹码`, roomId,
          });
        }
      }
    });
    
    broadcastStateChanged(roomId);
    // 返回最新状态
    const updatedRp = await db.select().from(roomPlayers).where(eq(roomPlayers.id, rp.id)).limit(1);
    const updatedUser = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
    res.json({ 
      ok: true, 
      points: updatedRp[0]?.points ?? rp.points, 
      agentPoints: updatedUser[0]?.points ?? u.points 
    });
  } catch (e: any) {
    console.error("[gift] 事务失败:", e.message);
    res.status(400).json({ error: e.message || "操作失败" });
  }
});

// GET /api/rooms/:id/chip-transactions — 获取房间内筹码交易记录（上下分历史）
router.get("/:id/chip-transactions", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  // 只有房主、代理、总代理、管理员可以查看房间交易记录
  const privileged = u.role === "admin" || u.role === "top_agent" || room.agentId === u.id;
  if (!privileged) {
    res.status(403).json({ error: "无权查看房间交易记录" });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const txRows = await db
    .select()
    .from(chipTransactions)
    .where(eq(chipTransactions.roomId, roomId))
    .orderBy(desc(chipTransactions.createdAt))
    .limit(limit);
  // 查询相关用户信息
  const userIds = [...new Set(txRows.map((t) => t.userId).filter((x): x is number => !!x))];
  const uRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
  const nameMap = new Map(uRows.map((x) => [x.id, x.nickname || x.account]));
  // 统计累计上分/下分
  let totalGiven = 0;
  let totalTaken = 0;
  for (const t of txRows) {
    if (t.type === "room_gift" && t.amount > 0) totalGiven += Number(t.amount);
    if (t.type === "agent_sub" || (t.type === "room_gift" && t.amount < 0)) totalTaken += Math.abs(Number(t.amount));
  }
  res.json({
    transactions: txRows.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: nameMap.get(t.userId) || "?",
      operatorId: t.operatorId,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      type: t.type,
      note: t.note,
      createdAt: t.createdAt,
    })),
    summary: {
      totalGiven,
      totalTaken,
      count: txRows.length,
    },
  });
});

// POST /api/rooms/:id/early-settle
router.post("/:id/early-settle", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  if (room.settled || room.status === "finished") {
    res.status(400).json({ error: "房间已结束" });
    return;
  }
  if (room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "无权操作" });
    return;
  }
  // 【事务保证】提前结算的所有数据库操作在同一事务中执行
  const result = await db.transaction(async (tx) => {
    const rps = await tx.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
    const hsRows = await tx.select().from(handStates).where(eq(handStates.roomId, roomId)).limit(1);
    if (hsRows.length) {
      const st = hsRows[0].state as HandState;
      if (!st.finished) {
        // 退还 streetBet（本轮下注但未分胜负的筹码）到玩家座位筹码
        for (const s of st.seats) {
          if (s.streetBet > 0) {
            s.points += s.streetBet;  // 退还给玩家座位筹码
            s.streetBet = 0;
          }
        }
        // pot 中未分配的筹码按比例退还给未弃牌玩家
        if (st.pot > 0) {
          const activePlayers = st.seats.filter((s) => !s.folded);
          if (activePlayers.length > 0) {
            const refundPerPlayer = Math.floor(st.pot / activePlayers.length);
            for (const s of activePlayers) {
              s.points += refundPerPlayer;  // 退还给玩家座位筹码
              st.pot -= refundPerPlayer;
            }
            // 剩余筹码（如果无法整除）归平台
            if (st.pot > 0) {
              console.log(`[提前结算] 未分配筹码 ${st.pot} 归平台`);
              st.pot = 0;
            }
          }
        }
        st.finished = true;
        st.phase = "showdown";
        await tx.update(handStates).set({ state: st, updatedAt: new Date() }).where(eq(handStates.roomId, roomId));
        // 把当前局的座位筹码更新到 room_players 表
        for (const s of st.seats) {
          const rp = rps.find((r) => r.userId === s.userId && !r.isSpectator);
          if (rp) {
            rp.points = Math.max(0, s.points);
          }
        }
      }
    }
    // 更新玩家座位筹码（含退还的streetBet和pot，以及当前局的输赢）
    for (const rp of rps) {
      if (rp.isSpectator) continue;
      await tx.update(roomPlayers).set({ points: rp.points }).where(eq(roomPlayers.id, rp.id));
    }
    // 退还玩家当前剩余筹码到钱包
    const refunded: { userId: number; amount: number }[] = [];
    for (const rp of rps) {
      if (rp.isSpectator || rp.points <= 0) continue;
      const ur = await tx.select().from(users).where(eq(users.id, rp.userId)).limit(1);
      if (!ur.length) continue;
      const next = ur[0].points + rp.points;
      await tx.update(users).set({ points: next }).where(eq(users.id, rp.userId));
      await tx.insert(chipTransactions).values({
        userId: rp.userId, amount: rp.points, balanceAfter: next, type: "cashout",
        note: `房间 ${room.roomNo} 提前结算带出筹码`, roomId,
      });
      refunded.push({ userId: rp.userId, amount: rp.points });
    }
    // 提前结算：按已完成局数的流水扣除代理信用分 + 计算返佣
    // 即使只玩了1局，也要扣除对应的水费
    let settlement = null;
    if (room.totalFlow > 0 || room.currentRound > 0) {
      settlement = await settleRoom(
        roomId,
        room.agentId,
        room.totalRake,
        room.totalFlow,
        room.gameType,
        tx
      );
      // 归档房间历史战绩（永久保留）
      await archiveRoom(
        {
          roomNo: room.roomNo,
          agentId: room.agentId,
          gameType: room.gameType,
          level: room.level,
          currentRound: room.currentRound,
          totalRake: room.totalRake,
          totalFlow: room.totalFlow,
          createdAt: room.createdAt,
        },
        "early_settle",
        settlement
          ? { agentNetCost: settlement.agentNetCost, platformIncome: settlement.platformNetIncome }
          : undefined,
        tx
      );
    }

    await tx.update(rooms).set({ status: "finished", settled: true, archivedAt: new Date() }).where(eq(rooms.id, roomId));
    await tx.delete(roomPlayers).where(eq(roomPlayers.roomId, roomId));
    await tx.delete(handStates).where(eq(handStates.roomId, roomId));

    return { refunded, settlement };
  });

  // 事务提交成功后广播
  broadcastStateChanged(roomId);
  res.json({ ok: true, refunded: result.refunded, totalRake: room.totalRake, totalFlow: room.totalFlow, settlement: result.settlement });
});

// POST /api/rooms/:id/kick (房主踢出单个玩家)
router.post("/:id/kick", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  if (room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "只有房主可踢出玩家" });
    return;
  }
  const { targetUserId } = req.body || {};
  if (!targetUserId) {
    res.status(400).json({ error: "缺少 targetUserId" });
    return;
  }
  const rpRows = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, Number(targetUserId))))
    .limit(1);
  const rp = rpRows[0];
  if (!rp) {
    res.status(404).json({ error: "玩家不在房间" });
    return;
  }
  if (rp.isSpectator) {
    res.status(400).json({ error: "不能踢出观战者" });
    return;
  }

  // 如果牌局进行中，标记该玩家弃牌
  const hsRows = await db.select().from(handStates).where(eq(handStates.roomId, roomId)).limit(1);
  if (hsRows.length) {
    const st = hsRows[0].state as HandState;
    if (!st.finished) {
      const seat = st.seats.find((s) => s.userId === Number(targetUserId));
      if (seat && !seat.folded) {
        applyAction(st, Number(targetUserId), "fold");
        st.lastActionTime = Date.now();
        await db.update(handStates).set({ state: st, updatedAt: new Date() }).where(eq(handStates.roomId, roomId));
      }
    }
  }

  // 退回该玩家剩余筹码到钱包
  let refunded = 0;
  if (rp.points > 0) {
    const ur = await db.select().from(users).where(eq(users.id, Number(targetUserId))).limit(1);
    if (ur.length) {
      const next = ur[0].points + rp.points;
      await db.update(users).set({ points: next }).where(eq(users.id, Number(targetUserId)));
      await db.insert(chipTransactions).values({
        userId: Number(targetUserId),
        amount: rp.points,
        balanceAfter: next,
        type: "cashout",
        note: `房间 ${room.roomNo} 被房主踢出，退回筹码`,
        roomId,
      });
      refunded = rp.points;
    }
  }

  // 从房间移除
  await db.delete(roomPlayers).where(eq(roomPlayers.id, rp.id));

  audit.info("room_kick_player", {
    userId: u.id,
    account: u.account,
    detail: `房间=${room.roomNo}(ID:${roomId}), 踢出玩家ID=${targetUserId}, 退回筹码=${refunded}`,
  });
  broadcastStateChanged(roomId);
  res.json({ ok: true, refunded });
});

// POST /api/rooms/:id/continue (代理续开房间：25局结束后重置计数，玩家不用重新进房)
router.post("/:id/continue", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  if (room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "只有房主可续开房间" });
    return;
  }
  if (room.status !== "waiting_continue") {
    res.status(400).json({ error: `当前状态不可续开（${room.status}）` });
    return;
  }
  // 重置房间计数，进入等待准备状态
  await db.update(rooms).set({
    currentRound: 0,
    totalRake: 0,
    totalFlow: 0,
    settled: false,
    status: "waiting",
  }).where(eq(rooms.id, roomId));
  // 玩家座位保留，重置准备状态；自动从钱包带筹码到座位（和加入房间时一样）
  const rps = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  // 使用事务批量处理所有玩家的筹码带入
  await db.transaction(async (tx) => {
    for (const rp of rps) {
      if (rp.isSpectator) {
        await tx.update(roomPlayers).set({ ready: false, points: 0 }).where(eq(roomPlayers.id, rp.id));
        continue;
      }
      const ur = await tx.select().from(users).where(eq(users.id, rp.userId)).limit(1);
      if (!ur.length) continue;
      const bringIn = Math.min(ur[0].points, room.initialPoints);
      const nextBal = ur[0].points - bringIn;
      if (bringIn > 0) {
        await tx.update(users).set({ points: nextBal }).where(eq(users.id, rp.userId));
        await tx.insert(chipTransactions).values({
          userId: rp.userId, amount: -bringIn, balanceAfter: nextBal, type: "buyin",
          note: `房间 ${room.roomNo} 续开带入筹码（上限${room.initialPoints}）`, roomId,
        });
      }
      await tx.update(roomPlayers).set({ ready: false, points: bringIn }).where(eq(roomPlayers.id, rp.id));
    }
  });
  // 清除上一轮牌局状态
  await db.delete(handStates).where(eq(handStates.roomId, roomId));
  broadcastStateChanged(roomId);
  res.json({ ok: true, message: "房间已续开，玩家可重新准备" });
});

// POST /api/rooms/:id/pause — 房间内任意玩家可暂停
router.post("/:id/pause", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) { res.status(404).json({ error: "房间不存在" }); return; }
  // 仅房主可暂停
  if (room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "只有房主可暂停" }); return;
  }
  // 检查用户是否在房间内
  const inRoom = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id))).limit(1);
  if (inRoom.length === 0 && room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "您不在该房间中" }); return;
  }
  if (room.status !== "playing") {
    res.status(400).json({ error: `当前状态不可暂停（${room.status}）` }); return;
  }
  await db.update(rooms).set({ status: "paused" }).where(eq(rooms.id, roomId));
  broadcastStateChanged(roomId);
  res.json({ ok: true, status: "paused" });
});

// POST /api/rooms/:id/resume — 房间内任意玩家可恢复
router.post("/:id/resume", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) { res.status(404).json({ error: "房间不存在" }); return; }
  // 仅房主可恢复
  if (room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "只有房主可恢复" }); return;
  }
  const inRoom = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id))).limit(1);
  if (inRoom.length === 0 && room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "您不在该房间中" }); return;
  }
  if (room.status !== "paused") {
    res.status(400).json({ error: `当前状态不可恢复（${room.status}）` }); return;
  }
  await db.update(rooms).set({ status: "playing" }).where(eq(rooms.id, roomId));
  broadcastStateChanged(roomId);
  res.json({ ok: true, status: "playing" });
});

// POST /api/rooms/:id/regenerate-invite — 房主重新生成邀请凭据
router.post("/:id/regenerate-invite", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  const room = roomRows[0];
  if (!room) { res.status(404).json({ error: "房间不存在" }); return; }
  if (room.agentId !== u.id && u.role !== "admin") {
    res.status(403).json({ error: "只有房主可操作" }); return;
  }
  // 删除旧的有效凭据
  await db.delete(roomInviteTokens).where(eq(roomInviteTokens.roomId, roomId));
  // 生成新凭据（有效期24小时）
  const newToken = crypto.randomBytes(8).toString("hex");
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(roomInviteTokens).values({
    roomId,
    token: newToken,
    expiresAt: newExpiresAt,
    createdBy: u.id,
  });
  res.json({
    ok: true,
    inviteToken: newToken,
    inviteExpiresAt: newExpiresAt.toISOString(),
    inviteUrl: `https://goodspage.cn/join?token=${newToken}`,
  });
});

// POST /api/rooms/join-by-token — 通过邀请凭据加入房间
router.post("/join-by-token", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const body = req.body || {};
  const { token } = body;
  if (!token) { res.status(400).json({ error: "请输入邀请凭据" }); return; }
  
  // 查找有效凭据
  const tokenRows = await db
    .select()
    .from(roomInviteTokens)
    .where(eq(roomInviteTokens.token, String(token).trim()))
    .limit(1);
  if (!tokenRows.length) {
    res.status(404).json({ error: "邀请凭据无效或已过期" });
    return;
  }
  const inviteToken = tokenRows[0];
  if (inviteToken.expiresAt < new Date()) {
    res.status(400).json({ error: "邀请凭据已过期" });
    return;
  }
  if (inviteToken.usedByUserId) {
    res.status(400).json({ error: "邀请凭据已被使用" });
    return;
  }
  
  // 获取房间信息
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, inviteToken.roomId)).limit(1);
  const room = roomRows[0];
  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  if (room.status === "finished" || room.settled) {
    res.status(400).json({ error: "该房间已结束" });
    return;
  }
  
  // 检查是否已在房间
  const existing = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (existing.length) {
    res.status(400).json({ error: "您已在该房间中" });
    return;
  }
  
  // 邀请加入遵循与普通加入相同的座位和最低带入规则。
  const members = await db
    .select()
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, room.id));
  const seated = members.filter((player) => !player.isSpectator);
  if (seated.length >= room.maxSeats) {
    res.status(400).json({ error: `房间已满（最多 ${room.maxSeats} 人）` });
    return;
  }
  const tmpl = getRoomTemplate(room.gameType, room.level);
  const canBuyIn = u.points >= tmpl.minBuyIn;
  const taken = new Set(seated.map((p) => p.seat));
  let seat = 1;
  while (taken.has(seat) && seat <= room.maxSeats) seat++;
  const bringIn = canBuyIn ? Math.min(u.points, room.initialPoints) : 0;
  const nextBal = u.points - bringIn;
  const isSpectator = !canBuyIn;
  await db.transaction(async (tx) => {
    if (bringIn > 0) {
      await tx.update(users).set({ points: nextBal }).where(eq(users.id, u.id));
      await tx.insert(chipTransactions).values({
        userId: u.id, amount: -bringIn, balanceAfter: nextBal, type: "buyin",
        note: `房间 ${room.roomNo} 带入筹码（通过邀请）`, roomId: room.id,
      });
    }
    await tx.insert(roomPlayers).values({
      roomId: room.id, userId: u.id, seat: isSpectator ? 0 : seat,
      points: bringIn, isSpectator, ready: false,
    });
    await tx.update(roomInviteTokens)
      .set({ usedByUserId: u.id })
      .where(eq(roomInviteTokens.id, inviteToken.id));
  });
  
  broadcastStateChanged(room.id);
  res.json({ 
    room, 
    seat: isSpectator ? 0 : seat,
    balance: nextBal, 
    broughtIn: bringIn,
    seatType: isSpectator ? "spectator" : "player",
    message: isSpectator
      ? `筹码不足（最低带入${tmpl.minBuyIn}），已进入观众席，请联系房主上分`
      : `已通过邀请加入房间 ${room.roomNo}`
  });
});


// POST /api/rooms/leave - 离开房间（前端调用，body: { roomId }）
router.post("/leave", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.body?.roomId);
  if (!roomId) {
    res.status(400).json({ error: "缺少 roomId" });
    return;
  }
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const room = roomRows[0];
  const mine = await db
    .select()
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)))
    .limit(1);
  if (!mine.length) {
    res.status(400).json({ error: "你不在房间中" });
    return;
  }
  // 玩家有筹码则退回
  if (!mine[0].isSpectator && mine[0].points > 0) {
    const refAmt = mine[0].points;
    const next = u.points + refAmt;
    await db.transaction(async (tx) => {
      await tx.update(users).set({ points: next }).where(eq(users.id, u.id));
      await tx.insert(chipTransactions).values({
        userId: u.id, amount: refAmt, balanceAfter: next, type: "cashout",
        note: `离开房间 ${room.roomNo} 带出筹码`, roomId,
      });
    });
  }
  // 游戏进行中自动弃牌
  try {
    const hs = await loadState(roomId);
    if (hs && !hs.finished) {
      const seatIdx = hs.seats.findIndex((s: any) => s.userId === u.id);
      if (seatIdx >= 0 && !hs.seats[seatIdx].folded) {
        applyAction(hs, u.id, "fold");
        await saveState(roomId, hs);
        if (hs.finished) await commitHand(roomId, hs);
      }
    }
  } catch {}
  // 从房间移除
  await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, u.id)));
  // 检查是否所有玩家都离开了
  const remaining = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const activePlayers = remaining.filter((r: any) => !r.isSpectator);
  if (activePlayers.length === 0) {
    if (room.totalFlow > 0 || room.currentRound > 0) {
      try {
        const settlement = await settleRoom(roomId, room.agentId, room.totalRake, room.totalFlow, room.gameType);
        await archiveRoom(
          { roomNo: room.roomNo, agentId: room.agentId, gameType: room.gameType, level: room.level, currentRound: room.currentRound, totalRake: room.totalRake, totalFlow: room.totalFlow, createdAt: room.createdAt },
          "player_left",
          settlement ? { agentNetCost: settlement.agentNetCost, platformIncome: settlement.platformNetIncome } : undefined
        );
      } catch (e) { console.error("[leave] settleRoom failed:", e); }
    }
    await db.update(rooms).set({ status: "finished", settled: true, archivedAt: new Date() }).where(eq(rooms.id, roomId));
    await db.delete(handStates).where(eq(handStates.roomId, roomId));
  }
  broadcastStateChanged(roomId);
  res.json({ ok: true });
});

// POST /api/rooms/:id/dissolve - 解散房间（仅房主）
router.post("/:id/dissolve", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const room = roomRows[0];
  if (room.agentId !== u.id && u.role !== 'admin') {
    res.status(403).json({ error: "仅房主可解散房间" });
    return;
  }
  if (room.status === "finished") {
    res.status(400).json({ error: "房间已结束" });
    return;
  }
  try {
    // 强制结束当前牌局
    try {
      const hs = await loadState(roomId);
      if (hs && !hs.finished) {
        hs.finished = true;
        await saveState(roomId, hs);
      }
    } catch {}
    // 所有玩家退回筹码
    const players = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
    for (const p of players) {
      if (!p.isSpectator && p.points > 0) {
        const userRows = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
        if (userRows.length) {
          const next = userRows[0].points + p.points;
          await db.transaction(async (tx) => {
            await tx.update(users).set({ points: next }).where(eq(users.id, p.userId));
            await tx.insert(chipTransactions).values({
              userId: p.userId, amount: p.points, balanceAfter: next, type: "cashout",
              note: `房间 ${room.roomNo} 解散退回筹码`, roomId,
            });
          });
        }
      }
    }
    // 结算房间经济
    if (room.totalFlow > 0 || room.currentRound > 0) {
      try {
        const settlement = await settleRoom(roomId, room.agentId, room.totalRake, room.totalFlow, room.gameType);
        await archiveRoom(
          { roomNo: room.roomNo, agentId: room.agentId, gameType: room.gameType, level: room.level, currentRound: room.currentRound, totalRake: room.totalRake, totalFlow: room.totalFlow, createdAt: room.createdAt },
          "force_end",
          settlement ? { agentNetCost: settlement.agentNetCost, platformIncome: settlement.platformNetIncome } : undefined
        );
      } catch (e) { console.error("[dissolve] settleRoom failed:", e); }
    }
    // 清空房间玩家和牌局状态
    await db.delete(roomPlayers).where(eq(roomPlayers.roomId, roomId));
    await db.delete(handStates).where(eq(handStates.roomId, roomId));
    // 标记房间为已结束
    await db.update(rooms).set({ status: "finished", settled: true, archivedAt: new Date() }).where(eq(rooms.id, roomId));
    audit.info("room_dissolved", { userId: u.id, targetId: roomId, targetType: "room", detail: `房间 ${room.roomNo} 被房主解散` });
    broadcastStateChanged(roomId);
    res.json({ ok: true, message: "房间已解散" });
  } catch (e) {
    console.error("[dissolve] failed:", e);
    res.status(500).json({ error: "解散房间失败" });
  }
});
export default router;

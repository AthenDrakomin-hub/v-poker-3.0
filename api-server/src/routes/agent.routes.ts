import { Router, Request, Response } from "express";
import { db } from "@/db";
import { users, chipTransactions, distributionRecords } from "@/db/schema";
import { and, desc, eq, ilike, inArray, ne, or, gte, lte } from "drizzle-orm";
import { getCurrentUser, genInviteCode } from "@/lib/auth";
import { getGameEconomy } from "@/lib/gameEconomy";
import { audit } from "@/lib/audit";

const router = Router();
const AGENT_ROLES = ["agent", "top_agent", "admin"];

/** 解析分页参数 */
function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || req.query.limit ? Number(req.query.limit) : 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/** 统一分页响应 */
function paginatedResponse<T>(data: T[], total: number, page: number, pageSize: number) {
  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getDownlineIds(userId: number): Promise<number[]> {
  // 递归获取所有下线ID
  const allIds: number[] = [userId];
  let queue = [userId];
  while (queue.length > 0) {
    const currentIds = queue;
    queue = [];
    const downs = await db.select({ id: users.id }).from(users).where(inArray(users.invitedById, currentIds));
    downs.forEach(d => {
      if (!allIds.includes(d.id)) {
        allIds.push(d.id);
        queue.push(d.id);
      }
    });
  }
  return allIds;
}

async function scopeIds(u: typeof users.$inferSelect): Promise<number[] | null> {
  if (u.role === "admin") return null;
  if (u.role === "top_agent") {
    return getDownlineIds(u.id);
  }
  if (u.role === "agent") {
    // 一级代理只能管理直招的下线（不递归）
    const downs = await db.select({ id: users.id }).from(users).where(eq(users.invitedById, u.id));
    return [u.id, ...downs.map((d) => d.id)];
  }
  return [u.id];
}

// GET /api/agent/players
router.get("/players", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (!AGENT_ROLES.includes(u.role)) {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const q = (req.query.q as string | undefined)?.trim();
  const { page, pageSize, offset } = parsePagination(req);
  const ids = await scopeIds(u);
  const conds: any[] = [eq(users.role, "player")];
  if (ids) conds.push(inArray(users.invitedById, ids));
  if (q) conds.push(or(ilike(users.account, `%${q}%`), ilike(users.nickname, `%${q}%`))!);

  const [rows, totalRows] = await Promise.all([
    db.select().from(users).where(and(...conds)).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: users.id }).from(users).where(and(...conds))
  ]);

  res.json(paginatedResponse(
    rows.map((r) => ({
      id: r.id,
      account: r.account,
      nickname: r.nickname || r.account,
      avatar: r.avatar,
      points: r.points,
      lastLoginAt: r.lastLoginAt,
      createdAt: r.createdAt,
    })),
    totalRows[0]?.count ?? 0,
    page,
    pageSize
  ));
});

// GET /api/agent/agents — 下线代理列表（总代理/一级代理可见名下代理）
router.get("/agents", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  const { page, pageSize, offset } = parsePagination(req);
  const ids = await scopeIds(u);
  // 查询名下代理（排除自己）
  const agentConds: any[] = [inArray(users.role, ["agent", "top_agent"])];
  if (ids) agentConds.push(inArray(users.id, ids));
  agentConds.push(ne(users.id, u.id));
  const [agentRows, totalRows] = await Promise.all([
    db.select().from(users).where(and(...agentConds)).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: users.id }).from(users).where(and(...agentConds))
  ]);
  // 为每个代理计算等级、直招玩家数、下线总数
  const agentsWithMeta = await Promise.all(agentRows.map(async (a) => {
    // 计算代理等级
    let level = 0;
    if (a.role === "top_agent") { level = 0; }
    else {
      let curId: number | null = a.invitedById;
      const vis = new Set<number>();
      while (curId && !vis.has(curId) && level < 5) {
        vis.add(curId);
        const up = await db.select({ role: users.role, invitedById: users.invitedById }).from(users).where(eq(users.id, curId)).limit(1);
        if (!up.length) break;
        level++;
        if (up[0].role === "top_agent") break;
        curId = up[0].invitedById;
      }
    }
    // 直招玩家数
    const directPlayers = await db.select({ count: users.id }).from(users).where(and(eq(users.invitedById, a.id), eq(users.role, "player")));
    // 下线总数（递归）
    const allDowns = await getDownlineIds(a.id);
    return {
      id: a.id, account: a.account, nickname: a.nickname || a.account, avatar: a.avatar,
      role: a.role, agentLevel: level, points: a.points, frozen: a.frozen || false,
      inviteCode: a.inviteCode, invitedByCode: a.invitedByCode,
      directPlayerCount: directPlayers[0]?.count ?? 0,
      totalDownlineCount: allDowns.length - 1,
      createdAt: a.createdAt, lastLoginAt: a.lastLoginAt,
    };
  }));
  res.json(paginatedResponse(agentsWithMeta, totalRows[0]?.count ?? 0, page, pageSize));
});

// POST /api/agent/players
// 代理为名下玩家上下分；禁止创建账号，账号依靠邀请码注册；必须写入审计日志
router.post("/players", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (!AGENT_ROLES.includes(u.role)) {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const b = req.body || {};
  const userId = Number(b?.userId);
  const amount = Math.trunc(Number(b?.amount));
  const note = typeof b?.note === "string" ? b.note.slice(0, 50) : null;
  if (!userId || !Number.isFinite(amount) || amount === 0) {
    res.status(400).json({ error: "参数无效" });
    return;
  }
  if (Math.abs(amount) > 1_000_000) {
    res.status(400).json({ error: "单次操作不得超过 100 万" });
    return;
  }
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) {
    res.status(404).json({ error: "玩家不存在" });
    return;
  }
  if (target.role !== "player") {
    res.status(400).json({ error: "只能给玩家上下分" });
    return;
  }
  const ids = await scopeIds(u);
  if (ids && (!target.invitedById || !ids.includes(target.invitedById))) {
    res.status(403).json({ error: "该玩家不在你的名下" });
    return;
  }
  const next = target.points + amount;
  if (next < 0) {
    res.status(400).json({ error: `下分超出余额（当前 ${target.points}）` });
    return;
  }
  // 上分时检查代理筹码是否足够
  if (amount > 0 && u.points < amount) {
    res.status(400).json({ error: `代理筹码不足，当前 ${u.points}，需要 ${amount}` });
    return;
  }
  // 更新玩家筹码
  await db.update(users).set({ points: next }).where(eq(users.id, userId));
  // 更新代理筹码（上分扣代理，下分加代理）
  const agentNext = u.points - amount;
  await db.update(users).set({ points: agentNext }).where(eq(users.id, u.id));
  // 玩家筹码流水
  await db.insert(chipTransactions).values({
    userId,
    operatorId: u.id,
    amount,
    balanceAfter: next,
    type: amount > 0 ? "agent_add" : "agent_sub",
    note: note || (amount > 0 ? "代理上分" : "代理下分"),
  });
  // 代理筹码流水
  await db.insert(chipTransactions).values({
    userId: u.id,
    operatorId: u.id,
    amount: -amount,
    balanceAfter: agentNext,
    type: amount > 0 ? "agent_sub" : "agent_add",
    note: note || (amount > 0 ? `给玩家 ${target.account} 上分` : `从玩家 ${target.account} 下分`),
  });
  audit.info("agent_player_chip_adjust", {
    userId: u.id,
    account: u.account,
    detail: `目标玩家=${target.account}(ID:${userId}), 金额=${amount}, 玩家余额=${next}, 代理余额=${agentNext}, 备注=${note || (amount > 0 ? "代理上分" : "代理下分")}`,
  });
  res.json({ ok: true, points: next, agentPoints: agentNext });
});

// GET /api/agent/chip-transactions
router.get("/chip-transactions", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }

  const { page, pageSize, offset } = parsePagination(req);

  const [rows, totalRows] = await Promise.all([
    db.select().from(chipTransactions)
      .where(eq(chipTransactions.operatorId, u.id))
      .orderBy(desc(chipTransactions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: chipTransactions.id })
      .from(chipTransactions)
      .where(eq(chipTransactions.operatorId, u.id))
  ]);

  const summary = {
    totalUp: rows.filter(r => r.amount > 0).reduce((a, r) => a + r.amount, 0),
    totalDown: rows.filter(r => r.amount < 0).reduce((a, r) => a + Math.abs(r.amount), 0),
    recordCount: totalRows[0]?.count ?? 0,
  };

  res.json(paginatedResponse(rows.map(r => ({
    id: r.id,
    userId: r.userId,
    amount: r.amount,
    balanceAfter: r.balanceAfter,
    type: r.type,
    note: r.note,
    createdAt: r.createdAt,
  })), totalRows[0]?.count ?? 0, page, pageSize));
});

// GET /api/agent/promotion
router.get("/promotion", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "top_agent") {
    res.json({
      isTopAgent: false,
      inviteCode: u.inviteCode,
      points: u.points,
      downlines: [],
      daily: [],
      todayFlow: 0,
      todayCommission: 0,
      totalFlow: 0,
      totalCommission: 0,
    });
    return;
  }
  const downlines = await db.select().from(users).where(eq(users.invitedById, u.id));
  const agentIds = downlines.map((d) => d.id);
  function dayKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // V3：总代返佣直接进筹码，从 chipTransactions 读取（type=room_rake，note包含"总代理返佣"）
  const rakeTx = await db.select().from(chipTransactions).where(eq(chipTransactions.userId, u.id)).orderBy(desc(chipTransactions.createdAt));
  const totalCommission = rakeTx
    .filter((t) => t.type === "room_rake" && t.note?.includes("总代理返佣"))
    .reduce((a, t) => a + t.amount, 0);
  const upRate = Math.max(0, getGameEconomy("texas").topAgentRebateRate * 100);
  const daily = rakeTx
    .filter((t) => t.type === "room_rake" && t.note?.includes("总代理返佣"))
    .reduce((acc: { date: string; flow: number; commission: number }[], t) => {
      const k = dayKey(new Date(t.createdAt));
      const existing = acc.find(a => a.date === k);
      if (existing) {
        existing.commission += t.amount;
      } else {
        acc.push({ date: k, flow: Math.round(t.amount * 100 / upRate), commission: t.amount });
      }
      return acc;
    }, [])
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14);
  const today = dayKey(new Date());
  const todayEntry = daily.find((d) => d.date === today) || { flow: 0, commission: 0 };
  const totalFlow = totalCommission > 0 ? Math.round(totalCommission * 100 / upRate) : 0;
  const downlineData = downlines.map((d) => ({
    id: d.id,
    account: d.account,
    role: d.role,
    points: d.points,
    totalFlow: 0,
    commission: 0,
  }));
  res.json({
    isTopAgent: true,
    inviteCode: u.inviteCode,
    points: u.points,
    topAgentCommissionRate: upRate,
    downlines: downlineData,
    daily,
    todayFlow: todayEntry.flow,
    todayCommission: todayEntry.commission,
    totalFlow,
    totalCommission,
  });
});

// POST /api/agent/promote (总代理提升名下玩家为代理)
router.post("/promote", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "top_agent" && u.role !== "admin") {
    res.status(403).json({ error: "仅总代理可提升玩家为代理" });
    return;
  }
  const { userId } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: "缺少 userId" });
    return;
  }
  const targetRows = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
  const target = targetRows[0];
  if (!target) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  // 只能提升玩家为代理
  if (target.role !== "player") {
    res.status(400).json({ error: "该用户已不是玩家身份" });
    return;
  }
  await db.update(users).set({ role: "agent" }).where(eq(users.id, Number(userId)));
  res.json({ ok: true, userId: Number(userId), newRole: "agent" });
});

// POST /api/agent/invite-code/regenerate — 重新生成邀请码
router.post("/invite-code/regenerate", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "agent" && u.role !== "top_agent") {
    res.status(403).json({ error: "仅代理可重新生成邀请码" });
    return;
  }
  const newCode = genInviteCode();
  await db.update(users).set({ inviteCode: newCode }).where(eq(users.id, u.id));
  audit.info("agent_regenerate_invite_code", { userId: u.id, account: u.account, detail: `重新生成邀请码: ${newCode}` });
  res.json({ ok: true, inviteCode: newCode });
});

// GET /api/agent/distribution-records — 房间级分配明细
router.get("/distribution-records", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "agent" && u.role !== "top_agent" && u.role !== "admin") {
    res.status(403).json({ error: "无权限" });
    return;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  const dateFrom = req.query.from as string | undefined;
  const dateTo = req.query.to as string | undefined;
  const gameId = req.query.gameId as string | undefined;

  const conditions: any[] = [eq(distributionRecords.agentId, u.id)];
  if (dateFrom) conditions.push(gte(distributionRecords.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(distributionRecords.createdAt, new Date(dateTo + "T23:59:59")));
  if (gameId) conditions.push(eq(distributionRecords.gameType, gameId));

  const [rows, totalRows] = await Promise.all([
    db.select()
      .from(distributionRecords)
      .where(and(...conditions))
      .orderBy(desc(distributionRecords.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: distributionRecords.id })
      .from(distributionRecords)
      .where(and(...conditions)),
  ]);

  // 获取玩家信息
  const playerIds = [...new Set(rows.map((r) => r.playerId))];
  const playerRows = playerIds.length
    ? await db.select({ id: users.id, account: users.account, nickname: users.nickname }).from(users).where(inArray(users.id, playerIds))
    : [];
  const playerNameMap = new Map(playerRows.map((p) => [p.id, p.nickname || p.account]));

  let totalFlow = 0;
  let totalCommission = 0;
  for (const r of rows) {
    totalFlow += Number(r.flow) || 0;
    totalCommission += Number(r.commissionAmount) || 0;
  }

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      playerId: r.playerId,
      playerName: playerNameMap.get(r.playerId) || "?",
      gameType: r.gameType,
      level: r.level,
      flow: r.flow,
      commissionRate: r.commissionRate,
      commissionAmount: r.commissionAmount,
      createdAt: r.createdAt,
    })),
    pagination: { page, pageSize, total: totalRows[0]?.count || 0 },
    summary: { totalFlow, totalCommission },
  });
});

// ========== POST /api/agent/adjust-points — 代理/总代理调整下线代理筹码 ==========
// 一级代理可以调整自己直招的二级代理筹码，总代理可以调整所有下线代理筹码
router.post("/adjust-points", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "agent" && u.role !== "top_agent" && u.role !== "admin") {
    res.status(403).json({ error: "仅代理可操作" });
    return;
  }
  const b = req.body || {};
  const targetId = Number(b?.targetId);
  const amount = Math.trunc(Number(b?.amount));
  const note = typeof b?.note === "string" ? b.note.slice(0, 50) : null;
  if (!targetId || !Number.isFinite(amount) || amount === 0) {
    res.status(400).json({ error: "参数无效" });
    return;
  }
  if (Math.abs(amount) > 1_000_000) {
    res.status(400).json({ error: "单次操作不得超过 100 万" });
    return;
  }
  // 获取目标用户
  const targetRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  const target = targetRows[0];
  if (!target) {
    res.status(404).json({ error: "目标用户不存在" });
    return;
  }
  // 目标必须是代理（不能是玩家，玩家用 /players 接口）
  if (target.role !== "agent" && target.role !== "top_agent") {
    res.status(400).json({ error: "只能调整代理的筹码" });
    return;
  }
  // 校验目标在调用者的下线体系中
  const ids = await scopeIds(u);
  if (!ids || !ids.includes(targetId)) {
    res.status(403).json({ error: "该代理不在你的名下" });
    return;
  }
  // 上分时检查余额
  if (amount > 0 && u.points < amount) {
    res.status(400).json({ error: `账户余额不足，当前 ${u.points}，需要 ${amount}` });
    return;
  }
  // 计算新余额
  const targetNext = target.points + amount;
  if (targetNext < 0) {
    res.status(400).json({ error: `代理余额不足，当前 ${target.points}` });
    return;
  }
  const agentNext = u.points - amount;
  // 执行更新
  await db.update(users).set({ points: targetNext }).where(eq(users.id, targetId));
  await db.update(users).set({ points: agentNext }).where(eq(users.id, u.id));
  // 写入流水
  await db.insert(chipTransactions).values({
    userId: targetId,
    operatorId: u.id,
    amount,
    balanceAfter: targetNext,
    type: amount > 0 ? "agent_add" : "agent_sub",
    note: note || (amount > 0 ? "代理上分" : "代理下分"),
  });
  await db.insert(chipTransactions).values({
    userId: u.id,
    operatorId: u.id,
    amount: -amount,
    balanceAfter: agentNext,
    type: amount > 0 ? "agent_sub" : "agent_add",
    note: note || (amount > 0 ? `给代理 ${target.account} 上分` : `从代理 ${target.account} 下分`),
  });
  audit.info("agent_adjust_agent_points", {
    userId: u.id,
    account: u.account,
    detail: `目标代理=${target.account}(ID:${targetId}), 金额=${amount}, 代理余额=${targetNext}, 调用者余额=${agentNext}`,
  });
  res.json({ ok: true, points: targetNext, agentPoints: agentNext });
});

// ========== POST /api/agent/freeze/:id — 冻结/解冻下线代理 ==========\
router.post("/freeze/:id", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "agent" && u.role !== "top_agent" && u.role !== "admin") {
    res.status(403).json({ error: "仅代理可操作" });
    return;
  }
  const targetId = Number(req.params.id);
  const { action } = req.body || {};
  if (!["freeze", "unfreeze"].includes(action)) {
    res.status(400).json({ error: "action 必须为 freeze 或 unfreeze" });
    return;
  }
  // 获取目标用户
  const targetRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  const target = targetRows[0];
  if (!target) {
    res.status(404).json({ error: "目标用户不存在" });
    return;
  }
  // 目标必须是代理
  if (target.role !== "agent" && target.role !== "top_agent") {
    res.status(400).json({ error: "只能冻结/解冻代理" });
    return;
  }
  // 校验目标在调用者的下线体系中
  const ids = await scopeIds(u);
  if (!ids || !ids.includes(targetId)) {
    res.status(403).json({ error: "该代理不在你的名下" });
    return;
  }
  // 执行冻结/解冻
  const newFrozen = action === "freeze";
  await db.update(users).set({ frozen: newFrozen }).where(eq(users.id, targetId));
  audit.info(`agent_${action}_agent`, {
    userId: u.id,
    account: u.account,
    detail: `${action === "freeze" ? "冻结" : "解冻"}代理=${target.account}(ID:${targetId})`,
  });
  res.json({ ok: true, frozen: newFrozen });
});


// ========== 补齐的API路由 ==========

// GET /api/agent/players/:userId - 获取玩家详情
router.get("/players/:userId", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.userId);
    const scoped = await scopeIds(u);
    if (scoped && !scoped.includes(userId)) {
      res.status(403).json({ error: "无权查看该玩家" }); return;
    }
    const player = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (player.length === 0) { res.status(404).json({ error: "玩家不存在" }); return; }
    const { password, ...safeUser } = player[0];
    res.json({ user: safeUser });
  } catch (e) {
    console.error("[agent] 获取玩家详情失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/agent/invite-code - 获取邀请码
router.get("/invite-code", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  try {
    res.json({ inviteCode: u.inviteCode || genInviteCode() });
  } catch (e) {
    console.error("[agent] 获取邀请码失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/agent/history - 代理历史记录
router.get("/history", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize, offset } = parsePagination(req);
    const scoped = await scopeIds(u);
    const whereClause = scoped ? inArray(chipTransactions.userId, scoped) : undefined;

    const [records, totalRows] = await Promise.all([
      db.select().from(chipTransactions)
        .where(whereClause)
        .orderBy(desc(chipTransactions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: chipTransactions.id }).from(chipTransactions)
        .where(whereClause)
    ]);
    res.json(paginatedResponse(records, totalRows[0]?.count ?? 0, page, pageSize));
  } catch (e) {
    console.error("[agent] 获取历史记录失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/agent/ledger - 代理账本
router.get("/ledger", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  try {
    const scoped = await scopeIds(u);
    const userIds = scoped || [u.id];
    const allTx = await db.select().from(chipTransactions).where(inArray(chipTransactions.userId, userIds));
    const totalIn = allTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = allTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const distributions = await db.select().from(distributionRecords).where(inArray(distributionRecords.agentId, userIds));
    const totalCommission = distributions.reduce((s, d) => s + (d.commissionAmount || 0), 0);
    res.json({ balance: u.points, totalIn, totalOut, totalCommission, transactionCount: allTx.length, distributionCount: distributions.length });
  } catch (e) {
    console.error("[agent] 获取账本失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/agent/credit-transactions - 信用分交易记录（V3已弃用）
router.get("/credit-transactions", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  res.json({ records: [], message: "V3版本已弃用信用分，改为筹码门槛制" });
});

export default router;

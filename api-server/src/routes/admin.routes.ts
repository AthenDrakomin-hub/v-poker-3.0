import { Router, Request, Response } from "express";
import { db } from "@/db";
import { users, chipTransactions, rooms, handStates, roomPlayers, userPermissions, distributionRecords, eventLogs, loginLogs, riskTags, approvalRequests, roomAnomalies, csConversations, configHistory, configDrafts, roomHistory, gameRounds } from "@/db/schema";
import { desc, eq, ilike, or, inArray, and, gte, lte, sql } from "drizzle-orm";
import { getCurrentUser, hashPassword, genInviteCode } from "@/lib/auth";
import { audit, getRequestIp, getRequestDevice, getRequestId } from "@/lib/audit";
import { getConfig, setConfig } from "@/lib/config";
import { broadcastStateChanged } from "@/socket/roomSocket";
import { cashOutAll, settleRoom } from "@/lib/settle";
import { archiveRoom } from "@/lib/roomHistory";

const router = Router();

const ROLES = ["player", "agent", "top_agent", "customer_service", "admin"];

/** 解析分页参数，返回 {page, pageSize, offset} */
function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || req.query.limit ? Number(req.query.limit) : 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/** 统一分页响应格式 */
function paginatedResponse<T>(data: T[], total: number, page: number, pageSize: number) {
  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function requireStaff(req: Request, res: Response) {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return null;
  }
  if (u.role !== "admin" && u.role !== "customer_service") {
    res.status(403).json({ error: "无权限" });
    return null;
  }
  return u;
}

/** 计算用户代理等级：0=总代理,1=一级代理,2=二级代理,null=玩家 */
async function calcAgentLevel(r: typeof users.$inferSelect): Promise<number | null> {
  if (r.role === "top_agent") return 0;
  if (r.role !== "agent") return null;
  let level = 0;
  let currentId: number | null = r.invitedById;
  const visited = new Set<number>();
  while (currentId && !visited.has(currentId) && level < 5) {
    visited.add(currentId);
    const up = await db.select({ role: users.role, invitedById: users.invitedById }).from(users).where(eq(users.id, currentId)).limit(1);
    if (!up.length) break;
    level++;
    if (up[0].role === "top_agent") break;
    currentId = up[0].invitedById;
  }
  return level;
}

function shape(r: typeof users.$inferSelect) {
  return {
    id: r.id,
    account: r.account,
    role: r.role,
    points: r.points,
    inviteCode: r.inviteCode,
    invitedByCode: r.invitedByCode,
    securityCode: r.securityCode,
    frozen: r.frozen,
    createdAt: r.createdAt,
  };
}

// GET /api/admin/users
router.get("/users", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  const q = req.query.q as string | undefined;
  const role = req.query.role as string | undefined;
  const { page, pageSize, offset } = parsePagination(req);

  // 客服权限隔离：只能看到代理/总代理
  const isCs = u.role === "customer_service";

  // 构建 WHERE 条件
  const baseCond: any[] = [];
  if (q) {
    baseCond.push(or(ilike(users.account, `%${q}%`), ilike(users.inviteCode, `%${q}%`)));
  }
  if (isCs) {
    baseCond.push(or(eq(users.role, "agent"), eq(users.role, "top_agent")));
  }

  const whereClause = baseCond.length > 0 ? and(...baseCond) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: users.id }).from(users)
      .where(whereClause)
  ]);

  // 前端过滤 role（简化处理）
  const filteredRows = role ? rows.filter((r) => r.role === role) : rows;
  const filteredTotal = role
    ? rows.filter((r) => r.role === role).length
    : totalRows[0]?.count ?? 0;

  const usersWithLevel = await Promise.all(filteredRows.map(async (r) => ({
    ...shape(r),
    agentLevel: await calcAgentLevel(r),
  })));
  res.json(paginatedResponse(usersWithLevel, filteredTotal, page, pageSize));
});

// POST /api/admin/users
router.post("/users", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可新建用户" });
    return;
  }
  const b = req.body || {};
  const { account, password, role, securityCode, invitedByCode } = b;
  if (!account || !password) {
    res.status(400).json({ error: "账号和密码必填" });
    return;
  }
  if (role && !ROLES.includes(role)) {
    res.status(400).json({ error: "角色无效" });
    return;
  }
  const dup = await db.select().from(users).where(eq(users.account, account)).limit(1);
  if (dup.length) {
    res.status(400).json({ error: "账号已存在" });
    return;
  }

  let invitedById: number | null = null;
  if (invitedByCode) {
    const up = await db
      .select()
      .from(users)
      .where(eq(users.inviteCode, String(invitedByCode).toUpperCase()))
      .limit(1);
    if (!up.length) {
      res.status(400).json({ error: "上级邀请码无效" });
      return;
    }
    invitedById = up[0].id;
  }

  const inserted = await db
    .insert(users)
    .values({
      account,
      password: hashPassword(password),
      securityCode: String(securityCode || "0000"),
      role: role || "player",
      inviteCode: genInviteCode(),
      invitedByCode: invitedByCode ? String(invitedByCode).toUpperCase() : null,
      invitedById,
      points: 0,
    })
    .returning();

  audit.info("admin_create_user", { userId: u.id, account: u.account, detail: `创建用户 ${account} [${role || 'player'}]` });
  res.json({ user: shape(inserted[0]) });
});

// PATCH /api/admin/users
router.patch("/users", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  const b = req.body || {};
  const { id, account, password, role, securityCode, points, invitedByCode } = b;
  if (!id) {
    res.status(400).json({ error: "缺少用户ID" });
    return;
  }
  const rows = await db.select().from(users).where(eq(users.id, Number(id))).limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (account !== undefined) updates.account = account;
  if (password) updates.password = hashPassword(password);
  if (role) updates.role = role;
  if (securityCode !== undefined) updates.securityCode = securityCode;
  // 上级转移
  if (invitedByCode !== undefined) {
    if (invitedByCode === "") {
      // 清空上级，绑定到管理员
      const adminRows = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      if (adminRows.length) {
        updates.invitedByCode = adminRows[0].inviteCode;
        updates.invitedById = adminRows[0].id;
      }
    } else {
      const upRows = await db.select().from(users).where(eq(users.inviteCode, String(invitedByCode).toUpperCase())).limit(1);
      if (!upRows.length) {
        res.status(400).json({ error: "上级邀请码无效" });
        return;
      }
      if (!["agent", "top_agent", "admin"].includes(upRows[0].role)) {
        res.status(400).json({ error: "上级必须是代理、总代理或管理员" });
        return;
      }
      updates.invitedByCode = upRows[0].inviteCode;
      updates.invitedById = upRows[0].id;
    }
  }
  if (points !== undefined) {
    const newPoints = Math.max(0, Number(points));
    updates.points = newPoints;
    // 记录筹码变更流水
    const oldPoints = rows[0].points;
    const diff = newPoints - oldPoints;
    if (diff !== 0) {
      await db.insert(chipTransactions).values({
        userId: Number(id),
        operatorId: u.id,
        amount: diff,
        balanceAfter: newPoints,
        type: "admin_adjust",
        note: `管理员调整筹码 ${diff > 0 ? "+" : ""}${diff}`,
      });
    }
  }
  await db.update(users).set(updates).where(eq(users.id, Number(id)));
  audit.info("admin_update_user", { userId: u.id, account: u.account, detail: `更新用户 ID=${id}` });
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可删除用户" });
    return;
  }
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "缺少用户ID" });
    return;
  }
  await db.delete(users).where(eq(users.id, id));
  res.json({ ok: true });
});

// POST /api/admin/adjust-points（客服/管理员调整玩家筹码）
router.post("/adjust-points", async (req: Request, res: Response) => {
  const op = await getCurrentUser(req);
  if (!op) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (op.role !== "admin" && op.role !== "customer_service") {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const body = req.body || {};
  const { userId, amount, note } = body;
  const amt = Number(amount);
  if (!userId || isNaN(amt) || amt === 0) {
    res.status(400).json({ error: "参数无效" });
    return;
  }
  // 客服操作强制备注
  if (op.role === "customer_service" && (!note || String(note).trim().length < 2)) {
    res.status(400).json({ error: "客服操作必须填写操作备注（至少2个字符）" });
    return;
  }
  if (Math.abs(amt) > 1_000_000) {
    res.status(400).json({ error: "单次操作不得超过 100 万" });
    return;
  }
  const rows = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
  const target = rows[0];
  if (!target) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  // 客服只能操作代理/总代理，不能操作普通玩家
  if (op.role === "customer_service" && target.role !== "agent" && target.role !== "top_agent") {
    res.status(403).json({ error: "客服只能调整代理/总代理的筹码，不能操作普通玩家" });
    return;
  }
  if (target.role === "admin") {
    res.status(400).json({ error: "不能调整管理员筹码" });
    return;
  }
  const next = target.points + amt;
  if (next < 0) {
    res.status(400).json({ error: `下分超出余额（当前 ${target.points}）` });
    return;
  }
  await db.update(users).set({ points: next }).where(eq(users.id, target.id));
  await db.insert(chipTransactions).values({
    userId: target.id,
    operatorId: op.id,
    amount: amt,
    balanceAfter: next,
    type: amount > 0 ? "cs_add" : "cs_sub",
    note: note || (amount > 0 ? "客服上分" : "客服下分"),
  });
  audit.info("admin_adjust_points", {
    userId: op.id,
    account: op.account,
    detail: `调整用户 ID=${target.id}(${target.account}) 筹码 ${amt > 0 ? '+' : ''}${amt}，结果=${next}`,
  });
  res.json({ ok: true, points: next });
});

// GET /api/admin/stats (平台数据概览)
router.get("/stats", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;

  // 用户统计：按 role 聚合
  const userRowsRaw = await db.execute(sql`
    SELECT role, COUNT(*) as cnt FROM users GROUP BY role
  `);
  const userRows = (userRowsRaw as any).rows;
  const userStats: Record<string, number> = {};
  for (const r of userRows) userStats[r.role] = Number(r.cnt);
  const totalUsers = userRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);

  // 房间统计
  const roomRows = await db.select({ status: rooms.status, totalRake: rooms.totalRake, totalFlow: rooms.totalFlow }).from(rooms);
  const activeRooms = roomRows.filter((r) => r.status === "playing" || r.status === "waiting").length;
  const finishedRooms = roomRows.filter((r) => r.status === "finished" || r.status === "waiting_continue").length;
  const totalRake = roomRows.reduce((s, r) => s + (r.totalRake || 0), 0);
  const totalFlow = roomRows.reduce((s, r) => s + (r.totalFlow || 0), 0);

  // V3 筹码交易统计（已分配返佣 + 客服调整）
  const chipRows = await db.execute(sql`
    SELECT type, SUM(amount) as total FROM chip_transactions GROUP BY type
  `);
  let v3TotalDistributed = 0;
  let v3TotalCsAdjust = 0;
  for (const t of (chipRows as any).rows) {
    const amt = Number(t.total) || 0;
    if (t.type === "room_rake") v3TotalDistributed += amt;
    else if (t.type === "cs_add" || t.type === "cs_sub" || t.type === "admin_adjust") v3TotalCsAdjust += amt;
  }
  const v3PlatformIncome = Math.max(0, totalRake - v3TotalDistributed);

  res.json({
    users: userStats,
    totalUsers,
    activeRooms,
    finishedRooms,
    totalRooms: roomRows.length,
    totalRake,
    totalFlow,
    v3TotalDistributed,
    v3PlatformIncome,
    v3TotalCsAdjust,
  });
});

// POST /api/admin/set-role
router.post("/set-role", async (req: Request, res: Response) => {
  const op = await getCurrentUser(req);
  if (!op) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (op.role !== "admin") {
    res.status(403).json({ error: "仅管理员可修改角色" });
    return;
  }
  const body = req.body || {};
  const { userId, role } = body;
  if (!userId || !ROLES.includes(role)) {
    res.status(400).json({ error: "参数无效" });
    return;
  }
  const rows = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  await db.update(users).set({ role }).where(eq(users.id, Number(userId)));
  audit.info("admin_set_role", { userId: op.id, account: op.account, detail: `修改用户 ID=${userId} 角色为 ${role}` });
  res.json({ ok: true, role });
});

// GET /api/admin/config (查看APP配置)
router.get("/config", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  const [appVersion, wgtUrl, force, changelog, downloadUrl] = await Promise.all([
    getConfig("app_version"),
    getConfig("app_wgt_url"),
    getConfig("app_wgt_force"),
    getConfig("app_changelog"),
    getConfig("app_download_url"),
  ]);
  const config = {
    app_version: appVersion,
    app_wgt_url: wgtUrl,
    app_wgt_force: force,
    app_changelog: changelog,
    app_download_url: downloadUrl,
  };
  res.json({ config });
});

// PUT /api/admin/config (修改APP配置)
// 高危配置（APP下载、热更新等）仅管理员可操作，客服仅有查看权限
router.put("/config", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可修改APP配置" });
    return;
  }
  const b = req.body || {};
  // APP配置项（字符串类型）
  const appKeys = ["app_version", "app_wgt_url", "app_wgt_force", "app_changelog", "app_download_url"];
  for (const key of appKeys) {
    if (b[key] !== undefined) {
      await setConfig(key, String(b[key] ?? ""));
    }
  }
  const [appVersion, wgtUrl, force, changelog, downloadUrl] = await Promise.all([
    getConfig("app_version"),
    getConfig("app_wgt_url"),
    getConfig("app_wgt_force"),
    getConfig("app_changelog"),
    getConfig("app_download_url"),
  ]);
  const config = {
    app_version: appVersion,
    app_wgt_url: wgtUrl,
    app_wgt_force: force,
    app_changelog: changelog,
    app_download_url: downloadUrl,
  };
  audit.info("admin_config_update", { userId: u.id, account: u.account, detail: `修改APP配置: ${JSON.stringify(b)}` });
  res.json({ ok: true, config });
});

// GET /api/admin/rooms — 房间列表管理
router.get("/rooms", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  const status = req.query.status as string | undefined;
  const { page, pageSize, offset } = parsePagination(req);

  const whereClause = status ? eq(rooms.status, status) : undefined;

  const [roomRows, totalRows] = await Promise.all([
    db.select().from(rooms)
      .where(whereClause)
      .orderBy(desc(rooms.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: rooms.id }).from(rooms)
      .where(whereClause)
  ]);

  const agentIds = [...new Set(roomRows.map((r) => r.agentId))];
  const agentRows = agentIds.length ? await db.select({ id: users.id, account: users.account }).from(users).where(inArray(users.id, agentIds)) : [];
  const agentMap = new Map(agentRows.map((a) => [a.id, a.account]));
  res.json(paginatedResponse(roomRows.map((r) => ({
      id: r.id,
      roomNo: r.roomNo,
      gameType: r.gameType,
      level: r.level,
      status: r.status,
      agentId: r.agentId,
      agentName: agentMap.get(r.agentId) || "-",
      maxSeats: r.maxSeats,
      currentRound: r.currentRound,
      totalRounds: r.totalRounds,
      totalRake: r.totalRake,
      totalFlow: r.totalFlow,
      createdAt: r.createdAt,
    })), totalRows[0]?.count ?? 0, page, pageSize));
});

// POST /api/admin/rooms/:id/force-end — 强制结束房间
router.post("/rooms/:id/force-end", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  const roomId = Number(req.params.id);
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }
  const room = roomRows[0];
  if (room.status === "finished") {
    res.status(400).json({ error: "房间已结束" });
    return;
  }

  // 【事务保证】强制结束的所有操作在同一事务中执行：
  // 1. 退回玩家桌上筹码到钱包
  // 2. 结算代理信用分（有流水时）
  // 3. 清理 roomPlayers / handStates
  // 4. 标记房间为 finished
  let settlement = null;
  try {
    await db.transaction(async (tx) => {
      // 1. 退回所有玩家剩余筹码到钱包
      await cashOutAll(roomId, room.roomNo, tx);

      // 2. 有已完成局时结算信用分（防止漏扣房费/抽水）
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
          "force_end",
          settlement
            ? { agentNetCost: settlement.agentNetCost, platformIncome: settlement.platformNetIncome }
            : undefined,
          tx
        );
      }

      // 3. 清理关联数据
      await tx.delete(roomPlayers).where(eq(roomPlayers.roomId, roomId));
      await tx.delete(handStates).where(eq(handStates.roomId, roomId));

      // 4. 标记房间为已结束（可被复用）
      await tx
        .update(rooms)
        .set({ status: "finished", settled: true, archivedAt: new Date() })
        .where(eq(rooms.id, roomId));
    });
  } catch (e: any) {
    console.error(`[admin force-end] room=${roomId} 事务失败:`, e);
    res.status(500).json({ error: `强制结束失败: ${e.message}` });
    return;
  }

  audit.info("admin_force_end_room", {
    userId: u.id,
    account: u.account,
    detail: `强制结束房间 ${room.roomNo}(ID:${roomId}), 流水=${room.totalFlow}, 抽水=${room.totalRake}`,
  });

  // 广播状态变更，通知前端刷新
  broadcastStateChanged(roomId);

  res.json({ ok: true, settlement });
});

// ============================================================
// 客服工作台业务接口（权限隔离 + 操作留痕 + 对账报表）
// ============================================================

// GET /api/admin/cs-operations — 客服操作流水（合并信用+筹码交易，区分系统/人工）
// 客服只能看到自己的操作；管理员可看到全部，支持按客服筛选
router.get("/cs-operations", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "admin" && u.role !== "customer_service") {
    res.status(403).json({ error: "无权限" });
    return;
  }

  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const type = req.query.type as string | undefined; // cs_credit | cs_points | system_deduct | system_rebate
  const operatorId = req.query.operatorId as string | undefined;
  const targetUserId = req.query.userId as string | undefined;

  // 客服只能看自己的
  const effectiveOperatorId = u.role === "customer_service" ? String(u.id) : operatorId;

  // 查询筹码交易
  const chipConditions: any[] = [];
  if (effectiveOperatorId) chipConditions.push(eq(chipTransactions.operatorId, Number(effectiveOperatorId)));
  if (targetUserId) chipConditions.push(eq(chipTransactions.userId, Number(targetUserId)));
  if (from) chipConditions.push(gte(chipTransactions.createdAt, new Date(from)));
  if (to) chipConditions.push(lte(chipTransactions.createdAt, new Date(to + "T23:59:59")));

  const { page, pageSize, offset } = parsePagination(req);

  const [chipRows, totalRows] = chipConditions.length > 0
    ? await Promise.all([
        db.select().from(chipTransactions).where(and(...chipConditions)).orderBy(desc(chipTransactions.createdAt)).limit(pageSize).offset(offset),
        db.select({ count: chipTransactions.id }).from(chipTransactions).where(and(...chipConditions))
      ])
    : await Promise.all([
        db.select().from(chipTransactions).orderBy(desc(chipTransactions.createdAt)).limit(pageSize).offset(offset),
        db.select({ count: chipTransactions.id }).from(chipTransactions)
      ]);

  // 合并并获取用户信息
  const allUserIds = [...new Set([
    ...chipRows.map((r) => r.userId),
    ...chipRows.map((r) => r.operatorId).filter((x): x is number => !!x),
  ])];
  const userRows = allUserIds.length ? await db.select({ id: users.id, account: users.account, role: users.role }).from(users).where(inArray(users.id, allUserIds)) : [];
  const nameMap = new Map(userRows.map((x) => [x.id, x.account]));
  const roleMap = new Map(userRows.map((x) => [x.id, x.role]));

  // 统一格式
  interface OpItem {
    id: string;
    source: "chip";
    opType: "cs_points" | "other";
    category: "manual" | "system";
    userId: number;
    account: string;
    targetRole: string;
    amount: number;
    balanceAfter: number;
    operatorId: number | null;
    operator: string;
    note: string | null;
    createdAt: string | Date;
  }

  const items: OpItem[] = [
    ...chipRows.map((r) => {
      const isCs = r.type === "cs_add" || r.type === "cs_sub";
      return {
        id: `p_${r.id}`,
        source: "chip" as const,
        opType: isCs ? "cs_points" as const : "other" as const,
        category: isCs ? "manual" as const : "system" as const,
        userId: r.userId,
        account: nameMap.get(r.userId) || "?",
        targetRole: roleMap.get(r.userId) || "?",
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        operatorId: r.operatorId,
        operator: r.operatorId ? (nameMap.get(r.operatorId) || "-") : "系统",
        note: r.note,
        createdAt: r.createdAt,
      };
    }),
  ];

  // 按类型筛选
  let filtered = items;
  if (type) {
    filtered = items.filter((i) => i.opType === type);
  }

  // 按时间倒序
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 统计面板
  const summary = {
    csPointsAdd: 0,
    csPointsSub: 0,
    totalManualOps: 0,
  };
  for (const item of filtered) {
    if (item.opType === "cs_points") {
      if (item.amount > 0) summary.csPointsAdd += item.amount;
      else summary.csPointsSub += -item.amount;
      summary.totalManualOps++;
    }
  }

  res.json(paginatedResponse(items.map(item => ({
    id: item.id,
    source: item.source,
    opType: item.opType,
    category: item.category,
    userId: item.userId,
    account: item.account,
    targetRole: item.targetRole,
    amount: item.amount,
    balanceAfter: item.balanceAfter,
    operatorId: item.operatorId,
    operator: item.operator,
    note: item.note,
    createdAt: item.createdAt,
  })), totalRows[0]?.count ?? 0, page, pageSize));
});

// GET /api/admin/cs-report — 客服对账报表（按客服/按日/按月统计）
// 管理员可看全部客服；客服只能看自己
router.get("/cs-report", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "admin" && u.role !== "customer_service") {
    res.status(403).json({ error: "无权限" });
    return;
  }

  const period = (req.query.period as string) || "day"; // day | month | range
  const date = req.query.date as string | undefined; // YYYY-MM-DD 或 YYYY-MM
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const operatorId = req.query.operatorId as string | undefined;

  // 客服只能看自己
  const effectiveOperatorId = u.role === "customer_service" ? String(u.id) : operatorId;

  // 计算时间范围
  let startDate: Date, endDate: Date;
  if (period === "day" && date) {
    startDate = new Date(date + "T00:00:00");
    endDate = new Date(date + "T23:59:59");
  } else if (period === "month" && date) {
    const [y, m] = date.split("-");
    startDate = new Date(Number(y), Number(m) - 1, 1);
    endDate = new Date(Number(y), Number(m), 0, 23, 59, 59);
  } else if (from && to) {
    startDate = new Date(from + "T00:00:00");
    endDate = new Date(to + "T23:59:59");
  } else {
    // 默认今日
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  // 查询筹码交易
  const chipConditions: any[] = [
    gte(chipTransactions.createdAt, startDate),
    lte(chipTransactions.createdAt, endDate),
  ];
  if (effectiveOperatorId) chipConditions.push(eq(chipTransactions.operatorId, Number(effectiveOperatorId)));

  const chipRows = await db.select().from(chipTransactions).where(and(...chipConditions));
  const csChipRows = chipRows.filter((r) => r.type === "cs_add" || r.type === "cs_sub");

  // 获取客服信息
  const csIds = [...new Set([
    ...csChipRows.map((r) => r.operatorId).filter((x): x is number => !!x),
  ])];
  const csUsers = csIds.length ? await db.select({ id: users.id, account: users.account }).from(users).where(inArray(users.id, csIds)) : [];
  const csNameMap = new Map(csUsers.map((x) => [x.id, x.account]));

  // 按客服分组统计
  const byOperator = new Map<number, {
    csId: number;
    csAccount: string;
    pointsAdd: number;
    pointsSub: number;
    totalOps: number;
  }>();

  const ensureOp = (csId: number) => {
    if (!byOperator.has(csId)) {
      byOperator.set(csId, {
        csId,
        csAccount: csNameMap.get(csId) || "未知",
        pointsAdd: 0,
        pointsSub: 0,
        totalOps: 0,
      });
    }
    return byOperator.get(csId)!;
  };

  for (const r of csChipRows) {
    if (r.operatorId) {
      const stat = ensureOp(r.operatorId);
      if (r.amount > 0) stat.pointsAdd += r.amount;
      else stat.pointsSub += -r.amount;
      stat.totalOps++;
    }
  }

  // 汇总
  const totals = {
    pointsAdd: 0,
    pointsSub: 0,
    totalOps: 0,
  };
  for (const stat of byOperator.values()) {
    totals.pointsAdd += stat.pointsAdd;
    totals.pointsSub += stat.pointsSub;
    totals.totalOps += stat.totalOps;
  }

  res.json({
    period,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    byOperator: Array.from(byOperator.values()),
    totals,
  });
});

// GET /api/admin/cs-staff — 客服员工列表（管理员用来筛选对账）
router.get("/cs-staff", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u || u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可查看" });
    return;
  }
  const staff = await db.select({ id: users.id, account: users.account, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.role, "customer_service"))
    .orderBy(desc(users.createdAt));
  res.json({ staff });
});

// POST /api/admin/users/:id/freeze — 冻结用户
router.post("/users/:id/freeze", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可冻结用户" });
    return;
  }
  const id = Number(req.params.id);
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  await db.update(users).set({ frozen: true }).where(eq(users.id, id));
  audit.info("admin_freeze_user", { userId: u.id, account: u.account, detail: `冻结用户 ID=${id}(${rows[0].account})` });
  res.json({ ok: true, frozen: true });
});

// POST /api/admin/users/:id/unfreeze — 解冻用户
router.post("/users/:id/unfreeze", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可解冻用户" });
    return;
  }
  const id = Number(req.params.id);
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  await db.update(users).set({ frozen: false }).where(eq(users.id, id));
  audit.info("admin_unfreeze_user", { userId: u.id, account: u.account, detail: `解冻用户 ID=${id}(${rows[0].account})` });
  res.json({ ok: true, frozen: false });
});

// ========== 功能权限（feature key 模型，与前端 featurePermissions.js 对齐） ==========
const FEATURE_KEYS = [
  "game.niuniu", "game.sangong", "game.tbnn", "game.jinhua", "game.texas",
  "tab.rooms", "tab.mine", "tab.wallet", "tab.profile",
  "float.join", "float.service", "float.help", "float.notify",
  "profile.records", "profile.settings", "profile.service", "profile.createRoom", "profile.agentCommission", "profile.downline",
];

const DEFAULT_ROLE_PERMS: Record<string, Record<string, boolean>> = {
  player: Object.fromEntries([...FEATURE_KEYS.map(k => [k, true]), ["profile.createRoom", false], ["profile.agentCommission", false], ["profile.downline", false]]),
  agent: Object.fromEntries([...FEATURE_KEYS.map(k => [k, true]), ["profile.downline", false]]),
  top_agent: Object.fromEntries(FEATURE_KEYS.map(k => [k, true])),
  customer_service: Object.fromEntries([
    ...FEATURE_KEYS.map(k => [k, true]),
    ["game.niuniu", false], ["game.sangong", false], ["game.tbnn", false], ["game.jinhua", false], ["game.texas", false],
    ["tab.rooms", false], ["tab.mine", false], ["tab.wallet", false],
    ["float.join", false], ["profile.records", false], ["profile.createRoom", false],
    ["profile.agentCommission", false], ["profile.downline", false],
  ]),
};

function buildRolePerms(role: string, rows: typeof userPermissions.$inferSelect[]): Record<string, boolean> {
  const base = { ...(DEFAULT_ROLE_PERMS[role] || Object.fromEntries(FEATURE_KEYS.map(k => [k, true]))) };
  for (const r of rows) {
    if (r.role === role) base[r.featureKey] = r.enabled;
  }
  return base;
}

// GET /api/admin/permissions — 获取所有角色权限配置
router.get("/permissions", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可访问" });
    return;
  }
  const rows = await db.select().from(userPermissions);
  const result: Record<string, Record<string, boolean>> = {};
  for (const role of ["player", "agent", "top_agent", "customer_service"]) {
    result[role] = buildRolePerms(role, rows);
  }
  res.json({ permissions: result, featureKeys: FEATURE_KEYS });
});

// PUT /api/admin/permissions/:role — 批量更新角色权限
router.put("/permissions/:role", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可修改" });
    return;
  }
  const { role } = req.params;
  if (!["player", "agent", "top_agent", "customer_service"].includes(role)) {
    res.status(400).json({ error: "无效角色" });
    return;
  }
  const perms = req.body || {};
  // 删除该角色所有旧记录
  await db.delete(userPermissions).where(eq(userPermissions.role, role));
  // 插入新记录（只插入与默认值不同的）
  const defaults = DEFAULT_ROLE_PERMS[role] || {};
  const values: any[] = [];
  for (const key of FEATURE_KEYS) {
    const val = typeof perms[key] === "boolean" ? perms[key] : undefined;
    if (val !== undefined && val !== defaults[key]) {
      values.push({ role, featureKey: key, enabled: val, updatedBy: u.id });
    }
  }
  if (values.length > 0) {
    await db.insert(userPermissions).values(values);
  }
  audit.info("admin_update_permissions", { userId: u.id, account: u.account, detail: `批量更新角色 ${role} 权限，共 ${values.length} 项变更` });
  res.json({ ok: true, role, updated: values.length });
});

// DELETE /api/admin/permissions/:role — 重置角色权限为默认
router.delete("/permissions/:role", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可重置" });
    return;
  }
  const { role } = req.params;
  await db.delete(userPermissions).where(eq(userPermissions.role, role));
  audit.info("admin_reset_permissions", { userId: u.id, account: u.account, detail: `重置角色 ${role} 权限为默认` });
  res.json({ ok: true, role });
});


// ========== 补齐的API路由 ==========

// GET /api/admin/users/:userId - 获取用户详情
router.get("/users/:userId", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin" && u.role !== "customer_service") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.userId);
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length === 0) { res.status(404).json({ error: "用户不存在" }); return; }
    const { password, ...safeUser } = user[0];
    res.json({ user: safeUser });
  } catch (e) {
    console.error("[admin] 获取用户详情失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// PUT /api/admin/users/:userId - 更新用户信息
router.put("/users/:userId", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.userId);
    const { nickname, account, points, role } = req.body;
    const updateData: any = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (account !== undefined) updateData.account = account;
    if (points !== undefined) updateData.points = points;
    if (role !== undefined) updateData.role = role;
    await db.update(users).set(updateData).where(eq(users.id, userId));
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 更新用户失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/admin/audit-logs - 审计日志
router.get("/audit-logs", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize } = parsePagination(req);
    const eventType = req.query.eventType as string | undefined;
    const operatorId = req.query.operatorId ? parseInt(req.query.operatorId as string) : null;
    
    const whereClause: any[] = [];
    if (eventType) whereClause.push(eq(eventLogs.eventType, eventType));
    
    const [logs, totalRows] = await Promise.all([
      db.select().from(eventLogs)
        .orderBy(desc(eventLogs.receivedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: eventLogs.id }).from(eventLogs)
        .where(whereClause.length > 0 ? and(...whereClause) : undefined),
    ]);
    
    const total = totalRows[0]?.count ?? logs.length;
    res.json(paginatedResponse(logs, total, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取审计日志失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/admin/ledger - 平台账本
router.get("/ledger", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin" && u.role !== "customer_service") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const allTx = await db.select().from(chipTransactions);
    const totalIn = allTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = allTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const allUsers = await db.select({ points: users.points }).from(users);
    const totalBalance = allUsers.reduce((s, usr) => s + (usr.points || 0), 0);
    res.json({ totalIn, totalOut, totalBalance, transactionCount: allTx.length, userCount: allUsers.length });
  } catch (e) {
    console.error("[admin] 获取平台账本失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/cs-operations - 客服操作记录
router.post("/cs-operations", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin" && u.role !== "customer_service") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { userId, action, note, amount } = req.body;
    if (amount && userId) {
      await db.insert(chipTransactions).values({
        userId,
        type: action === "add" ? "cs_add" : "cs_sub",
        amount: action === "add" ? Math.abs(amount) : -Math.abs(amount),
        balanceAfter: 0,
        operatorId: u.id,
        note: note || "",
      });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 客服操作记录失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ==================== P0: 用户账号治理增强 ====================

// GET /api/admin/users/:id/details - 用户详情（含登录日志、风险标签）
router.get("/users/:id/details", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.id);
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length === 0) { res.status(404).json({ error: "用户不存在" }); return; }
    const { password, ...safeUser } = user[0];
    
    // 获取登录日志
    const loginLogsList = await db.select().from(loginLogs).where(eq(loginLogs.userId, userId)).orderBy(desc(loginLogs.createdAt)).limit(20);
    
    // 获取风险标签
    const riskTagsList = await db.select().from(riskTags).where(eq(riskTags.userId, userId)).orderBy(desc(riskTags.createdAt));
    
    res.json({
      user: safeUser,
      loginLogs: loginLogsList.map(l => ({
        id: l.id,
        ip: l.ip,
        device: l.device,
        platform: l.platform,
        success: l.success,
        failReason: l.failReason,
        createdAt: l.createdAt,
      })),
      riskTags: riskTagsList.map(t => ({
        id: t.id,
        tagType: t.tagType,
        tagValue: t.tagValue,
        reason: t.reason,
        isActive: t.isActive,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    console.error("[admin] 获取用户详情失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/users/:id/soft-delete - 软删除用户
router.post("/users/:id/soft-delete", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    const targetUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (targetUser.length === 0) { res.status(404).json({ error: "用户不存在" }); return; }
    
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    audit.info("admin_soft_delete_user", { 
      operatorId: u.id, 
      operatorAccount: u.account,
      targetId: userId,
      targetType: "user",
      beforeValue: { nickname: targetUser[0].nickname, role: targetUser[0].role },
      afterValue: { deletedAt: new Date().toISOString() },
      reason,
      ip: getRequestIp(req), 
      device: getRequestDevice(req), 
      requestId: getRequestId(req) 
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 软删除用户失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/users/:id/restore - 恢复用户
router.post("/users/:id/restore", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.id);
    await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
    audit.info("admin_restore_user", { 
      operatorId: u.id, 
      operatorAccount: u.account,
      targetId: userId,
      targetType: "user",
      ip: getRequestIp(req), 
      device: getRequestDevice(req), 
      requestId: getRequestId(req) 
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 恢复用户失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/users/:id/risk-tag - 添加风险标签
router.post("/users/:id/risk-tag", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.id);
    const { tagType, tagValue, reason, expiresAt } = req.body;
    await db.insert(riskTags).values({
      userId,
      tagType,
      tagValue,
      reason,
      createdBy: u.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    audit.info("admin_add_risk_tag", { 
      operatorId: u.id, 
      operatorAccount: u.account,
      targetId: userId,
      targetType: "risk_tag",
      afterValue: { tagType, tagValue },
      reason,
      ip: getRequestIp(req), 
      device: getRequestDevice(req), 
      requestId: getRequestId(req) 
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 添加风险标签失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// DELETE /api/admin/users/:id/risk-tag/:tagId - 移除风险标签
router.delete("/users/:id/risk-tag/:tagId", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const userId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);
    await db.update(riskTags).set({ isActive: false }).where(eq(riskTags.id, tagId));
    audit.info("admin_remove_risk_tag", { 
      operatorId: u.id, 
      operatorAccount: u.account,
      targetId: userId,
      targetType: "risk_tag",
      ip: getRequestIp(req), 
      device: getRequestDevice(req), 
      requestId: getRequestId(req) 
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 移除风险标签失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/admin/risk-tags - 获取所有风险标签
router.get("/risk-tags", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const tags = await db.select().from(riskTags).orderBy(desc(riskTags.createdAt)).limit(100);
    res.json(paginatedResponse(tags, tags.length, 1, 100));
  } catch (e) {
    console.error("[admin] 获取风险标签失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/admin/login-logs - 登录日志查询
router.get("/login-logs", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize } = parsePagination(req);
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
    const whereClause = userId ? eq(loginLogs.userId, userId) : undefined;
    const logs = await db.select().from(loginLogs)
      .orderBy(desc(loginLogs.createdAt))
      .limit(pageSize)
      .where(whereClause as any);
    const total = logs.length;
    res.json(paginatedResponse(logs, total, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取登录日志失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ==================== P0: 双人复核机制 ====================

// GET /api/admin/approvals/pending - 待审核列表
router.get("/approvals/pending", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize } = parsePagination(req);
    const logs = await db.select().from(approvalRequests)
      .where(eq(approvalRequests.status, "pending"))
      .orderBy(desc(approvalRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const total = await db.select({ count: approvalRequests.id }).from(approvalRequests).where(eq(approvalRequests.status, "pending"));
    res.json(paginatedResponse(logs, total[0]?.count || 0, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取待审核列表失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/approvals/:id/approve - 审核通过
router.post("/approvals/:id/approve", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    await db.update(approvalRequests).set({ 
      status: "approved", 
      reviewerId: u.id,
      reviewedAt: new Date(),
      reviewComment: reason,
    }).where(eq(approvalRequests.id, id));
    audit.info("admin_approve_request", { operatorId: u.id, operatorAccount: u.account, targetId: id, targetType: "approval", ip: getRequestIp(req), requestId: getRequestId(req) });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 审核通过失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/approvals/:id/reject - 审核拒绝
router.post("/approvals/:id/reject", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    await db.update(approvalRequests).set({ 
      status: "rejected", 
      reviewerId: u.id,
      reviewedAt: new Date(),
      reviewComment: reason,
    }).where(eq(approvalRequests.id, id));
    audit.info("admin_reject_request", { operatorId: u.id, operatorAccount: u.account, targetId: id, targetType: "approval", ip: getRequestIp(req), requestId: getRequestId(req) });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 审核拒绝失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ==================== P1: 房间监管 ====================

// GET /api/admin/rooms/:id/anomalies - 房间异常事件
router.get("/rooms/:id/anomalies", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const roomId = parseInt(req.params.id);
    const anomalies = await db.select().from(roomAnomalies)
      .where(eq(roomAnomalies.roomId, roomId))
      .orderBy(desc(roomAnomalies.detectedAt))
      .limit(50);
    res.json({ data: anomalies });
  } catch (e) {
    console.error("[admin] 获取房间异常失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/rooms/:id/anomalies - 创建异常记录
router.post("/rooms/:id/anomalies", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const roomId = parseInt(req.params.id);
    const { anomalyType, description, severity } = req.body;
    await db.insert(roomAnomalies).values({ roomId, anomalyType, description, severity });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 创建异常记录失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ==================== P1: 客服运营 ====================

// GET /api/admin/cs/conversations - 客服会话列表
router.get("/cs/conversations", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize } = parsePagination(req);
    const conversations = await db.select().from(csConversations)
      .orderBy(desc(csConversations.assignedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const total = await db.select({ count: csConversations.id }).from(csConversations);
    res.json(paginatedResponse(conversations, total[0]?.count || 0, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取客服会话失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ==================== P1: 代理管理增强 ====================

// GET /api/admin/agents/tree - 代理树结构
router.get("/agents/tree", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    // 获取所有一级代理（由总代理邀请）
    const level1Agents = await db.select({
      id: users.id,
      account: users.account,
      nickname: users.nickname,
      role: users.role,
      invitedById: users.invitedById,
    }).from(users).where(eq(users.role, "agent"));
    
    // 获取所有总代理
    const topAgents = await db.select({
      id: users.id,
      account: users.account,
      nickname: users.nickname,
      role: users.role,
    }).from(users).where(eq(users.role, "top_agent"));
    
    // 获取二级代理（由一级代理邀请）
    const level2AgentIds = level1Agents.map(a => a.id);
    const level2Agents = level2AgentIds.length > 0 
      ? await db.select({
          id: users.id,
          account: users.account,
          nickname: users.nickname,
          role: users.role,
          invitedById: users.invitedById,
        }).from(users).where(and(eq(users.role, "agent"), inArray(users.invitedById, level2AgentIds)))
      : [];
    
    res.json({
      topAgents,
      level1Agents,
      level2Agents,
    });
  } catch (e) {
    console.error("[admin] 获取代理树失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/admin/agents/:id/commission-report - 佣金结算报表
router.get("/agents/:id/commission-report", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const agentId = parseInt(req.params.id);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    let whereClause = eq(distributionRecords.agentId, agentId) as any;
    if (from) whereClause = and(whereClause, gte(distributionRecords.createdAt, new Date(from)));
    if (to) whereClause = and(whereClause, lte(distributionRecords.createdAt, new Date(to)));

    const records = await db.select().from(distributionRecords).where(whereClause).orderBy(desc(distributionRecords.createdAt));

    const totalCommission = records.reduce((sum, r) => sum + Number(r.commissionAmount || 0), 0);
    const totalFlow = records.reduce((sum, r) => sum + Number(r.flow || 0), 0);

    res.json({
      data: records,
      summary: { totalCommission, totalFlow, recordCount: records.length },
    });
  } catch (e) {
    console.error("[admin] 获取佣金报表失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// ==================== P2: 配置版本化 ====================

// GET /api/admin/config/history - 配置变更历史
router.get("/config/history", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize } = parsePagination(req);
    const history = await db.select().from(configHistory)
      .orderBy(desc(configHistory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const total = await db.select({ count: configHistory.id }).from(configHistory);
    res.json(paginatedResponse(history, total[0]?.count || 0, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取配置历史失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/config/draft - 创建配置草稿
router.post("/config/draft", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { configKey, configValue } = req.body;
    await db.insert(configDrafts).values({ configKey, configValue, createdBy: u.id });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 创建配置草稿失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// PUT /api/admin/config/draft/:id/publish - 发布草稿
router.put("/config/draft/:id/publish", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const draftId = parseInt(req.params.id);
    const draft = await db.select().from(configDrafts).where(eq(configDrafts.id, draftId)).limit(1);
    if (!draft.length) { res.status(404).json({ error: "草稿不存在" }); return; }
    
    // 更新当前配置
    await db.update(configHistory).set({ isCurrent: false }).where(eq(configHistory.configKey, draft[0].configKey));
    await db.insert(configHistory).values({
      configKey: draft[0].configKey,
      configValue: draft[0].configValue,
      changedBy: u.id,
      version: (await db.select({ version: configHistory.version }).from(configHistory).where(eq(configHistory.configKey, draft[0].configKey)).orderBy(desc(configHistory.version)).limit(1))[0]?.version + 1 || 1,
    });
    await db.update(configDrafts).set({ publishedAt: new Date() }).where(eq(configDrafts.id, draftId));
    
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 发布配置草稿失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/config/rollback - 回滚配置
router.post("/config/rollback", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { configKey, version } = req.body;
    const target = await db.select().from(configHistory).where(and(eq(configHistory.configKey, configKey), eq(configHistory.version, version))).limit(1);
    if (!target.length) { res.status(404).json({ error: "目标版本不存在" }); return; }

    await db.update(configHistory).set({ isCurrent: false }).where(eq(configHistory.configKey, configKey));
    await db.update(configHistory).set({ isCurrent: true }).where(and(eq(configHistory.configKey, configKey), eq(configHistory.version, version)));

    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 回滚配置失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// PUT /api/admin/cs-status/:id — 客服开启/关闭接待
router.put("/cs-status/:id", async (req: Request, res: Response) => {
  const u = await requireStaff(req, res);
  if (!u) return;
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可操作" });
    return;
  }
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!["online", "offline"].includes(status)) {
    res.status(400).json({ error: "状态值无效，必须为 online 或 offline" });
    return;
  }
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  if (rows[0].role !== "customer_service") {
    res.status(400).json({ error: "该用户不是客服" });
    return;
  }
  await db.update(users).set({ csStatus: status }).where(eq(users.id, id));
  audit.info("admin_cs_status_change", { userId: u.id, account: u.account, detail: `客服 ID=${id} 状态改为 ${status}`, ip: getRequestIp(req), requestId: getRequestId(req) });
  res.json({ ok: true, csStatus: status });
});


// ========== GET /api/admin/messages ==========
// 管理员查询所有客服聊天记录（支持筛选+分页）
router.get("/messages", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u || u.role !== "admin") {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const csId = req.query.csId ? Number(req.query.csId) : null;
  const keyword = req.query.keyword ? String(req.query.keyword) : null;
  const startDate = req.query.startDate ? String(req.query.startDate) : null;
  const endDate = req.query.endDate ? String(req.query.endDate) : null;
  const type = req.query.type ? String(req.query.type) : null;
  let page = Number(req.query.page) || 1;
  let pageSize = Number(req.query.pageSize) || 20;
  page = Math.max(1, page);
  pageSize = Math.min(Math.max(1, pageSize), 100);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (csId) conditions.push(sql`(m.sender_id = ${csId} OR m.receiver_id = ${csId})`);
  if (keyword) conditions.push(sql`m.content ILIKE ${'%' + keyword + '%'}`);
  if (startDate) conditions.push(sql`m.created_at >= ${startDate}::timestamp`);
  if (endDate) conditions.push(sql`m.created_at <= ${endDate}::timestamp`);
  if (type) conditions.push(sql`m.type = ${type}`);

  const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

  const countResult = await db.execute(sql`SELECT COUNT(*) AS total FROM cs_messages m ${whereClause}`);
  const total = Number(countResult.rows?.[0]?.total || 0);

  const messages = await db.execute(sql`
    SELECT
      m.id, m.sender_id, m.receiver_id, m.content, m.type, m.status,
      m.related_data, m.created_at,
      su.account AS sender_account, su.nickname AS sender_nickname, su.role AS sender_role,
      ru.account AS receiver_account, ru.nickname AS receiver_nickname, ru.role AS receiver_role
    FROM cs_messages m
    LEFT JOIN users su ON su.id = m.sender_id
    LEFT JOIN users ru ON ru.id = m.receiver_id
    ${whereClause}
    ORDER BY m.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  res.json({
    messages: (messages.rows || []).reverse(),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// ========== GET /api/admin/messages/stats ==========
// 管理员查看客服聊天统计
router.get("/messages/stats", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u || u.role !== "admin") {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const days = req.query.days ? Number(req.query.days) : 7;

  const stats = await db.execute(sql`
    WITH cs_users AS (
      SELECT id, account, nickname FROM users WHERE role = 'customer_service'
    )
    SELECT
      cu.id, cu.account, cu.nickname,
      COUNT(DISTINCT CASE WHEN m.created_at > NOW() - INTERVAL '${days} days'
        THEN CASE WHEN m.sender_id = cu.id THEN m.receiver_id ELSE m.sender_id END
      END) AS active_sessions,
      COUNT(CASE WHEN m.sender_id = cu.id AND m.created_at > NOW() - INTERVAL '${days} days' THEN 1 END) AS messages_sent,
      COUNT(CASE WHEN m.receiver_id = cu.id AND m.created_at > NOW() - INTERVAL '${days} days' THEN 1 END) AS messages_received,
      COUNT(CASE WHEN m.type = 'chip_request' AND m.receiver_id = cu.id AND m.created_at > NOW() - INTERVAL '${days} days' THEN 1 END) AS chip_requests_received,
      COUNT(CASE WHEN m.type = 'chip_request' AND m.status = 'processed' AND m.receiver_id = cu.id AND m.created_at > NOW() - INTERVAL '${days} days' THEN 1 END) AS chip_requests_processed,
      MAX(m.created_at) AS last_active
    FROM cs_users cu
    LEFT JOIN cs_messages m ON (m.sender_id = cu.id OR m.receiver_id = cu.id)
    GROUP BY cu.id, cu.account, cu.nickname
    ORDER BY active_sessions DESC, messages_sent DESC
  `);

  res.json({
    days,
    stats: (stats.rows || []).map(r => ({
      id: r.id,
      account: r.account,
      nickname: r.nickname,
      activeSessions: Number(r.active_sessions || 0),
      messagesSent: Number(r.messages_sent || 0),
      messagesReceived: Number(r.messages_received || 0),
      chipRequestsReceived: Number(r.chip_requests_received || 0),
      chipRequestsProcessed: Number(r.chip_requests_processed || 0),
      lastActive: r.last_active || null,
    })),
  });
});
export default router;

// ==================== P3: 房间查询接口 ====================

// GET /api/admin/room-history - 管理端房间汇总查询
router.get("/room-history", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const { page, pageSize } = parsePagination(req);
    const { agentId, gameType, from, to, roomNo } = req.query;

    let whereClause: any = undefined;
    if (agentId) whereClause = eq(roomHistory.agentId, parseInt(agentId as string));
    if (gameType) whereClause = and(whereClause, eq(roomHistory.gameType, gameType as string));
    if (roomNo) whereClause = and(whereClause, eq(roomHistory.roomNo, roomNo as string));
    if (from) whereClause = and(whereClause, gte(roomHistory.endedAt, new Date(from as string)));
    if (to) whereClause = and(whereClause, lte(roomHistory.endedAt, new Date(to as string)));

    const rows = await db.select().from(roomHistory)
      .orderBy(desc(roomHistory.endedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .where(whereClause as any);

    const totalRows = await db.select({ count: roomHistory.id }).from(roomHistory)
      .where(whereClause as any);
    const total = totalRows[0]?.count || 0;

    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取房间历史失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/admin/rooms/:roomNo/rounds - 管理端单局审计
router.get("/rooms/:roomNo/rounds", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }
  try {
    const roomNo = req.params.roomNo;
    const { page, pageSize } = parsePagination(req);

    // 先获取房间ID
    const roomRows = await db.select().from(rooms).where(eq(rooms.roomNo, roomNo)).limit(1);
    if (!roomRows.length) {
      res.status(404).json({ error: "房间不存在" });
      return;
    }
    const roomId = roomRows[0].id;

    const rows = await db.select().from(gameRounds)
      .where(eq(gameRounds.roomId, roomId))
      .orderBy(desc(gameRounds.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalRows = await db.select({ count: gameRounds.id }).from(gameRounds)
      .where(eq(gameRounds.roomId, roomId));
    const total = totalRows[0]?.count || 0;

    res.json(paginatedResponse(rows, total, page, pageSize));
  } catch (e) {
    console.error("[admin] 获取房间对局失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// PUT /api/admin/cs-status/:id — 客服开启/关闭接待

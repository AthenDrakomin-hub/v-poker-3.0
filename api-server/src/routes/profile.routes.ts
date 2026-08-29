import { Router, Request, Response } from "express";
import { db } from "@/db";
import {
  users,
  gameRounds,
  rooms,
  devices,
  chipTransactions,
  roomPlayers,
} from "@/db/schema";
import { desc, eq, inArray, and } from "drizzle-orm";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimitMiddleware } from "@/lib/rateLimiter";
import { audit } from "@/lib/audit";

const router = Router();

interface RoundResultShape {
  hands: { userId: number; account: string; handName: string; delta: number }[];
  winnerUserId: number;
}

// GET /api/profile
router.get("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  // 并行查询：房间列表；对局记录依赖房间ID，串行后续查询
  const myRooms = await db.select().from(rooms).orderBy(desc(rooms.createdAt)).limit(200);
  const roomMap = new Map(myRooms.map((r) => [r.id, r]));
  const roundRows = myRooms.length
    ? await db
        .select()
        .from(gameRounds)
        .where(inArray(gameRounds.roomId, myRooms.map((r) => r.id)))
        .orderBy(desc(gameRounds.createdAt))
        .limit(500)
    : [];
  const myRounds = roundRows.filter((r) => {
    const res = r.result as unknown as RoundResultShape;
    return res?.hands?.some((h) => h.userId === u.id);
  });
  let wins = 0;
  let net = 0;
  const history = myRounds.slice(0, 30).map((r) => {
    const res = r.result as unknown as RoundResultShape;
    const mine = res.hands.find((h) => h.userId === u.id)!;
    const won = res.winnerUserId === u.id;
    if (won) wins++;
    net += mine.delta;
    return {
      id: r.id,
      roomNo: r.roomNo || "-", // 直接用 gameRounds 记录的房间号，避免房间复用后显示错误
      gameType: r.gameType,
      roundNo: r.roundNo,
      handName: mine.handName,
      delta: mine.delta,
      won,
      createdAt: r.createdAt,
    };
  });
  const totalRounds = myRounds.length;
  for (const r of myRounds.slice(30)) {
    const res = r.result as unknown as RoundResultShape;
    const mine = res.hands.find((h) => h.userId === u.id)!;
    if (res.winnerUserId === u.id) wins++;
    net += mine.delta;
  }

  // 按房间实例汇总战绩：用 (roomId, roomNo) 作为 key，房间ID复用后区分不同实例
  const roomMap2 = new Map<string, { rounds: number; wins: number; net: number; lastAt: Date; gameType: string; level: string; roomNo: string; agentId: number; details: any[] }>();
  for (const r of myRounds) {
    const res = r.result as unknown as RoundResultShape;
    const mine = res.hands.find((h) => h.userId === u.id)!;
    const room = roomMap.get(r.roomId);
    const won = res.winnerUserId === u.id;
    const detail = {
      id: r.id,
      roundNo: r.roundNo,
      handName: mine.handName,
      delta: mine.delta,
      won,
      createdAt: r.createdAt,
    };
    const groupKey = `${r.roomId}_${r.roomNo || "unknown"}`;
    const existing = roomMap2.get(groupKey);
    if (existing) {
      existing.rounds++;
      if (won) existing.wins++;
      existing.net += mine.delta;
      if (r.createdAt > existing.lastAt) existing.lastAt = r.createdAt;
      existing.details.push(detail);
    } else {
      roomMap2.set(groupKey, {
        rounds: 1,
        wins: won ? 1 : 0,
        net: mine.delta,
        lastAt: r.createdAt,
        gameType: r.gameType,
        level: room?.level ?? "junior",
        roomNo: r.roomNo || room?.roomNo || "-", // 优先用 gameRounds 记录的房间号
        agentId: room?.agentId ?? 0,
        details: [detail],
      });
    }
  }
  const agentIds = [...new Set([...roomMap2.values()].map((v) => v.agentId))];
  const agents = agentIds.length ? await db.select().from(users).where(inArray(users.id, agentIds)) : [];
  const agentNameMap = new Map(agents.map((a) => [a.id, a.nickname || a.account]));
  const roomHistory = [...roomMap2.values()]
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .map((v) => ({
      roomNo: v.roomNo,
      gameType: v.gameType,
      level: v.level,
      rounds: v.rounds,
      wins: v.wins,
      net: v.net,
      lastAt: v.lastAt,
      ownerName: agentNameMap.get(v.agentId) || "-",
      details: v.details.sort((a, b) => b.roundNo - a.roundNo),
    }));
  const chips = await db
    .select()
    .from(chipTransactions)
    .where(eq(chipTransactions.userId, u.id))
    .orderBy(desc(chipTransactions.createdAt))
    .limit(50);
  const deviceRows = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, u.id))
    .orderBy(desc(devices.lastActiveAt))
    .limit(20);
  res.json({
    user: {
      id: u.id,
      account: u.account,
      nickname: u.nickname || u.account,
      avatar: u.avatar,
      signature: u.signature,
      role: u.role,
      points: u.points,
      inviteCode: ["agent", "top_agent", "admin"].includes(u.role) ? u.inviteCode : null,
      canInvite: ["agent", "top_agent", "admin"].includes(u.role),
      invitedByCode: u.invitedByCode,
      settings: u.settings ?? { sound: true, music: true, vibrate: true },
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    },
    stats: {
      totalRounds,
      wins,
      losses: totalRounds - wins,
      winRate: totalRounds ? Math.round((wins / totalRounds) * 100) : 0,
      net,
    },
    history,
    roomHistory,
    chips: chips.map((c) => ({
      id: c.id,
      amount: c.amount,
      balanceAfter: c.balanceAfter,
      type: c.type,
      note: c.note,
      createdAt: c.createdAt,
    })),
    devices: deviceRows,
  });
});

// PATCH /api/profile
router.patch("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const b = req.body || {};
  const updates: Record<string, unknown> = {};
  if (b.nickname !== undefined) updates.nickname = String(b.nickname).slice(0, 30);
  if (b.avatar !== undefined) updates.avatar = String(b.avatar);
  if (b.signature !== undefined) updates.signature = String(b.signature).slice(0, 100);
  if (b.settings !== undefined) updates.settings = b.settings;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "无更新字段" });
    return;
  }
  await db.update(users).set(updates).where(eq(users.id, u.id));
  res.json({ ok: true });
});

// POST /api/profile/devices
router.post("/devices", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const b = req.body || {};
  const deviceId = String(b?.deviceId || "").slice(0, 64);
  if (!deviceId) {
    res.status(400).json({ error: "缺少设备标识" });
    return;
  }
  const ua = req.headers["user-agent"] || "";
  const platform = /iPhone|iPad|iOS/i.test(String(ua))
    ? "iOS"
    : /Android/i.test(String(ua))
    ? "Android"
    : /Windows/i.test(String(ua))
    ? "Windows"
    : /Mac/i.test(String(ua))
    ? "macOS"
    : "其他";
  const name = String(b?.name || `${platform} 设备`).slice(0, 40);
  const existing = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, u.id), eq(devices.deviceId, deviceId)))
    .limit(1);
  if (existing.length) {
    await db.update(devices).set({ lastActiveAt: new Date(), name, platform, trusted: true }).where(eq(devices.id, existing[0].id));
  } else {
    // 设备数量限制：最多10台，超过则删除最旧的非当前设备
    const allDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, u.id))
      .orderBy(desc(devices.lastActiveAt));
    if (allDevices.length >= 10) {
      const oldest = allDevices[allDevices.length - 1];
      await db.delete(devices).where(eq(devices.id, oldest.id));
    }
    await db.insert(devices).values({ userId: u.id, deviceId, name, platform, trusted: true });
  }
  res.json({ ok: true });
});

// DELETE /api/profile/devices
router.delete("/devices", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const id = Number(req.query.id);
  if (!id) {
    res.status(400).json({ error: "缺少设备ID" });
    return;
  }
  await db.delete(devices).where(and(eq(devices.id, id), eq(devices.userId, u.id)));
  res.json({ ok: true });
});

// POST /api/profile/password
router.post("/password", rateLimitMiddleware, async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const b = req.body || {};
  const { oldPassword, newPassword, confirmPassword } = b;
  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: "请填写完整" });
    return;
  }
  if (String(newPassword).length < 6) {
    res.status(400).json({ error: "新密码至少 6 位" });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "两次输入的新密码不一致" });
    return;
  }
  const { ok } = await verifyPassword(oldPassword, u.password, u.id);
  if (!ok) {
    res.status(400).json({ error: "原密码错误" });
    return;
  }
  const newHash = hashPassword(newPassword);
  await db.update(users).set({ password: newHash, mustChangePassword: false }).where(eq(users.id, u.id));
  audit.info("password_changed", { userId: u.id, account: u.account, detail: "用户修改密码" });
  res.json({ ok: true });
});

// POST /api/profile/force-change-password（首次登录强制改密）
router.post("/force-change-password", rateLimitMiddleware, async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (!u.mustChangePassword) {
    res.status(400).json({ error: "您无需强制修改密码" });
    return;
  }
  const b = req.body || {};
  const { newPassword, confirmPassword } = b;
  if (!newPassword || !confirmPassword) {
    res.status(400).json({ error: "请填写完整" });
    return;
  }
  if (String(newPassword).length < 6) {
    res.status(400).json({ error: "新密码至少 6 位" });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "两次输入的新密码不一致" });
    return;
  }
  const newHash = hashPassword(newPassword);
  await db.update(users).set({ password: newHash, mustChangePassword: false }).where(eq(users.id, u.id));
  audit.info("force_password_changed", { userId: u.id, account: u.account, detail: "首次登录强制修改密码" });
  res.json({ ok: true });
});

// PUT /api/profile/nickname
router.put("/nickname", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const b = req.body || {};
  const nickname = String(b?.nickname || "").trim().slice(0, 20);
  if (!nickname) { res.status(400).json({ error: "nickname required" }); return; }
  await db.update(users).set({ nickname }).where(eq(users.id, u.id));
  audit.info("profile_nickname_changed", { userId: u.id, account: u.account, detail: "nickname=" + nickname });
  res.json({ ok: true, nickname });
});

// PUT /api/profile/avatar
router.put("/avatar", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const b = req.body || {};
  const avatar = String(b?.avatar || "").trim().slice(0, 10);
  if (!avatar) { res.status(400).json({ error: "avatar required" }); return; }
  await db.update(users).set({ avatar }).where(eq(users.id, u.id));
  audit.info("profile_avatar_changed", { userId: u.id, account: u.account, detail: "avatar=" + avatar });
  res.json({ ok: true, avatar });
});

// GET /api/profile/devices
router.get("/devices", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  const rows = await db.select().from(devices).where(eq(devices.userId, u.id)).orderBy(desc(devices.lastActiveAt)).limit(20);
  res.json({ items: rows, total: rows.length });
});

// GET /api/profile/room-history - 用户房间汇总战绩
router.get("/room-history", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || req.query.limit ? Number(req.query.limit) : 20));
    const offset = (page - 1) * pageSize;

    // 获取用户创建或参与过的房间
    const myRooms = await db.select().from(rooms)
      .where(eq(rooms.agentId, u.id))
      .orderBy(desc(rooms.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRooms = await db.select({ count: rooms.id }).from(rooms)
      .where(eq(rooms.agentId, u.id));
    const total = totalRooms[0]?.count || 0;

    // 获取每个房间的对局数据
    const roomIds = myRooms.map(r => r.id);
    const rounds = roomIds.length > 0
      ? await db.select().from(gameRounds)
        .where(inArray(gameRounds.roomId, roomIds))
        .orderBy(desc(gameRounds.createdAt))
      : [];

    // 按房间汇总
    const roomStats = new Map<number, { rounds: number; wins: number; net: number; latestRound: any }>();
    for (const round of rounds) {
      const result = round.result as any;
      const myHand = result?.hands?.find((h: any) => h.userId === u.id);
      if (!myHand) continue;

      const existing = roomStats.get(round.roomId);
      if (existing) {
        existing.rounds++;
        if (result?.winnerUserId === u.id) existing.wins++;
        existing.net += myHand.delta || 0;
        if (!existing.latestRound || round.createdAt > existing.latestRound.createdAt) {
          existing.latestRound = round;
        }
      } else {
        roomStats.set(round.roomId, {
          rounds: 1,
          wins: result?.winnerUserId === u.id ? 1 : 0,
          net: myHand.delta || 0,
          latestRound: round,
        });
      }
    }

    // 构建响应
    const result = myRooms.map(room => {
      const stats = roomStats.get(room.id) || { rounds: 0, wins: 0, net: 0, latestRound: null };
      return {
        roomId: room.id,
        roomNo: room.roomNo,
        gameType: room.gameType,
        level: room.level,
        rounds: stats.rounds,
        wins: stats.wins,
        losses: stats.rounds - stats.wins,
        winRate: stats.rounds > 0 ? Math.round((stats.wins / stats.rounds) * 100) : 0,
        net: stats.net,
        lastPlayedAt: stats.latestRound?.createdAt,
      };
    });

    res.json({
      data: result,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (e) {
    console.error("[profile] 获取房间历史失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/profile/room-history/:roomNo/rounds - 用户在某房间的逐局记录
router.get("/room-history/:roomNo/rounds", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  try {
    const roomNo = req.params.roomNo;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || req.query.limit ? Number(req.query.limit) : 20));
    const offset = (page - 1) * pageSize;

    // 获取房间
    const roomRows = await db.select().from(rooms).where(eq(rooms.roomNo, roomNo)).limit(1);
    if (!roomRows.length) {
      res.status(404).json({ error: "房间不存在" });
      return;
    }
    const room = roomRows[0];

    // 检查用户是否有权限查看（放宽权限：房主、参与者、观察者都可查看）
    const playerRecords = await db.select().from(roomPlayers)
      .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, u.id)));

    // 如果用户不是房间成员，检查是否是房主
    if (!playerRecords.length && room.agentId !== u.id) {
      // 如果不是房主也不是成员，检查是否是客服或管理员（可查看所有）
      if (u.role !== "admin" && u.role !== "customer_service") {
        res.status(403).json({ error: "无权查看此房间记录" });
        return;
      }
    }

    // 获取对局记录
    const rounds = await db.select().from(gameRounds)
      .where(eq(gameRounds.roomId, room.id))
      .orderBy(desc(gameRounds.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await db.select({ count: gameRounds.id }).from(gameRounds)
      .where(eq(gameRounds.roomId, room.id));
    const total = totalRows[0]?.count || 0;

    // 格式化响应
    const result = rounds.map(r => {
      const resData = r.result as any;
      const myHand = resData?.hands?.find((h: any) => h.userId === u.id);
      // 所有玩家明细（用于前端全部玩家tab展示）
      const allHands = Array.isArray(resData?.hands)
        ? resData.hands.map((h: any) => ({
            userId: h.userId,
            account: h.account || h.name || "玩家",
            handName: h.handName || "-",
            delta: typeof h.delta === "number" ? h.delta : (h.amount || 0),
            won: resData?.winnerUserId === h.userId || h.won === true,
          }))
        : [];
      return {
        id: r.id,
        roomNo: r.roomNo || room.roomNo,
        roundNo: r.roundNo,
        gameType: r.gameType,
        handName: myHand?.handName || "-",
        delta: myHand?.delta || 0,
        won: resData?.winnerUserId === u.id,
        potBeforeRake: r.potBeforeRake,
        rake: r.rake,
        turnover: r.turnover,
        createdAt: r.createdAt,
        allHands, // 所有玩家明细
      };
    });

    res.json({
      data: result,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (e) {
    console.error("[profile] 获取房间对局失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

export default router;

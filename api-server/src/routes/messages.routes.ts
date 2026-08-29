import { Router, Request, Response } from "express";
import { db } from "@/db";
import { csMessages, users } from "@/db/schema";
import { and, desc, eq, or, sql, lt, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const router = Router();

// ========== 常量与校验 ==========
const MAX_CONTENT_LENGTH = 500;
const VALID_TYPES = ["text", "chip_request", "chip_response", "system"];
const VALID_STATUS = ["unread", "read", "processed"];
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// 内存级发送频率限制：同一用户 10 秒内最多 5 条
const rateLimitMap = new Map<number, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_COUNT = 5;

function checkRateLimit(userId: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= RATE_MAX_COUNT) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

// 清理过期的限流记录（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt < now) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ========== GET /api/messages?peerId=&beforeId=&limit= ==========
// 获取与某人的聊天记录，支持分页（beforeId 加载更早消息）
router.get("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const peerId = Number(req.query.peerId);
  if (!peerId || peerId <= 0) {
    res.status(400).json({ error: "缺少有效的 peerId 参数" });
    return;
  }
  if (peerId === u.id) {
    res.status(400).json({ error: "不能与自己聊天" });
    return;
  }
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
  let limit = Number(req.query.limit) || DEFAULT_PAGE_SIZE;
  limit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);

  const conditions = [
    or(
      and(eq(csMessages.senderId, u.id), eq(csMessages.receiverId, peerId)),
      and(eq(csMessages.senderId, peerId), eq(csMessages.receiverId, u.id))
    ),
  ];
  if (beforeId && beforeId > 0) {
    conditions.push(lt(csMessages.id, beforeId));
  }

  const messages = await db
    .select()
    .from(csMessages)
    .where(and(...conditions))
    .orderBy(desc(csMessages.id))
    .limit(limit);

  // 标记收到的消息为已读（只标记未读的）
  const unreadIds = messages
    .filter(m => m.receiverId === u.id && m.status === "unread")
    .map(m => m.id);
  if (unreadIds.length > 0) {
    await db
      .update(csMessages)
      .set({ status: "read" })
      .where(and(eq(csMessages.receiverId, u.id), sql`${csMessages.id} IN (${sql.join(unreadIds.map(id => sql`${id}`), sql`, `)})`));
  }

  // 按时间正序返回（最新在底部）
  const sorted = messages.reverse();
  const hasMore = messages.length >= limit;

  res.json({
    messages: sorted,
    hasMore,
    oldestId: sorted.length > 0 ? sorted[0].id : null,
  });
});

// ========== GET /api/messages/contacts ==========
// 联系人列表：单条 SQL 聚合查询，避免 N+1
router.get("/contacts", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }

  // 用一条 SQL 获取所有联系人及其未读数、最后消息
  const contacts = await db.execute(sql`
    WITH peer_ids AS (
      SELECT DISTINCT CASE WHEN sender_id = ${u.id} THEN receiver_id ELSE sender_id END AS peer_id
      FROM cs_messages
      WHERE sender_id = ${u.id} OR receiver_id = ${u.id}
    ),
    last_msgs AS (
      SELECT DISTINCT ON (peer_id)
        p.peer_id,
        m.id AS msg_id,
        m.content,
        m.created_at,
        m.type
      FROM peer_ids p
      JOIN cs_messages m ON (m.sender_id = p.peer_id AND m.receiver_id = ${u.id})
                         OR (m.receiver_id = p.peer_id AND m.sender_id = ${u.id})
      ORDER BY p.peer_id, m.id DESC
    ),
    unread_counts AS (
      SELECT sender_id AS peer_id, COUNT(*) AS unread_count
      FROM cs_messages
      WHERE receiver_id = ${u.id} AND status = 'unread'
      GROUP BY sender_id
    )
    SELECT
      u.id, u.account, u.nickname, u.role, u.avatar,
      COALESCE(uc.unread_count, 0) AS unread_count,
      lm.content AS last_message,
      lm.created_at AS last_message_time,
      lm.type AS last_message_type
    FROM peer_ids p
    JOIN users u ON u.id = p.peer_id
    LEFT JOIN unread_counts uc ON uc.peer_id = p.peer_id
    LEFT JOIN last_msgs lm ON lm.peer_id = p.peer_id
    ORDER BY lm.created_at DESC NULLS LAST, u.id DESC
  `);

  const rows = contacts.rows || [];
  res.json({
    contacts: rows.map(r => ({
      id: r.id,
      account: r.account,
      nickname: r.nickname,
      role: r.role,
      avatar: r.avatar,
      unreadCount: Number(r.unread_count || 0),
      lastMessage: r.last_message || '',
      lastMessageTime: r.last_message_time || null,
      lastMessageType: r.last_message_type || 'text',
    })),
  });
});

// ========== GET /api/messages/unread-count ==========
router.get("/unread-count", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(csMessages)
    .where(and(eq(csMessages.receiverId, u.id), eq(csMessages.status, "unread")));
  res.json({ unreadCount: Number(result[0]?.count || 0) });
});

// ========== GET /api/messages/cs-list ==========
// 客服列表：优先返回有未读消息的客服，其次按最近活跃排序
router.get("/cs-list", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const csUsers = await db.execute(sql`
    SELECT
      u.id, u.account, u.nickname, u.avatar, u.role,
      COALESCE(uc.unread_count, 0) AS unread_count,
      lm.last_active
    FROM users u
    LEFT JOIN (
      SELECT sender_id, COUNT(*) AS unread_count
      FROM cs_messages
      WHERE receiver_id = ${u.id} AND status = 'unread' AND sender_role = 'customer_service'
      GROUP BY sender_id
    ) uc ON uc.sender_id = u.id
    LEFT JOIN (
      SELECT sender_id, MAX(created_at) AS last_active
      FROM cs_messages
      WHERE (sender_id = u.id AND receiver_role = 'customer_service')
         OR (receiver_id = u.id AND sender_role = 'customer_service')
      GROUP BY sender_id
    ) lm ON lm.sender_id = u.id
    WHERE u.role = 'customer_service'
    ORDER BY COALESCE(uc.unread_count, 0) DESC, lm.last_active DESC NULLS LAST, u.id ASC
  `);
  const rows = csUsers.rows || [];
  res.json({
    list: rows.map(r => ({
      id: r.id,
      account: r.account,
      nickname: r.nickname,
      avatar: r.avatar,
      role: r.role,
      unreadCount: Number(r.unread_count || 0),
    })),
  });
});

// ========== POST /api/messages ==========
// 发送消息：完整校验 + 限流
router.post("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const { receiverId, content, type, relatedData } = req.body;

  // 参数校验
  if (!receiverId || typeof receiverId !== "number" || receiverId <= 0) {
    res.status(400).json({ error: "缺少有效的 receiverId" });
    return;
  }
  if (receiverId === u.id) {
    res.status(400).json({ error: "不能给自己发送消息" });
    return;
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "消息内容不能为空" });
    return;
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    res.status(400).json({ error: `消息内容不能超过 ${MAX_CONTENT_LENGTH} 字` });
    return;
  }
  const msgType = type && VALID_TYPES.includes(type) ? type : "text";

  // 发送频率限制
  const rl = checkRateLimit(u.id);
  if (!rl.ok) {
    res.status(429).json({ error: `发送过于频繁，请 ${rl.retryAfter} 秒后再试`, retryAfter: rl.retryAfter });
    return;
  }

  // 冻结用户不能发送消息
  if (u.frozen) {
    res.status(403).json({ error: "账号已被冻结，无法发送消息" });
    return;
  }

  // 校验接收者存在
  const receiverRows = await db
    .select({ id: users.id, role: users.role, account: users.account })
    .from(users)
    .where(eq(users.id, receiverId))
    .limit(1);
  if (receiverRows.length === 0) {
    res.status(404).json({ error: "接收者不存在" });
    return;
  }
  const receiver = receiverRows[0];

  // relatedData 大小限制（10KB）
  let safeRelatedData = null;
  if (relatedData && typeof relatedData === "object") {
    const jsonStr = JSON.stringify(relatedData);
    if (jsonStr.length > 10 * 1024) {
      res.status(400).json({ error: "关联数据过大" });
      return;
    }
    safeRelatedData = relatedData;
  }

  try {
    const inserted = await db.insert(csMessages).values({
      senderId: u.id,
      senderRole: u.role,
      receiverId: receiver.id,
      receiverRole: receiver.role,
      content: content.trim().slice(0, MAX_CONTENT_LENGTH),
      type: msgType,
      relatedData: safeRelatedData,
    }).returning();

    res.json({ message: inserted[0] });
  } catch (e) {
    console.error("[messages] 发送消息失败", e);
    res.status(500).json({ error: "发送失败，请稍后重试" });
  }
});

// ========== POST /api/messages/read ==========
// 批量标记与某人的对话为已读
router.post("/read", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const { peerId } = req.body;
  if (!peerId || typeof peerId !== "number") {
    res.status(400).json({ error: "缺少 peerId" });
    return;
  }
  const result = await db
    .update(csMessages)
    .set({ status: "read" })
    .where(and(
      eq(csMessages.receiverId, u.id),
      eq(csMessages.senderId, peerId),
      eq(csMessages.status, "unread")
    ))
    .returning({ id: csMessages.id });

  res.json({ updated: result.length });
});

// ========== POST /api/messages/:id/process ==========
// 标记筹码申请为已处理（客服专用）
router.post("/:id/process", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (!["customer_service", "admin"].includes(u.role)) {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const msgId = Number(req.params.id);
  if (!msgId || msgId <= 0) {
    res.status(400).json({ error: "无效的消息ID" });
    return;
  }
  const result = await db
    .update(csMessages)
    .set({ status: "processed" })
    .where(and(eq(csMessages.id, msgId), eq(csMessages.type, "chip_request")))
    .returning({ id: csMessages.id });

  if (result.length === 0) {
    res.status(404).json({ error: "消息不存在或不是筹码申请" });
    return;
  }
  res.json({ ok: true });
});



// ========== GET /api/messages/assign-cs ==========
// 自动分配客服：优先在线、会话数最少的客服
router.get("/assign-cs", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  // 获取所有客服及其当前活跃会话数（最近24小时有消息的对话数）
  const csList = await db.execute(sql`
    WITH cs_users AS (
      SELECT id, account, nickname, avatar, last_login_at
      FROM users
      WHERE role = 'customer_service' AND frozen = false
    ),
    session_counts AS (
      SELECT
        cu.id,
        COUNT(DISTINCT CASE WHEN m.created_at > NOW() - INTERVAL '24 hours'
          THEN CASE WHEN m.sender_id = cu.id THEN m.receiver_id ELSE m.sender_id END
        END) AS session_count_24h,
        MAX(m.created_at) AS last_msg_time
      FROM cs_users cu
      LEFT JOIN cs_messages m ON (m.sender_id = cu.id OR m.receiver_id = cu.id)
      GROUP BY cu.id
    )
    SELECT
      cu.id, cu.account, cu.nickname, cu.avatar,
      COALESCE(sc.session_count_24h, 0) AS session_count,
      cu.last_login_at > NOW() - INTERVAL '2 hours' AS is_online,
      sc.last_msg_time
    FROM cs_users cu
    LEFT JOIN session_counts sc ON sc.id = cu.id
    ORDER BY is_online DESC, session_count ASC, cu.id ASC
    LIMIT 10
  `);
  const rows = csList.rows || [];
  if (rows.length === 0) {
    res.status(404).json({ error: "暂无可用客服" });
    return;
  }
  // 返回最优客服（第一个：在线且会话最少）
  const best = rows[0];
  res.json({
    cs: {
      id: best.id,
      account: best.account,
      nickname: best.nickname,
      avatar: best.avatar,
      isOnline: best.is_online,
      sessionCount: Number(best.session_count || 0),
    },
    available: rows.length,
  });
});

// ========== POST /api/messages/transfer ==========
// 客服转接会话：将与某用户的对话转接给另一个客服
router.post("/transfer", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (!["customer_service", "admin"].includes(u.role)) {
    res.status(403).json({ error: "无权限" });
    return;
  }
  const { userId, targetCsId, reason } = req.body;
  if (!userId || !targetCsId) {
    res.status(400).json({ error: "缺少 userId 或 targetCsId" });
    return;
  }
  if (targetCsId === u.id) {
    res.status(400).json({ error: "不能转接给自己" });
    return;
  }
  // 校验目标客服存在
  const targetRows = await db.select({ id: users.id, account: users.account, nickname: users.nickname })
    .from(users).where(and(eq(users.id, targetCsId), eq(users.role, "customer_service"))).limit(1);
  if (targetRows.length === 0) {
    res.status(404).json({ error: "目标客服不存在" });
    return;
  }
  const target = targetRows[0];

  // 发送系统消息通知用户已转接
  const systemMsg = await db.insert(csMessages).values({
    senderId: u.id,
    senderRole: u.role,
    receiverId: userId,
    receiverRole: "player",
    content: `客服已将您的对话转接给 ${target.nickname || target.account}，请稍候...`,
    type: "system",
    status: "unread",
    relatedData: { transferFrom: u.id, transferTo: targetCsId, reason: reason || "" },
  }).returning();

  // 发送系统消息通知目标客服
  await db.insert(csMessages).values({
    senderId: u.id,
    senderRole: u.role,
    receiverId: targetCsId,
    receiverRole: "customer_service",
    content: `客服 ${u.nickname || u.account} 将用户 #${userId} 的对话转接给您${reason ? "，原因：" + reason : ""}`,
    type: "system",
    status: "unread",
    relatedData: { transferFrom: u.id, transferTo: targetCsId, userId, reason: reason || "" },
  });

  res.json({ ok: true, message: systemMsg[0] });
});

// ========== GET /api/admin/messages ==========
// 管理员查询所有客服聊天记录（支持筛选+分页）
router.get("/admin/messages", async (req: Request, res: Response) => {
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

  // 总数
  const countResult = await db.execute(sql`SELECT COUNT(*) AS total FROM cs_messages m ${whereClause}`);
  const total = Number(countResult.rows?.[0]?.total || 0);

  // 分页查询，关联发送者和接收者信息
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
router.get("/admin/messages/stats", async (req: Request, res: Response) => {
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


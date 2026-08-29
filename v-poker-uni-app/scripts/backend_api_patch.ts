// ============================================
// V-Poker 后端API补齐补丁
// 添加缺失的agent和admin路由
// ============================================

// ========== agent.routes.ts 补齐 ==========

// GET /api/agent/players/:userId - 获取玩家详情
router.get("/players/:userId", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  
  try {
    const userId = parseInt(req.params.userId);
    const scoped = await scopeIds(u);
    if (scoped && !scoped.includes(userId)) {
      res.status(403).json({ error: "无权查看该玩家" });
      return;
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

// GET /api/agent/history - 代理历史记录（兼容前端，返回筹码流水）
router.get("/history", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  
  try {
    const scoped = await scopeIds(u);
    let query = db.select().from(chipTransactions).orderBy(desc(chipTransactions.createdAt)).limit(100);
    if (scoped) {
      query = db.select().from(chipTransactions).where(inArray(chipTransactions.userId, scoped)).orderBy(desc(chipTransactions.createdAt)).limit(100);
    }
    const records = await query;
    res.json({ records });
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
    
    // 统计总流水
    const allTx = await db.select().from(chipTransactions).where(inArray(chipTransactions.userId, userIds));
    const totalIn = allTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = allTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    
    // 统计分配记录
    const distributions = await db.select().from(distributionRecords).where(inArray(distributionRecords.agentId, userIds));
    const totalCommission = distributions.reduce((s, d) => s + (d.amount || 0), 0);
    
    res.json({
      balance: u.points,
      totalIn,
      totalOut,
      totalCommission,
      transactionCount: allTx.length,
      distributionCount: distributions.length,
    });
  } catch (e) {
    console.error("[agent] 获取账本失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// GET /api/agent/credit-transactions - 信用分交易记录（V3已弃用信用分，返回空数组兼容）
router.get("/credit-transactions", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (!AGENT_ROLES.includes(u.role)) { res.status(403).json({ error: "无权限" }); return; }
  res.json({ records: [], message: "V3版本已弃用信用分，改为筹码门槛制" });
});

// ========== admin.routes.ts 补齐 ==========

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
    await audit(u.id, "admin_update_user", { userId, ...updateData });
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
    const limit = parseInt(req.query.limit as string) || 100;
    // 从chipTransactions和其他表中提取操作记录作为审计日志
    const logs = await db.select().from(chipTransactions).orderBy(desc(chipTransactions.createdAt)).limit(limit);
    res.json({ logs: logs.map(l => ({ id: l.id, userId: l.userId, type: l.type, amount: l.amount, note: l.note, createdAt: l.createdAt })) });
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
    const totalBalance = allUsers.reduce((s, u) => s + (u.points || 0), 0);
    
    res.json({
      totalIn,
      totalOut,
      totalBalance,
      transactionCount: allTx.length,
      userCount: allUsers.length,
    });
  } catch (e) {
    console.error("[admin] 获取平台账本失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

// POST /api/admin/cs-operations - 客服操作记录（新增）
router.post("/cs-operations", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) { res.status(401).json({ error: "未登录" }); return; }
  if (u.role !== "admin" && u.role !== "customer_service") { res.status(403).json({ error: "无权限" }); return; }
  
  try {
    const { userId, action, note, amount } = req.body;
    // 记录到chipTransactions（如果是筹码操作）
    if (amount && userId) {
      await db.insert(chipTransactions).values({
        userId,
        type: action === "add" ? "cs_add" : "cs_sub",
        amount: action === "add" ? Math.abs(amount) : -Math.abs(amount),
        balanceAfter: 0, // 需要更新
        operatorId: u.id,
        note: note || "",
      });
    }
    await audit(u.id, "cs_operation", { userId, action, note, amount });
    res.json({ ok: true });
  } catch (e) {
    console.error("[admin] 客服操作记录失败", e);
    res.status(500).json({ error: "服务器错误" });
  }
});

console.log("✅ 后端API补齐补丁已加载");

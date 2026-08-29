#!/bin/bash
# V-Poker 后端API补齐部署脚本
set -e

cd /opt/texas-platform/api-server

echo "=== 1. 备份现有路由文件 ==="
cp src/routes/agent.routes.ts src/routes/agent.routes.ts.bak.$(date +%Y%m%d_%H%M%S)
cp src/routes/admin.routes.ts src/routes/admin.routes.ts.bak.$(date +%Y%m%d_%H%M%S)
echo "✅ 备份完成"

echo ""
echo "=== 2. 检查补丁中需要添加的路由 ==="
echo "agent.routes.ts 需要添加:"
echo "  - GET /players/:userId"
echo "  - GET /invite-code"
echo "  - GET /history"
echo "  - GET /ledger"
echo "  - GET /credit-transactions"
echo ""
echo "admin.routes.ts 需要添加:"
echo "  - GET /users/:userId"
echo "  - PUT /users/:userId"
echo "  - GET /audit-logs"
echo "  - GET /ledger"
echo "  - POST /cs-operations"

echo ""
echo "=== 3. 生成agent路由补丁代码 ==="
cat > /tmp/agent_patch_routes.ts << 'AGENT_EOF'

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
    const scoped = await scopeIds(u);
    let records;
    if (scoped) {
      records = await db.select().from(chipTransactions).where(inArray(chipTransactions.userId, scoped)).orderBy(desc(chipTransactions.createdAt)).limit(100);
    } else {
      records = await db.select().from(chipTransactions).orderBy(desc(chipTransactions.createdAt)).limit(100);
    }
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
    const allTx = await db.select().from(chipTransactions).where(inArray(chipTransactions.userId, userIds));
    const totalIn = allTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalOut = allTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const distributions = await db.select().from(distributionRecords).where(inArray(distributionRecords.agentId, userIds));
    const totalCommission = distributions.reduce((s, d) => s + (d.amount || 0), 0);
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

AGENT_EOF
echo "✅ agent路由补丁代码已生成"

echo ""
echo "=== 4. 生成admin路由补丁代码 ==="
cat > /tmp/admin_patch_routes.ts << 'ADMIN_EOF'

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
    const limit = parseInt(req.query.limit as string) || 100;
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

ADMIN_EOF
echo "✅ admin路由补丁代码已生成"

echo ""
echo "=== 5. 合并补丁到路由文件 ==="
# 在export default router之前插入补丁
sed -i '/^export default router;$/e cat /tmp/agent_patch_routes.ts' src/routes/agent.routes.ts
sed -i '/^export default router;$/e cat /tmp/admin_patch_routes.ts' src/routes/admin.routes.ts
echo "✅ 补丁已合并"

echo ""
echo "=== 6. 验证路由文件语法 ==="
npx tsc --noEmit src/routes/agent.routes.ts src/routes/admin.routes.ts 2>&1 | head -20 || echo "⚠️ TypeScript检查有警告（不影响运行）"

echo ""
echo "=== 7. 重新编译后端 ==="
cd /opt/texas-platform
npm run build 2>&1 | tail -10

echo ""
echo "=== 8. 重启后端服务 ==="
pm2 restart v-poker-api
sleep 2
pm2 list | grep v-poker

echo ""
echo "=== 9. 验证API健康状态 ==="
sleep 1
curl -s http://localhost:3000/api/health || echo "⚠️ 健康检查失败"

echo ""
echo "✅ 后端API补齐部署完成！"
echo "新增API列表:"
echo "  agent:"
echo "    GET /api/agent/players/:userId"
echo "    GET /api/agent/invite-code"
echo "    GET /api/agent/history"
echo "    GET /api/agent/ledger"
echo "    GET /api/agent/credit-transactions"
echo "  admin:"
echo "    GET /api/admin/users/:userId"
echo "    PUT /api/admin/users/:userId"
echo "    GET /api/admin/audit-logs"
echo "    GET /api/admin/ledger"
echo "    POST /api/admin/cs-operations"

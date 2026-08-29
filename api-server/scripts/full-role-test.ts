/**
 * V-Poker 全角色全功能 API 联调测试
 * 按角色分级测试，每个角色测所有核心接口
 */
import "dotenv/config";

const BASE = "http://localhost:3001";
const results: { role: string; name: string; pass: boolean; detail: string }[] = [];

function log(role: string, name: string, pass: boolean, detail = "") {
  results.push({ role, name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} [${role}] ${name}${detail ? " — " + detail : ""}`);
}

async function req(path: string, opts: any = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(account: string, password: string, deviceId: string) {
  const r = await req("/api/auth/login", {
    method: "POST",
    body: { account, password },
    headers: { "x-device-id": deviceId },
  });
  return r.data.token;
}

function auth(token: string, deviceId: string) {
  return { Authorization: `Bearer ${token}`, "x-device-id": deviceId };
}

// ==================== 1. 管理员 ====================
async function testAdmin() {
  console.log("\n========== 1. 管理员(admin) ==========");
  const token = await login("admin", "admin123", "test_admin");
  log("管理员", "登录", !!token);
  if (!token) return;

  // 概览统计
  const stats = await req("/api/admin/stats", { headers: auth(token, "test_admin") });
  log("管理员", "概览统计", stats.status === 200, `status=${stats.status}`);

  // 用户管理 - 列表
  const users = await req("/api/admin/users?page=1&pageSize=10", { headers: auth(token, "test_admin") });
  log("管理员", "用户列表", users.status === 200, `count=${users.data?.items?.length || users.data?.list?.length || users.data?.users?.length || "?"}`);

  // 用户管理 - 搜索
  const search = await req("/api/admin/users?search=player", { headers: auth(token, "test_admin") });
  log("管理员", "用户搜索", search.status === 200);

  // 用户管理 - 详情(含邀请码)
  const userDetail = await req("/api/admin/users/4", { headers: auth(token, "test_admin") });
  const hasInvite = !!(userDetail.data?.inviteCode || userDetail.data?.invite_code || userDetail.data?.user?.inviteCode);
  log("管理员", "用户详情(邀请码)", userDetail.status === 200, `inviteCode=${hasInvite ? "有" : "无"}`);

  // 房间管理 - 列表
  const rooms = await req("/api/admin/rooms?page=1&pageSize=10", { headers: auth(token, "test_admin") });
  log("管理员", "房间列表", rooms.status === 200, `status=${rooms.status}`);

  // 代理管理 - 列表
  const agents = await req("/api/admin/agents?page=1&pageSize=10", { headers: auth(token, "test_admin") });
  log("管理员", "代理列表", agents.status === 200, `status=${agents.status}`);

  // 财务流水
  const ledger = await req("/api/admin/ledger?page=1&pageSize=10", { headers: auth(token, "test_admin") });
  log("管理员", "财务流水", ledger.status === 200, `status=${ledger.status}`);

  // 审计日志
  const audit = await req("/api/admin/audit?page=1&pageSize=10", { headers: auth(token, "test_admin") });
  log("管理员", "审计日志", audit.status === 200, `status=${audit.status}`);

  // 客服管理
  const cs = await req("/api/admin/cs-staff", { headers: auth(token, "test_admin") });
  log("管理员", "客服管理", cs.status === 200, `status=${cs.status}`);

  // 经济配置
  const economy = await req("/api/admin/economy/config", { headers: auth(token, "test_admin") });
  log("管理员", "经济配置", economy.status === 200, `games=${economy.data?.games?.length || economy.data?.configs?.length || "?"}`);
}

// ==================== 2. 总代理 ====================
async function testTopAgent() {
  console.log("\n========== 2. 总代理(top_agent) ==========");
  const token = await login("topagent", "topagent123", "test_topagent");
  log("总代理", "登录", !!token);
  if (!token) return;

  // 推广数据
  const promo = await req("/api/agent/promotion", { headers: auth(token, "test_topagent") });
  log("总代理", "推广数据", promo.status === 200, `status=${promo.status}`);

  // 下线玩家列表
  const players = await req("/api/agent/players?page=1&pageSize=10", { headers: auth(token, "test_topagent") });
  log("总代理", "下线玩家列表", players.status === 200, `count=${players.data?.items?.length || players.data?.list?.length || "?"}`);

  // 邀请码
  const invite = await req("/api/agent/invite-code", { headers: auth(token, "test_topagent") });
  log("总代理", "邀请码", invite.status === 200, `code=${invite.data?.inviteCode || invite.data?.code || "?"}`);

  // 筹码交易记录
  const txs = await req("/api/agent/chip-transactions?page=1&pageSize=10", { headers: auth(token, "test_topagent") });
  log("总代理", "筹码交易记录", txs.status === 200, `status=${txs.status}`);

  // 账本
  const ledger = await req("/api/agent/ledger?page=1&pageSize=10", { headers: auth(token, "test_topagent") });
  log("总代理", "代理账本", ledger.status === 200, `status=${ledger.status}`);

  // 创建房间
  const create = await req("/api/rooms/create", {
    method: "POST",
    body: { gameType: "jinhua", level: "junior", initialPoints: 500, password: "123456" },
    headers: auth(token, "test_topagent"),
  });
  log("总代理", "创建房间", create.status === 200, `roomId=${create.data?.room?.id || "?"}`);
}

// ==================== 3. 一级代理 ====================
async function testAgent() {
  console.log("\n========== 3. 一级代理(agent) ==========");
  const token = await login("agent01", "agent123", "test_agent01");
  log("一级代理", "登录", !!token);
  if (!token) return;

  // 我的房间列表
  const mine = await req("/api/rooms/mine", { headers: auth(token, "test_agent01") });
  log("一级代理", "我的房间列表", mine.status === 200, `count=${mine.data?.items?.length || mine.data?.list?.length || "?"}`);

  // 房间模板
  const tpls = await req("/api/rooms/templates/jinhua", { headers: auth(token, "test_agent01") });
  log("一级代理", "房间模板", tpls.status === 200, `count=${Array.isArray(tpls.data) ? tpls.data.length : tpls.data?.templates?.length || "?"}`);

  // 创建房间
  const create = await req("/api/rooms/create", {
    method: "POST",
    body: { gameType: "jinhua", level: "junior", initialPoints: 500, password: "123456" },
    headers: auth(token, "test_agent01"),
  });
  const roomId = create.data?.room?.id;
  log("一级代理", "创建房间", create.status === 200, `roomId=${roomId}`);

  if (roomId) {
    // 房间详情
    const detail = await req(`/api/rooms/${roomId}`, { headers: auth(token, "test_agent01") });
    log("一级代理", "房间详情", detail.status === 200, `status=${detail.data?.room?.status || detail.data?.status}`);

    // 下线玩家列表
    const players = await req("/api/agent/players?page=1&pageSize=10", { headers: auth(token, "test_agent01") });
    log("一级代理", "下线玩家列表", players.status === 200, `count=${players.data?.items?.length || players.data?.list?.length || "?"}`);

    // 邀请码
    const invite = await req("/api/agent/invite-code", { headers: auth(token, "test_agent01") });
    log("一级代理", "邀请码", invite.status === 200, `code=${invite.data?.inviteCode || invite.data?.code || "?"}`);

    // 筹码交易记录
    const txs = await req("/api/agent/chip-transactions?page=1&pageSize=10", { headers: auth(token, "test_agent01") });
    log("一级代理", "筹码交易记录", txs.status === 200);
  }

  return roomId;
}

// ==================== 4. 玩家 ====================
async function testPlayer(roomId: number) {
  console.log("\n========== 4. 玩家(player) ==========");

  // 先注册新玩家（用代理邀请码）
  const agentToken = await login("agent01", "agent123", "test_agent_invite");
  const inviteRes = await req("/api/agent/invite-code", { headers: auth(agentToken, "test_agent_invite") });
  const inviteCode = inviteRes.data?.inviteCode || inviteRes.data?.code || "AGX1OU1H";
  log("玩家", "获取代理邀请码", !!inviteCode, `code=${inviteCode}`);

  const testAccount = `testplayer_${Date.now() % 100000}`;
  const reg = await req("/api/auth/register", {
    method: "POST",
    body: { account: testAccount, password: "player123", confirmPassword: "player123", nickname: "测试玩家", securityCode: "888888", inviteCode },
  });
  const playerToken = reg.data?.token;
  log("玩家", "注册(邀请码)", reg.status === 200, `account=${testAccount}, status=${reg.status}`);

  if (!playerToken) {
    // 注册失败就用已有账号
    const fallback = await login("player01", "player123", "test_player01");
    log("玩家", "登录(已有账号)", !!fallback);
    if (!fallback) return;
    return testPlayerFlow(fallback, roomId, "player01");
  }

  await testPlayerFlow(playerToken, roomId, testAccount);
}

async function testPlayerFlow(token: string, roomId: number, account: string) {
  // 个人信息
  const me = await req("/api/auth/me", { headers: auth(token, `test_${account}`) });
  log("玩家", "个人信息", me.status === 200, `role=${me.data?.user?.role || me.data?.role}`);

  // 钱包
  const wallet = await req("/api/wallet/balance", { headers: auth(token, `test_${account}`) });
  log("玩家", "钱包余额", wallet.status === 200, `status=${wallet.status}`);

  if (roomId) {
    // 获取房间号
    const agentToken = await login("agent01", "agent123", "test_agent_join");
    const roomDetail = await req(`/api/rooms/${roomId}`, { headers: auth(agentToken, "test_agent_join") });
    const roomNo = roomDetail.data?.room?.roomNo || roomDetail.data?.roomNo;

    if (roomNo) {
      // 加入房间
      const join = await req("/api/rooms/join", {
        method: "POST",
        body: { roomNo, password: "123456", spectate: false },
        headers: auth(token, `test_${account}`),
      });
      log("玩家", "加入房间", join.status === 200, `status=${join.status}, seatType=${join.data?.seatType}`);

      // 准备
      const ready = await req(`/api/rooms/${roomId}/ready`, {
        method: "POST",
        headers: auth(token, `test_${account}`),
      });
      log("玩家", "准备", ready.status === 200, `status=${ready.status}`);

      // 房间状态
      const state = await req(`/api/rooms/${roomId}`, { headers: auth(token, `test_${account}`) });
      log("玩家", "房间状态", state.status === 200, `players=${state.data?.room?.currentPlayers || state.data?.currentPlayers || "?"}`);
    }
  }

  // 游戏历史
  const history = await req("/api/profile/game-history?page=1&pageSize=10", { headers: auth(token, `test_${account}`) });
  log("玩家", "游戏历史", history.status === 200, `status=${history.status}`);
}

// ==================== 5. 客服 ====================
async function testCustomerService() {
  console.log("\n========== 5. 客服(customer_service) ==========");
  const token = await login("cs01", "cs123456", "test_cs01");
  log("客服", "登录", !!token, token ? "" : "(可能无测试账号)");
  if (!token) return;

  // 客服工作台
  const dashboard = await req("/api/cs/dashboard", { headers: auth(token, "test_cs01") });
  log("客服", "工作台数据", dashboard.status === 200, `status=${dashboard.status}`);

  // 会话列表
  const sessions = await req("/api/cs/sessions?page=1&pageSize=10", { headers: auth(token, "test_cs01") });
  log("客服", "会话列表", sessions.status === 200, `status=${sessions.status}`);
}

// ==================== 主流程 ====================
async function main() {
  console.log("========== V-Poker 全角色全功能联调测试 ==========\n");

  try { await testAdmin(); } catch (e: any) { log("管理员", "异常", false, e.message); }
  try { await testTopAgent(); } catch (e: any) { log("总代理", "异常", false, e.message); }
  let roomId: number | undefined;
  try { roomId = await testAgent(); } catch (e: any) { log("一级代理", "异常", false, e.message); }
  try { await testPlayer(roomId || 0); } catch (e: any) { log("玩家", "异常", false, e.message); }
  try { await testCustomerService(); } catch (e: any) { log("客服", "异常", false, e.message); }

  // 汇总
  console.log("\n========== 测试汇总 ==========");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`通过: ${passed} / ${results.length}`);
  console.log(`失败: ${failed.length}`);
  if (failed.length > 0) {
    console.log("\n失败项:");
    failed.forEach((r) => console.log(`  ❌ [${r.role}] ${r.name} — ${r.detail}`));
  }

  // 按角色统计
  console.log("\n按角色统计:");
  const roles = [...new Set(results.map((r) => r.role))];
  roles.forEach((role) => {
    const roleResults = results.filter((r) => r.role === role);
    const p = roleResults.filter((r) => r.pass).length;
    console.log(`  ${role}: ${p}/${roleResults.length}`);
  });

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("测试执行失败:", e.message);
  process.exit(1);
});

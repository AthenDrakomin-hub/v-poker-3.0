/**
 * V-Poker 全角色全功能 API 联调测试 v2
 * 修正所有API路径和测试账号
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

function getList(data: any): any[] {
  return data?.items || data?.list || data?.users || data?.rooms || data?.records || data?.data || (Array.isArray(data) ? data : []);
}

// ==================== 1. 管理员 ====================
async function testAdmin() {
  console.log("\n========== 1. 管理员(admin) ==========");
  const token = await login("admin", "admin123", "test_admin");
  log("管理员", "登录", !!token);
  if (!token) return;

  const tests = [
    ["概览统计", "/api/admin/stats"],
    ["用户列表", "/api/admin/users?page=1&pageSize=10"],
    ["用户搜索", "/api/admin/users?q=player"],
    ["用户详情", "/api/admin/users/4"],
    ["房间列表", "/api/admin/rooms?page=1&pageSize=10"],
    ["代理树", "/api/admin/agents/tree"],
    ["财务流水", "/api/admin/ledger?page=1&pageSize=10"],
    ["审计日志", "/api/admin/audit-logs?page=1&pageSize=10"],
    ["客服管理", "/api/admin/cs-staff"],
    ["经济配置", "/api/admin/config"],
    ["登录日志", "/api/admin/login-logs?page=1&pageSize=10"],
    ["权限列表", "/api/admin/permissions"],
  ];

  for (const [name, path] of tests) {
    const r = await req(path, { headers: auth(token, "test_admin") });
    const count = getList(r.data).length;
    log("管理员", name, r.status === 200, `status=${r.status}${count ? `, count=${count}` : ""}`);
  }

  // 调账测试
  const adjust = await req("/api/admin/adjust-points", {
    method: "POST",
    body: { userId: 4, amount: 100, reason: "联调测试" },
    headers: auth(token, "test_admin"),
  });
  log("管理员", "调账(上分)", adjust.status === 200, `status=${adjust.status}`);
}

// ==================== 2. 总代理 ====================
async function testTopAgent() {
  console.log("\n========== 2. 总代理(top_agent) ==========");
  const token = await login("topagent", "agent123", "test_topagent");
  log("总代理", "登录", !!token);
  if (!token) return;

  const tests = [
    ["推广数据", "/api/agent/promotion"],
    ["下线玩家", "/api/agent/players?page=1&pageSize=10"],
    ["邀请码", "/api/agent/invite-code"],
    ["筹码交易", "/api/agent/chip-transactions?page=1&pageSize=10"],
    ["代理账本", "/api/agent/ledger?page=1&pageSize=10"],
    ["分配明细", "/api/agent/distribution-records?page=1&pageSize=10"],
    ["我的房间", "/api/rooms/mine"],
  ];

  for (const [name, path] of tests) {
    const r = await req(path, { headers: auth(token, "test_topagent") });
    const count = getList(r.data).length;
    log("总代理", name, r.status === 200, `status=${r.status}${count ? `, count=${count}` : ""}`);
  }

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

  const tests = [
    ["我的房间", "/api/rooms/mine"],
    ["房间模板", "/api/rooms/templates/jinhua"],
    ["下线玩家", "/api/agent/players?page=1&pageSize=10"],
    ["邀请码", "/api/agent/invite-code"],
    ["筹码交易", "/api/agent/chip-transactions?page=1&pageSize=10"],
    ["代理账本", "/api/agent/ledger?page=1&pageSize=10"],
  ];

  for (const [name, path] of tests) {
    const r = await req(path, { headers: auth(token, "test_agent01") });
    const count = getList(r.data).length;
    log("一级代理", name, r.status === 200, `status=${r.status}${count ? `, count=${count}` : ""}`);
  }

  // 创建房间
  const create = await req("/api/rooms/create", {
    method: "POST",
    body: { gameType: "jinhua", level: "junior", initialPoints: 500, password: "123456" },
    headers: auth(token, "test_agent01"),
  });
  const roomId = create.data?.room?.id;
  const roomNo = create.data?.room?.roomNo;
  log("一级代理", "创建房间", create.status === 200, `roomId=${roomId}, roomNo=${roomNo}`);

  if (roomId) {
    const detail = await req(`/api/rooms/${roomId}`, { headers: auth(token, "test_agent01") });
    log("一级代理", "房间详情", detail.status === 200, `status=${detail.data?.room?.status || detail.data?.status}`);
  }

  return { roomId, roomNo };
}

// ==================== 4. 玩家 ====================
async function testPlayer(roomInfo: { roomId?: number; roomNo?: string }) {
  console.log("\n========== 4. 玩家(player) ==========");

  // 用已有玩家账号测试
  const token = await login("player01", "player123", "test_player01");
  log("玩家", "登录", !!token);
  if (!token) return;

  const tests = [
    ["个人信息", "/api/profile/"],
    ["钱包余额", "/api/wallet/"],
    ["钱包交易", "/api/wallet/transactions?page=1&pageSize=10"],
    ["游戏历史", "/api/profile/room-history?page=1&pageSize=10"],
    ["未读消息", "/api/messages/unread-count"],
    ["消息列表", "/api/messages/?page=1&pageSize=10"],
  ];

  for (const [name, path] of tests) {
    const r = await req(path, { headers: auth(token, "test_player01") });
    log("玩家", name, r.status === 200, `status=${r.status}`);
  }

  // 加入房间测试
  if (roomInfo.roomNo) {
    const join = await req("/api/rooms/join", {
      method: "POST",
      body: { roomNo: roomInfo.roomNo, password: "123456", spectate: false },
      headers: auth(token, "test_player01"),
    });
    log("玩家", "加入房间", join.status === 200, `status=${join.status}, seatType=${join.data?.seatType || "player"}`);

    if (join.status === 200 && roomInfo.roomId) {
      const ready = await req(`/api/rooms/${roomInfo.roomId}/ready`, {
        method: "POST",
        headers: auth(token, "test_player01"),
      });
      log("玩家", "准备", ready.status === 200, `status=${ready.status}`);

      const state = await req(`/api/rooms/${roomInfo.roomId}`, { headers: auth(token, "test_player01") });
      log("玩家", "房间状态", state.status === 200, `status=${state.data?.room?.status || state.data?.status}`);
    }
  }
}

// ==================== 5. 客服 ====================
async function testCustomerService() {
  console.log("\n========== 5. 客服(customer_service) ==========");
  // seed里没有客服账号，用管理员创建一个
  const adminToken = await login("admin", "admin123", "test_admin_cs");
  if (!adminToken) {
    log("客服", "创建客服账号(前置)", false, "管理员登录失败");
    return;
  }

  // 检查是否已有客服账号
  const csList = await req("/api/admin/cs-staff", { headers: auth(adminToken, "test_admin_cs") });
  const csStaff = getList(csList.data);
  log("客服", "客服列表", csList.status === 200, `count=${csStaff.length}`);

  if (csStaff.length > 0) {
    const csAccount = csStaff[0]?.account || "cs01";
    const token = await login(csAccount, "cs123456", "test_cs01");
    log("客服", "登录", !!token, `account=${csAccount}`);
    if (token) {
      const conv = await req("/api/messages/cs-list", { headers: auth(token, "test_cs01") });
      log("客服", "会话列表", conv.status === 200, `status=${conv.status}`);
    }
  } else {
    log("客服", "登录", false, "无客服测试账号(seed未创建)，需管理员在后台添加");
  }
}

// ==================== 主流程 ====================
async function main() {
  console.log("========== V-Poker 全角色全功能联调测试 v2 ==========\n");

  try { await testAdmin(); } catch (e: any) { log("管理员", "异常", false, e.message); }
  try { await testTopAgent(); } catch (e: any) { log("总代理", "异常", false, e.message); }
  let roomInfo: { roomId?: number; roomNo?: string } = {};
  try { roomInfo = await testAgent() || {}; } catch (e: any) { log("一级代理", "异常", false, e.message); }
  try { await testPlayer(roomInfo); } catch (e: any) { log("玩家", "异常", false, e.message); }
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

  console.log("\n按角色统计:");
  const roles = [...new Set(results.map((r) => r.role))];
  roles.forEach((role) => {
    const rr = results.filter((r) => r.role === role);
    const p = rr.filter((r) => r.pass).length;
    console.log(`  ${role}: ${p}/${rr.length}`);
  });

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("测试执行失败:", e.message);
  process.exit(1);
});

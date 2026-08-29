/**
 * V-Poker 联调测试脚本 - 认证与角色权限
 * 运行：npx tsx scripts/integration-test.ts
 */
import "dotenv/config";

const BASE = "http://localhost:3001";
const results: { name: string; pass: boolean; detail: string }[] = [];

function log(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
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
  return req("/api/auth/login", {
    method: "POST",
    body: { account, password },
    headers: { "x-device-id": deviceId },
  });
}

async function main() {
  console.log("========== V-Poker 联调测试 ==========\n");

  // ── 1. 环境确认 ──
  console.log("【1. 环境确认】");
  const health = await req("/api/health");
  log("健康检查", health.status === 200 && health.data.ok, `status=${health.status}`);

  // ── 2. 认证链路 ──
  console.log("\n【2. 认证链路】");
  const adminLogin = await login("admin", "admin123", "test_admin_dev");
  log("管理员登录", adminLogin.status === 200 && !!adminLogin.data.token, `status=${adminLogin.status}`);
  const adminToken = adminLogin.data.token;

  const topAgentLogin = await login("topagent", "agent123", "test_topagent_dev");
  log("总代理登录", topAgentLogin.status === 200 && !!topAgentLogin.data.token, `status=${topAgentLogin.status}`);
  const topAgentToken = topAgentLogin.data.token;

  const agentLogin = await login("agent01", "agent123", "test_agent_dev");
  log("代理登录", agentLogin.status === 200 && !!agentLogin.data.token, `status=${agentLogin.status}`);
  const agentToken = agentLogin.data.token;

  const playerLogin = await login("player01", "player123", "test_player_dev");
  log("玩家登录", playerLogin.status === 200 && !!playerLogin.data.token, `status=${playerLogin.status}`);
  const playerToken = playerLogin.data.token;

  // 错误密码
  const wrongLogin = await login("admin", "wrongpass", "test_wrong");
  log("错误密码拒绝", wrongLogin.status === 401, `status=${wrongLogin.status}`);

  // Token 鉴权
  const profile = await req("/api/profile", { headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" } });
  log("Token鉴权-获取个人信息", profile.status === 200, `status=${profile.status}, role=${profile.data?.user?.role || profile.data?.role}`);

  // 无Token
  const noToken = await req("/api/profile");
  log("无Token拒绝", noToken.status === 401, `status=${noToken.status}`);

  // 错误Token
  const badToken = await req("/api/profile", { headers: { Authorization: "Bearer invalid.token.here" } });
  log("无效Token拒绝", badToken.status === 401, `status=${badToken.status}`);

  // ── 3. 角色权限 ──
  console.log("\n【3. 角色权限】");
  // 管理员访问经济配置
  const adminEcon = await req("/api/admin/economy-v2/games", { headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" } });
  log("管理员→经济配置", adminEcon.status === 200, `status=${adminEcon.status}, games=${adminEcon.data?.games?.length}`);

  // 代理访问经济配置（应拒绝）
  const agentEcon = await req("/api/admin/economy-v2/games", { headers: { Authorization: `Bearer ${agentToken}`, "x-device-id": "test_agent_dev" } });
  log("代理→经济配置(应403)", agentEcon.status === 403 || agentEcon.status === 401, `status=${agentEcon.status}`);

  // 玩家访问经济配置（应拒绝）
  const playerEcon = await req("/api/admin/economy-v2/games", { headers: { Authorization: `Bearer ${playerToken}`, "x-device-id": "test_player_dev" } });
  log("玩家→经济配置(应403)", playerEcon.status === 403 || playerEcon.status === 401, `status=${playerEcon.status}`);

  // ── 4. 房间生命周期 ──
  console.log("\n【4. 房间生命周期】");
  // 代理创建房间
  const createRoom = await req("/api/rooms/create", {
    method: "POST",
    body: { gameType: "jinhua", level: "junior", initialPoints: 500, password: "123456" },
    headers: { Authorization: `Bearer ${agentToken}`, "x-device-id": "test_agent_dev" },
  });
  log("代理创建房间", createRoom.status === 200, `status=${createRoom.status}, roomId=${createRoom.data?.room?.id}`);
  const roomId = createRoom.data?.room?.id;
  const roomNo = createRoom.data?.room?.roomNo;

  // 玩家加入房间（用房号）
  const joinRoom = await req("/api/rooms/join", {
    method: "POST",
    body: { roomNo, password: "123456" },
    headers: { Authorization: `Bearer ${playerToken}`, "x-device-id": "test_player_dev" },
  });
  log("玩家加入房间", joinRoom.status === 200, `status=${joinRoom.status}`);

  // 获取房间状态
  const roomState = await req(`/api/rooms/${roomId}`, {
    headers: { Authorization: `Bearer ${playerToken}`, "x-device-id": "test_player_dev" },
  });
  log("获取房间状态", roomState.status === 200, `status=${roomState.status}, players=${roomState.data?.players?.length}`);

  // 玩家准备
  const ready = await req(`/api/rooms/${roomId}/ready`, {
    method: "POST",
    body: { ready: true },
    headers: { Authorization: `Bearer ${playerToken}`, "x-device-id": "test_player_dev" },
  });
  log("玩家准备", ready.status === 200, `status=${ready.status}`);

  // ── 5. 经济配置读写 ──
  console.log("\n【5. 经济配置】");
  const games = await req("/api/admin/economy-v2/games", { headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" } });
  log("读取游戏经济配置", games.status === 200 && games.data?.games?.length === 5, `count=${games.data?.games?.length}`);

  const templates = await req("/api/admin/economy-v2/templates", { headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" } });
  log("读取房间模板", templates.status === 200 && templates.data?.templates?.length === 15, `count=${templates.data?.templates?.length}`);

  // 更新游戏配置
  const texasGame = games.data?.games?.find((g: any) => g.gameType === "texas");
  if (texasGame) {
    const updateGame = await req(`/api/admin/economy-v2/games/texas`, {
      method: "PUT",
      body: { rakeRate: 0.03, rakeBaseType: "flow", rakeCap: 0, minRakePot: 0, agentRebateRate: 0.01, topAgentRebateRate: 0.01, reason: "联调测试" },
      headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" },
    });
    log("更新游戏经济配置", updateGame.status === 200, `status=${updateGame.status}`);
  }

  // 配置历史
  const history = await req("/api/admin/economy-v2/history?limit=5", { headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" } });
  log("配置修改历史", history.status === 200, `status=${history.status}, count=${history.data?.history?.length}`);

  // 刷新缓存
  const reload = await req("/api/admin/economy-v2/reload", { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "x-device-id": "test_admin_dev" } });
  log("刷新经济配置缓存", reload.status === 200, `status=${reload.status}`);

  // ── 6. 钱包/上下分 ──
  console.log("\n【6. 钱包系统】");
  const wallet = await req("/api/wallet", { headers: { Authorization: `Bearer ${playerToken}`, "x-device-id": "test_player_dev" } });
  log("玩家钱包余额", wallet.status === 200, `status=${wallet.status}, points=${wallet.data?.points || wallet.data?.user?.points}`);

  // ── 7. 消息系统 ──
  console.log("\n【7. 消息系统】");
  const unread = await req("/api/messages/unread-count", { headers: { Authorization: `Bearer ${playerToken}`, "x-device-id": "test_player_dev" } });
  log("未读消息数", unread.status === 200, `status=${unread.status}, count=${unread.data?.unreadCount}`);

  // ── 汇总 ──
  console.log("\n========== 测试汇总 ==========");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`通过: ${passed} / ${results.length}`);
  console.log(`失败: ${failed}`);
  if (failed > 0) {
    console.log("\n失败项:");
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ❌ ${r.name} — ${r.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("测试执行失败:", e.message);
  process.exit(1);
});

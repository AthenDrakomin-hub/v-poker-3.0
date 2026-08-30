/**
 * V-POKER 2.0 端对端功能测试
 * 测试所有API接口是否正常
 */

const BASE = "https://goodspage.cn/api";
let adminToken = "";
let agentToken = "";
let playerToken = "";
let roomId = 0;

async function req(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}

function pass(name) { console.log(`  ✅ ${name}`); }
function fail(name, err) { console.log(`  ❌ ${name}: ${err}`); }
function section(name) { console.log(`\n=== ${name} ===`); }

async function main() {
  console.log("V-POKER 2.0 端对端功能测试");
  console.log(`API: ${BASE}`);
  console.log(`时间: ${new Date().toLocaleString()}`);

  // 1. 基础
  section("1. 基础接口");
  try {
    const r = await req("/health");
    if (r.ok && r.data.ok) pass("健康检查"); else fail("健康检查", JSON.stringify(r.data));
  } catch (e) { fail("健康检查", e.message); }

  // 2. 认证
  section("2. 认证接口");
  try {
    const r = await req("/auth/login", { method: "POST", body: JSON.stringify({ account: "fengye", password: "weinisivpoker" }) });
    if (r.ok && r.data.token) { adminToken = r.data.token; pass("管理员登录"); }
    else fail("管理员登录", JSON.stringify(r.data));
  } catch (e) { fail("管理员登录", e.message); }

  try {
    const r = await req("/auth/me", { token: adminToken });
    if (r.ok && r.data.user) pass("获取当前用户"); else fail("获取当前用户", JSON.stringify(r.data));
  } catch (e) { fail("获取当前用户", e.message); }

  // 3. 管理后台
  section("3. 管理后台接口");
  try {
    const r = await req("/admin/users", { token: adminToken });
    if (r.ok && Array.isArray(r.data.users)) pass(`用户列表 (${r.data.users.length}人)`);
    else fail("用户列表", JSON.stringify(r.data));
  } catch (e) { fail("用户列表", e.message); }

  try {
    const r = await req("/admin/ledger", { token: adminToken });
    if (r.ok && r.data.summary) {
      const s = r.data.summary;
      pass(`对账明细 (扣费:${s.deduct} 返佣:${s.commission} 客服入:${s.csIn} 客服出:${s.csOut})`);
    } else fail("对账明细", JSON.stringify(r.data));
  } catch (e) { fail("对账明细", e.message); }

  try {
    const r = await req("/admin/stats", { token: adminToken });
    if (r.ok && r.data.totalUsers !== undefined) {
      pass(`平台统计 (用户:${r.data.totalUsers} 房间:${r.data.totalRooms} 流水:${r.data.totalFlow} 抽水:${r.data.totalRake})`);
    } else fail("平台统计", JSON.stringify(r.data));
  } catch (e) { fail("平台统计", e.message); }

  try {
    const r = await req("/admin/config", { token: adminToken });
    if (r.ok && r.data.config) {
      const c = r.data.config;
      pass(`系统配置 (抽水:${c.platform_rake_rate}% 扣信用:${c.agent_deduct_rate}% 代理返佣:${c.agent_commission_rate}% 总代返佣:${c.top_agent_commission_rate}%)`);
    } else fail("系统配置", JSON.stringify(r.data));
  } catch (e) { fail("系统配置", e.message); }

  // 4. 代理相关
  section("4. 代理接口");
  try {
    const r = await req("/rooms/mine", { token: adminToken });
    if (r.ok && Array.isArray(r.data.rooms)) pass(`我的房间 (${r.data.rooms.length}间)`);
    else fail("我的房间", JSON.stringify(r.data));
  } catch (e) { fail("我的房间", e.message); }

  try {
    const r = await req("/agent/players", { token: adminToken });
    if (r.ok) pass(`我的玩家 (${r.data.players?.length || 0}人)`);
    else fail("我的玩家", JSON.stringify(r.data));
  } catch (e) { fail("我的玩家", e.message); }

  try {
    const r = await req("/agent/promotion", { token: adminToken });
    if (r.ok) pass("推广数据");
    else fail("推广数据", JSON.stringify(r.data));
  } catch (e) { fail("推广数据", e.message); }

  // 5. 个人资料
  section("5. 个人资料接口");
  try {
    const r = await req("/profile", { token: adminToken });
    if (r.ok && r.data.user) {
      pass(`个人资料 (设备:${r.data.devices?.length || 0}台 筹码:${r.data.user.points})`);
    } else fail("个人资料", JSON.stringify(r.data));
  } catch (e) { fail("个人资料", e.message); }

  // 6. 房间创建与游戏流程（用管理员账号测试，管理员强制观众）
  section("6. 房间流程测试");
  try {
    const r = await req("/rooms/create", {
      method: "POST",
      token: adminToken,
      body: JSON.stringify({ gameType: "niuniu", level: "junior", password: "1234" }),
    });
    if (r.ok && r.data.room) {
      roomId = r.data.room.id;
      pass(`创建房间 (#${r.data.room.roomNo})`);
    } else fail("创建房间", JSON.stringify(r.data));
  } catch (e) { fail("创建房间", e.message); }

  if (roomId) {
    try {
      const r = await req(`/rooms/${roomId}`, { token: adminToken });
      if (r.ok && r.data.room) pass(`房间详情 (#${r.data.room.roomNo})`);
      else fail("房间详情", JSON.stringify(r.data));
    } catch (e) { fail("房间详情", e.message); }

    try {
      const r = await req(`/rooms/${roomId}/chat`, { token: adminToken });
      if (r.ok) pass(`聊天记录 (${r.data.messages?.length || 0}条)`);
      else fail("聊天记录", JSON.stringify(r.data));
    } catch (e) { fail("聊天记录", e.message); }

    // 管理员加入房间应该是观众身份
    try {
      const r = await req("/rooms/join", {
        method: "POST",
        token: adminToken,
        body: JSON.stringify({ roomNo: String(roomId), password: "1234" }),
      });
      if (r.ok && r.data.seatType === "spectator") pass("管理员加入房间（观众身份）");
      else if (r.ok) fail("管理员加入房间", `身份错误: ${r.data.seatType}`);
      else fail("管理员加入房间", JSON.stringify(r.data));
    } catch (e) { fail("管理员加入房间", e.message); }
  }

  // 7. 素材
  section("7. 素材接口");
  try {
    const r = await req("/assets");
    if (r.ok && Array.isArray(r.data.assets)) pass(`素材列表 (${r.data.assets.length}个)`);
    else fail("素材列表", JSON.stringify(r.data));
  } catch (e) { fail("素材列表", e.message); }

  // 8. 历史
  section("8. 历史清理");
  try {
    const r = await req("/history/cleanup", { token: adminToken });
    if (r.ok) pass("历史清理统计");
    else fail("历史清理统计", JSON.stringify(r.data));
  } catch (e) { fail("历史清理统计", e.message); }

  console.log("\n=== 测试完成 ===");
}

main().catch(console.error);

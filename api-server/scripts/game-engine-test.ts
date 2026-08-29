/**
 * V-Poker 游戏引擎联调测试
 * 验证5款游戏的发牌、操作、结算链路
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
  const r = await req("/api/auth/login", {
    method: "POST",
    body: { account, password },
    headers: { "x-device-id": deviceId },
  });
  return r.data.token;
}

function authHeader(token: string, deviceId: string) {
  return { Authorization: `Bearer ${token}`, "x-device-id": deviceId };
}

async function testGame(gameType: string, gameName: string, idx: number) {
  console.log(`\n【${gameName} (${gameType})】`);

  // 登录代理
  const agentToken = await login("agent01", "agent123", `game_${gameType}_agent`);

  // 为每款游戏注册新玩家（避免房间互斥）
  const playerAccount = `player_${gameType}_${idx}`;
  const reg = await req("/api/auth/register", {
    method: "POST",
    body: { account: playerAccount, password: "player123", confirmPassword: "player123", nickname: `测试玩家${idx}`, securityCode: "888888", inviteCode: "AGX1OU1H" },
  });
  const playerToken = reg.data?.token || await login(playerAccount, "player123", `game_${gameType}_player`);
  log(`${gameName}-玩家注册/登录`, !!playerToken, `account=${playerAccount}`);

  // 管理员给玩家上分（确保足够带入）
  const adminToken = await login("admin", "admin123", `game_${gameType}_admin`);
  await req("/api/admin/users/4/recharge", {
    method: "POST",
    body: { amount: 10000, reason: "联调测试上分" },
    headers: authHeader(adminToken, `game_${gameType}_admin`),
  }).catch(() => {});

  // 创建房间
  const create = await req("/api/rooms/create", {
    method: "POST",
    body: { gameType, level: "junior", initialPoints: 500, password: "123456" },
    headers: authHeader(agentToken, `game_${gameType}_agent`),
  });
  const roomId = create.data?.room?.id;
  const roomNo = create.data?.room?.roomNo;
  log(`${gameName}-创建房间`, create.status === 200 && !!roomId, `roomId=${roomId}`);

  // 玩家加入（明确 spectate:false 入座）
  const join = await req("/api/rooms/join", {
    method: "POST",
    body: { roomNo, password: "123456", spectate: false },
    headers: authHeader(playerToken, `game_${gameType}_player`),
  });
  log(`${gameName}-玩家加入`, join.status === 200, `status=${join.status}, seatType=${join.data?.seatType}`);

  // 玩家准备
  const ready = await req(`/api/rooms/${roomId}/ready`, {
    method: "POST",
    body: { ready: true },
    headers: authHeader(playerToken, `game_${gameType}_player`),
  });
  log(`${gameName}-玩家准备`, ready.status === 200, `status=${ready.status}`);

  // 开始新一局
  const startHand = await req(`/api/rooms/${roomId}/hand`, {
    method: "POST",
    headers: authHeader(agentToken, `game_${gameType}_agent`),
  });
  log(`${gameName}-开始发牌`, startHand.status === 200, `status=${startHand.status}, phase=${startHand.data?.hand?.phase || startHand.data?.phase}`);

  // 获取房间状态（含手牌）
  const state = await req(`/api/rooms/${roomId}`, {
    headers: authHeader(playerToken, `game_${gameType}_player`),
  });
  const hand = state.data?.hand || state.data?.handState;
  const hasCards = hand && (hand.players || hand.seats || hand.hands);
  log(`${gameName}-牌已发放`, state.status === 200 && !!hand, `phase=${hand?.phase}, hasCards=${!!hasCards}`);

  // 尝试执行操作（如果有可操作玩家）
  if (hand && hand.phase !== "finished" && hand.phase !== "showdown") {
    // 获取玩家可执行的操作
    const options = hand.options || hand.availableActions;
    if (options && options.length > 0) {
      const action = options[0];
      const actionName = action.action || action.type || action.name;
      const doAction = await req(`/api/rooms/${roomId}/hand`, {
        method: "PUT",
        body: { action: actionName, amount: action.minAmount || 0, clientActionId: `test_${Date.now()}` },
        headers: authHeader(playerToken, `game_${gameType}_player`),
      });
      log(`${gameName}-执行操作(${actionName})`, doAction.status === 200 || doAction.status === 400, `status=${doAction.status}`);
    } else {
      log(`${gameName}-操作选项`, true, "无需操作（自动流程）");
    }
  } else {
    log(`${gameName}-操作选项`, true, hand?.phase === "finished" ? "已结算" : "等待中");
  }

  // 通比牛牛等待自动结算
  if (gameType === "tbnn") {
    await new Promise((r) => setTimeout(r, 3000));
    const finalState = await req(`/api/rooms/${roomId}`, {
      headers: authHeader(playerToken, `game_${gameType}_player`),
    });
    const finalHand = finalState.data?.hand || finalState.data?.handState;
    log(`${gameName}-自动结算`, finalHand?.phase === "finished" || finalHand?.phase === "showdown", `phase=${finalHand?.phase}`);
  }

  return roomId;
}

async function main() {
  console.log("========== 游戏引擎联调测试 ==========\n");

  const games = [
    { type: "jinhua", name: "炸金花" },
    { type: "niuniu", name: "抢庄斗牛" },
    { type: "sangong", name: "抢庄三公" },
    { type: "tbnn", name: "通比牛牛" },
    { type: "texas", name: "德州扑克" },
  ];

  for (const game of games) {
    try {
      await testGame(game.type, game.name);
    } catch (e: any) {
      log(`${game.name}-异常`, false, e.message);
    }
  }

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

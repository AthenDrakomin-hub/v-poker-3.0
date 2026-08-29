/**
 * 机器人陪玩服务
 *
 * 功能：
 * 1. 机器人账号池管理（自动创建/获取机器人账号）
 * 2. 机器人加入房间并自动准备
 * 3. 机器人AI决策（支持全部5款游戏）
 * 4. 机器人自动行动定时器（每2秒检查轮到机器人的房间）
 *
 * 机器人AI策略：
 * - 抢庄牛牛(niuniu)：抢庄阶段随机，下注阶段根据牌型倍数决定
 * - 抢庄三公(sangong)：同牛牛
 * - 通比牛牛(tbnn)：根据牌型决定下注
 * - 炸金花(jinhua)：根据牌型强度决定跟注/加注/弃牌/比牌
 * - 德州扑克(texas)：根据手牌强度决定跟注/加注/弃牌
 */
import { db } from "@/db";
import { users, roomPlayers, rooms, handStates } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { HandState, applyAction, optionsFor } from "@/lib/hand";
import { loadState, saveState } from "@/lib/roomState";
import { commitHand } from "@/lib/settle";
import { broadcastStateChanged } from "@/socket/roomSocket";
import { processingRooms } from "@/lib/roomLock";
import { hashPassword } from "@/lib/auth";

// 机器人账号前缀
const BOT_PREFIX = "bot_";
// 机器人池大小
const BOT_POOL_SIZE = 30;
// 机器人初始筹码
const BOT_INITIAL_POINTS = 50000;
// 机器人行动间隔（毫秒）
const BOT_ACTION_INTERVAL = 2000;
// 机器人思考延迟（毫秒）- 模拟人类思考
const BOT_THINK_DELAY = 800;

// 机器人昵称池
const BOT_NICKNAMES = [
  "幸运星", "同花顺", "豹子头", "赌神", "老千",
  "新手村", "稳赢", "一把梭", "佛系玩家", "夜猫子",
];

let botTimer: NodeJS.Timeout | null = null;
const activeBotRooms = new Set<number>();

/**
 * 确保机器人账号池存在
 */
export async function ensureBotPool(): Promise<void> {
  for (let i = 1; i <= BOT_POOL_SIZE; i++) {
    const account = `${BOT_PREFIX}${String(i).padStart(2, "0")}`;
    const existing = await db.select().from(users).where(eq(users.account, account)).limit(1);
    if (existing.length === 0) {
      const hashedPwd = await hashPassword("bot123456");
      const inviteCode = `BOT${Date.now().toString(36).toUpperCase().slice(-6)}${i}`;
      await db.insert(users).values({
        account,
        password: hashedPwd,
        securityCode: hashedPwd,
        role: "player",
        nickname: BOT_NICKNAMES[i - 1] || `机器人${i}`,
        avatar: String((i % 10) + 1),
        inviteCode,
        points: BOT_INITIAL_POINTS,
        settings: { sound: false, music: false, vibrate: false },
      });
      console.log(`[BotService] 创建机器人账号: ${account}`);
    }
  }
}

/**
 * 获取可用的机器人账号（不在任何未结束房间的）
 */
export async function getAvailableBots(count: number = 1): Promise<typeof users.$inferSelect[]> {
  // 获取所有机器人
  const botAccounts = Array.from({ length: BOT_POOL_SIZE }, (_, i) => `${BOT_PREFIX}${String(i + 1).padStart(2, "0")}`);
  const bots = await db.select().from(users).where(inArray(users.account, botAccounts));

  // 获取所有在未结束房间（waiting/playing/waiting_continue/paused）的玩家
  const activeRoomPlayers = await db
    .select({ userId: roomPlayers.userId })
    .from(roomPlayers)
    .innerJoin(rooms, eq(roomPlayers.roomId, rooms.id))
    .where(and(
      eq(roomPlayers.isSpectator, false),
      inArray(rooms.status, ["waiting", "playing", "waiting_continue", "paused"])
    ));

  const activeUserIds = new Set(activeRoomPlayers.map((p) => p.userId));
  const available = bots.filter((b) => !activeUserIds.has(b.id) && !b.frozen);
  return available.slice(0, count);
}

/**
 * 添加机器人到房间
 */
export async function addBotToRoom(roomId: number, hostUserId: number): Promise<{ ok: boolean; bot?: typeof users.$inferSelect; error?: string }> {
  // 验证房间
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) return { ok: false, error: "房间不存在" };
  const room = roomRows[0];
  if (room.agentId !== hostUserId) return { ok: false, error: "只有房主可添加机器人" };
  if (room.status === "finished") return { ok: false, error: "房间已结束" };

  // 获取可用机器人
  const available = await getAvailableBots(1);
  if (available.length === 0) return { ok: false, error: "暂无可用机器人" };
  const bot = available[0];

  // 检查房间人数
  const currentPlayers = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.isSpectator, false)));
  if (currentPlayers.length >= room.maxSeats) return { ok: false, error: "房间已满" };

  // 计算带入筹码（取房间初始筹码的50%）
  const bringIn = Math.min(bot.points, Math.floor(room.initialPoints * 0.5));
  if (bringIn <= 0) return { ok: false, error: "机器人筹码不足" };

  // 事务：扣除机器人钱包筹码 + 加入房间 + 自动准备
  await db.transaction(async (tx) => {
    const botNext = bot.points - bringIn;
    await tx.update(users).set({ points: botNext }).where(eq(users.id, bot.id));

    await tx.insert(roomPlayers).values({
      roomId,
      userId: bot.id,
      seat: currentPlayers.length + 1,
      points: bringIn,
      isSpectator: false,
      ready: true, // 机器人自动准备
      autoPlay: true, // 开启自动玩
    });
  });

  // 标记该房间有机器人
  activeBotRooms.add(roomId);

  // 启动机器人定时器（如果未启动）
  startBotTimer();

  broadcastStateChanged(roomId);
  console.log(`[BotService] 机器人 ${bot.account}(${bot.nickname}) 加入房间 ${room.roomNo}，带入 ${bringIn} 筹码`);
  return { ok: true, bot };
}

/**
 * 从房间移除机器人
 */
export async function removeBotFromRoom(roomId: number, botUserId: number, hostUserId: number): Promise<{ ok: boolean; error?: string }> {
  const roomRows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!roomRows.length) return { ok: false, error: "房间不存在" };
  if (roomRows[0].agentId !== hostUserId) return { ok: false, error: "只有房主可移除机器人" };

  const rpRows = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, botUserId))).limit(1);
  if (!rpRows.length) return { ok: false, error: "机器人不在房间" };

  const rp = rpRows[0];
  const bot = (await db.select().from(users).where(eq(users.id, botUserId)).limit(1))[0];
  if (!bot) return { ok: false, error: "机器人不存在" };

  // 退还筹码
  await db.transaction(async (tx) => {
    if (rp.points > 0) {
      await tx.update(users).set({ points: bot.points + rp.points }).where(eq(users.id, botUserId));
    }
    await tx.delete(roomPlayers).where(eq(roomPlayers.id, rp.id));
  });

  broadcastStateChanged(roomId);
  console.log(`[BotService] 机器人 ${bot.account} 离开房间 ${roomRows[0].roomNo}`);
  return { ok: true };
}

/**
 * 获取房间内机器人列表
 */
export async function getRoomBots(roomId: number): Promise<typeof users.$inferSelect[]> {
  const botAccounts = Array.from({ length: BOT_POOL_SIZE }, (_, i) => `${BOT_PREFIX}${String(i + 1).padStart(2, "0")}`);
  const bots = await db.select().from(users).where(inArray(users.account, botAccounts));
  const botIds = new Set(bots.map((b) => b.id));

  const rps = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.isSpectator, false)));
  return bots.filter((b) => rps.some((rp) => rp.userId === b.id));
}

// ==================== 机器人AI决策 ====================

/**
 * 评估炸金花牌型强度（0-100）
 */
function evaluateJinhuaStrength(cards: any[]): number {
  if (!cards || cards.length < 3) return 30;
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isSameSuit = suits.every((s) => s === suits[0]);
  const isStraight = ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1;
  const isTriple = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2];

  if (isTriple) return 95; // 豹子
  if (isSameSuit && isStraight) return 90; // 顺金
  if (isSameSuit) return 70; // 金花
  if (isStraight) return 60; // 顺子
  if (isPair) return 45 + ranks[0] * 2; // 对子
  return 20 + ranks[0]; // 高牌
}

/**
 * 评估德州扑克手牌强度（0-100，简化版）
 */
function evaluateTexasStrength(holeCards: any[], community: any[]): number {
  const allCards = [...(holeCards || []), ...(community || [])];
  if (allCards.length < 2) return 30;
  const ranks = allCards.map((c) => c.rank).sort((a, b) => b - a);
  const highCard = ranks[0] || 0;
  const pair = ranks.filter((r, i) => ranks.indexOf(r) !== i).length > 0;
  if (allCards.length >= 5) return 50 + highCard; // 有公共牌，中等强度
  if (pair) return 55 + highCard;
  if (highCard >= 12) return 50; // 高牌A/K
  return 25 + highCard;
}

/**
 * 评估牛牛/三公牌型倍数
 */
function evaluateNiuMultiplier(cards: any[]): number {
  if (!cards || cards.length < 5) return 1;
  // 简化：根据点数判断倍数
  const ranks = cards.map((c) => Math.min(c.rank, 10));
  const total = ranks.reduce((a, b) => a + b, 0);
  const niu = total % 10;
  if (niu === 0) return 3; // 牛牛
  if (niu >= 7) return 2; // 牛七以上
  return 1;
}

/**
 * 机器人AI决策：根据当前状态选择动作
 */
function botDecideAction(st: HandState, userId: number): { action: string; amount?: number } {
  const seat = st.seats.find((s) => s.userId === userId);
  if (!seat) return { action: "fold" };

  const options = optionsFor(st, userId);
  if (options.length === 0) return { action: "fold" };

  // 抢庄阶段：随机掷骰
  if (st.phase === "grab") {
    return { action: "roll" };
  }

  // 亮牌阶段
  if (st.phase === "dealt") {
    if (st.gameType === "niuniu" || st.gameType === "sangong") return { action: "confirm" };
    return { action: "reveal" };
  }

  // 下注阶段
  if (st.phase === "betting" || st.phase === "preflop" || st.phase === "flop" || st.phase === "turn" || st.phase === "river") {
    switch (st.gameType) {
      case "niuniu":
      case "sangong": {
        const mult = evaluateNiuMultiplier(seat.cards);
        const betOptions = options.filter((o) => o.action === "bet");
        if (betOptions.length > 0) {
          // 根据倍数选择下注额
          const idx = Math.min(mult - 1, betOptions.length - 1);
          return { action: "bet", amount: betOptions[Math.max(0, idx)].amount };
        }
        return { action: "confirm_bet" };
      }
      case "tbnn": {
        const mult = evaluateNiuMultiplier(seat.cards);
        const betOptions = options.filter((o) => o.action === "bet");
        if (betOptions.length > 0) {
          const idx = Math.min(mult - 1, betOptions.length - 1);
          return { action: "bet", amount: betOptions[Math.max(0, idx)].amount };
        }
        return { action: "reveal" };
      }
      case "jinhua": {
        const strength = evaluateJinhuaStrength(seat.cards);
        const callOption = options.find((o) => o.action === "call");
        const raiseOption = options.find((o) => o.action === "raise");
        const compareOption = options.find((o) => o.action === "compare");
        const foldOption = options.find((o) => o.action === "fold");

        if (strength >= 80) {
          // 强牌：加注或比牌
          if (compareOption && Math.random() > 0.5) return { action: "compare", amount: compareOption.amount };
          if (raiseOption) return { action: "raise", amount: raiseOption.amount };
          if (callOption) return { action: "call" };
        } else if (strength >= 50) {
          // 中等牌：跟注
          if (callOption && seat.points >= (callOption.amount || 0)) return { action: "call" };
          if (raiseOption && Math.random() > 0.7) return { action: "raise", amount: raiseOption.amount };
        } else {
          // 弱牌：30%概率弃牌，70%跟注（诈唬）
          if (Math.random() < 0.3 && foldOption) return { action: "fold" };
          if (callOption && seat.points >= (callOption.amount || 0)) return { action: "call" };
          if (foldOption) return { action: "fold" };
        }
        if (callOption) return { action: "call" };
        return { action: "check" in options.map((o) => o.action) ? "check" : "fold" };
      }
      case "texas": {
        const strength = evaluateTexasStrength(seat.cards, st.community);
        const callOption = options.find((o) => o.action === "call");
        const raiseOption = options.find((o) => o.action === "raise");
        const checkOption = options.find((o) => o.action === "check");
        const foldOption = options.find((o) => o.action === "fold");

        if (strength >= 70) {
          if (raiseOption) return { action: "raise", amount: raiseOption.amount };
          if (callOption) return { action: "call" };
          if (checkOption) return { action: "check" };
        } else if (strength >= 40) {
          if (callOption && seat.points >= (callOption.amount || 0)) return { action: "call" };
          if (checkOption) return { action: "check" };
        } else {
          if (checkOption) return { action: "check" };
          if (Math.random() < 0.5 && foldOption) return { action: "fold" };
          if (callOption && seat.points >= (callOption.amount || 0)) return { action: "call" };
          if (foldOption) return { action: "fold" };
        }
        if (checkOption) return { action: "check" };
        return { action: "fold" };
      }
    }
  }

  // 默认：选择第一个可用动作
  return { action: options[0].action, amount: options[0].amount };
}

/**
 * 处理单个房间的机器人行动
 */
async function processRoomBots(roomId: number): Promise<void> {
  if (processingRooms.has(roomId)) return;
  processingRooms.add(roomId);
  try {
    const st = await loadState(roomId);
    if (!st || st.finished) {
      activeBotRooms.delete(roomId);
      return;
    }
    if (st.turn < 0) return;

    const currentSeat = st.seats[st.turn];
    if (!currentSeat) return;

    // 检查当前玩家是否是机器人
    const isBot = currentSeat.account?.startsWith(BOT_PREFIX);
    if (!isBot) return;

    // 检查是否刚行动过（避免重复）
    if (currentSeat.acted && st.phase !== "betting") return;

    // 模拟思考延迟
    await new Promise((r) => setTimeout(r, BOT_THINK_DELAY));

    // 重新加载状态（可能已被其他玩家改变）
    const freshSt = await loadState(roomId);
    if (!freshSt || freshSt.finished || freshSt.turn < 0) return;
    const freshSeat = freshSt.seats[freshSt.turn];
    if (!freshSeat || freshSeat.userId !== currentSeat.userId) return;

    // AI决策
    const decision = botDecideAction(freshSt, currentSeat.userId);
    console.log(`[BotAI] 房间${roomId} 机器人${freshSeat.account} 决策: ${decision.action}${decision.amount ? `(${decision.amount})` : ""}`);

    const result = applyAction(freshSt, currentSeat.userId, decision.action, decision.amount);
    if (result.ok) {
      // 牛牛/三公下注后需要确认
      if (decision.action === "bet" && (freshSt.gameType === "niuniu" || freshSt.gameType === "sangong" || freshSt.gameType === "tbnn")) {
        applyAction(freshSt, currentSeat.userId, "confirm_bet");
      }
      freshSt.lastActionTime = Date.now();
      freshSt.log.push(`🤖 ${freshSeat.account} 自动${decision.action === "fold" ? "弃牌" : decision.action === "call" ? "跟注" : decision.action === "raise" ? "加注" : decision.action === "check" ? "过牌" : decision.action === "bet" ? "下注" : decision.action === "roll" ? "掷骰" : decision.action === "reveal" ? "亮牌" : decision.action === "confirm" ? "确认" : decision.action}`);
      await saveState(roomId, freshSt);

      if (freshSt.finished) {
        await commitHand(roomId, freshSt);
      }
      broadcastStateChanged(roomId);
    } else {
      console.warn(`[BotAI] 房间${roomId} 机器人${freshSeat.account} 行动失败: ${result.error}`);
    }
  } catch (e) {
    console.error(`[BotAI] 房间${roomId} 处理错误:`, e);
  } finally {
    processingRooms.delete(roomId);
  }
}

/**
 * 机器人行动定时器
 */
function startBotTimer(): void {
  if (botTimer) return;
  botTimer = setInterval(async () => {
    for (const roomId of activeBotRooms) {
      await processRoomBots(roomId);
    }
  }, BOT_ACTION_INTERVAL);
  console.log("[BotService] 机器人行动定时器已启动");
}

/**
 * 停止机器人定时器
 */
export function stopBotTimer(): void {
  if (botTimer) {
    clearInterval(botTimer);
    botTimer = null;
    console.log("[BotService] 机器人行动定时器已停止");
  }
}

/**
 * 初始化机器人服务（服务启动时调用）
 */
export async function initBotService(): Promise<void> {
  await ensureBotPool();

  // 服务重启后，从数据库恢复有机器人的房间列表
  try {
    const botAccounts = Array.from({ length: BOT_POOL_SIZE }, (_, i) => `${BOT_PREFIX}${String(i + 1).padStart(2, "0")}`);
    const bots = await db.select().from(users).where(inArray(users.account, botAccounts));
    const botIds = new Set(bots.map((b) => b.id));

    const allActiveRps = await db
      .select({ roomId: roomPlayers.roomId, userId: roomPlayers.userId })
      .from(roomPlayers)
      .innerJoin(rooms, eq(roomPlayers.roomId, rooms.id))
      .where(and(
        eq(roomPlayers.isSpectator, false),
        inArray(rooms.status, ["waiting", "playing", "waiting_continue", "paused"])
      ));

    const roomsWithBots = new Set<number>();
    for (const rp of allActiveRps) {
      if (botIds.has(rp.userId)) {
        roomsWithBots.add(rp.roomId);
      }
    }
    for (const roomId of roomsWithBots) {
      activeBotRooms.add(roomId);
    }
    console.log(`[BotService] 恢复 ${roomsWithBots.size} 个有机器人的活跃房间`);
  } catch (e) {
    console.warn("[BotService] 恢复机器人房间列表失败:", e);
  }

  startBotTimer();
  console.log("[BotService] 机器人服务已初始化");
}

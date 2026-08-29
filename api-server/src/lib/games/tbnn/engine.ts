// Tbnn (通比牛牛) engine - fully independent
// 并行亮牌制：所有玩家可同时亮牌，无需轮流
// 自动挂机：engine 层实现，玩家开启 autoPlay 后自动开始/亮牌
import { HandState, ActionOption, GameEngine, Seat } from "../common/types";
import { GameError, ActionResult } from "../common/types";
import { freshDeck, shuffle, cardLabel, Card } from "../common/cards";
import { tbnnScore } from "./cards";
import { chipsFor, capFor } from "../../rooms";
import { getGameEconomy } from "@/lib/gameEconomy";

function putIn(st: HandState, idx: number, amt: number) {
  const s = st.seats[idx];
  const pay = Math.max(0, Math.min(amt, s.points));
  s.points -= pay;
  s.streetBet += pay;
  s.totalBet += pay;
  st.pot += pay;
  if (s.points === 0) s.allin = true;
}

function createTbnnHand(
  players: { userId: number; account: string; points: number }[],
  level: string,
  roundNo: number,
  dealer: number,
  fixedAnte: number = 0,
  opts?: { chips?: number[]; cap?: number; baseBet?: number }
): HandState {
  const deck = shuffle(freshDeck(true));
  const chips = opts?.chips?.length ? opts.chips : chipsFor(level);
  const cap = opts?.cap || capFor(level);
  const base = opts?.baseBet || chips[0];
  const anteAmt = fixedAnte > 0 ? fixedAnte : base;

  const seats: Seat[] = players.map((p) => ({
    userId: p.userId,
    account: p.account,
    cards: [] as Card[],
    points: p.points,
    streetBet: 0,
    totalBet: 0,
    folded: false,
    allin: false,
    acted: false,
    looked: false,
    diceRoll: null,
    autoPlay: false,
    revealed: false,
  }));

  const st: HandState = {
    gameType: "tbnn",
    roundNo,
    phase: "waiting_start",
    seats,
    deck,
    community: [],
    turn: -1,
    dealer,
    pot: 0,
    currentBet: 0,
    minRaise: base,
    baseBet: base,
    chips,
    cap,
    bankerIdx: null,
    log: [`通比牛牛开始：${seats.length}人局，每人底注 ${anteAmt}，请点击「开始」发牌`],
    actionLog: [],
    finished: false,
    result: null,
    lastActionTime: Date.now(),
    // 从 V2 配置读取抽水参数
    rakeRate: getGameEconomy("tbnn").rakeRate * 100,
    rakeBaseType: getGameEconomy("tbnn").rakeBaseType,
    fixedAnte: anteAmt,
    spec: {
      scoreOf: (cards) => {
        const result = tbnnScore(cards);
        return { ...result, mult: 1 };
      },
      canSeeCards: (seat, viewer, phase) => phase === "dealt" || phase === "showdown" || !seat.folded,
    },
  };

  return st;
}

import { calcHandRake, round2 } from "@/lib/economy";

function finalize(st: HandState, startStacks: Map<number, number>, pot: number) {
  const hands = [];
  let winnerUserId = st.seats[0].userId;
  let bestDelta = -Infinity;

  const playerData = st.seats.map((seat) => {
    const start = startStacks.get(seat.userId) ?? seat.points;
    const gross = seat.points - start;
    return { seat, start, gross, rake: 0 };
  });

  const grossFlow = playerData.reduce((sum, p) => sum + Math.max(0, p.gross), 0);
  const useFlowBase = st.rakeBaseType === "flow";
  let flow = useFlowBase ? grossFlow : pot;

  const rakeRate = Number.isFinite(st.rakeRate as number) ? (st.rakeRate as number) : 3;
  if (!Number.isFinite(st.rakeRate as number)) {
    console.warn(`[tbnn] rakeRate 无效 (${st.rakeRate})，回退默认 3%`);
  }
  const { totalRake: rawTotalRake } = calcHandRake(flow, rakeRate);
  const totalRake = Math.min(rawTotalRake, round2(grossFlow));
  const winners = playerData.filter(p => p.gross > 0);
  let allocatedRake = 0;

  for (let i = 0; i < playerData.length; i++) {
    const pd = playerData[i];
    if (pd.gross > 0 && totalRake > 0) {
      const winnerIdx = winners.indexOf(pd);
      const remaining = Math.max(0, round2(totalRake - allocatedRake));
      const grossCap = Math.floor(pd.gross * 100) / 100;
      if (winnerIdx === winners.length - 1) {
        pd.rake = Math.min(remaining, grossCap);
      } else {
        const proportional = round2(totalRake * pd.gross / flow);
        pd.rake = Math.min(proportional, remaining, grossCap);
        allocatedRake = round2(allocatedRake + pd.rake);
      }
      pd.seat.points = round2(pd.seat.points - pd.rake);
    }
    const delta = round2(pd.seat.points - pd.start);
    if (delta > bestDelta) {
      bestDelta = delta;
      winnerUserId = pd.seat.userId;
    }
    const sc = pd.seat.cards.length === 5 ? { ...tbnnScore(pd.seat.cards), mult: 1 } : { name: "未亮牌", mult: 1 };
    const actualBet = st.fixedAnte ?? st.baseBet ?? 0;
    hands.push({
      userId: pd.seat.userId,
      account: pd.seat.account,
      cards: pd.seat.cards.map(cardLabel),
      handName: pd.seat.folded ? "已弃牌" : sc.name,
      diceRoll: null,
      delta,
      gross: pd.gross,
      rake: pd.rake,
      mult: sc.mult,
      bet: actualBet,
      folded: pd.seat.folded,
    });
  }

  const actualTotalRake = round2(playerData.reduce((sum, p) => sum + p.rake, 0));

  st.result = {
    hands,
    winnerUserId,
    community: [],
    bankerUserId: null,
    pot,
    rake: actualTotalRake,
    flow,
  };
}

/**
 * 发牌：扣底注 + 发5张牌 + 所有牌公开
 * 通比牛牛改造：发牌即公开，无需玩家手动亮牌；开牌结算由后端延迟自动触发
 */
function dealCards(st: HandState) {
  const anteAmt = st.fixedAnte ?? st.baseBet;
  st.seats.forEach((s) => {
    if (!s.folded) {
      const pay = Math.min(anteAmt, s.points);
      s.points -= pay;
      s.totalBet += pay;
      st.pot += pay;
    }
  });
  st.log.push(`固定底注已扣：${st.seats.filter(s => !s.folded).length}人，每人 ${anteAmt}，底池 ${st.pot}`);
  st.seats.forEach((s) => {
    if (!s.folded) {
      for (let i = 0; i < 5; i++) s.cards.push(st.deck.pop()!);
    }
  });
  // 通比牛牛：发牌后所有玩家牌立即公开
  st.seats.forEach((s) => { s.acted = true; s.revealed = true; });
  st.phase = "dealt";
  st.turn = -1;
  st.log.push("发牌完成，所有玩家牌已公开，即将自动开牌");
  // 不立即结算，由后端 scheduleTbnnSettlement 延迟自动开牌
}

/**
 * 结算：所有玩家亮牌后比大小
 * 导出供后端延迟自动开牌调用
 */
export function settleHand(st: HandState) {
  st.phase = "showdown";
  st.turn = -1;
  st.finished = true;

  const startStacks = new Map<number, number>();
  st.seats.forEach((s) => startStacks.set(s.userId, s.points + s.totalBet));

  const activeSeats = st.seats.filter((s) => !s.folded && s.cards.length === 5);
  if (activeSeats.length === 0) {
    st.log.push("无有效玩家，本局流局");
    st.seats.forEach((s) => { s.points += s.totalBet; });
    st.pot = 0;
    // st.result 由 finalize 统一设置，此处不重复赋值
    finalize(st, new Map(), 0);
    return;
  }

  if (activeSeats.length === 1) {
    const winner = activeSeats[0];
    const pot = st.pot;
    winner.points += pot;
    st.pot = 0;
    st.log.push(`${winner.account} 独赢底池`);
    finalize(st, startStacks, pot);
    return;
  }

  const scored = activeSeats.map((s) => ({
    seat: s,
    score: tbnnScore(s.cards),
  }));

  const maxScore = Math.max(...scored.map((x) => x.score.score));
  const topWinners = scored.filter((x) => x.score.score === maxScore);
  topWinners.sort((a, b) => {
    const maxA = Math.max(...a.seat.cards.map(c => c.rank));
    const maxB = Math.max(...b.seat.cards.map(c => c.rank));
    if (maxA !== maxB) return maxB - maxA;
    const suitW = (s: string) => (s === "S" ? 3 : s === "H" ? 2 : s === "C" ? 1 : 0);
    const suitA = Math.max(...a.seat.cards.filter(c => c.rank === maxA).map(c => suitW(c.suit)));
    const suitB = Math.max(...b.seat.cards.filter(c => c.rank === maxB).map(c => suitW(c.suit)));
    if (suitA !== suitB) return suitB - suitA;
    return a.seat.userId - b.seat.userId;
  });

  const winnerSeat = topWinners[0].seat;
  const pot = st.pot;
  winnerSeat.points += pot;
  st.pot = 0;
  st.log.push(`开牌结算：${winnerSeat.account}「${topWinners[0].score.name}」赢走底池 ${pot}`);
  finalize(st, startStacks, pot);
}

/**
 * 自动挂机处理：遍历所有 autoPlay=true 的玩家，自动执行当前阶段的操作
 * 通比牛牛改造：仅 waiting_start 阶段自动开始，发牌后由后端延迟自动开牌
 */
export function triggerAutoPlay(st: HandState) {
  if (st.finished) return;
  let changed = true;
  let guard = 0;
  while (changed && guard < 20) {
    changed = false;
    guard++;

    if (st.phase === "waiting_start") {
      const autoPlayers = st.seats.filter(s => s.autoPlay && !s.folded && !s.acted);
      for (const p of autoPlayers) {
        p.acted = true;
        st.log.push(`🤖 ${p.account} 自动开始`);
        changed = true;
      }
      const allStarted = st.seats.every((s) => s.acted || s.folded);
      if (allStarted && st.phase === "waiting_start") {
        dealCards(st);
        changed = true;
      }
    }
    // dealt 阶段无挂机逻辑：发牌后由后端 scheduleTbnnSettlement 延迟自动开牌
  }
}

export const tbnnEngine: GameEngine = {
  createHand: createTbnnHand,
  optionsFor(st: HandState, userId: number): ActionOption[] {
    if (st.finished) return [];
    const idx = st.seats.findIndex((s) => s.userId === userId);
    if (idx < 0) return [];
    const me = st.seats[idx];

    if (st.phase === "waiting_start") {
      if (me.folded) return [];
      const opts: ActionOption[] = [{ action: "start", label: "🎮 开始" }];
      // 始终显示挂机切换按钮，label 根据状态切换，确保可以关闭挂机
      opts.push({
        action: "toggle_auto",
        label: me.autoPlay ? "🤖 关闭挂机" : "🤖 开启挂机",
      });
      return opts;
    }

    if (st.phase === "dealt") {
      // 通比牛牛改造：发牌后延迟1.5秒自动开牌，此阶段无玩家操作
      return [];
    }

    return [];
  },
  applyAction(st: HandState, userId: number, action: string, amount?: number): ActionResult {
    const idx = st.seats.findIndex((s) => s.userId === userId);
    if (idx < 0) return { ok: false, error: GameError.PLAYER_NOT_FOUND };
    const me = st.seats[idx];

    if (st.finished) return { ok: false, error: GameError.GAME_ALREADY_FINISHED };

    if (st.phase === "waiting_start") {
      if (me.folded) return { ok: false, error: GameError.PLAYER_FOLDED };

      if (action === "start") {
        if (me.acted) return { ok: false, error: GameError.ALREADY_ACTED };
        me.acted = true;
        st.log.push(`${me.account} 点击开始`);
        st.lastActionTime = Date.now();

        const allStarted = st.seats.every((s) => s.acted || s.folded);
        if (allStarted) {
          dealCards(st);
        }
        // 触发挂机玩家自动开始
        triggerAutoPlay(st);
        return { ok: true };
      }

      if (action === "toggle_auto") {
        const target = amount === 1 ? true : amount === 0 ? false : !me.autoPlay;
        if (me.autoPlay === target) return { ok: true };
        me.autoPlay = target;
        st.log.push(`${me.account} ${me.autoPlay ? "开启挂机" : "关闭挂机"}`);
        if (me.autoPlay) {
          triggerAutoPlay(st);
        }
        return { ok: true };
      }

      return { ok: false, error: GameError.UNKNOWN_ACTION };
    }

    if (st.phase === "dealt") {
      // 通比牛牛改造：发牌后延迟自动开牌，此阶段无玩家操作
      // 保留 reveal/toggle_auto 作为兼容，直接返回成功
      if (action === "reveal") {
        return { ok: true };
      }
      if (action === "toggle_auto") {
        const target = amount === 1 ? true : amount === 0 ? false : !me.autoPlay;
        if (me.autoPlay === target) return { ok: true };
        me.autoPlay = target;
        st.log.push(`${me.account} ${me.autoPlay ? "开启挂机" : "关闭挂机"}`);
        return { ok: true };
      }
      return { ok: false, error: GameError.UNKNOWN_ACTION };
    }

    return { ok: false, error: GameError.UNKNOWN_ACTION };
  },
};

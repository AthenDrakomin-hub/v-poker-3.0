// Niuniu (抢庄牛牛) engine - fully independent
import { HandState, ActionOption, GameEngine, Seat } from "../common/types";
import { GameError, ActionResult } from "../common/types";
import { freshDeck, shuffle, cardLabel, Card } from "../common/cards";
import { niuniuScore } from "./cards";
import { chipsFor, capFor } from "../../rooms";
import { rollDice } from "../../secureRandom";
import { getGameEconomy } from "@/lib/gameEconomy";

// 五小牛×6为最大赔付倍数，下注前预扣校验防止闲家余额不足导致赔付截断
const MAX_PAYOUT_MULT = 6;

function createNiuniuHand(
  players: { userId: number; account: string; points: number }[],
  level: string,
  roundNo: number,
  dealer: number,
  _fixedAnte: number = 0,
  opts?: { chips?: number[]; cap?: number; baseBet?: number }
): HandState {
  const deck = shuffle(freshDeck());
  const chips = opts?.chips?.length ? opts.chips : chipsFor(level);
  const cap = opts?.cap || capFor(level);
  const base = opts?.baseBet || chips[0];

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
  }));

  const st: HandState = {
    gameType: "niuniu",
    roundNo,
    phase: "grab",
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
    log: ["抢庄阶段：请掷骰子比大小（点数大者坐庄）"],
    actionLog: [],
    finished: false,
    result: null,
    lastActionTime: Date.now(),
    // 从 V2 配置读取抽水参数
    rakeRate: getGameEconomy("niuniu").rakeRate * 100,
    rakeBaseType: getGameEconomy("niuniu").rakeBaseType,
    spec: {
      scoreOf: (cards) => niuniuScore(cards),
      canSeeCards: (seat, viewer, phase) => phase === "dealt" || phase === "showdown" || !seat.folded,
    },
  };

  return st;
}

function nextBettor(st: HandState, from: number): number {
  const bi = st.bankerIdx ?? -1;
  const n = st.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (i !== bi && !st.seats[i].acted) return i;
  }
  return -1;
}

function putIn(st: HandState, idx: number, amt: number) {
  const s = st.seats[idx];
  const pay = Math.max(0, Math.min(amt, s.points));
  s.points -= pay;
  s.streetBet += pay;
  s.totalBet += pay;
  st.pot += pay;
  if (s.points === 0) s.allin = true;
}

function undoBet(st: HandState, idx: number, amt: number) {
  const s = st.seats[idx];
  const refund = Math.max(0, Math.min(amt, s.totalBet));
  s.points += refund;
  s.streetBet -= refund;
  s.totalBet -= refund;
  st.pot -= refund;
  if (s.allin && s.points > 0) s.allin = false;
}

import { calcHandRake, round2 } from "@/lib/economy";

function finalize(st: HandState, startStacks: Map<number, number>, pot: number, bets?: Map<number, number>) {
  const hands = [];
  let winnerUserId = st.seats[0].userId;
  let bestDelta = -Infinity;
  let grossFlow = 0;

  const playerData = st.seats.map((seat) => {
    const start = startStacks.get(seat.userId) ?? seat.points;
    const gross = seat.points - start;
    if (gross > 0) grossFlow += gross;
    return { seat, start, gross, rake: 0 };
  });

  // 抽水基数由V2配置 st.rakeBaseType 决定：pot（底池）/ flow（赢家盈利总和）
  const usePotBase = st.rakeBaseType === "pot";
  const flow = usePotBase ? pot : grossFlow;

  const rakeRate = Number.isFinite(st.rakeRate as number) ? (st.rakeRate as number) : 3;
  if (!Number.isFinite(st.rakeRate as number)) {
    console.warn(`[niuniu] rakeRate 无效 (${st.rakeRate})，回退默认 3%`);
  }
  const { totalRake: rawTotalRake } = calcHandRake(flow, rakeRate);
  // 安全约束：总抽水不得超过赢家总盈利，防止抽水超过盈利导致赢家delta为负
  const totalRake = Math.min(rawTotalRake, round2(grossFlow));
  const winners = playerData.filter(p => p.gross > 0);
  let allocatedRake = 0;

  for (let i = 0; i < playerData.length; i++) {
    const pd = playerData[i];
    if (pd.gross > 0 && totalRake > 0) {
      const winnerIdx = winners.indexOf(pd);
      const remaining = Math.max(0, round2(totalRake - allocatedRake));
      const grossCap = Math.floor(pd.gross * 100) / 100; // 个人盈利上限（两位小数，防止round2向上取整超过盈利）
      if (winnerIdx === winners.length - 1) {
        // 最后一个赢家：倒挤剩余抽水，确保不为负且不超过个人盈利
        pd.rake = Math.min(remaining, grossCap);
      } else {
        // 非最后赢家：按比例分配，但不超过剩余额度和个人盈利
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
    const sc = pd.seat.cards.length > 0 ? niuniuScore(pd.seat.cards) : { name: "未亮牌", mult: 1 };
    // 实际有效下注：庄家=0，闲家=参与结算的下注金额（bets Map传入，兼容totalBet=0但用baseBet的情况）
    const actualBet = bets?.get(pd.seat.userId) ?? 0;
    hands.push({
      userId: pd.seat.userId,
      account: pd.seat.account,
      cards: pd.seat.cards.map(cardLabel),
      handName: pd.seat.folded ? "已弃牌" : sc.name,
      diceRoll: pd.seat.diceRoll,
      delta,
      gross: pd.gross,
      rake: pd.rake,
      mult: sc.mult,
      bet: actualBet,
      folded: pd.seat.folded,
    });
  }

  // 修正：使用实际扣除的总抽水（受个人盈利上限约束后可能小于理论值）
  const actualTotalRake = round2(playerData.reduce((sum, p) => sum + p.rake, 0));

  st.result = {
    hands,
    winnerUserId,
    community: [],
    bankerUserId: st.bankerIdx !== null ? st.seats[st.bankerIdx].userId : null,
    pot,
    rake: actualTotalRake,
    flow,
  };
}

export const niuniuEngine: GameEngine = {
  createHand: createNiuniuHand,
  optionsFor(st: HandState, userId: number): ActionOption[] {
    if (st.finished) return [];
    const idx = st.seats.findIndex((s) => s.userId === userId);
    if (idx < 0) return [];
    const me = st.seats[idx];

    if (st.phase === "grab") {
      if (me.acted) return [];
      return [{ action: "roll", label: "🎲 掷骰子", amount: 0 }];
    }

    if (st.phase === "betting") {
      const bi = st.bankerIdx ?? -1;
      if (idx === bi) return [];
      if (me.acted) return [];
      const opts: ActionOption[] = [];
      for (const chip of st.chips) {
        const potentialStake = me.totalBet + chip;
        // 预扣过滤：闲家总筹码需覆盖最大赔付（stake×6）
        if (me.points >= chip && potentialStake <= st.cap && me.points >= potentialStake * MAX_PAYOUT_MULT) {
          opts.push({ action: "bet", label: `下注 ${chip}`, amount: chip });
        }
      }
      if (me.totalBet > 0) {
        opts.push({ action: "undo_bet", label: "↩ 撤回下注", amount: 0 });
      }
      if (me.totalBet >= st.baseBet) {
        opts.push({ action: "confirm_bet", label: "✓ 确认下注" });
      }
      return opts;
    }

    if (st.phase === "dealt") {
      if (me.acted) return [];
      return [{ action: "confirm", label: "🃏 开牌" }];
    }

    return [];
  },
  applyAction(st: HandState, userId: number, action: string, amount?: number): ActionResult {
    if (st.finished) return { ok: false, error: GameError.GAME_ALREADY_FINISHED };
    const idx = st.seats.findIndex((s) => s.userId === userId);
    if (idx < 0) return { ok: false, error: GameError.PLAYER_NOT_FOUND };
    const me = st.seats[idx];

    if (st.phase === "grab") {
      if (me.acted) return { ok: false, error: GameError.ALREADY_ACTED };
      const roll = rollDice();
      me.diceRoll = roll;
      me.acted = true;
      st.log.push(`${me.account} 掷出 ${roll} 点`);
      if (st.seats.every((s) => s.diceRoll !== null)) {
        const maxRoll = Math.max(...st.seats.map((s) => s.diceRoll ?? 0));
        const maxRollers = st.seats
          .map((s, i) => ({ i, roll: s.diceRoll }))
          .filter((x) => x.roll === maxRoll)
          .map((x) => x.i);

        if (maxRollers.length === 1) {
          const bi = maxRollers[0];
          st.bankerIdx = bi;
          st.log.push(`👑 ${st.seats[bi].account} 以 ${maxRoll} 点成为庄家`);
          st.phase = "grab_result";
          st.turn = -1;
          st.lastActionTime = Date.now();
        } else {
          // 平局：进入 grab_tie 展示阶段，让玩家看到结果和平局提示，2.5秒后自动重掷
          // 不再立即重置骰子，否则玩家根本看不到第一次掷骰结果
          const tiedAccounts = maxRollers.map((i) => st.seats[i].account).join("、");
          st.log.push(`⚖️ ${tiedAccounts} 点数相同（${maxRoll}点），即将重新掷骰`);
          st.phase = "grab_tie";
          st.turn = -1;
          st.lastActionTime = Date.now();
        }
      }
      return { ok: true };
    }

    if (st.phase === "betting") {
      const bi = st.bankerIdx ?? -1;
      if (idx === bi) return { ok: false, error: GameError.BANKER_NO_BET };
      if (me.acted) return { ok: false, error: GameError.ALREADY_ACTED };

      if (action === "bet") {
        const chip = amount ?? 0;
        if (!st.chips.includes(chip)) return { ok: false, error: GameError.INVALID_CHIP_AMOUNT };
        if (me.points < chip) return { ok: false, error: GameError.INSUFFICIENT_CHIPS };
        if (me.totalBet + chip > st.cap) return { ok: false, error: GameError.BET_EXCEEDS_CAP };
        // 预扣校验：闲家总筹码需覆盖最大赔付（stake×6），防止结算时余额不足被截断
        const potentialStake = me.totalBet + chip;
        if (me.points < potentialStake * MAX_PAYOUT_MULT) return { ok: false, error: GameError.INSUFFICIENT_FOR_PAYOUT };
        putIn(st, idx, chip);
        st.log.push(`${me.account} 下注 ${chip}（累计 ${me.totalBet}）`);
        return { ok: true };
      }

      if (action === "undo_bet") {
        if (me.totalBet <= 0) return { ok: false, error: GameError.NO_BET_TO_UNDO };
        const refund = me.totalBet;
        undoBet(st, idx, refund);
        st.log.push(`${me.account} 撤回下注 ${refund}`);
        return { ok: true };
      }

      if (action === "confirm_bet") {
        if (me.totalBet < st.baseBet) return { ok: false, error: GameError.BET_TOO_LOW };
        me.acted = true;
        st.log.push(`${me.account} 确认下注 ${me.totalBet}`);
        const allConfirmed = st.seats.every((s, i) => i === bi || s.acted || s.folded);
        if (allConfirmed) {
          st.seats.forEach((s) => {
            for (let i = 0; i < 5; i++) s.cards.push(st.deck.pop()!);
          });
          st.phase = "dealt";
          st.turn = -1;
          st.seats.forEach((s) => (s.acted = false));
          st.log.push("发牌完成，请点击开牌");
        } else {
          st.turn = nextBettor(st, idx);
        }
        return { ok: true };
      }
      return { ok: false, error: GameError.UNKNOWN_ACTION };
    }

    if (st.phase === "dealt") {
      if (me.acted) return { ok: false, error: GameError.ALREADY_ACTED };
      me.acted = true;
      st.log.push(`${me.account} 开牌`);
      const allConfirmed = st.seats.every((s) => s.acted || s.folded);
      if (allConfirmed) {
        st.phase = "showdown";
        st.turn = -1;
        st.finished = true;

        const startStacks = new Map<number, number>();
        st.seats.forEach((s) => startStacks.set(s.userId, s.points + s.totalBet));

        const bi = st.bankerIdx ?? 0;
        const banker = st.seats[bi];
        const bScore = niuniuScore(banker.cards);

        const hasActiveOpponents = st.seats.some((s, i) => i !== bi && !s.folded);
        if (!hasActiveOpponents) {
          const pot = st.pot;
          banker.points += pot;
          st.log.push(`${banker.account}(庄家) 独得底池 ${pot}`);
          st.pot = 0;
          // 记录实际有效下注
          const bets = new Map<number, number>();
          st.seats.forEach((s, i) => {
            bets.set(s.userId, i === bi ? 0 : s.totalBet);
          });
          finalize(st, startStacks, pot, bets);
          return { ok: true };
        }

        // 记录实际有效下注：庄家=0，闲家=totalBet>0用totalBet，否则用baseBet
        const bets = new Map<number, number>();
        st.seats.forEach((s, i) => {
          if (i === bi) bets.set(s.userId, 0);
          else if (s.folded) bets.set(s.userId, s.totalBet);
          else bets.set(s.userId, s.totalBet); // totalBet=0 玩家不参与结算，bet 如实显示 0
        });

        // 保存结算前真实底池，用于前端显示"底池总额"（结算过程中st.pot会被修改）
        const originalPot = st.pot;

        const winners: { idx: number; stake: number; win: number; mult: number }[] = [];
        let totalWin = 0;
        st.seats.forEach((s, i) => {
          if (i === bi || s.folded || s.totalBet === 0) return;
          const stake = s.totalBet;
          const pScore = niuniuScore(s.cards);
          if (bScore.score < pScore.score) {
            const win = stake * pScore.mult;
            winners.push({ idx: i, stake, win, mult: pScore.mult });
            totalWin += win;
          }
        });

        const bankerBankroll = Math.max(0, banker.points);
        const scale = totalWin > 0 && totalWin > bankerBankroll ? bankerBankroll / totalWin : 1;
        if (scale < 1) {
          st.log.push(`⚠️ 庄家筹码不足，赔付按 ${(scale * 100).toFixed(1)}% 比例结算`);
        }

        st.seats.forEach((s, i) => {
          if (i === bi || s.folded || s.totalBet === 0) return;
          const stake = s.totalBet;
          const pScore = niuniuScore(s.cards);
          if (bScore.score > pScore.score) {
            const extra = Math.min(s.points, stake * (bScore.mult - 1));
            s.points -= extra;
            banker.points += extra;
          } else if (bScore.score < pScore.score) {
            const w = winners.find((w) => w.idx === i)!;
            const actualWin = Math.floor(w.win * scale);
            s.points += stake + actualWin;
            st.pot -= stake;
            banker.points -= actualWin;
            s.totalBet = 0;
          } else {
            s.points += stake;
            st.pot -= stake;
            s.totalBet = 0;
          }
        });

        banker.points = Math.max(0, banker.points);
        const remainingPot = st.pot;
        if (remainingPot > 0) banker.points += remainingPot;
        st.pot = 0;
        // 传给finalize的是结算前真实底池originalPot，不是结算后剩余值
        finalize(st, startStacks, originalPot, bets);
      }
      return { ok: true };
    }

    return { ok: false, error: GameError.UNKNOWN_ACTION };
  },
};

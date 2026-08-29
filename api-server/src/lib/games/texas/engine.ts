// Texas Hold'em engine - fully independent
import { PokerEngine, ActionType } from "@pokertools/engine";
import { HandState, ActionOption, GameEngine, Seat } from "../common/types";
import { GameError, ActionResult } from "../common/types";
import { cardLabel, Card } from "../common/cards";
import { chipsFor, capFor } from "../../rooms";
import { texasScore, texasCompareCards } from "./cards";
import { round2 } from "../../economy";
import { getGameEconomy } from "@/lib/gameEconomy";

function pkCardToCard(pk: string): Card {
  const rankCh = pk[0];
  const suit = pk[1].toUpperCase() as "S" | "H" | "D" | "C";
  const rank =
    rankCh === "A" ? 14 :
    rankCh === "K" ? 13 :
    rankCh === "Q" ? 12 :
    rankCh === "J" ? 11 :
    rankCh === "T" ? 10 :
    parseInt(rankCh, 10);
  return { rank, suit };
}

const STREET_MAP: Record<string, import("../common/types").Phase> = {
  PREFLOP: "preflop" as const,
  FLOP: "flop" as const,
  TURN: "turn" as const,
  RIVER: "river" as const,
  SHOWDOWN: "showdown" as const,
};

function restoreEngine(st: HandState): PokerEngine {
  if (!st._pkSnapshot) throw new Error("texas: missing engine snapshot");
  return PokerEngine.restore(st._pkSnapshot as any);
}

function syncFromEngine(engine: PokerEngine, st: HandState) {
  const s = engine.state;

  st.phase = STREET_MAP[s.street] ?? "preflop";
  st.community = (s.board as string[]).map(pkCardToCard);
  st.currentBet = Math.max(0, ...Array.from(s.currentBets.values()));
  // 修复：@pokertools/engine 的 s.minRaise 在 handleBet 中错误地计算为 betAmount*2，
  // 导致加注金额翻倍。s.lastRaiseAmount 才是正确的加注增量。
  // 标准德州规则：最小加注额 = 上一次加注增量（preflop等于大盲）。
  st.minRaise = (s.lastRaiseAmount as number) ?? (s.bigBlind as number) ?? st.baseBet ?? 0;
  st.finished = s.street === "SHOWDOWN";

  const settledPot = s.pots.reduce((sum: number, p: any) => sum + p.amount, 0);
  const activeBets = Array.from(s.currentBets.values()).reduce((a: number, b: number) => a + b, 0);
  st.pot = settledPot + activeBets;

  const activePlayers = s.players.filter((p: any) => p !== null);
  st.seats = activePlayers.map((p: any): Seat => ({
    userId: Number(p.id),
    account: p.name,
    cards: ((p.hand as string[]) ?? []).map(pkCardToCard),
    points: p.stack,
    streetBet: p.betThisStreet,
    totalBet: p.totalInvestedThisHand,
    folded: p.status === "FOLDED",
    allin: p.status === "ALL_IN",
    acted: false,
    looked: false,
    diceRoll: null,
  }));

  const rawToFiltered = new Map<number, number>();
  s.players.forEach((p: any, i: number) => {
    if (p !== null) {
      rawToFiltered.set(i, activePlayers.findIndex((ap: any) => ap.id === p.id));
    }
  });
  st.turn = s.actionTo !== null ? (rawToFiltered.get(s.actionTo) ?? -1) : -1;
  st.dealer = s.buttonSeat !== null ? (rawToFiltered.get(s.buttonSeat) ?? 0) : 0;

  const initial = st._initialPoints ?? {};
  const winnerIds = st.seats
    .filter((seat) => (seat.points - (initial[seat.userId] ?? seat.points)) > 0)
    .map((s) => s.userId);

  if (s.street === "SHOWDOWN" || winnerIds.length > 0 || st.seats.filter((x: Seat) => !x.folded).length <= 1) {
    // 引擎结算（弃牌赢/摊牌）后会清空 currentBets 和 pots，导致 st.pot=0。
    // 此时从所有玩家的 totalInvestedThisHand 反推本局总投入，作为真实底池显示。
    const totalInvested = st.seats.reduce((sum, s) => sum + (s.totalBet ?? 0), 0);
    const realPot = st.pot > 0 ? st.pot : totalInvested;
    let grossFlow = 0;
    const playerData = st.seats.map((seat: Seat) => {
      const start = initial[seat.userId] ?? seat.points;
      const gross = seat.points - start;
      if (gross > 0) grossFlow += gross;
      return { seat, start, gross, rake: 0 };
    });
    // 根据V2配置选择抽水基数：pot=底池（主池+边池总和，市面标准），flow=赢家盈利总和
    // 德州扑克默认 pot（配置未加载时的安全回退）
    const useFlowBase = st.rakeBaseType === "flow";
    let flow = useFlowBase ? grossFlow : realPot;

    // 德州扑克抽水优化算法
    const rakeRate = Number.isFinite(st.rakeRate as number) ? (st.rakeRate as number) : 3;
    if (!Number.isFinite(st.rakeRate as number)) {
      console.warn(`[texas] rakeRate 无效 (${st.rakeRate})，回退默认 3%`);
    }
    let totalRake = 0;

    // 1. 无Flop不抽水：如果没有发出公共牌（翻牌前全弃牌），不抽水
    const hasFlop = s.board.length >= 3;
    const allFoldedPreflop = !hasFlop && st.seats.filter(x => !x.folded).length <= 1;

    if (!allFoldedPreflop && flow > 0) {
      // 2. 起抽门槛：底池低于门槛不抽水（可配置，默认0）
      const minRakePot = (st as any).minRakePot ?? 0;

      if (flow >= minRakePot) {
        // 3. 计算抽水并应用上限
        let rake = flow * (rakeRate / 100);
        const rakeCap = (st as any).rakeCap ?? Infinity;
        rake = Math.min(rake, rakeCap);
        totalRake = round2(rake);
      }
    }
    // 安全约束：总抽水不得超过赢家总盈利，防止抽水超过盈利导致赢家delta为负
    totalRake = Math.min(totalRake, round2(grossFlow));

    const winners = playerData.filter(p => p.gross > 0);
    let allocatedRake = 0;

    const hands: any[] = playerData.map((pd, idx) => {
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
        // 代理从玩家盈利中抽水（3%），归代理所有
        pd.seat.points = round2(pd.seat.points - pd.rake);
      }
      const delta = round2(pd.seat.points - pd.start);
      // 使用texasScore计算具体牌型名称（弃牌玩家显示"已弃牌"）
      let handName = "已弃牌";
      if (!pd.seat.folded) {
        try {
          const allCards = [...st.community, ...pd.seat.cards];
          handName = texasScore(allCards).name;
        } catch (e) {
          handName = "德州扑克";
        }
      }
      return {
        userId: pd.seat.userId,
        account: pd.seat.account,
        cards: pd.seat.cards.map(cardLabel),
        handName,
        diceRoll: null,
        delta,
        gross: pd.gross,
        rake: pd.rake,
        mult: 1,
        bet: pd.seat.totalBet ?? 0,
        folded: pd.seat.folded,
      };
    });

    // 修正：使用实际扣除的总抽水（受个人盈利上限约束后可能小于理论值）
    const actualTotalRake = round2(playerData.reduce((sum, p) => sum + p.rake, 0));

    st.result = {
      hands,
      winnerUserId: winnerIds[0] ?? st.seats.find((s: Seat) => !s.folded)?.userId ?? st.seats[0].userId,
      community: st.community.map(cardLabel),
      bankerUserId: null,
      pot: realPot,
      rake: actualTotalRake,
      flow,
      log: [...st.log],  // 返回本局行动日志
    };
  } else {
    st.result = null;
  }

  st._pkSnapshot = engine.snapshot;
}

export function createTexasHand(
  players: { userId: number; account: string; points: number }[],
  level: string,
  roundNo: number,
  dealer: number,
  _fixedAnte: number = 0,
  opts?: { chips?: number[]; cap?: number; baseBet?: number }
): HandState {
  const chips = opts?.chips?.length ? opts.chips : chipsFor(level);
  const base = opts?.baseBet || chips[0];
  const smallBlind = Math.max(1, Math.ceil(base / 2));
  const bigBlind = smallBlind * 2;

  const engine = new PokerEngine({
    smallBlind,
    bigBlind,
    maxPlayers: Math.max(6, players.length),
    rakePercent: 0,
    validateIntegrity: true,
  });

  players.forEach((p, i) => {
    // @pokertools/engine 要求整数筹码，玩家筹码可能含小数（抽水结算产生），向下取整
    engine.sit(i, String(p.userId), p.account, Math.floor(p.points));
  });
  engine.deal();

  const st: HandState = {
    gameType: "texas",
    roundNo,
    phase: "preflop",
    seats: [],
    deck: [],
    community: [],
    turn: 0,
    dealer: dealer % players.length,
    pot: 0,
    currentBet: 0,
    minRaise: base,
    baseBet: base,
    chips,
    cap: opts?.cap || capFor(level),
    bankerIdx: null,
    log: [],
    actionLog: [],
    finished: false,
    result: null,
    _initialPoints: Object.fromEntries(players.map((p) => [p.userId, Math.floor(p.points)])),
    lastActionTime: Date.now(),
    spec: {
      scoreOf: (cards) => texasScore(cards as Card[]),
      compareCards: texasCompareCards,
      canSeeCards: (seat, viewer, phase) => {
        // 自己永远能看自己的牌
        if (seat.userId === viewer.userId) return true;
        // 游戏进行中，当前行动的玩家只能看自己的牌（上面已处理）
        // 摊牌/结算阶段，可以看所有非弃牌玩家的牌
        return (phase === "showdown" || phase === "settlement") && !seat.folded;
      },
    },
  };

  syncFromEngine(engine, st);
  st.log.push(`— 第 ${roundNo} 局 —`);

  // 从V2配置读取抽水参数
  const economy = getGameEconomy("texas");
  st.rakeRate = economy.rakeRate * 100;
  st.rakeBaseType = economy.rakeBaseType;

  return st;
}

export const texasOptionsFor = (st: HandState, userId: number): ActionOption[] => {
  if (st.finished || st.turn < 0) return [];
  const engine = restoreEngine(st);
  const s = engine.state;
  if (s.actionTo === null) return [];
  const me = s.players[s.actionTo];
  if (!me || Number(me.id) !== userId) return [];

  const toCall = Math.max(0, st.currentBet - me.betThisStreet);
  const opts: ActionOption[] = [];

  opts.push({ action: "fold", label: "弃牌" });

  if (toCall === 0) {
    opts.push({ action: "check", label: "过牌" });
  } else {
    opts.push({
      action: "call",
      label: `跟注 ${Math.min(toCall, me.stack)}`,
      amount: Math.min(toCall, me.stack),
    });
  }

  if (me.stack > toCall) {
    const minTotal = toCall + st.minRaise;
    opts.push({
      action: "raise",
      label: toCall === 0 ? "下注" : "加注",
      min: Math.min(minTotal, me.betThisStreet + me.stack),
      max: Math.min(toCall + st.cap, me.betThisStreet + me.stack),
      chips: st.chips,
      baseBet: st.baseBet,
    });
  }

  if (me.stack > 0) {
    const total = me.betThisStreet + me.stack;
    if (total > st.currentBet) {
      opts.push({ action: "allin", label: `All-in ${me.stack}`, amount: me.stack });
    } else {
      opts.push({ action: "allin", label: `全下跟注 ${me.stack}`, amount: me.stack });
    }
  }

  return opts;
};

export const texasApplyAction = (st: HandState, userId: number, action: string, amount?: number): ActionResult => {
  if (st.finished) return { ok: false, error: GameError.GAME_ALREADY_FINISHED };
  const engine = restoreEngine(st);
  const s = engine.state;
  if (s.actionTo === null) return { ok: false, error: GameError.GAME_ALREADY_FINISHED };
  const me = s.players[s.actionTo];
  if (!me || Number(me.id) !== userId) return { ok: false, error: GameError.NOT_YOUR_TURN };

  const playerId = String(userId);

  try {
    switch (action) {
      case "fold":
        engine.act({ type: ActionType.FOLD, playerId });
        st.log.push(`${me.name} 弃牌`);
        break;
      case "check": {
        const toCall = Math.max(0, st.currentBet - me.betThisStreet);
        if (toCall > 0) {
          return { ok: false, error: GameError.NOT_YOUR_TURN };
        }
        engine.act({ type: ActionType.CHECK, playerId });
        st.log.push(`${me.name} 过牌`);
        break;
      }
      case "call": {
        engine.act({ type: ActionType.CALL, playerId });
        const paid = Math.min(Math.max(0, st.currentBet - me.betThisStreet), me.stack);
        st.log.push(`${me.name} 跟注 ${paid}`);
        break;
      }
      case "raise": {
        let amt = Math.floor(Number(amount ?? 0));
        const toCall = Math.max(0, st.currentBet - me.betThisStreet);
        const minTotal = toCall + st.minRaise;
        if (amt < minTotal) amt = minTotal;
        amt = Math.min(amt, toCall + st.cap, me.betThisStreet + me.stack);
        // 关键修复：当前无人下注(currentBet=0)时必须用BET，用RAISE会被引擎拒绝
        // engine 支持 BET 在 currentBet>0 时自动转换为 RAISE，因此统一用 BET 更安全
        engine.act({ type: ActionType.BET, playerId, amount: amt });
        st.log.push(`${me.name} ${toCall === 0 ? "下注" : "加注到"} ${amt}`);
        break;
      }
      case "allin": {
        const total = me.betThisStreet + me.stack;
        // 检查是否可以加注：如果当前玩家是上一个加注者（lastAggressorSeat），
        // 且下注没有因完整加注而重新开放，则不能再次加注，只能跟注
        const canRaise = total > st.currentBet && s.lastAggressorSeat !== s.actionTo;
        if (canRaise) {
          // 同 raise：统一用 BET，engine 会在 currentBet>0 时自动转 RAISE
          engine.act({ type: ActionType.BET, playerId, amount: total });
        } else {
          engine.act({ type: ActionType.CALL, playerId });
        }
        st.log.push(`${me.name} All-in ${me.stack}`);
        break;
      }
      default:
        return { ok: false, error: GameError.UNKNOWN_ACTION };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "操作被拒绝" };
  }

  syncFromEngine(engine, st);
  return { ok: true };
};

export const texasEngine: GameEngine = {
  createHand: createTexasHand,
  optionsFor: texasOptionsFor,
  applyAction: texasApplyAction,
};

// Jinhua (炸金花) engine - fully independent
import { getGameEconomy } from "@/lib/gameEconomy";
import { HandState, ActionOption, GameEngine, Seat, ActionEntry, GameError, ActionResult } from "../common/types";
import { freshDeck, shuffle, cardLabel, Card } from "../common/cards";
import { jinhuaScore, jinhuaCompare } from "./cards";
import { chipsFor } from "../../rooms";
import { round2 } from "@/lib/economy";

/**
 * 炸金花注额规则（按级别固定，不允许调整）
 * 初级场: 底注=5  闷跟=5   看跟=10  闷上=10  看上=20
 * 高级场: 底注=10 闷跟=20  看跟=40  闷上=40  看上=80
 * 顶级场: 底注=20 闷跟=40  看跟=80  闷上=80  看上=160
 *
 * 注意：底注(ante)与初始下注额(currentBet)不同
 *   初级场: ante=5,  currentBet=5  （两者相等）
 *   高级场: ante=10, currentBet=20 （currentBet=ante*2）
 *   顶级场: ante=20, currentBet=40 （currentBet=ante*2）
 *
 * 统一规则：
 *   闷跟  = currentBet
 *   看跟  = currentBet * 2
 *   最小加注 = currentBet * 2（闷/看统一）
 *   闷注上限 = currentBet * 2
 *   看注上限 = currentBet * 2
 */

// 炸金花各场次初始下注额（currentBet），按级别固定
const JINHUA_BASE_BET: Record<string, number> = {
  junior: 5,
  senior: 20,
  top: 40,
};

function createJinhuaHand(
  players: { userId: number; account: string; points: number }[],
  level: string,
  roundNo: number,
  dealer: number,
  fixedAnte: number = 0,
  opts?: { chips?: number[]; cap?: number; baseBet?: number }
): HandState {
  const deck = shuffle(freshDeck());
  // base = 初始下注额(currentBet)，优先从数据库模板读取，兜底用JINHUA_BASE_BET或chips[0]
  const base = opts?.baseBet || JINHUA_BASE_BET[level] || chipsFor(level)[0] || 5;
  // cap = 看上上限(base*4)，优先从数据库模板读取
  const cap = opts?.cap || base * 4;

  const seats: Seat[] = players.map((p) => {
    const cards: Card[] = [];
    for (let i = 0; i < 3; i++) cards.push(deck.pop()!);
    return {
      userId: p.userId,
      account: p.account,
      cards,
      points: Math.floor(p.points),
      streetBet: 0,
      totalBet: 0,
      folded: false,
      allin: false,
      acted: false,
      looked: false,
      diceRoll: null as number | null,
    };
  });

  const st: HandState = {
    gameType: "jinhua",
    roundNo,
    phase: "betting",
    seats,
    deck,
    community: [],
    turn: dealer,
    dealer,
    pot: 0,
    currentBet: base,
    minRaise: base,
    baseBet: base,
    chips: [], // 炸金花全固定金额，不需要筹码面额
    cap,
    bankerIdx: null,
    log: [],
    actionLog: [],
    finished: false,
    result: null,
    lastActionTime: Date.now(),
    _bettingRound: 0,
    // 连续闷牌回合计数器：每完成一轮所有人都是闷牌操作则+1，有人看牌/比牌/弃牌则清零
    // 达到20轮强制摊牌比大小
    continuousMuteRound: 0,
    // 当前轮是否有人执行了看牌/比牌/弃牌（用于判断本轮是否全闷）
    _roundHadLookFoldCompare: false,
    spec: {
      scoreOf: (cards) => ({ ...jinhuaScore(cards), mult: 1 }),
      compareCards: jinhuaCompare,
      canSeeCards: (seat, viewer, phase) => {
        if (seat.revealed === true) return true;
        if (seat.userId === viewer.userId) {
          return seat.looked === true;
        }
        return phase === "showdown" && !seat.folded;
      },
    },
  };

  // 开局底注入池
  st.seats.forEach((_, i) => {
    const pay = Math.min(base, st.seats[i].points);
    st.seats[i].points -= pay;
    st.seats[i].totalBet += pay;
    st.pot += pay;
    if (st.seats[i].points === 0) st.seats[i].allin = true;
  });
  st.log.push(`每人下底注 ${base}`);

  // 从V2配置读取抽水参数
  const economy = getGameEconomy("jinhua");
  st.rakeRate = economy.rakeRate * 100;
  st.rakeBaseType = economy.rakeBaseType;

  return st;
}

function activeIdx(st: HandState): number[] {
  return st.seats
    .map((s, i) => ({ s, i }))
    .filter((x) => !x.s.folded)
    .map((x) => x.i);
}

function nextActive(st: HandState, from: number): number {
  const n = st.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const s = st.seats[i];
    if (!s.folded && !s.allin) return i;
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

function distributePots(st: HandState) {
  const n = st.seats.length;
  const contrib = st.seats.map((x) => x.totalBet);
  const levels = [...new Set(contrib.filter((c) => c > 0))].sort((a, b) => a - b);

  let prev = 0;
  for (const lvl of levels) {
    let amount = 0;
    for (let i = 0; i < n; i++) {
      amount += Math.min(contrib[i], lvl) - Math.min(contrib[i], prev);
    }
    prev = lvl;
    if (amount <= 0) continue;

    const eligible: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!st.seats[i].folded && contrib[i] >= lvl) eligible.push(i);
    }
    if (eligible.length === 0) {
      const totalContrib = st.seats.reduce((sum, s) => sum + Math.min(s.totalBet, lvl) - Math.min(s.totalBet, prev), 0);
      if (totalContrib > 0) {
        st.seats.forEach((s) => {
          const contrib = Math.min(s.totalBet, lvl) - Math.min(s.totalBet, prev);
          if (contrib > 0) {
            s.points += Math.floor(amount * contrib / totalContrib);
          }
        });
      }
      continue;
    }

    let winners: number[] = [];
    for (const i of eligible) {
      if (winners.length === 0) {
        winners = [i];
      } else {
        const cmp = jinhuaCompare(st.seats[winners[0]].cards, st.seats[i].cards);
        if (cmp < 0) winners = [i];
        else if (cmp === 0) winners.push(i);
      }
    }
    const share = Math.floor(amount / winners.length);
    let remainder = amount - share * winners.length;
    winners.forEach((i) => {
      st.seats[i].points += share;
      if (remainder > 0) {
        st.seats[i].points += 1;
        remainder--;
      }
    });
  }
}

function finalize(st: HandState, startStacks: Map<number, number>, pot: number) {
  const hands = [];
  let winnerUserId = st.seats[0].userId;
  let bestDelta = -Infinity;

  const hasCompare = st.log.some((l: string) => l.includes("比牌"));
  const foldedCount = st.seats.filter((s) => s.folded).length;
  const winType = hasCompare ? "compare" : (foldedCount > 0 ? "fold_all" : "showdown");

  const playerData = st.seats.map((seat) => {
    const start = startStacks.get(seat.userId) ?? seat.points;
    const gross = seat.points - start;
    return { seat, start, gross, rake: 0 };
  });

  const rakeRate = Number.isFinite(st.rakeRate as number) ? (st.rakeRate as number) : 3;
  // 抽水基数由V2配置 st.rakeBaseType 决定：pot（底池）/ flow（赢家盈利总和），不硬编码
  const useFlowBase = st.rakeBaseType === "flow";
  const grossFlow = playerData.filter(p => p.gross > 0).reduce((a, p) => a + p.gross, 0);
  let flow = useFlowBase ? grossFlow : pot;
  let totalRake = 0;
  const minRakePot = (st as any).minRakePot ?? 0;
  if (flow >= minRakePot) {
    let rake = flow * (rakeRate / 100);
    const rakeCap = (st as any).rakeCap ?? Infinity;
    rake = Math.min(rake, rakeCap);
    totalRake = round2(rake);
  }
  // 安全约束：总抽水不得超过赢家总盈利，防止抽水超过盈利导致赢家delta为负
  totalRake = Math.min(totalRake, round2(grossFlow));
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
    const sc = jinhuaScore(pd.seat.cards);
    const isEliminatedByCompare = (pd.seat as any).eliminatedBy === "compare";
    const actualBet = pd.seat.totalBet ?? 0;
    hands.push({
      userId: pd.seat.userId,
      account: pd.seat.account,
      cards: pd.seat.cards.map(cardLabel),
      handName: pd.seat.folded && !isEliminatedByCompare ? "已弃牌" : sc.name,
      diceRoll: null,
      delta,
      gross: pd.gross,
      rake: pd.rake,
      mult: 1,
      bet: actualBet,
      folded: pd.seat.folded,
      eliminatedBy: (pd.seat as any).eliminatedBy || null,
    });
  }

  // 修正：使用实际扣除的总抽水（受个人盈利上限约束后可能小于理论值）
  const actualTotalRake = round2(playerData.reduce((sum, p) => sum + p.rake, 0));

  st.result = {
    hands,
    winnerUserId,
    community: [],
    bankerUserId: null,
    pot,
    rake: actualTotalRake,
    flow,
    winType,
  };
}

export const jinhuaEngine: GameEngine = {
  createHand: createJinhuaHand,
  optionsFor(st: HandState, userId: number): ActionOption[] {
    if (st.finished || st.turn < 0) return [];
    const idx = st.seats.findIndex((s) => s.userId === userId);
    if (idx !== st.turn) return [];
    const me = st.seats[idx];

    const opts: ActionOption[] = [];
    // 当前注额（闷注基准）
    const cb = st.currentBet;
    // 跟注额：闷=cb，看=cb×2
    const callAmtBlind = cb;
    const callAmtLooked = cb * 2;
    const callAmt = me.looked ? callAmtLooked : callAmtBlind;
    // 加注额：闷上=cb×2（闷注），看上=cb×4（看注，对应闷注基准cb×2）
    const raiseAmtBlind = cb * 2;
    const raiseAmtLooked = cb * 4;
    const raiseAmt = me.looked ? raiseAmtLooked : raiseAmtBlind;

    // 连续闷牌20轮强制比牌由applyAction处理（进入showdown阶段），此处不再检查
    // 仅当玩家筹码不足跟注时，强制弃牌/比牌
    const cantAfford = me.points < callAmt;

    if (cantAfford) {
      opts.push({ action: "fold", label: "弃牌" });
      if (activeIdx(st).length > 1) {
        opts.push({ action: "compare", label: me.looked ? "⚔ 比牌（筹码不足）" : "⚡ 闷开（筹码不足）" });
      }
      return opts;
    }

    if (!me.looked) opts.push({ action: "look", label: "👁 看牌" });
    opts.push({ action: "fold", label: "弃牌" });
    // 闷牌状态下无闷跟，只有加注；看牌状态下有跟注
    if (me.looked) {
      opts.push({
        action: "call",
        label: `跟注 ${callAmt}`,
        amount: callAmt,
      });
    }
    // 加注 = 固定金额：闷上 cb*2（闷注），看上 cb*4（看注）
    if (me.points >= raiseAmt) {
      opts.push({
        action: "raise",
        label: `${me.looked ? "看上" : "闷上"} ${raiseAmt}`,
        amount: raiseAmt,
      });
    }
    if (activeIdx(st).length > 1) {
      opts.push({ action: "compare", label: me.looked ? "⚔ 比牌" : "⚡ 闷开" });
    }
    return opts;
  },
  applyAction(st: HandState, userId: number, action: string, amount?: number): ActionResult {
    if (st.finished) return { ok: false, error: GameError.GAME_ALREADY_FINISHED };
    const idx = st.seats.findIndex((s) => s.userId === userId);
    if (idx < 0) return { ok: false, error: GameError.PLAYER_NOT_FOUND };
    if (idx !== st.turn) return { ok: false, error: GameError.NOT_YOUR_TURN };
    const me = st.seats[idx];
    const toCall = Math.max(0, st.currentBet - me.streetBet);

    switch (action) {
      case "look": {
        me.looked = true;
        (st as any)._roundHadLookFoldCompare = true;
        (st as any).continuousMuteRound = 0;
        st.lastActionTime = Date.now();
        st.log.push(`${me.account} 看牌`);
        return { ok: true };
      }
      case "fold": {
        me.folded = true;
        me.acted = true;
        (st as any)._roundHadLookFoldCompare = true;
        (st as any).continuousMuteRound = 0;
        st.log.push(`${me.account} 弃牌`);
        st._bettingRound = (st._bettingRound ?? 0) + 1;
        break;
      }
      case "call": {
        const cb = st.currentBet;
        const amt = me.looked ? cb * 2 : cb;
        const paid = Math.min(amt, me.points);
        putIn(st, idx, paid);
        me.acted = true;
        st._bettingRound = (st._bettingRound ?? 0) + 1;
        st.log.push(`${me.account} 跟注 ${paid}`);
        break;
      }
      case "raise": {
        let amt = Math.floor(Number(amount ?? 0));
        const cb = st.currentBet;
        // 最小加注：闷=cb×2（闷注），看=cb×4（看注，对应闷注基准cb×2）
        const minRaiseAmt = me.looked ? cb * 4 : cb * 2;
        if (amt < minRaiseAmt) amt = minRaiseAmt;
        // 上限：固定金额游戏，加注只有一个档位 = 最小加注额
        const maxAmt = Math.min(minRaiseAmt, me.points);
        amt = Math.min(amt, maxAmt);
        putIn(st, idx, amt);
        // currentBet 始终表示闷注基准：闷牌加注 cb=amt，看牌加注 cb=amt/2
        st.currentBet = me.looked ? Math.floor(amt / 2) : amt;
        // 重置其他未行动玩家
        st.seats.forEach((s, i) => {
          if (i !== idx && !s.folded) s.acted = false;
        });
        me.acted = true;
        st._bettingRound = (st._bettingRound ?? 0) + 1;
        st.log.push(`${me.account} 加注到 ${amt}`);
        break;
      }
      case "compare": {
        (st as any)._roundHadLookFoldCompare = true;
        (st as any).continuousMuteRound = 0;
        const others = activeIdx(st).filter((i) => i !== idx);
        if (!others.length) return { ok: false, error: GameError.NO_VALID_OPPONENT };
        // 比牌费：闷牌 = currentBet（不翻倍），看牌 = currentBet * 2（翻倍）
        const cost = Math.min(Math.max(1, me.looked ? st.currentBet * 2 : st.currentBet), me.points);
        putIn(st, idx, cost);
        let opp = others[0];
        if (amount != null) {
          const targetIdx = st.seats.findIndex((s) => s.userId === amount);
          if (targetIdx >= 0 && others.includes(targetIdx)) opp = targetIdx;
        }
        const cmp = jinhuaCompare(me.cards, st.seats[opp].cards);
        const winnerHand = jinhuaScore(cmp > 0 ? me.cards : st.seats[opp].cards).name;
        const loserHand = jinhuaScore(cmp > 0 ? st.seats[opp].cards : me.cards).name;
        const actionName = me.looked ? "比牌" : "闷开";
        if (cmp > 0) {
          st.seats[opp].folded = true;
          (st.seats[opp] as any).eliminatedBy = "compare";
          st.lastCompare = {
            winnerId: me.userId,
            loserId: st.seats[opp].userId,
            winnerName: me.account,
            loserName: st.seats[opp].account,
            winnerHand,
            loserHand,
            ts: Date.now(),
          };
          st.log.push(`${me.account} ${actionName}胜 ${st.seats[opp].account}（${winnerHand} vs ${loserHand}）`);
        } else {
          me.folded = true;
          (me as any).eliminatedBy = "compare";
          st.lastCompare = {
            winnerId: st.seats[opp].userId,
            loserId: me.userId,
            winnerName: st.seats[opp].account,
            loserName: me.account,
            winnerHand,
            loserHand,
            ts: Date.now(),
          };
          st.log.push(`${me.account} ${actionName}负 ${st.seats[opp].account}（${loserHand} vs ${winnerHand}）`);
        }
        me.acted = true;
        st._bettingRound = (st._bettingRound ?? 0) + 1;
        break;
      }
      default:
        return { ok: false, error: GameError.UNKNOWN_ACTION };
    }

    const alive = activeIdx(st);
    if (alive.length <= 1) {
      st.phase = "showdown";
      st.turn = -1;
      st.finished = true;
      const pot = st.pot;
      const startStacks = new Map();
      st.seats.forEach((s) => startStacks.set(s.userId, s.points + s.totalBet));
      distributePots(st);
      finalize(st, startStacks, pot);
      return { ok: true };
    }
    // 判断下一位玩家需要行动：未行动且未跟满
    // 使用 checked 集合记录已检查的座位，防止比牌/弃牌导致人数减少后在活跃玩家间无限循环
    let nxt = nextActive(st, idx);
    const checked = new Set<number>();
    while (
      nxt >= 0 &&
      !checked.has(nxt) &&
      st.seats[nxt].acted &&
      st.seats[nxt].streetBet >= st.currentBet * (st.seats[nxt].looked ? 2 : 1)
    ) {
      checked.add(nxt);
      nxt = nextActive(st, nxt);
    }
    // 循环因回到已检查座位而退出：所有活跃玩家均已 acted 且跟满，本回合结束
    if (nxt >= 0 && checked.has(nxt)) {
      nxt = -1;
    }

    // 回合结束检测：所有活跃玩家都已行动且跟满当前注额
    if (nxt < 0) {
      const activePlayers = activeIdx(st);
      // 本轮是否全闷：所有活跃玩家都未看牌 且 本轮无人看牌/比牌/弃牌
      const allBlind = activePlayers.every((i) => !st.seats[i].looked);
      const noLookFoldCompare = !(st as any)._roundHadLookFoldCompare;
      if (allBlind && noLookFoldCompare) {
        (st as any).continuousMuteRound += 1;
        st.log.push(`连续闷牌第 ${(st as any).continuousMuteRound} 轮`);
      } else {
        (st as any).continuousMuteRound = 0;
      }
      (st as any)._roundHadLookFoldCompare = false;

      // 连续闷牌达到20轮，强制摊牌比大小
      if ((st as any).continuousMuteRound >= 20) {
        st.log.push("连续闷牌20轮，强制摊牌比大小");
        st.phase = "showdown";
        st.turn = -1;
        st.finished = true;
        const pot = st.pot;
        const startStacks = new Map();
        st.seats.forEach((s) => startStacks.set(s.userId, s.points + s.totalBet));
        distributePots(st);
        finalize(st, startStacks, pot);
        return { ok: true };
      }

      // 开始新回合：重置streetBet和acted，所有玩家重新下注
      activePlayers.forEach((i) => {
        st.seats[i].streetBet = 0;
        st.seats[i].acted = false;
      });
      // 从庄家下家开始新一轮
      let startIdx = nextActive(st, st.dealer);
      if (startIdx < 0) startIdx = activePlayers[0];
      st.turn = startIdx;
      st.lastActionTime = Date.now();
      return { ok: true };
    }

    st.turn = nxt;
    st.lastActionTime = Date.now();
    return { ok: true };
  },
};

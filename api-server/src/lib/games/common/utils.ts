// Shared utilities for game engines
import { Card, cardLabel } from "./cards";
import { HandState } from "./types";

/**
 * Get the score of a player's hand.
 * This is a fallback when st.spec.scoreOf is not available.
 */
export function scoreOf(st: HandState, seat: { cards: Card[] }): { score: number; name: string; mult?: number } {
  if (st.gameType && (!st.spec || !st.spec.scoreOf)) {
    // Try to load spec dynamically
    try {
      const { getSpec } = require("../../engine/specs");
      st.spec = getSpec(st.gameType);
    } catch (e) {
      // ignore
    }
  }
  if (st.spec?.scoreOf) {
    return st.spec.scoreOf(seat.cards);
  }
  return { score: 0, name: "未知", mult: 1 };
}

/**
 * Client-safe projection of HandState for WebSocket broadcast and API responses.
 */
export function publicState(
  st: HandState,
  viewerId: number | null,
  isSpectator = false
) {
  // 兜底：确保 spec 存在（包含 canSeeCards/scoreOf 函数，JSON序列化会丢失）
  if (!st.spec || !st.spec.canSeeCards) {
    try {
      const { getSpec } = require("../../engine/specs");
      st.spec = getSpec(st.gameType);
    } catch (e) {
      // ignore
    }
  }
  
  return {
    gameType: st.gameType,
    roundNo: st.roundNo,
    phase: st.phase,
    pot: st.pot,
    currentBet: st.currentBet,
    baseBet: st.baseBet,
    bettingRound: st._bettingRound ?? 0,
    maxBettingRound: 20,
    community: st.community.map(cardLabel),
    dealer: st.dealer,
    turnUserId: st.turn >= 0 ? st.seats[st.turn].userId : null,
    bankerUserId:
      st.bankerIdx !== null ? st.seats[st.bankerIdx].userId : null,
    finished: st.finished,
    log: st.log.slice(-8),
    result: st.result
      ? {
          ...st.result,
          hands: st.result.hands.map((h) => ({
            ...h,
            cards: isSpectator ? [] : h.cards,
          })),
        }
      : null,
    seats: st.seats.map((s) => {
      const isMe = s.userId === viewerId;
      const isCurrentActing =
        st.turn >= 0 && st.seats[st.turn].userId === s.userId;
      
      const spec = st.spec;
      let canSeeOwn = st.phase === "dealt" || st.finished;
      if (spec?.canSeeCards) {
        const viewerSeat = viewerId !== null ? st.seats.find((x) => x.userId === viewerId) : null;
        if (viewerSeat) {
          canSeeOwn = spec.canSeeCards(s, viewerSeat, st.phase);
        }
      }
      
      const reveal = isSpectator
        ? false
        : (isMe && canSeeOwn) ||
          (st.finished && !s.folded) ||
          (st.phase === "dealt" && s.acted) ||  // 已开牌的玩家显示牌面，方便比牌
          s.revealed === true;  // 比牌后亮出的牌对所有玩家可见
      
      return {
        userId: s.userId,
        account: s.account,
        points: s.points,
        streetBet: s.streetBet,
        totalBet: s.totalBet,
        folded: s.folded,
        allin: s.allin,
        looked: s.looked,
        acted: s.acted,
        diceRoll: s.diceRoll,
        revealed: s.revealed === true,
        eliminatedBy: (s as any).eliminatedBy || null,
        cardCount: s.cards.length,
        cards: reveal ? s.cards.map(cardLabel) : null,
        handName:
          (st.finished && !s.folded) || (isMe && canSeeOwn) || (st.phase === "dealt" && s.acted) || s.revealed === true
            ? (s.cards.length > 0 ? scoreOf(st, s).name : null)
            : null,
        mult:
          (st.finished && !s.folded) || (isMe && canSeeOwn) || (st.phase === "dealt" && s.acted) || s.revealed === true
            ? (s.cards.length > 0 ? (scoreOf(st, s).mult ?? 1) : 1)
            : 1,
        autoPlay: s.autoPlay === true,
      };
    }),
  };
}

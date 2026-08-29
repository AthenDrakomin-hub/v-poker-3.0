// Spec definitions for all games (backward-compatible wrapper)
import { GameSpec } from "./types";
import { jinhuaScore, jinhuaCompare } from "../../games/jinhua/cards";
import { niuniuScore } from "../../games/niuniu/cards";
import { sangongScore } from "../../games/sangong/cards";
import { texasScore } from "../../games/texas/cards";

export const texasSpec: GameSpec = {
  scoreOf: (cards, community) => {
    const allCards = community ? [...community, ...cards] : cards;
    return texasScore(allCards);
  },
  compareCards: (a, b, community) => {
    return texasScore([...community ?? [], ...a]).score - texasScore([...community ?? [], ...b]).score;
  },
  canSeeCards: (seat, viewer, phase) => {
    // 自己永远能看自己的牌
    if (seat.userId === viewer.userId) return true;
    // 摊牌/结算阶段，可以看所有非弃牌玩家的牌
    return (phase === "showdown" || phase === "settlement") && !seat.folded;
  },
};

export const jinhuaSpec: GameSpec = {
  scoreOf: (cards) => ({ ...jinhuaScore(cards), mult: 1 }),
  compareCards: jinhuaCompare,
  canSeeCards: (seat, viewer, phase) => {
    // 炸金花规则：默认暗牌，自己也看不到自己的牌
    // 只有点击"看牌"后（looked=true），自己才能看到自己的牌
    if (seat.userId === viewer.userId) {
      return seat.looked === true;
    }
    // 对手的牌：betting 阶段看不到；showdown 阶段可看所有非弃牌玩家的牌
    return phase === "showdown" && !seat.folded;
  },
};

export const niuniuSpec: GameSpec = {
  scoreOf: (cards) => niuniuScore(cards),
  canSeeCards: (seat, viewer, phase) => phase === "dealt" || phase === "showdown" || !seat.folded,
};

export const tbnnSpec: GameSpec = {
  scoreOf: (cards) => {
    const result = niuniuScore(cards);
    return { ...result, mult: 1 };
  },
  canSeeCards: (seat, viewer, phase) => phase === "dealt" || phase === "showdown" || !seat.folded,
};

export const sangongSpec: GameSpec = {
  scoreOf: (cards) => sangongScore(cards),
  canSeeCards: (seat, viewer, phase) => phase === "dealt" || phase === "showdown" || !seat.folded,
};

export const SPEC_MAP: Record<string, GameSpec> = {
  texas: texasSpec,
  jinhua: jinhuaSpec,
  niuniu: niuniuSpec,
  tbnn: tbnnSpec,
  sangong: sangongSpec,
};

export function getSpec(gameType: string): GameSpec {
  return SPEC_MAP[gameType] || niuniuSpec;
}

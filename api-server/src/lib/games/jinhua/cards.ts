// Jinhua (炸金花) specific card evaluation
import { Card } from "../common/cards";

export function jinhuaScore(three: Card[]): { score: number; name: string } {
  const ranks = three.map((c) => c.rank).sort((a, b) => b - a);
  const suits = three.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(ranks)];

  let isStraight = false;
  let straightHigh = ranks[0];
  if (uniq.length === 3) {
    if (ranks[0] - ranks[2] === 2) isStraight = true;
    else if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
      isStraight = true;
      straightHigh = 3;
    }
  }

  const tb = (cat: number, ks: number[]) =>
    cat * 1e8 + ks.reduce((a, k, i) => a + k * Math.pow(15, 2 - i), 0);

  if (!isFlush && ranks[0] === 5 && ranks[1] === 3 && ranks[2] === 2) {
    return { score: tb(0, [5, 3, 2]), name: "特殊235" };
  }
  if (uniq.length === 1) return { score: tb(6, ranks), name: "豹子" };
  if (isStraight && isFlush)
    return { score: tb(5, [straightHigh]), name: "同花顺" };
  if (isFlush) return { score: tb(4, ranks), name: "金花" };
  if (isStraight) return { score: tb(3, [straightHigh]), name: "顺子" };
  if (uniq.length === 2) {
    const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[1];
    const single = ranks.find((r) => r !== pairRank)!;
    return { score: tb(2, [pairRank, single]), name: "对子" };
  }
  return { score: tb(1, ranks), name: "散牌" };
}

export function jinhuaCompare(a: Card[], b: Card[]): number {
  const sa = jinhuaScore(a);
  const sb = jinhuaScore(b);
  const aIs235 = sa.name === "特殊235";
  const bIs235 = sb.name === "特殊235";
  const aIsBaozi = sa.name === "豹子";
  const bIsBaozi = sb.name === "豹子";

  if (aIs235 && bIsBaozi) return 1;
  if (bIs235 && aIsBaozi) return -1;
  if (aIs235 && bIs235) return 0;

  return sa.score - sb.score;
}

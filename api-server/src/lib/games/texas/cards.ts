// Texas Hold'em specific card evaluation
import { Card } from "../common/cards";

export function texasScore(seven: Card[]): { score: number; name: string } {
  const combos = combinations(seven, 5);
  let best = { score: -1, name: "" };
  for (const c of combos) {
    const s = five(c);
    if (s.score > best.score) best = s;
  }
  return best;
}

function five(cards: Card[]): { score: number; name: string } {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (
      uniq[0] === 14 &&
      uniq[1] === 5 &&
      uniq[2] === 4 &&
      uniq[3] === 3 &&
      uniq[4] === 2
    )
      straightHigh = 5;
  }
  
  const counts: Record<number, number> = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const primary = groups.map((g) => g.rank);
  const tiebreak = (cat: number, kickers: number[]) =>
    cat * 1e10 +
    kickers.reduce((acc, k, i) => acc + k * Math.pow(15, 4 - i), 0);

  if (straightHigh && isFlush)
    return { score: tiebreak(8, [straightHigh]), name: straightHigh === 14 ? "皇家同花顺" : "同花顺" };
  if (groups[0].count === 4)
    return {
      score: tiebreak(7, [groups[0].rank, groups[1].rank]),
      name: "四条",
    };
  if (groups[0].count === 3 && groups[1].count === 2)
    return {
      score: tiebreak(6, [groups[0].rank, groups[1].rank]),
      name: "葫芦",
    };
  if (isFlush) return { score: tiebreak(5, ranks), name: "同花" };
  if (straightHigh) return { score: tiebreak(4, [straightHigh]), name: "顺子" };
  if (groups[0].count === 3)
    return { score: tiebreak(3, primary), name: "三条" };
  if (groups[0].count === 2 && groups[1].count === 2)
    return { score: tiebreak(2, primary), name: "两对" };
  if (groups[0].count === 2) return { score: tiebreak(1, primary), name: "一对" };
  return { score: tiebreak(0, ranks), name: "高牌" };
}

function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const combo: T[] = [];
  const rec = (start: number) => {
    if (combo.length === k) {
      res.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  return res;
}

export function texasCompareCards(a: Card[], b: Card[], community?: Card[]): number {
  const aCards = community ? [...community, ...a] : a;
  const bCards = community ? [...community, ...b] : b;
  const sa = texasScore(aCards);
  const sb = texasScore(bCards);
  if (sa.score !== sb.score) return sa.score - sb.score;
  const rankA = [...aCards].sort((x, y) => y.rank - x.rank);
  const rankB = [...bCards].sort((x, y) => y.rank - x.rank);
  for (let i = 0; i < rankA.length; i++) {
    if (rankA[i].rank !== rankB[i].rank) return rankA[i].rank - rankB[i].rank;
  }
  return 0;
}

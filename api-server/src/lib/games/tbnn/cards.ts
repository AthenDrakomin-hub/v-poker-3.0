// Tbnn (通比牛牛) specific card evaluation - WITH JOKERS
import { Card } from "../common/cards";

function niuPoint(rank: number): number {
  if (rank > 14) return -1; // 大小王
  if (rank === 14) return 1;
  if (rank >= 10) return 10;
  return rank;
}

export function tbnnScore(five: Card[]): {
  score: number;
  name: string;
  mult: number;
} {
  const suitWeight = (s: string) => (s === "S" ? 3 : s === "H" ? 2 : s === "C" ? 1 : 0);
  const maxRank = Math.max(...five.map((c) => c.rank));
  const maxSuit = Math.max(...five.filter((c) => c.rank === maxRank).map((c) => suitWeight(c.suit)));

  // 通比牛牛有大小王（百搭）
  const jokerIdx = five.map((c, i) => c.rank > 14 ? i : -1).filter(i => i >= 0);
  const nonJokers = five.filter((c) => c.rank <= 14);
  const jkCount = jokerIdx.length;

  const nonJokerPts = nonJokers.map(c => niuPoint(c.rank));
  
  // 检查五小牛（所有牌≤5且总和≤10）
  const allNonJokerSmall = nonJokerPts.every(p => p > 0 && p <= 5);
  if (allNonJokerSmall && jkCount <= 5) {
    const nonJokerTotal = nonJokerPts.reduce((a, b) => a + b, 0);
    const total = nonJokerTotal + jkCount;
    if (total <= 10) {
      return { score: 70000 + (10 - total) * 100 + maxRank * 10 + maxSuit, name: "五小牛", mult: 6 };
    }
  }

  // 检查炸弹（四张相同，大小王可百搭）
  const counts: Record<number, number> = {};
  for (const c of nonJokers) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const quadRank = Object.entries(counts).find(([, n]) => n + jkCount >= 4)?.[0];
  if (quadRank) {
    return { score: 60000 + Number(quadRank) * 100 + maxRank * 10 + maxSuit, name: "炸弹", mult: 5 };
  }

  // 检查五花牛（全部为J/Q/K，大小王可百搭）
  const nonJokerFaces = nonJokers.filter(c => c.rank >= 11 && c.rank <= 13).length;
  if (nonJokerFaces + jkCount === 5) {
    const faceMax = nonJokers.length > 0 ? Math.max(...nonJokers.map(c => c.rank)) : 13;
    return { score: 50000 + faceMax * 100 + maxSuit, name: "五花牛", mult: 4 };
  }

  // 计算牛数
  const basePts = nonJokerPts;
  let bestScore = -1;
  let bestName = "无牛";
  let bestMult = 1;

  function tryCombo(values: number[]) {
    const pts = [...basePts, ...values];
    const idx = [0, 1, 2, 3, 4];
    let niuVal = -1;
    for (const combo of combinations(idx, 3)) {
      const s = combo.reduce((a, i) => a + pts[i], 0);
      if (s % 10 === 0) {
        const rest = idx.filter((i) => !combo.includes(i));
        const r = (pts[rest[0]] + pts[rest[1]]) % 10;
        niuVal = Math.max(niuVal, r === 0 ? 10 : r);
      }
    }
    if (niuVal < 0) {
      const score = 0 + maxRank * 10 + maxSuit;
      if (score > bestScore) { bestScore = score; bestName = "无牛"; bestMult = 1; }
    } else if (niuVal === 10) {
      const score = 20000 + maxRank * 10 + maxSuit;
      if (score > bestScore) { bestScore = score; bestName = "牛牛"; bestMult = 3; }
    } else {
      const score = 10000 + niuVal * 100 + maxRank * 10 + maxSuit;
      if (score > bestScore) { bestScore = score; bestName = `牛${niuVal}`; bestMult = niuVal >= 7 ? 2 : 1; }
    }
  }

  if (jkCount === 0) {
    tryCombo([]);
  } else if (jkCount === 1) {
    for (let v = 1; v <= 10; v++) tryCombo([v]);
  } else if (jkCount === 2) {
    for (let v1 = 1; v1 <= 10; v1++) {
      for (let v2 = 1; v2 <= 10; v2++) {
        tryCombo([v1, v2]);
      }
    }
  }

  return { score: bestScore, name: bestName, mult: bestMult };
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

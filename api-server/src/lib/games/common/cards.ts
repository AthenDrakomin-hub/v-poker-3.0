// Cards & game evaluation utilities - Texas, Jinhua, Sangong, Niuniu, Tbnn

import { randomInt } from "crypto";

export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  rank: number;
  suit: Suit;
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export function rankLabel(rank: number): string {
  if (rank === 16) return "大王";
  if (rank === 15) return "小王";
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  if (rank === 10) return "10";
  return String(rank);
}

export function cardLabel(c: Card): string {
  if (c.rank === 16) return "🃏黑";
  if (c.rank === 15) return "🃏红";
  return `${SUIT_SYMBOL[c.suit]}${rankLabel(c.rank)}`;
}

export function freshDeck(useJokers: boolean = false): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  if (useJokers) {
    deck.push({ rank: 15, suit: "S" });
    deck.push({ rank: 16, suit: "S" });
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); // 使用加密安全的随机数
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function combinations<T>(arr: T[], k: number): T[][] {
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

// Texas Hold'em engine unit tests
import { vi } from "vitest";
vi.mock("@/db", () => ({ db: {} }));

import { texasEngine } from "@/lib/games/texas/engine";
import { texasScore } from "@/lib/games/texas/cards";
import { Card } from "@/lib/games/common/cards";
import { GameError } from "@/lib/games/common/types";

describe("Texas Engine", () => {
  const players = [
    { userId: 1, account: "玩家A", points: 1000 },
    { userId: 2, account: "玩家B", points: 1000 },
  ];

  test("should create hand successfully", () => {
    const hand = texasEngine.createHand(players, "junior", 1, 0);
    expect(hand.gameType).toBe("texas");
    expect(hand.phase).toBe("preflop");
    expect(hand.seats.length).toBe(2);
  });

  test("texas score - royal flush", () => {
    const cards: Card[] = [
      { rank: 14, suit: "S" }, // A
      { rank: 13, suit: "S" }, // K
      { rank: 12, suit: "S" }, // Q
      { rank: 11, suit: "S" }, // J
      { rank: 10, suit: "S" }, // 10
    ];
    const score = texasScore(cards);
    expect(score.name).toContain("皇家同花顺");
  });

  test("texas score - straight flush", () => {
    const cards: Card[] = [
      { rank: 9, suit: "H" },
      { rank: 8, suit: "H" },
      { rank: 7, suit: "H" },
      { rank: 6, suit: "H" },
      { rank: 5, suit: "H" },
    ];
    const score = texasScore(cards);
    expect(score.name).toContain("同花顺");
  });

  test("texas score - four of a kind", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" },
      { rank: 13, suit: "H" },
      { rank: 13, suit: "D" },
      { rank: 13, suit: "C" },
      { rank: 10, suit: "S" },
    ];
    const score = texasScore(cards);
    expect(score.name).toContain("四条");
  });
});

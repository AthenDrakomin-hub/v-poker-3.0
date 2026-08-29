// Niuniu (抢庄牛牛) engine unit tests
import { vi } from "vitest";
vi.mock("@/db", () => ({ db: {} }));

import { niuniuEngine } from "@/lib/games/niuniu/engine";
import { niuniuScore } from "@/lib/games/niuniu/cards";
import { Card } from "@/lib/games/common/cards";
import { GameError } from "@/lib/games/common/types";

describe("Niuniu Engine", () => {
  const players = [
    { userId: 1, account: "玩家A", points: 1000 },
    { userId: 2, account: "玩家B", points: 1000 },
    { userId: 3, account: "玩家C", points: 1000 },
  ];

  test("should create hand with grabbing phase", () => {
    const hand = niuniuEngine.createHand(players, "junior", 1, 0);
    expect(hand.gameType).toBe("niuniu");
    expect(hand.phase).toBe("grab");
  });

  test("player can roll dice in grab phase", () => {
    const hand = niuniuEngine.createHand(players, "junior", 1, 0);
    const result = niuniuEngine.applyAction(hand, 1, "roll_dice");
    expect(result.ok).toBe(true);
    expect(hand.seats[0].diceRoll).toBeTruthy();
  });

  test("player cannot roll dice twice", () => {
    const hand = niuniuEngine.createHand(players, "junior", 1, 0);
    niuniuEngine.applyAction(hand, 1, "roll_dice");
    const result = niuniuEngine.applyAction(hand, 1, "roll_dice");
    expect(result.ok).toBe(false);
    expect(result.error).toBe(GameError.ALREADY_ACTED);
  });

  test("niuniu score calculation - bull nine", () => {
    // 9+1+10=20 (有牛), 5+4=9 → 牛九
    const cards: Card[] = [
      { rank: 9, suit: "S" },
      { rank: 1, suit: "H" },
      { rank: 10, suit: "D" },
      { rank: 5, suit: "C" },
      { rank: 4, suit: "S" },
    ];
    const score = niuniuScore(cards);
    expect(score.name).toContain("牛9");
  });

  test("niuniu score calculation - bull bull", () => {
    // 5+5+10=20 (有牛), 1+9=10 (有牛) → 牛牛
    const cards: Card[] = [
      { rank: 5, suit: "S" },
      { rank: 5, suit: "H" },
      { rank: 10, suit: "D" },
      { rank: 1, suit: "C" },
      { rank: 9, suit: "S" },
    ];
    const score = niuniuScore(cards);
    expect(score.name).toContain("牛牛");
  });
});

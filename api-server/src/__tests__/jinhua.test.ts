// Jinhua (炸金花) engine unit tests
import { vi } from "vitest";
vi.mock("@/db", () => ({ db: {} }));

import { jinhuaEngine } from "@/lib/games/jinhua/engine";
import { jinhuaScore, jinhuaCompare } from "@/lib/games/jinhua/cards";
import { Card } from "@/lib/games/common/cards";
import { GameError } from "@/lib/games/common/types";

describe("Jinhua Engine", () => {
  const players = [
    { userId: 1, account: "玩家A", points: 1000 },
    { userId: 2, account: "玩家B", points: 1000 },
    { userId: 3, account: "玩家C", points: 1000 },
  ];

  test("should create hand successfully", () => {
    const hand = jinhuaEngine.createHand(players, "junior", 1, 0);
    expect(hand.gameType).toBe("jinhua");
    expect(hand.phase).toBe("betting");
    expect(hand.seats.length).toBe(3);
    expect(hand.seats[0].cards.length).toBe(3);
  });

  test("player can call bet", () => {
    const hand = jinhuaEngine.createHand(players, "junior", 1, 0);
    const result = jinhuaEngine.applyAction(hand, 1, "call");
    expect(result.ok).toBe(true);
  });

  test("player can fold", () => {
    const hand = jinhuaEngine.createHand(players, "junior", 1, 0);
    const result = jinhuaEngine.applyAction(hand, 1, "fold");
    expect(result.ok).toBe(true);
    expect(hand.seats[0].folded).toBe(true);
  });

  test("player cannot act after folding", () => {
    const hand = jinhuaEngine.createHand(players, "junior", 1, 0);
    jinhuaEngine.applyAction(hand, 1, "fold");
    // After fold, it's not this player's turn anymore
    const result = jinhuaEngine.applyAction(hand, 1, "bet", 10);
    expect(result.ok).toBe(false);
  });

  test("compare leopard beats straight flush", () => {
    const leopard: Card[] = [
      { rank: 13, suit: "S" },
      { rank: 13, suit: "H" },
      { rank: 13, suit: "D" },
    ];
    const straightFlush: Card[] = [
      { rank: 14, suit: "S" },
      { rank: 13, suit: "S" },
      { rank: 12, suit: "S" },
    ];
    const result = jinhuaCompare(leopard, straightFlush);
    expect(result).toBeGreaterThan(0); // leopard wins
  });
});

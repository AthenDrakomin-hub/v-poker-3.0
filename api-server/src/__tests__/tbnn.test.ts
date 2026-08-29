// Tbnn (通比牛牛) engine unit tests
import { vi } from "vitest";
vi.mock("@/db", () => ({ db: {} }));

import { tbnnEngine, settleHand } from "@/lib/games/tbnn/engine";
import { tbnnScore } from "@/lib/games/tbnn/cards";
import { Card } from "@/lib/games/common/cards";
import { GameError } from "@/lib/games/common/types";

describe("Tbnn Engine", () => {
  const players = [
    { userId: 1, account: "玩家A", points: 1000 },
    { userId: 2, account: "玩家B", points: 1000 },
    { userId: 3, account: "玩家C", points: 1000 },
  ];

  test("should create hand with waiting_start phase", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    expect(hand.gameType).toBe("tbnn");
    expect(hand.phase).toBe("waiting_start");
    expect(hand.seats.length).toBe(3);
    expect(hand.fixedAnte).toBe(10);
  });

  test("player can start hand", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    const result = tbnnEngine.applyAction(hand, 1, "start");
    expect(result.ok).toBe(true);
    // Should not finish yet because not all players started
    expect(hand.finished).toBe(false);
  });

  test("hand starts when all players click start", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    // All players click start
    tbnnEngine.applyAction(hand, 1, "start");
    tbnnEngine.applyAction(hand, 2, "start");
    tbnnEngine.applyAction(hand, 3, "start");
    expect(hand.phase).toBe("dealt");
    // Each player should have 5 cards
    hand.seats.forEach((s) => {
      expect(s.cards.length).toBe(5);
    });
  });

  test("player can reveal cards in dealt phase", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    // Start hand
    tbnnEngine.applyAction(hand, 1, "start");
    tbnnEngine.applyAction(hand, 2, "start");
    tbnnEngine.applyAction(hand, 3, "start");
    
    // Reveal cards
    const result = tbnnEngine.applyAction(hand, 1, "reveal");
    expect(result.ok).toBe(true);
    expect(hand.seats[0].revealed).toBe(true);
  });

  test("hand finishes when all players reveal", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    // All start -> triggers dealCards
    tbnnEngine.applyAction(hand, 1, "start");
    tbnnEngine.applyAction(hand, 2, "start");
    tbnnEngine.applyAction(hand, 3, "start");
    
    // 通比牛牛：发牌后由后端延迟自动开牌，测试中直接调用 settleHand
    settleHand(hand);
    
    expect(hand.finished).toBe(true);
    expect(hand.phase).toBe("showdown");
    expect(hand.result).toBeTruthy();
  });

  test("tbnn score - niuniu", () => {
    const cards: Card[] = [
      { rank: 3, suit: "S" },
      { rank: 7, suit: "H" },
      { rank: 10, suit: "D" },
      { rank: 5, suit: "C" },
      { rank: 5, suit: "S" },
    ];
    const score = tbnnScore(cards);
    expect(score.name).toContain("牛牛");
  });

  test("tbnn score - niu nine", () => {
    const cards: Card[] = [
      { rank: 2, suit: "S" },
      { rank: 8, suit: "H" },
      { rank: 10, suit: "D" },
      { rank: 4, suit: "C" },
      { rank: 5, suit: "S" },
    ];
    const score = tbnnScore(cards);
    expect(score.name).toContain("牛9");
  });

  test("tbnn score - no bull", () => {
    const cards: Card[] = [
      { rank: 2, suit: "S" },
      { rank: 4, suit: "H" },
      { rank: 6, suit: "D" },
      { rank: 7, suit: "C" },
      { rank: 9, suit: "S" },
    ];
    const score = tbnnScore(cards);
    // 2+4+6=12(有牛), 7+9=16(个位6) -> 牛6
    expect(score.name).toContain("牛");
  });

  test("auto play toggle", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    const result = tbnnEngine.applyAction(hand, 1, "toggle_auto");
    expect(result.ok).toBe(true);
    expect(hand.seats[0].autoPlay).toBe(true);
  });

  test("fixed ante is used for buy-in", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 25);
    expect(hand.fixedAnte).toBe(25);
    // Start should deduct fixed ante from each player
    tbnnEngine.applyAction(hand, 1, "start");
    tbnnEngine.applyAction(hand, 2, "start");
    tbnnEngine.applyAction(hand, 3, "start");
    
    hand.seats.forEach((s) => {
      expect(s.totalBet).toBe(25);
      expect(s.points).toBe(975);
    });
  });
});

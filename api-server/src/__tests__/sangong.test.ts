// Sangong (三公) engine unit tests
import { vi } from "vitest";
vi.mock("@/db", () => ({ db: {} }));

import { sangongEngine } from "@/lib/games/sangong/engine";
import { sangongScore } from "@/lib/games/sangong/cards";
import { Card } from "@/lib/games/common/cards";
import { GameError } from "@/lib/games/common/types";

describe("Sangong Engine", () => {
  const players = [
    { userId: 1, account: "玩家A", points: 1000 },
    { userId: 2, account: "玩家B", points: 1000 },
    { userId: 3, account: "玩家C", points: 1000 },
  ];

  test("should create hand with grab phase", () => {
    const hand = sangongEngine.createHand(players, "junior", 1, 0);
    expect(hand.gameType).toBe("sangong");
    expect(hand.phase).toBe("grab");
  });

  test("player can roll dice in grab phase", () => {
    const hand = sangongEngine.createHand(players, "junior", 1, 0);
    const result = sangongEngine.applyAction(hand, 1, "roll");
    expect(result.ok).toBe(true);
    expect(hand.seats[0].diceRoll).toBeGreaterThan(0);
  });

  test("player can reveal cards", () => {
    const hand = sangongEngine.createHand(players, "junior", 1, 0);
    // Simulate to dealt phase
    hand.phase = "dealt";
    const result = sangongEngine.applyAction(hand, 1, "reveal");
    expect(result.ok).toBe(true);
    expect(hand.seats[0].revealed).toBe(true);
  });

  test("player cannot confirm twice in dealt phase", () => {
    const hand = sangongEngine.createHand(players, "junior", 1, 0);
    hand.phase = "dealt";
    hand.seats.forEach((s) => { s.cards = [{ rank: 1, suit: "S" }, { rank: 2, suit: "H" }, { rank: 3, suit: "C" }]; });
    sangongEngine.applyAction(hand, 1, "confirm");
    const result = sangongEngine.applyAction(hand, 1, "confirm");
    expect(result.ok).toBe(false);
    expect(result.error).toBe(GameError.ALREADY_ACTED);
  });

  test("sangong score - double public 9 points", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, // K
      { rank: 12, suit: "H" }, // Q
      { rank: 9, suit: "D" },  // 9
    ];
    const score = sangongScore(cards);
    expect(score.score).toBeGreaterThan(0);
  });

  test("sangong score - san gong (all public)", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, // K
      { rank: 12, suit: "H" }, // Q
      { rank: 11, suit: "D" }, // J
    ];
    const score = sangongScore(cards);
    expect(score.mult).toBeGreaterThanOrEqual(5);
  });

  // ===== V3新牌型规则验证 =====
  test("大三公 KKK 倍数为6", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, { rank: 13, suit: "H" }, { rank: 13, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("大三公");
    expect(score.mult).toBe(6);
  });

  test("小三公 KKQ 倍数为5", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, { rank: 13, suit: "H" }, { rank: 12, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("小三公");
    expect(score.mult).toBe(5);
  });

  test("混三公 KQJ 倍数为5", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, { rank: 12, suit: "H" }, { rank: 11, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("混三公");
    expect(score.mult).toBe(5);
  });

  test("豹子 AAA 倍数为4（非公牌三张相同）", () => {
    const cards: Card[] = [
      { rank: 14, suit: "S" }, { rank: 14, suit: "H" }, { rank: 14, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("豹子");
    expect(score.mult).toBe(4);
  });

  test("豹子 222 倍数为4", () => {
    const cards: Card[] = [
      { rank: 2, suit: "S" }, { rank: 2, suit: "H" }, { rank: 2, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("豹子");
    expect(score.mult).toBe(4);
  });

  test("双公9点 KQ9 倍数为3", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, { rank: 12, suit: "H" }, { rank: 9, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("双公9点");
    expect(score.mult).toBe(3);
  });

  test("9点（无公）A26 倍数为3", () => {
    // A=1, 2=2, 6=6, sum=9, point=9
    const cards: Card[] = [
      { rank: 14, suit: "S" }, { rank: 2, suit: "H" }, { rank: 6, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("9点");
    expect(score.mult).toBe(3);
  });

  test("双公8点 KQ8 倍数为2", () => {
    const cards: Card[] = [
      { rank: 13, suit: "S" }, { rank: 12, suit: "H" }, { rank: 8, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("双公8点");
    expect(score.mult).toBe(2);
  });

  test("8点（无公）A25 倍数为2", () => {
    // A=1, 2=2, 5=5, sum=8, point=8
    const cards: Card[] = [
      { rank: 14, suit: "S" }, { rank: 2, suit: "H" }, { rank: 5, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("8点");
    expect(score.mult).toBe(2);
  });

  test("7点（无公）A24 倍数为1", () => {
    // A=1, 2=2, 4=4, sum=7, point=7
    const cards: Card[] = [
      { rank: 14, suit: "S" }, { rank: 2, suit: "H" }, { rank: 4, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.name).toBe("7点");
    expect(score.mult).toBe(1);
  });

  test("双公7点 KQ7 归入7点及以下，倍数为1", () => {
    // K=0, Q=0, 7=7, sum=7, point=7, faces=2
    const cards: Card[] = [
      { rank: 13, suit: "S" }, { rank: 12, suit: "H" }, { rank: 7, suit: "D" },
    ];
    const score = sangongScore(cards);
    expect(score.mult).toBe(1);
  });

  test("牌型大小顺序：大三公 > 小三公 > 混三公 > 豹子 > 双公9点 > 9点 > 双公8点 > 8点 > 7点", () => {
    const daSan = sangongScore([{rank:13,suit:"S"},{rank:13,suit:"H"},{rank:13,suit:"D"}]);
    const xiaoSan = sangongScore([{rank:13,suit:"S"},{rank:13,suit:"H"},{rank:12,suit:"D"}]);
    const hunSan = sangongScore([{rank:13,suit:"S"},{rank:12,suit:"H"},{rank:11,suit:"D"}]);
    const baozi = sangongScore([{rank:14,suit:"S"},{rank:14,suit:"H"},{rank:14,suit:"D"}]);
    const shuangGong9 = sangongScore([{rank:13,suit:"S"},{rank:12,suit:"H"},{rank:9,suit:"D"}]);
    const dian9 = sangongScore([{rank:14,suit:"S"},{rank:2,suit:"H"},{rank:6,suit:"D"}]);
    const shuangGong8 = sangongScore([{rank:13,suit:"S"},{rank:12,suit:"H"},{rank:8,suit:"D"}]);
    const dian8 = sangongScore([{rank:14,suit:"S"},{rank:2,suit:"H"},{rank:5,suit:"D"}]);
    const dian7 = sangongScore([{rank:14,suit:"S"},{rank:2,suit:"H"},{rank:4,suit:"D"}]);

    expect(daSan.score).toBeGreaterThan(xiaoSan.score);
    expect(xiaoSan.score).toBeGreaterThan(hunSan.score);
    expect(hunSan.score).toBeGreaterThan(baozi.score);
    expect(baozi.score).toBeGreaterThan(shuangGong9.score);
    expect(shuangGong9.score).toBeGreaterThan(dian9.score);
    expect(dian9.score).toBeGreaterThan(shuangGong8.score);
    expect(shuangGong8.score).toBeGreaterThan(dian8.score);
    expect(dian8.score).toBeGreaterThan(dian7.score);
  });
});

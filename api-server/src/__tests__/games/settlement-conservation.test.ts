import { describe, it, expect, vi } from "vitest";

// Mock 掉数据库依赖
vi.mock("@/db", () => ({
  db: {},
}));

import { niuniuEngine } from "@/lib/games/niuniu/engine";
import { sangongEngine } from "@/lib/games/sangong/engine";
import { tbnnEngine, settleHand as settleTbnnHand } from "@/lib/games/tbnn/engine";
import { jinhuaEngine } from "@/lib/games/jinhua/engine";
import { HandState, Seat, Card } from "@/lib/games/common/types";

// ==================== 测试辅助函数 ====================

function makePlayers(count: number, points: number = 100) {
  return Array.from({ length: count }, (_, i) => ({
    userId: 100 + i,
    account: `P${i + 1}`,
    points,
  }));
}

function totalChips(st: HandState): number {
  return st.seats.reduce((sum, s) => sum + s.points, 0) + st.pot;
}

function setCards(seat: Seat, cards: Card[]) {
  seat.cards = cards;
}

// 创建完整的手牌并设置结算状态
function createFinishedHand(
  gameEngine: any,
  players: any[],
  level: string,
  bankerIdx: number,
  bets: Map<number, number>,
  cards: Card[][],
  rakeBaseType: string = "pot"
): HandState {
  const st = gameEngine.createHand(players, level, 1, 0);
  st.phase = "dealt";
  st.bankerIdx = bankerIdx;
  st.rakeBaseType = rakeBaseType;

  // 设置牌
  cards.forEach((handCards, idx) => {
    setCards(st.seats[idx], handCards);
  });

  // 设置下注
  bets.forEach((amt, userId) => {
    const idx = st.seats.findIndex(s => s.userId === userId);
    if (idx >= 0) {
      st.seats[idx].points -= amt;
      st.seats[idx].totalBet = amt;
      st.pot += amt;
    }
  });

  // 庄家不设totalBet
  st.seats[bankerIdx].totalBet = 0;

  return st;
}

// ==================== 抢庄牛牛完整测试 ====================

describe("抢庄牛牛(niuniu) 完整测试", () => {
  it("createHand 应正确初始化并从V2配置读取参数", () => {
    const players = makePlayers(3, 100);
    const st = niuniuEngine.createHand(players, "junior", 1, 0);
    expect(st.gameType).toBe("niuniu");
    expect(st.phase).toBe("grab");
    expect(st.rakeRate).toBeGreaterThan(0);
    expect(st.rakeBaseType).toBeDefined();
  });

  it("3人全下注闲家赢庄家应守恒(pot模式)", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
      ],
      "pot"
    );
    const before = totalChips(st);
    const beforePot = st.pot;
    niuniuEngine.applyAction(st, players[0].userId, "confirm");
    niuniuEngine.applyAction(st, players[1].userId, "confirm");
    const result = niuniuEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
    expect(st.pot).toBe(0);
    expect(st.result?.flow).toBe(beforePot);
  });

  it("3人全下注闲家赢庄家应守恒(flow模式)", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
      ],
      "flow"
    );
    const before = totalChips(st);
    niuniuEngine.applyAction(st, players[0].userId, "confirm");
    niuniuEngine.applyAction(st, players[1].userId, "confirm");
    const result = niuniuEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
    expect(st.pot).toBe(0);
  });

  it("未下注闲家不应参与结算", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 9 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
      ]
    );
    const beforePoints = st.seats[2].points;
    niuniuEngine.applyAction(st, players[2].userId, "confirm");
    expect(st.seats[2].points).toBe(beforePoints);
  });

  it("庄家赢时应正确结算", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
      ]
    );
    const before = totalChips(st);
    niuniuEngine.applyAction(st, players[0].userId, "confirm");
    niuniuEngine.applyAction(st, players[1].userId, "confirm");
    const result = niuniuEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    expect(st.pot).toBe(0);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
  });

  it("单个闲家赢时抽水应从该闲家扣除", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
      ]
    );
    niuniuEngine.applyAction(st, players[0].userId, "confirm");
    niuniuEngine.applyAction(st, players[1].userId, "confirm");
    const result = niuniuEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.result?.hands[1].rake).toBeGreaterThan(0);
    expect(st.result?.hands[2].rake).toBe(0);
  });

  it("不同抽水比例应正确计算", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
      ],
      "pot"
    );
    st.rakeRate = 5;
    niuniuEngine.applyAction(st, players[0].userId, "confirm");
    niuniuEngine.applyAction(st, players[1].userId, "confirm");
    const result = niuniuEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.result?.rake).toBeCloseTo(1, 0);
  });

  it("多人局应正确处理结算", () => {
    const players = makePlayers(4, 100);
    const st = createFinishedHand(
      niuniuEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10], [103, 10]]),
      [
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }, { suit: "D", rank: 10 }, { suit: "S", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 5 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 6 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }, { suit: "D", rank: 4 }, { suit: "S", rank: 7 }],
      ]
    );
    const before = totalChips(st);
    niuniuEngine.applyAction(st, players[0].userId, "confirm");
    niuniuEngine.applyAction(st, players[1].userId, "confirm");
    niuniuEngine.applyAction(st, players[2].userId, "confirm");
    const result = niuniuEngine.applyAction(st, players[3].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.pot).toBe(0);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
  });
});

// ==================== 抢庄三公完整测试 ====================

describe("抢庄三公(sangong) 完整测试", () => {
  it("createHand 应正确初始化", () => {
    const players = makePlayers(3, 100);
    const st = sangongEngine.createHand(players, "junior", 1, 0);
    expect(st.gameType).toBe("sangong");
    expect(st.rakeBaseType).toBeDefined();
    expect(st.rakeRate).toBeGreaterThan(0);
  });

  it("3人全下注筹码应守恒(pot模式)", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      sangongEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }],
        [{ suit: "S", rank: 5 }, { suit: "H", rank: 6 }, { suit: "C", rank: 7 }],
      ],
      "pot"
    );
    const before = totalChips(st);
    const beforePot = st.pot;
    sangongEngine.applyAction(st, players[0].userId, "confirm");
    sangongEngine.applyAction(st, players[1].userId, "confirm");
    const result = sangongEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
    expect(st.pot).toBe(0);
    expect(st.result?.flow).toBe(beforePot);
  });

  it("3人全下注筹码应守恒(flow模式)", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      sangongEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }],
        [{ suit: "S", rank: 5 }, { suit: "H", rank: 6 }, { suit: "C", rank: 7 }],
      ],
      "flow"
    );
    const before = totalChips(st);
    sangongEngine.applyAction(st, players[0].userId, "confirm");
    sangongEngine.applyAction(st, players[1].userId, "confirm");
    const result = sangongEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
  });

  it("未下注闲家不应参与结算", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      sangongEngine, players, "junior", 0,
      new Map([[101, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }],
        [{ suit: "S", rank: 5 }, { suit: "H", rank: 6 }, { suit: "C", rank: 7 }],
      ]
    );
    const beforePoints = st.seats[2].points;
    sangongEngine.applyAction(st, players[2].userId, "confirm");
    expect(st.seats[2].points).toBe(beforePoints);
  });

  it("庄家赢时应正确结算", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      sangongEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
        [{ suit: "S", rank: 4 }, { suit: "H", rank: 5 }, { suit: "C", rank: 6 }],
      ]
    );
    const before = totalChips(st);
    sangongEngine.applyAction(st, players[0].userId, "confirm");
    sangongEngine.applyAction(st, players[1].userId, "confirm");
    const result = sangongEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    expect(st.pot).toBe(0);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
  });

  it("不同闲家牌型不同时结算应正常", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      sangongEngine, players, "junior", 0,
      new Map([[101, 10], [102, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }],
        [{ suit: "S", rank: 5 }, { suit: "H", rank: 6 }, { suit: "C", rank: 7 }],
      ]
    );
    const before = totalChips(st);
    sangongEngine.applyAction(st, players[0].userId, "confirm");
    sangongEngine.applyAction(st, players[1].userId, "confirm");
    const result = sangongEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
    expect(st.pot).toBe(0);
  });

  it("闲家三公对散牌庄家应赔付", () => {
    const players = makePlayers(3, 100);
    const st = createFinishedHand(
      sangongEngine, players, "junior", 0,
      new Map([[101, 10]]),
      [
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
        [{ suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 }],
        [{ suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 }],
      ]
    );
    const before = totalChips(st);
    sangongEngine.applyAction(st, players[0].userId, "confirm");
    sangongEngine.applyAction(st, players[1].userId, "confirm");
    const result = sangongEngine.applyAction(st, players[2].userId, "confirm");
    expect(result.ok).toBe(true);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
    expect(st.pot).toBe(0);
  });
});

// ==================== 通比牛牛完整测试 ====================

describe("通比牛牛(tbnn) 完整测试", () => {
  it("createHand 应正确初始化", () => {
    const players = makePlayers(3, 100);
    const st = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    expect(st.gameType).toBe("tbnn");
    expect(st.fixedAnte).toBe(10);
    expect(st.rakeBaseType).toBeDefined();
    expect(st.rakeRate).toBeGreaterThan(0);
  });

  it("应支持不同底注金额", () => {
    const players = makePlayers(3, 100);
    const st = tbnnEngine.createHand(players, "junior", 1, 0, 20);
    expect(st.fixedAnte).toBe(20);
  });

  it("3人固定底注应正确结算", () => {
    const players = makePlayers(3, 100);
    const st = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    st.phase = "dealt";
    st.seats.forEach((s: Seat) => {
      s.points -= 10;
      s.totalBet = 10;
      st.pot += 10;
      setCards(s, [
        { suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 },
        { suit: "D", rank: 4 }, { suit: "S", rank: 5 },
      ]);
    });
    const before = totalChips(st);
    settleTbnnHand(st);
    expect(st.finished).toBe(true);
    const after = totalChips(st);
    const rake = st.result?.rake ?? 0;
    expect(after).toBeCloseTo(before - rake, 1);
    expect(st.pot).toBe(0);
  });

  it("不同牌型应有不同胜负", () => {
    const players = makePlayers(3, 100);
    const st = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    st.phase = "dealt";
    st.seats.forEach((s: Seat, i: number) => {
      s.points -= 10;
      s.totalBet = 10;
      st.pot += 10;
      setCards(s, [
        { suit: "S", rank: i + 1 }, { suit: "H", rank: i + 2 }, { suit: "C", rank: i + 3 },
        { suit: "D", rank: i + 4 }, { suit: "S", rank: i + 5 },
      ]);
    });
    settleTbnnHand(st);
    expect(st.result?.winnerUserId).toBeDefined();
  });

  it("庄家牌型最大时应获胜", () => {
    const players = makePlayers(3, 100);
    const st = tbnnEngine.createHand(players, "junior", 1, 0, 10);
    st.phase = "dealt";
    st.seats.forEach((s: Seat, i: number) => {
      s.points -= 10;
      s.totalBet = 10;
      st.pot += 10;
      if (i === 0) {
        setCards(s, [
          { suit: "S", rank: 10 }, { suit: "H", rank: 10 }, { suit: "C", rank: 10 },
          { suit: "D", rank: 10 }, { suit: "S", rank: 10 },
        ]);
      } else {
        setCards(s, [
          { suit: "S", rank: 1 }, { suit: "H", rank: 2 }, { suit: "C", rank: 3 },
          { suit: "D", rank: 4 }, { suit: "S", rank: i + 5 },
        ]);
      }
    });
    settleTbnnHand(st);
    expect(st.result?.winnerUserId).toBe(100);
  });
});

// ==================== 炸金花守恒测试 ====================

describe("炸金花(jinhua) 守恒测试", () => {
  it("createHand 应正确初始化并从V2配置读取参数", () => {
    const players = makePlayers(3, 100);
    const st = jinhuaEngine.createHand(players, "junior", 1, 0);
    expect(st.gameType).toBe("jinhua");
    expect(st.phase).toBe("betting");
    expect(st.rakeBaseType).toBeDefined();
    expect(st.rakeRate).toBeGreaterThan(0);
  });
});

// ==================== 德州扑克测试（基础功能） ====================
// 注意：texas 需要 @pokertools/engine 包，需先安装依赖才能测试
// describe("德州扑克(texas) 守恒测试", () => {
//   it("createHand 应正确初始化", () => {
//     const players = makePlayers(2, 100);
//     const st = texasEngine.createHand(players, "junior", 1, 0);
//     expect(st.gameType).toBe("texas");
//     expect(st.phase).toBe("preflop");
//     expect(st.rakeBaseType).toBeDefined();
//     expect(st.rakeRate).toBeGreaterThan(0);
//   });
// });

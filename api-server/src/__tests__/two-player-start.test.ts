import { describe, expect, test, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { niuniuEngine } from "@/lib/games/niuniu/engine";
import { sangongEngine } from "@/lib/games/sangong/engine";
import { tbnnEngine } from "@/lib/games/tbnn/engine";
import { jinhuaEngine } from "@/lib/games/jinhua/engine";
import { texasEngine } from "@/lib/games/texas/engine";

const players = [
  { userId: 1, account: "player-one", points: 1000 },
  { userId: 2, account: "player-two", points: 1000 },
];

describe("two-player room starts", () => {
  test.each([
    ["niuniu", () => niuniuEngine.createHand(players, "junior", 1, 0)],
    ["sangong", () => sangongEngine.createHand(players, "junior", 1, 0)],
    ["tbnn", () => tbnnEngine.createHand(players, "junior", 1, 0, 10)],
    ["jinhua", () => jinhuaEngine.createHand(players, "junior", 1, 0)],
    ["texas", () => texasEngine.createHand(players, "junior", 1, 0)],
  ])("%s can create a hand with two players", (_, createHand) => {
    const hand = createHand();

    expect(hand.seats).toHaveLength(2);
    expect(hand.finished).toBe(false);
  });

  test("tbnn deals after both players start", () => {
    const hand = tbnnEngine.createHand(players, "junior", 1, 0, 10);

    expect(tbnnEngine.applyAction(hand, 1, "start").ok).toBe(true);
    expect(tbnnEngine.applyAction(hand, 2, "start").ok).toBe(true);
    expect(hand.phase).toBe("dealt");
  });
});

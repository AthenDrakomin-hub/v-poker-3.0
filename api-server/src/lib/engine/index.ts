// Game engine entry point - direct imports from games/
// Thin backward-compatible wrapper for legacy code.

// 1. Re-export types first
export type {
  GameType,
  HandState,
  Seat,
  ActionOption,
  GameEngine,
  GameError,
  ActionResult,
  ActionEntry,
  Phase,
  HandPlayerResult,
  HandResult,
} from "../games/common/types";

export { Card, Suit, freshDeck, shuffle, cardLabel } from "../games/common/cards";
export { publicState } from "../games/common/utils";
export { GAME_META } from "../games/common/types";

// 2. Re-export engines
export { texasEngine } from "../games/texas/engine";
export { jinhuaEngine } from "../games/jinhua/engine";
export { niuniuEngine } from "../games/niuniu/engine";
export { tbnnEngine } from "../games/tbnn/engine";
export { sangongEngine } from "../games/sangong/engine";

// 3. Spec definitions
export { SPEC_MAP, getSpec } from "./specs";

// 4. 经济配置已统一使用 EconConfig 模块，不再导出 RAKE 常量
import { GameType, HandState, ActionOption, GameEngine } from "../games/common/types";
import { texasEngine, jinhuaEngine, niuniuEngine, tbnnEngine, sangongEngine } from "../games/index";

const ENGINES: Record<GameType, GameEngine> = {
  texas: texasEngine,
  jinhua: jinhuaEngine,
  sangong: sangongEngine,
  niuniu: niuniuEngine,
  tbnn: tbnnEngine,
};

export function getEngine(gameType: GameType): GameEngine {
  return ENGINES[gameType];
}

export function createHand(
  gameType: GameType,
  players: { userId: number; account: string; points: number }[],
  level: string,
  roundNo: number,
  dealer: number,
  fixedAnte: number = 0,
  opts?: { chips?: number[]; cap?: number; baseBet?: number }
): HandState {
  const st = ENGINES[gameType].createHand(players, level, roundNo, dealer, fixedAnte, opts);
  if (fixedAnte > 0) {
    st.fixedAnte = fixedAnte;
  }
  return st;
}

export function optionsFor(st: HandState, userId: number): ActionOption[] {
  return ENGINES[st.gameType].optionsFor(st, userId);
}

export function applyAction(
  st: HandState,
  userId: number,
  action: string,
  amount?: number
): { ok: boolean; error?: string } {
  return ENGINES[st.gameType].applyAction(st, userId, action, amount);
}

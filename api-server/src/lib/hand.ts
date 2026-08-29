// Backward-compatible re-export layer
// Game logic has been split into ./games/* — each game is fully isolated.
// This file exists only so existing imports (@/lib/hand) keep working.
export {
  createHand,
  optionsFor,
  applyAction,
  publicState,
  getEngine,
} from "./engine";
export type {
  Seat,
  Phase,
  HandState,
  HandPlayerResult,
  HandResult,
  ActionOption,
  GameEngine,
  GameType,
} from "./engine";
// RAKE常量已移除，统一使用 V2 配置（game_economy_config），在 rooms.routes.ts 创建手牌时设置 st.rakeRate
export { GAME_META } from "./engine";

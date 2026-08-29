// Shared types for all game engines
import { Card } from "../common/cards";

// ==================== 游戏错误码 ====================
export enum GameError {
  // 玩家状态
  PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
  PLAYER_FOLDED = "PLAYER_FOLDED",
  NOT_YOUR_TURN = "NOT_YOUR_TURN",
  ALREADY_ACTED = "ALREADY_ACTED",
  ALREADY_REVEALED = "ALREADY_REVEALED",
  ALREADY_PREPARED = "ALREADY_PREPARED",

  // 筹码/下注
  INSUFFICIENT_CHIPS = "INSUFFICIENT_CHIPS",
  INVALID_CHIP_AMOUNT = "INVALID_CHIP_AMOUNT",
  BET_EXCEEDS_CAP = "BET_EXCEEDS_CAP",
  BET_TOO_LOW = "BET_TOO_LOW",
  NO_BET_TO_UNDO = "NO_BET_TO_UNDO",
  INSUFFICIENT_FOR_PAYOUT = "INSUFFICIENT_FOR_PAYOUT", // 筹码不足以应对最大倍数赔付

  // 阶段/流程
  GAME_ALREADY_FINISHED = "GAME_ALREADY_FINISHED",
  INVALID_PHASE = "INVALID_PHASE",
  PHASE_NOT_READY = "PHASE_NOT_READY",

  // 特殊规则
  NO_VALID_OPPONENT = "NO_VALID_OPPONENT",
  BANKER_NO_BET = "BANKER_NO_BET",
  MUST_REVEAL_FIRST = "MUST_REVEAL_FIRST",

  // 系统
  UNKNOWN_ACTION = "UNKNOWN_ACTION",
}

// ==================== 结构化操作日志 ====================
export interface ActionEntry {
  timestamp: number;
  seatIdx: number;
  seatId: number;
  action: string;
  amount?: number;
  phase: Phase;
  detail?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: GameError;
}

// ==================== 游戏类型 ====================
export type GameType = "texas" | "jinhua" | "sangong" | "niuniu" | "tbnn";

export const GAME_META: Record<
  GameType,
  { name: string; mode: string; emoji: string }
> = {
  texas: { name: "德州竞技", mode: "正常模式", emoji: "♠️" },
  jinhua: { name: "金花竞技", mode: "正常发牌", emoji: "🃏" },
  sangong: { name: "三公竞技", mode: "抢庄模式", emoji: "👑" },
  niuniu: { name: "斗牛竞技", mode: "抢庄模式", emoji: "🐂" },
  tbnn: { name: "通比牛牛", mode: "通比模式", emoji: "🏆" },
};

export interface Seat {
  userId: number;
  account: string;
  cards: Card[];
  points: number;
  streetBet: number;
  totalBet: number;
  folded: boolean;
  allin: boolean;
  acted: boolean;
  looked: boolean;
  diceRoll: number | null;
  autoPlay?: boolean;
  revealed?: boolean;
  hasPrepared?: boolean; // 三公专用：是否已点击准备
}

export type Phase =
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "betting"
  | "grab"
  | "grab_tie"
  | "grab_result"
  | "waiting_start"
  | "blind_grab"
  | "dealt"
  | "showdown"
  | "settlement";

export interface HandState {
  gameType: GameType;
  roundNo: number;
  phase: Phase;
  seats: Seat[];
  deck: Card[];
  community: Card[];
  turn: number;
  dealer: number;
  pot: number;
  currentBet: number;
  minRaise: number;
  baseBet: number;
  chips: number[];
  cap: number;
  bankerIdx: number | null;
  log: string[];
  actionLog: ActionEntry[];
  finished: boolean;
  result: HandResult | null;
  fixedAnte?: number;
  lastActionTime: number;
  rakeRate?: number;
  /** 抽水基数类型：pot（底池）/ flow（赢家盈利总和），从V2配置注入，不硬编码 */
  rakeBaseType?: string;
  _pkSnapshot?: unknown;
  _initialPoints?: Record<number, number>;
  _bettingRound?: number;
  /** 连续闷牌回合计数器（炸金花专用）：每轮所有人闷牌则+1，有人看牌/比牌/弃牌则清零，达到20强制摊牌 */
  continuousMuteRound?: number;
  /** 当前轮是否有人执行了看牌/比牌/弃牌（炸金花专用，用于判断本轮是否全闷） */
  _roundHadLookFoldCompare?: boolean;
  lastCompare?: {
    winnerId: number;
    loserId: number;
    winnerName: string;
    loserName: string;
    winnerHand: string;
    loserHand: string;
    ts: number;
  };
  spec?: {
    scoreOf: (cards: Card[], community?: Card[]) => { score: number; name: string; mult?: number };
    compareCards?: (a: Card[], b: Card[]) => number;
    canSeeCards?: (seat: Seat, viewer: Seat, phase: string) => boolean;
  };
}

export interface HandPlayerResult {
  userId: number;
  account: string;
  cards: string[];
  handName: string;
  diceRoll: number | null;
  delta: number;
  gross: number;
  rake: number;
  mult: number;
  folded: boolean;
}

export interface HandResult {
  hands: HandPlayerResult[];
  winnerUserId: number;
  community: string[];
  bankerUserId: number | null;
  pot: number;
  rake: number;
  flow: number;
  winType?: string;
  log?: string[];  // 本局行动日志（德州扑克等游戏）
}

export interface ActionOption {
  action: string;
  label: string;
  amount?: number;
  min?: number;
  max?: number;
  chips?: number[];
  baseBet?: number; // 德州扑克基础盲注，用于前端计算小盲/大盲快捷按钮
}

export interface GameEngine {
  createHand(
    players: { userId: number; account: string; points: number }[],
    level: string,
    roundNo: number,
    dealer: number,
    fixedAnte?: number,
    opts?: { chips?: number[]; cap?: number; baseBet?: number }
  ): HandState;
  optionsFor(st: HandState, userId: number): ActionOption[];
  applyAction(
    st: HandState,
    userId: number,
    action: string,
    amount?: number
  ): ActionResult;
}

// RAKE常量已移除，统一使用 EconConfig.chipRakeRate() 读取配置

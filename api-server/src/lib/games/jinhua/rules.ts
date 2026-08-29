/**
 * 炸金花（扎金花）游戏规则说明
 * 供 /api/games/rules/jinhua 端点返回给前端渲染
 */

// ============================================================
// 牌型倍数配置（可按房间/场次调整）
// ============================================================

/**
 * 牌型赔付倍数
 * 说明：赢家的牌型决定从每个输家收取的倍数
 * 例如：赢家是豹子(3倍)，某输家本局投入100，则输家再赔300（或按具体规则计算）
 * 不同场子规则不同，此处为常用配置，可按需修改
 */
export const HAND_MULTIPLIERS = {
  /** 豹子：三张相同 */
  BAOZI: 3,
  /** 同花顺：同花色连续 */
  TONGHUASHUN: 3,
  /** 金花：同花色不连续 */
  JINHUA: 2,
  /** 顺子：不同花色连续 */
  SHUNZI: 2,
  /** 对子：两张相同 */
  DUIZI: 1,
  /** 散牌：无牌型 */
  SANPAI: 1,
  /** 特殊235：不同花235，赢豹子时按豹子倍数 */
  SPECIAL_235: 3,
} as const;

/** 牌型等级（从大到小） */
export const HAND_RANK = {
  BAOZI: 6,
  TONGHUASHUN: 5,
  JINHUA: 4,
  SHUNZI: 3,
  DUIZI: 2,
  SANPAI: 1,
  SPECIAL_235: 0,
} as const;

// ============================================================
// 游戏配置参数
// ============================================================

export const GAME_CONFIG = {
  /** 每人发牌张数 */
  CARDS_PER_PLAYER: 3,
  /** 最大下注轮次，达到后强制结算 */
  MAX_BETTING_ROUNDS: 20,
  /** 闷牌（未看牌）跟注/加注折扣 */
  BLIND_BET_DISCOUNT: 0.5,
  /** 比牌费用倍数（比牌者需支付当前跟注的多少倍） */
  SHOWDOWN_FEE_MULTIPLIER: 2,
  /** 玩家操作超时时间（秒），超时自动弃牌 */
  ACTION_TIMEOUT: 30,
  /** 最小加注单位（筹码） */
  MIN_RAISE_UNIT: 1,
} as const;

// ============================================================
// 牌型说明（前端展示用）
// ============================================================

export interface HandTypeInfo {
  /** 牌型标识 */
  key: keyof typeof HAND_RANK;
  /** 牌型中文名 */
  name: string;
  /** 等级（数字越大越大） */
  rank: number;
  /** 赔付倍数 */
  multiplier: number;
  /** 说明 */
  description: string;
  /** 示例 */
  example: string;
}

export const HAND_TYPES: HandTypeInfo[] = [
  {
    key: 'BAOZI',
    name: '豹子',
    rank: HAND_RANK.BAOZI,
    multiplier: HAND_MULTIPLIERS.BAOZI,
    description: '三张点数完全相同的牌',
    example: 'AAA、KKK、888',
  },
  {
    key: 'TONGHUASHUN',
    name: '同花顺',
    rank: HAND_RANK.TONGHUASHUN,
    multiplier: HAND_MULTIPLIERS.TONGHUASHUN,
    description: '三张牌同花色且点数连续',
    example: '♠5 ♠6 ♠7',
  },
  {
    key: 'JINHUA',
    name: '金花',
    rank: HAND_RANK.JINHUA,
    multiplier: HAND_MULTIPLIERS.JINHUA,
    description: '三张牌同花色但点数不连续',
    example: '♥2 ♥5 ♥9',
  },
  {
    key: 'SHUNZI',
    name: '顺子',
    rank: HAND_RANK.SHUNZI,
    multiplier: HAND_MULTIPLIERS.SHUNZI,
    description: '三张牌点数连续但花色不同',
    example: '♥5 ♦6 ♣7',
  },
  {
    key: 'DUIZI',
    name: '对子',
    rank: HAND_RANK.DUIZI,
    multiplier: HAND_MULTIPLIERS.DUIZI,
    description: '恰好两张牌点数相同',
    example: 'AAK、JJ5',
  },
  {
    key: 'SANPAI',
    name: '散牌',
    rank: HAND_RANK.SANPAI,
    multiplier: HAND_MULTIPLIERS.SANPAI,
    description: '以上牌型均不构成',
    example: '♥2 ♦5 ♣9',
  },
  {
    key: 'SPECIAL_235',
    name: '特殊235',
    rank: HAND_RANK.SPECIAL_235,
    multiplier: HAND_MULTIPLIERS.SPECIAL_235,
    description: '不同花色的2、3、5，是最小的牌，但唯一能赢豹子',
    example: '♥2 ♦3 ♣5',
  },
];

// ============================================================
// 游戏流程说明
// ============================================================

export interface GameStep {
  /** 步骤序号 */
  step: number;
  /** 阶段名称 */
  phase: string;
  /** 说明 */
  description: string;
}

export const GAME_FLOW: GameStep[] = [
  {
    step: 1,
    phase: '开局下底注',
    description: '所有玩家先下一份固定底注（盲注），形成初始奖池。',
  },
  {
    step: 2,
    phase: '发牌',
    description: '系统为每位玩家发3张牌，牌面朝下，所有人均处于"闷牌"状态。',
  },
  {
    step: 3,
    phase: '轮流下注',
    description: '从庄家下家开始顺时针轮流操作，可选择跟注、加注、看牌、弃牌或比牌。',
  },
  {
    step: 4,
    phase: '结算触发',
    description: '满足以下任一条件则结束下注：仅剩1人未弃牌、有人开牌比牌、达到20轮上限。',
  },
  {
    step: 5,
    phase: '亮牌比大小',
    description: '所有未弃牌玩家亮牌，按牌型等级比较，最大者获胜。',
  },
  {
    step: 6,
    phase: '分配奖池',
    description: '赢家按牌型倍数从输家处收取筹码，本局结束。',
  },
];

// ============================================================
// 玩家操作说明
// ============================================================

export interface ActionInfo {
  /** 操作标识 */
  action: string;
  /** 操作名称 */
  name: string;
  /** 说明 */
  description: string;
  /** 闷牌时是否可用 */
  availableWhenBlind: boolean;
}

export const ACTIONS: ActionInfo[] = [
  {
    action: 'call',
    name: '跟注',
    description: '支付当前下注额，继续留在牌局中。闷牌时金额减半。',
    availableWhenBlind: true,
  },
  {
    action: 'raise',
    name: '加注',
    description: '在当前下注额基础上提高金额，后续玩家需按新额度跟注。闷牌时金额减半。',
    availableWhenBlind: true,
  },
  {
    action: 'see',
    name: '看牌',
    description: '查看自己的3张牌。看牌后转为明牌状态，下注恢复全额，且不可逆。',
    availableWhenBlind: true,
  },
  {
    action: 'fold',
    name: '弃牌',
    description: '放弃本局，已投入的筹码不予退还。',
    availableWhenBlind: true,
  },
  {
    action: 'compare',
    name: '比牌',
    description: '选择一名未弃牌玩家私下比牌，需支付双倍跟注费用，输者弃牌。',
    availableWhenBlind: false,
  },
];

// ============================================================
// 特殊规则
// ============================================================

export interface SpecialRule {
  /** 规则名称 */
  name: string;
  /** 规则内容 */
  content: string;
}

export const SPECIAL_RULES: SpecialRule[] = [
  {
    name: '特殊235专克豹子',
    content:
      '不同花色的2、3、5是游戏中最小的牌（等级0），输给所有其他牌型。但唯一例外：当对手是豹子时，不同花235反而获胜。注意：同花235按金花计算，不触发此规则。',
  },
  {
    name: '闷跟减半',
    content:
      '玩家处于闷牌（未看牌）状态时，跟注和加注金额仅为正常金额的一半。一旦看牌，立即转为明牌，后续下注全额支付，且无法再回到闷牌状态。开局底注和比牌费不适用减半。',
  },
  {
    name: '20轮强制结算',
    content:
      '每局下注阶段最多进行20轮（所有玩家各操作一次记为1轮）。第20轮结束后不允许继续加注，所有未弃牌玩家必须亮牌比大小。',
  },
  {
    name: '顺子特殊判定',
    content: 'A23为最小顺子，QKA为最大顺子，KA2不算顺子。',
  },
];

// ============================================================
// 完整规则对象（API 返回用）
// ============================================================

export interface JinhuaRules {
  /** 游戏类型 */
  gameType: 'jinhua';
  /** 游戏名称 */
  gameName: string;
  /** 游戏图标emoji */
  emoji: string;
  /** 游戏简介 */
  description: string;
  /** 游戏配置 */
  config: typeof GAME_CONFIG;
  /** 牌型列表（含倍数） */
  handTypes: HandTypeInfo[];
  /** 游戏流程 */
  flow: GameStep[];
  /** 玩家操作 */
  actions: ActionInfo[];
  /** 特殊规则 */
  specialRules: SpecialRule[];
}

export const rules: JinhuaRules = {
  gameType: 'jinhua',
  gameName: '炸金花',
  emoji: '🃏',
  description:
    '炸金花（又称扎金花、三张牌）是一款多人扑克牌游戏。每位玩家持有3张牌，通过多轮下注博弈，最终以牌型大小决定胜负。核心乐趣在于闷牌与看牌的策略选择，以及特殊235带来的变数。',
  config: GAME_CONFIG,
  handTypes: HAND_TYPES,
  flow: GAME_FLOW,
  actions: ACTIONS,
  specialRules: SPECIAL_RULES,
};

export default rules;

// Texas Hold'em game rules - structured format
export const texasRules = {
  gameType: "texas" as const,
  gameName: "德州扑克",
  emoji: "♠️",
  description:
    "德州扑克是全球最流行的扑克牌游戏。每位玩家持有2张私有手牌，结合5张公共牌，选出最佳5张组合比大小。通过多轮下注和策略博弈，牌型最大者赢得奖池。",
  config: {
    HOLE_CARDS: 2,
    COMMUNITY_CARDS: 5,
    FLOP_CARDS: 3,
    TURN_CARDS: 1,
    RIVER_CARDS: 1,
    SMALL_BLIND: 1,
    BIG_BLIND: 2,
    ACTION_TIMEOUT: 30,
    MAX_RAISES_PER_STREET: 4,
  },
  handTypes: [
    { key: "ROYAL_FLUSH", name: "皇家同花顺", rank: 9, multiplier: 1, description: "同花色的10、J、Q、K、A，是最大的牌型", example: "♠10 ♠J ♠Q ♠K ♠A" },
    { key: "STRAIGHT_FLUSH", name: "同花顺", rank: 8, multiplier: 1, description: "同花色且点数连续的5张牌", example: "♥5 ♥6 ♥7 ♥8 ♥9" },
    { key: "FOUR_OF_A_KIND", name: "四条", rank: 7, multiplier: 1, description: "四张点数相同的牌+任意一张", example: "8 8 8 8 K" },
    { key: "FULL_HOUSE", name: "葫芦", rank: 6, multiplier: 1, description: "三张相同+一对（三带二）", example: "K K K 5 5" },
    { key: "FLUSH", name: "同花", rank: 5, multiplier: 1, description: "五张牌同花色但点数不连续", example: "♣2 ♣5 ♣8 ♣J ♣K" },
    { key: "STRAIGHT", name: "顺子", rank: 4, multiplier: 1, description: "五张牌点数连续但花色不同", example: "♥5 ♦6 ♣7 ♠8 ♥9" },
    { key: "THREE_OF_A_KIND", name: "三条", rank: 3, multiplier: 1, description: "三张点数相同+两张散牌", example: "Q Q Q 5 9" },
    { key: "TWO_PAIR", name: "两对", rank: 2, multiplier: 1, description: "两个不同的对子+一张散牌", example: "K K 5 5 9" },
    { key: "ONE_PAIR", name: "一对", rank: 1, multiplier: 1, description: "一个对子+三张散牌", example: "A A 5 8 K" },
    { key: "HIGH_CARD", name: "高牌", rank: 0, multiplier: 1, description: "以上牌型都不构成，以最大单张牌比较", example: "A 5 8 J K" },
  ],
  flow: [
    { step: 1, phase: "盲注", description: "庄家左侧第一位下小盲注，第二位下大盲注，强制下注形成初始奖池。" },
    { step: 2, phase: "翻牌前（Pre-flop）", description: "每人发2张手牌，从大盲注左侧开始轮流操作：跟注、加注或弃牌。" },
    { step: 3, phase: "翻牌（Flop）", description: "发出3张公共牌，玩家继续轮流下注。" },
    { step: 4, phase: "转牌（Turn）", description: "发出第4张公共牌，继续轮流下注。" },
    { step: 5, phase: "河牌（River）", description: "发出第5张公共牌，最后一轮下注。" },
    { step: 6, phase: "摊牌（Showdown）", description: "剩余玩家亮牌，从7张牌（2张手牌+5张公共牌）中选出最佳5张组合比较大小。" },
    { step: 7, phase: "分配奖池", description: "牌型最大者赢得奖池。若有All in玩家，可能形成边池，按参与度分配。" },
  ],
  actions: [
    { action: "fold", name: "弃牌", description: "放弃手牌，退出本局，已投入筹码不予退还", availableWhenBlind: true },
    { action: "check", name: "过牌", description: "不下注，将操作权传给下一位。仅在当前无人加注时可用", availableWhenBlind: true },
    { action: "call", name: "跟注", description: "支付与当前下注额相等的筹码，继续留在牌局中", availableWhenBlind: true },
    { action: "raise", name: "加注", description: "提高下注额，后续玩家需按新额度跟注", availableWhenBlind: true },
    { action: "allin", name: "全押", description: "将所有剩余筹码全部投入。可能形成边池", availableWhenBlind: true },
  ],
  specialRules: [
    { name: "最佳5张组合", content: "玩家从2张手牌+5张公共牌共7张中，选出任意5张组成最佳牌型。可以不用手牌（纯公共牌），也可以用1张或2张手牌。" },
    { name: "All in 与边池", content: "当玩家全押后，若其他玩家继续加注，超出全押金额的部分形成边池。全押玩家只能参与主池争夺。" },
    { name: "顺子A的用法", content: "A既可作为最大牌（10-J-Q-K-A），也可作为最小牌（A-2-3-4-5，又称'轮子'）。但Q-K-A-2-3不算顺子。" },
    { name: "庄家轮转", content: "每局结束后，庄家按钮顺时针移动一位。小盲注和大盲注位置随之变化。" },
    { name: "平局分配", content: "若两名或多名玩家牌型完全相同，则奖池平均分配。无法整除时，按座位顺序分配零头。" },
  ],
};

export const rules = texasRules;

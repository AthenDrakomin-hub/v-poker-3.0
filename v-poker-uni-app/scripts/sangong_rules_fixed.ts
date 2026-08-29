// Sangong (三公) game rules - structured format
// V3规则：与 cards.ts 中的 sangongScore() 实际实现保持一致
export const sangongRules = {
  gameType: "sangong" as const,
  gameName: "抢庄三公",
  emoji: "👑",
  description:
    "三公是一款经典的扑克牌游戏，采用盲注抢庄模式。J/Q/K为公牌算0点，通过牌型和点数大小决定胜负。大三公为最大牌型（×6倍）。",
  config: {
    CARDS_PER_PLAYER: 3,
    BET_OPTIONS: [1, 2, 3, 4, 5] as number[],
    ACTION_TIMEOUT: 30,
    USE_JOKERS: false,
  },
  handTypes: [
    { key: "DA_SAN_GONG", name: "大三公", rank: 8, multiplier: 6, description: "三张都是公牌且牌面相同（如JJJ、QQQ、KKK）", example: "JJJ、QQQ、KKK" },
    { key: "XIAO_SAN_GONG", name: "小三公", rank: 7, multiplier: 5, description: "三张都是公牌，其中恰好两张牌面相同（如JJQ、QQK、KKJ）", example: "JJQ、QQK、KKJ" },
    { key: "HUN_SAN_GONG", name: "混三公", rank: 6, multiplier: 5, description: "三张都是公牌且牌面各不相同（如JQK）", example: "JQK" },
    { key: "BAO_ZI", name: "豹子", rank: 5, multiplier: 4, description: "三张牌点数完全相同（非三公，如AAA、222、101010）", example: "AAA、222、101010" },
    { key: "SHUANG_GONG_9", name: "双公9点", rank: 4, multiplier: 3, description: "恰好两张是公牌，第三张为9", example: "J Q 9、K K 9" },
    { key: "NINE_POINT", name: "9点", rank: 3, multiplier: 3, description: "单公或无公，三张牌点数相加取个位为9", example: "A 8 K（1+8+0=9）" },
    { key: "SHUANG_GONG_8", name: "双公8点", rank: 2, multiplier: 2, description: "恰好两张是公牌，第三张为8", example: "J Q 8、K K 8" },
    { key: "EIGHT_POINT", name: "8点", rank: 1, multiplier: 2, description: "单公或无公，三张牌点数相加取个位为8", example: "A 7 K（1+7+0=8）" },
    { key: "BELOW_SEVEN", name: "7点及以下", rank: 0, multiplier: 1, description: "单公或无公，点数为0~7（含双公0~7点）", example: "2 3 5（0点）、A 2 4（7点）" },
  ],
  flow: [
    { step: 1, phase: "盲注抢庄", description: "所有玩家下盲注，盲注最大者成为庄家。" },
    { step: 2, phase: "正式下注", description: "庄家固定，其他玩家正常下注/弃牌。" },
    { step: 3, phase: "发牌亮牌", description: "每人发3张牌，依次亮牌看牌。" },
    { step: 4, phase: "准备确认", description: "所有人亮牌后点击「准备就绪」，所有人都准备后才结算。" },
    { step: 5, phase: "结算展示", description: "显示庄家身份、各家牌型、输赢明细。" },
  ],
  actions: [
    { action: "blind_bet", name: "下盲注", description: "抢庄阶段下盲注，盲注最大者成为庄家", availableWhenBlind: true },
    { action: "bet", name: "下注", description: "正式下注阶段选择筹码", availableWhenBlind: true },
    { action: "fold", name: "弃牌", description: "放弃本局，退出本轮", availableWhenBlind: true },
    { action: "reveal", name: "亮牌", description: "查看并亮出3张牌", availableWhenBlind: true },
    { action: "prepare", name: "准备就绪", description: "所有人亮牌后点击准备，所有人都准备才结算", availableWhenBlind: true },
  ],
  specialRules: [
    { name: "公牌与点数", content: "J/Q/K称为'公牌'，算0点。A=1点，2~10按牌面点数。三张牌点数相加后取个位为最终点数，9点最大，0点最小。" },
    { name: "三公分类", content: "三张都是公牌时：大三公（三张相同如JJJ，×6倍）> 小三公（两张相同如JJQ，×5倍）> 混三公（三张不同如JQK，×5倍）。" },
    { name: "豹子", content: "三张牌点数完全相同（非三公）称为豹子，×4倍。如AAA、222、101010。" },
    { name: "双公点数", content: "恰好两张公牌：双公9点×3、双公8点×2，7点及以下归入普通点数档（×1）。" },
    { name: "普通点数", content: "单公或无公：9点×3、8点×2、7点及以下×1。" },
    { name: "点数优先", content: "同牌型等级下比点数：无公3点 > 双公1点（均为普通点数档）。" },
    { name: "同点庄家赢", content: "牌型和点数都相同时，庄家赢。" },
    { name: "盲注抢庄", content: "所有人都先下盲注，盲注最大者成为庄家，然后正式下注→发牌→亮牌→准备→结算。" },
  ],
};

export const rules = sangongRules;

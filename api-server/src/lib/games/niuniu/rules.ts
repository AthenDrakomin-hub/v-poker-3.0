// Niuniu (抢庄牛牛) game rules - structured format
export const niuniuRules = {
  gameType: "niuniu" as const,
  gameName: "抢庄斗牛",
  emoji: "🐂",
  description:
    "抢庄牛牛是一款流行的扑克牌游戏。玩家通过抢庄确定庄家，每人5张牌，选出3张凑成10的倍数（有牛），以牛数大小决定胜负。五小牛为最大牌型（×6倍）。",
  config: {
    CARDS_PER_PLAYER: 5,
    BANKER_BID_OPTIONS: [1, 2, 3, 4, 5] as number[],
    BET_OPTIONS: [1, 2, 3, 4, 5] as number[],
    ACTION_TIMEOUT: 30,
    USE_JOKERS: false,
  },
  handTypes: [
    { key: "WU_XIAO", name: "五小牛", rank: 8, multiplier: 6, description: "五张牌点数都≤5，且五张总和≤10", example: "A 2 2 2 3（总和10）" },
    { key: "SIZHA", name: "炸弹", rank: 7, multiplier: 5, description: "五张牌中有四张点数相同", example: "8 8 8 8 K" },
    { key: "WUHUA", name: "五花牛", rank: 6, multiplier: 4, description: "五张牌全部是J、Q、K（花牌）", example: "J Q K J Q" },
    { key: "NIU_NIU", name: "牛牛", rank: 5, multiplier: 3, description: "三张凑成10的倍数，剩余两张相加也是10的倍数", example: "3 7 K 5 5" },
    { key: "NIU_9", name: "牛九", rank: 4, multiplier: 2, description: "三张凑10，剩余两张相加个位为9", example: "2 8 K 4 5" },
    { key: "NIU_8", name: "牛八", rank: 3, multiplier: 2, description: "三张凑10，剩余两张相加个位为8", example: "A 9 Q 3 5" },
    { key: "NIU_7", name: "牛七", rank: 2, multiplier: 2, description: "三张凑10，剩余两张相加个位为7", example: "4 6 J 2 5" },
    { key: "NIU_1_TO_6", name: "牛一~牛六", rank: 1, multiplier: 1, description: "三张凑10，剩余两张相加个位为1~6", example: "5 5 10 2 3" },
    { key: "NO_NIU", name: "无牛", rank: 0, multiplier: 1, description: "任意三张牌都无法凑成10的倍数", example: "A 3 5 7 9" },
  ],
  flow: [
    { step: 1, phase: "抢庄", description: "所有玩家掷骰子比大小，点数最大者为庄家（相同则重掷）。" },
    { step: 2, phase: "闲家下注", description: "闲家依次选择筹码下注，可多次累加，确认后下一位。" },
    { step: 3, phase: "发牌", description: "系统为每位玩家发5张牌。" },
    { step: 4, phase: "亮牌比大小", description: "所有玩家亮牌，庄家与每位闲家逐一比较牌型大小。" },
    { step: 5, phase: "结算", description: "庄家赢则收闲家筹码（×倍数），庄家输则赔闲家筹码（×倍数）。" },
  ],
  actions: [
    { action: "roll_dice", name: "掷骰子", description: "抢庄阶段掷骰子，点数大者坐庄", availableWhenBlind: true },
    { action: "bet", name: "下注", description: "选择筹码下注，可多次累加", availableWhenBlind: true },
    { action: "confirm_bet", name: "确认下注", description: "确认后进入下一阶段", availableWhenBlind: true },
    { action: "reveal", name: "亮牌", description: "查看自己的牌并亮牌", availableWhenBlind: true },
  ],
  specialRules: [
    { name: "点数计算", content: "A=1点，2~10按牌面点数，J/Q/K=10点。从5张牌中任选3张，若和为10的倍数则'有牛'，剩余2张相加取个位为牛数。" },
    { name: "五小牛判定", content: "五张牌点数都不超过5（A=1，2~5），且总和≤10。五小牛是最大牌型（×6倍）。" },
    { name: "炸弹", content: "五张牌中有四张点数相同。炸弹为第二大牌型（×5倍）。" },
    { name: "五花牛", content: "五张牌全部是J、Q、K（花牌）。五花牛为第三大牌型（×4倍）。" },
    { name: "抢庄规则", content: "所有玩家掷骰子，点数最大者为庄家；相同则重掷。庄家承担所有闲家的输赢。" },
    { name: "倍数规则", content: "五小牛×6、炸弹×5、五花牛×4、牛牛×3、牛七牛八牛九×2、牛六及以下×1。庄家与闲家相同时庄家赢。" },
  ],
};

export const rules = niuniuRules;

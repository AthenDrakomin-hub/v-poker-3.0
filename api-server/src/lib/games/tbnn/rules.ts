// Tbnn (通比牛牛) game rules - structured format
export const tbnnRules = {
  gameType: "tbnn" as const,
  gameName: "通比牛牛",
  emoji: "🏆",
  description:
    "通比牛牛是牛牛的变体，无庄家，固定底注，全部牌型1倍赔付。使用含大小王的牌堆，大小王为百搭牌。所有玩家通比大小，唯一赢家通吃奖池。支持自动挂机功能。",
  config: {
    CARDS_PER_PLAYER: 5,
    BASE_ANTE: 1,
    ACTION_TIMEOUT: 30,
    USE_JOKERS: true,
    JOKER_COUNT: 2,
    AUTO_PLAY_ENABLED: true,
  },
  handTypes: [
    { key: "WU_XIAO", name: "五小牛", rank: 8, multiplier: 1, description: "五张牌点数都≤5，且五张总和≤10（大小王算0点）", example: "A 2 2 2 3（总和10）" },
    { key: "SIZHA", name: "四炸", rank: 7, multiplier: 1, description: "五张牌中有四张点数相同，大小王可代替任意牌", example: "8 8 8 大王 K" },
    { key: "WUHUA", name: "五花牛", rank: 6, multiplier: 1, description: "五张牌全部是J、Q、K（花牌），大小王可代替花牌", example: "J Q K J 小王" },
    { key: "NIU_NIU", name: "牛牛", rank: 5, multiplier: 1, description: "三张凑成10的倍数，剩余两张相加也是10的倍数", example: "3 7 K 5 5" },
    { key: "NIU_9", name: "牛九", rank: 4, multiplier: 1, description: "三张凑10，剩余两张相加个位为9", example: "2 8 K 4 5" },
    { key: "NIU_8", name: "牛八", rank: 3, multiplier: 1, description: "三张凑10，剩余两张相加个位为8", example: "A 9 Q 3 5" },
    { key: "NIU_7", name: "牛七", rank: 2, multiplier: 1, description: "三张凑10，剩余两张相加个位为7", example: "4 6 J 2 5" },
    { key: "NIU_1_TO_6", name: "牛一~牛六", rank: 1, multiplier: 1, description: "三张凑10，剩余两张相加个位为1~6", example: "5 5 10 2 3" },
    { key: "NO_NIU", name: "无牛", rank: 0, multiplier: 1, description: "任意三张牌都无法凑成10的倍数", example: "A 3 5 7 9" },
  ],
  flow: [
    { step: 1, phase: "下底注", description: "所有玩家自动扣除固定底注，形成奖池。通比牛牛无庄家。" },
    { step: 2, phase: "发牌", description: "系统为每位玩家发5张牌（含大小王），玩家可查看自己的牌。" },
    { step: 3, phase: "组牌", description: "从5张牌中选出3张凑成10的倍数（有牛），大小王可作为百搭牌。" },
    { step: 4, phase: "亮牌通比", description: "所有玩家亮牌，所有人一起比较牌型大小，最大者获胜。" },
    { step: 5, phase: "结算", description: "唯一赢家通吃奖池全部筹码。所有牌型均为1倍。" },
  ],
  actions: [
    { action: "start", name: "开始", description: "点击开始发牌，需所有人点击后才开局", availableWhenBlind: true },
    { action: "reveal", name: "亮牌", description: "亮出所有牌，亮牌后不可更改", availableWhenBlind: true },
    { action: "auto_reveal", name: "自动亮牌", description: "系统自动选择最优组牌并亮牌", availableWhenBlind: true },
  ],
  specialRules: [
    { name: "固定底注", content: "每局开始时所有玩家自动扣除相同的底注，无需选择下注倍数。奖池 = 底注 × 玩家数。" },
    { name: "全部1倍", content: "所有牌型赔付倍数均为1倍，无论五小牛、四炸还是无牛，输赢金额相同。赢家通吃奖池。" },
    { name: "唯一赢家", content: "没有庄家，所有玩家亮牌后统一比较，牌型最大的玩家为唯一赢家。若多人相同则比最大单张和花色。" },
    { name: "大小王百搭", content: "使用大小王，可代替任意点数（算0点），帮助凑牛、凑四炸、凑五花牛。" },
    { name: "自动挂机", content: "支持自动挂机：开启后自动开始→自动亮牌→自动跟随，全程无需手动操作。" },
  ],
};

export const rules = tbnnRules;

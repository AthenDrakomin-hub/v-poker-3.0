/** 快捷语（点一下即可发送，含语音播报文本） */
export const QUICK_PHRASES = [
  "大家好，多多关照！",
  "快点啦，等到花儿都谢了",
  "手气不错哦～",
  "不要走，决战到天亮！",
  "哇，你太厉害了！",
  "我这牌怎么这么烂",
  "再来一局，翻本！",
  "先走一步，下次再玩",
  "稍等一下，马上回来",
  "全下！搏一搏",
];

/** 表情包（大图表情，飘在座位上） */
export const EMOJIS = [
  "😀", "😂", "😍", "😎", "🤔", "😭",
  "😡", "🥳", "🤑", "😱", "🤩", "🥰",
  "👍", "👎", "👏", "🙏", "💪", "🤝",
  "🔥", "💰", "🎉", "💣", "❤️", "💔",
];

/** 互动表情（对指定玩家发送） */
export const INTERACTIONS = [
  { id: "flower", icon: "🌹", label: "送花" },
  { id: "beer", icon: "🍺", label: "干杯" },
  { id: "egg", icon: "🥚", label: "丢鸡蛋" },
  { id: "bomb", icon: "💣", label: "扔炸弹" },
  { id: "kiss", icon: "💋", label: "飞吻" },
  { id: "slap", icon: "🖐", label: "拍一下" },
  { id: "money", icon: "💸", label: "撒钱" },
  { id: "knife", icon: "🔪", label: "捅一刀" },
];

export function interactionById(id: string) {
  return INTERACTIONS.find((i) => i.id === id);
}

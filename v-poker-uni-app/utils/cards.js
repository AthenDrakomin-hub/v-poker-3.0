/**
 * V-Poker 卡牌工具函数
 * 后端卡牌编码: {rank}{suit}
 *   rank: A/2/3/4/5/6/7/8/9/10/J/Q/K
 *   suit: s(黑桃)/h(红桃)/d(方片)/c(梅花)
 *   特殊: back(牌背)
 *
 * 对应 SVG 文件: static/images/cards/{label}.svg
 */
import { cdnUrl } from './cdn.js'

// ========== 常量 ==========
const CARDS_DIR = '/static/images/cards'

const SUITS = ['s', 'h', 'd', 'c']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const SUIT_NAMES = {
  s: '黑桃', h: '红桃', d: '方片', c: '梅花'
}

const SUIT_SYMBOLS = {
  s: '♠', h: '♥', d: '♦', c: '♣'
}

// 点数排序值（A最大）
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
}

// ========== 校验 ==========

/**
 * 校验卡牌 label 是否合法
 * @param {string} label - 如 "As", "10d", "back"
 * @returns {boolean}
 */
export function isValidCard(label) {
  if (!label || typeof label !== 'string') return false
  if (label === 'back') return true
  const rank = label.replace(/[shdc]$/i, '').toUpperCase()
  const suit = label.match(/[shdc]$/i)
  if (!suit) return false
  return RANKS.includes(rank) && SUITS.includes(suit[0].toLowerCase())
}

// ========== 解析 ==========

/**
 * 从 label 提取点数
 * @param {string} label
 * @returns {string} 如 "A", "10", "K"
 */
export function getRank(label) {
  if (!label || label === 'back') return ''
  return label.replace(/[shdc]$/i, '').toUpperCase()
}

/**
 * 从 label 提取花色
 * @param {string} label
 * @returns {string} s/h/d/c
 */
export function getSuit(label) {
  if (!label || label === 'back') return ''
  const m = label.match(/[shdc]$/i)
  return m ? m[0].toLowerCase() : ''
}

/**
 * 获取花色中文名
 * @param {string} label
 * @returns {string}
 */
export function getSuitName(label) {
  return SUIT_NAMES[getSuit(label)] || ''
}

/**
 * 获取花色符号
 * @param {string} label
 * @returns {string} ♠♥♦♣
 */
export function getSuitSymbol(label) {
  return SUIT_SYMBOLS[getSuit(label)] || ''
}

/**
 * 是否红色花色
 * @param {string} label
 * @returns {boolean}
 */
export function isRedSuit(label) {
  const s = getSuit(label)
  return s === 'h' || s === 'd'
}

/**
 * 获取点数数值（A=14）
 * @param {string} label
 * @returns {number}
 */
export function getRankValue(label) {
  return RANK_VALUES[getRank(label)] || 0
}

// ========== 文件路径 ==========

/**
 * 获取卡牌 SVG 文件路径
 * @param {string} label - 如 "As", "10d", "back"
 * @returns {string} 如 "/static/images/cards/As.svg"
 */
export function getCardImage(label) {
  let path
  if (!label) path = `${CARDS_DIR}/back.svg`
  else if (label === 'back') path = `${CARDS_DIR}/back.svg`
  else {
    const rank = getRank(label)
    const suit = getSuit(label)
    path = `${CARDS_DIR}/${rank}${suit}.svg`
  }
  return cdnUrl(path)
}

// ========== 牌组工具（前端预览/Mock用，正式洗牌由后端负责） ==========

/**
 * 创建一副完整的52张牌
 * @returns {string[]} 如 ["As", "2s", ..., "Kc"]
 */
export function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(rank + suit)
    }
  }
  return deck
}

/**
 * Fisher-Yates 洗牌（仅前端预览用，正式游戏由后端洗牌）
 * @param {string[]} deck
 * @returns {string[]}
 */
export function shuffleDeck(deck) {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 比较两张牌的点数大小
 * @param {string} a
 * @param {string} b
 * @returns {number} 正数a大, 负数b大, 0相等
 */
export function compareRank(a, b) {
  return getRankValue(a) - getRankValue(b)
}

/**
 * 按点数降序排序手牌
 * @param {string[]} cards
 * @returns {string[]}
 */
export function sortCardsByRank(cards) {
  return [...cards].sort((a, b) => compareRank(b, a))
}

// ========== 游戏特定工具 ==========

/**
 * 牛牛：计算点数（A=1, J/Q/K=10, 其他=面值）
 * @param {string} label
 * @returns {number}
 */
export function getNiuNiuValue(label) {
  const rank = getRank(label)
  if (rank === 'A') return 1
  if (['J', 'Q', 'K'].includes(rank)) return 10
  return parseInt(rank) || 0
}

/**
 * 炸金花：比较单牌大小（A最大，2最小）
 * 与 getRankValue 一致
 */

// ========== 导出常量 ==========
export {
  SUITS,
  RANKS,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  RANK_VALUES,
  CARDS_DIR
}

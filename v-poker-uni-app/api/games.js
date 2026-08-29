/**
 * V-Poker 游戏规则 API
 */
import { get } from './request.js'

// 获取所有游戏规则列表
export function getGameRules() {
  return get('/api/games/rules')
}

// 获取单个游戏规则
export function getGameRule(gameType) {
  return get(`/api/games/rules/${gameType}`)
}

export default {
  getGameRules,
  getGameRule
}

/**
 * V-Poker 虚拟筹码钱包 API
 * 钱柜与房间上下分、结算共用同一筹码账本
 */
import { get, post } from './request.js'

// 生成幂等请求 ID（防重复点击/网络重试）
function genRequestId() {
  return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
}

/**
 * 钱包总览
 * GET /api/wallet
 * @returns { availablePoints, vaultPoints, totalPoints, updatedAt }
 */
export function getWallet() {
  return get('/api/wallet')
}

/**
 * 钱柜转存
 * POST /api/wallet/vault-transfer
 * @param {string} direction - 'deposit' 存入钱柜 | 'withdraw' 取出至可用筹码
 * @param {number} amount - 正整数
 * @returns { ok, availablePoints, vaultPoints, transaction }
 */
export function vaultTransfer(direction, amount) {
  return post('/api/wallet/vault-transfer', {
    direction,
    amount: Number(amount),
    requestId: genRequestId(),
  })
}

/**
 * 账变记录
 * GET /api/wallet/transactions
 * @param {object} params - { page, pageSize, type }
 *   type 可选: vault_deposit / vault_withdraw / room_buyin / room_settlement /
 *             agent_gift_in / agent_gift_out / activity_reward / agent_grant / rake
 * @returns { items: [], total }
 */
export function getWalletTransactions(params = {}) {
  const qs = []
  qs.push('page=' + encodeURIComponent(params.page || 1))
  qs.push('pageSize=' + encodeURIComponent(params.pageSize || 20))
  if (params.type) qs.push('type=' + encodeURIComponent(params.type))
  return get('/api/wallet/transactions?' + qs.join('&'))
}

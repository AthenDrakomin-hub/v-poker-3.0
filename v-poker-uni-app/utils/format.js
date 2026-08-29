/**
 * V-Poker 格式化工具
 */

/**
 * 格式化筹码数字
 * 大数字显示为 K/M/B
 */
export function formatPoints(points) {
  if (points === null || points === undefined) return '0'
  const num = Number(points)
  if (isNaN(num)) return '0'

  const absNum = Math.abs(num)
  if (absNum >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B'
  }
  if (absNum >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M'
  }
  if (absNum >= 1e4) {
    return (num / 1e3).toFixed(1) + 'K'
  }
  // 小数字保留2位小数，去掉末尾多余的0
  return Number(num.toFixed(2)).toString()
}

/**
 * 格式化完整数字（带千分位）
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return Number(num).toLocaleString('zh-CN')
}

/**
 * 格式化百分比
 */
export function formatPercent(num, decimals = 2) {
  if (num === null || num === undefined) return '0%'
  return (Number(num) * 100).toFixed(decimals) + '%'
}

/**
 * 格式化时间
 */
export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * 格式化日期时间
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - new Date(timestamp).getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

/**
 * 格式化游戏类型名称
 */
export function formatGameType(gameType) {
  const map = {
    niuniu: '抢庄牛牛',
    sangong: '抢庄三公',
    tbnn: '通比牛牛',
    jinhua: '炸金花',
    texas: '德州扑克',
  }
  return map[gameType] || gameType
}

/**
 * 格式化角色名称
 */
export function formatRole(role) {
  const map = {
    player: '玩家',
    agent: '代理',
    top_agent: '总代理',
    admin: '管理员',
    customer_service: '客服',
  }
  return map[role] || role
}

/**
 * 格式化房间状态
 */
export function formatRoomStatus(status) {
  const map = {
    waiting: '等待中',
    playing: '游戏中',
    paused: '已暂停',
    ended: '已结束',
    active: '进行中',
    inactive: '未开始',
  }
  return map[status] || status || '-'
}

/**
 * 格式化用户状态
 */
export function formatUserStatus(status) {
  const map = {
    active: '正常',
    frozen: '已冻结',
    banned: '已封禁',
    online: '在线',
    offline: '离线',
  }
  return map[status] || status || '-'
}

/**
 * 格式化客服状态
 */
export function formatCsStatus(status) {
  const map = {
    online: '接待中',
    offline: '已关闭',
    busy: '忙碌中',
  }
  return map[status] || status || '-'
}

/**
 * 格式化会话状态
 */
export function formatConversationStatus(status) {
  const map = {
    open: '进行中',
    closed: '已结束',
    pending: '待处理',
    resolved: '已解决',
  }
  return map[status] || status || '-'
}

/**
 * 隐藏手机号中间四位
 */
export function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
}

/**
 * 生成随机ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export default {
  formatPoints,
  formatNumber,
  formatPercent,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatGameType,
  formatRole,
  formatRoomStatus,
  formatUserStatus,
  formatCsStatus,
  formatConversationStatus,
  maskPhone,
  generateId,
}

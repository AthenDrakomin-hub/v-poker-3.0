/**
 * V-Poker V3 经济模型配置
 * 单一货币筹码，抽水3%，多级代理返佣
 */

// 经济模型常量
export const ECONOMY_CONFIG = {
  // 抽水比例（3%）
  RAKE_RATE: 0.03,

  // 层级定义
  HIERARCHY: {
    // L0: 开房代理（最底层）
    L0: {
      level: 0,
      name: '开房代理',
      role: 'agent',
      // 基础分成比例（占抽水总额的1/3 ≈ 流水的1%）
      baseShare: 1 / 3,
    },
    // L1: 一级代理
    L1: {
      level: 1,
      name: '一级代理',
      role: 'agent',
      // 基础分成比例（占抽水总额的0.5/3 ≈ 流水的0.5%）
      baseShare: 0.5 / 3,
    },
    // L2: 总代理
    L2: {
      level: 2,
      name: '总代理',
      role: 'top_agent',
      // 基础分成比例（占抽水总额的0.5/3 ≈ 流水的0.5%）
      baseShare: 0.5 / 3,
    },
    // 平台
    PLATFORM: {
      level: -1,
      name: '平台',
      role: 'platform',
      // 平台分成 = 剩余部分（倒挤确保守恒）
      baseShare: null, // 动态计算
    },
  },

  // 最大追溯层级
  MAX_HIERARCHY_LEVELS: 2,

  // 开房门槛（筹码，只校验不扣费）
  ROOM_THRESHOLDS: {
    junior: 100,    // 初级房
    senior: 1000,   // 高级房
    premium: 5000,  // 顶级房
  },

  // 货币单位
  CURRENCY: {
    name: '筹码',
    symbol: '💰',
    decimals: 0,
  },
}

/**
 * 计算抽水分配
 * @param {number} totalPot - 底池总额
 * @param {Object} hierarchy - 层级信息 { L0: agentId, L1: agentId, L2: agentId }
 * @returns {Object} 分配结果
 */
export function calculateRakeDistribution(totalPot, hierarchy = {}) {
  const rakeAmount = Math.floor(totalPot * ECONOMY_CONFIG.RAKE_RATE)
  const remaining = totalPot - rakeAmount

  // 各层级应得比例
  const shares = {
    L0: ECONOMY_CONFIG.HIERARCHY.L0.baseShare,
    L1: ECONOMY_CONFIG.HIERARCHY.L1.baseShare,
    L2: ECONOMY_CONFIG.HIERARCHY.L2.baseShare,
  }

  // 实际分配（跳过不存在的层级，份额归上层）
  const distribution = []
  let allocatedShare = 0

  // 从最高层开始分配
  const levels = ['L2', 'L1', 'L0']
  let upperLevelShare = 0

  levels.forEach((levelKey) => {
    const level = ECONOMY_CONFIG.HIERARCHY[levelKey]
    const agentId = hierarchy[levelKey]

    if (agentId) {
      // 该层级存在代理，获得基础份额 + 上层跳过的份额
      const actualShare = shares[levelKey] + upperLevelShare
      const amount = Math.floor(rakeAmount * actualShare)
      distribution.push({
        level: level.level,
        levelKey,
        name: level.name,
        role: level.role,
        agentId,
        share: actualShare,
        amount,
        inherited: upperLevelShare > 0,
        inheritedFrom: upperLevelShare > 0 ? '下级跳过层' : null,
      })
      allocatedShare += actualShare
      upperLevelShare = 0
    } else {
      // 该层级不存在，份额累积到上层
      upperLevelShare += shares[levelKey]
    }
  })

  // 平台获得剩余部分（倒挤确保守恒）
  const platformShare = 1 - allocatedShare - upperLevelShare
  const platformAmount = rakeAmount - distribution.reduce((sum, d) => sum + d.amount, 0)

  distribution.push({
    level: -1,
    levelKey: 'PLATFORM',
    name: '平台',
    role: 'platform',
    agentId: null,
    share: platformShare + upperLevelShare,
    amount: platformAmount,
    isPlatform: true,
  })

  // 验证守恒
  const totalAllocated = distribution.reduce((sum, d) => sum + d.amount, 0)
  const isConserved = totalAllocated === rakeAmount

  return {
    totalPot,
    rakeAmount,
    rakeRate: ECONOMY_CONFIG.RAKE_RATE,
    remaining,
    distribution,
    isConserved,
    // 守恒等式字符串
    conservationEquation: buildConservationEquation(rakeAmount, distribution),
  }
}

/**
 * 构建守恒等式字符串
 * 例如：30 = 10 + 5 + 5 + 10
 */
function buildConservationEquation(rakeAmount, distribution) {
  const parts = distribution.map(d => d.amount)
  return `${rakeAmount} = ${parts.join(' + ')}`
}

/**
 * 格式化分配结果为显示用数据
 */
export function formatDistributionForDisplay(distributionResult) {
  const { rakeAmount, distribution } = distributionResult

  return {
    totalRake: rakeAmount,
    items: distribution.map(d => ({
      id: d.levelKey,
      name: d.name,
      amount: d.amount,
      percentage: rakeAmount > 0 ? ((d.amount / rakeAmount) * 100).toFixed(1) : '0.0',
      role: d.role,
      isPlatform: d.isPlatform || false,
      inherited: d.inherited || false,
      color: getRoleColor(d.role),
    })),
    equation: distributionResult.conservationEquation,
  }
}

/**
 * 获取角色颜色
 */
function getRoleColor(role) {
  const colors = {
    agent: '#FFBF00',        // 代理 - 琥珀金
    top_agent: '#6B46C1', // 总代理 - 暗夜紫
    platform: '#00D4FF',      // 平台 - 青色
  }
  return colors[role] || '#888'
}

/**
 * 获取层级金字塔数据（用于倒金字塔可视化）
 */
export function getPyramidData(distributionResult) {
  const { distribution } = distributionResult

  // 从顶层到底层排序
  const sorted = [...distribution].sort((a, b) => b.level - a.level)

  return sorted.map((d, index) => ({
    id: d.levelKey,
    name: d.name,
    amount: d.amount,
    level: d.level,
    isPlatform: d.isPlatform || false,
    color: getRoleColor(d.role),
    // 金字塔层级宽度（顶层最窄，底层最宽）
    widthPercent: 30 + (index * 20),
    // 流体动画延迟
    animationDelay: index * 200,
  }))
}

export default {
  ECONOMY_CONFIG,
  calculateRakeDistribution,
  formatDistributionForDisplay,
  getPyramidData,
}

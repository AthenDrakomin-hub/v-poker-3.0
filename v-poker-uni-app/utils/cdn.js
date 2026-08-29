/**
 * V-Poker CDN 静态资源路径适配
 *
 * 将本地 /static/ 路径转换为 Cloudflare R2 CDN 路径
 * 开发环境可切换为本地路径，生产环境使用 CDN
 *
 * 用法:
 *   import { cdnUrl, cdnEnabled, setCdnConfig } from '@/utils/cdn.js'
 *
 *   // 模板中: <image :src="$cdn('/static/logo.png')" />
 *   // JS中:    const url = cdnUrl('/static/logo.png')
 */

// ========== 配置 ==========
const CDN_CONFIG = {
  // 是否启用 CDN（false 时返回原始本地路径）
  // 注意：本项目静态资源（图片/音效/字体）全部托管在 Cloudflare R2 CDN，
  // 本地 static/sounds/ 和 static/voices/ 已故意删除以减小包体积，
  // 禁止禁用 CDN，否则 APP 端所有资源加载失败
  enabled: true,
  // CDN 基准 URL（自定义域）
  baseUrl: 'https://static.yefeng.us.cc',
  // R2 中的 key 前缀（上传时使用的前缀）
  keyPrefix: 'static/',
  // 本地路径前缀（用于匹配和替换）
  localPrefix: '/static/',
}

// ========== 核心函数 ==========

/**
 * 将本地静态资源路径转换为 CDN 路径
 * @param {string} localPath - 如 '/static/logo.png' 或 'static/logo.png' 或 '/static/images/cards/As.svg'
 * @returns {string} CDN 完整 URL 或原始路径
 */
export function cdnUrl(localPath) {
  if (!localPath || typeof localPath !== 'string') {
    return localPath || ''
  }

  // 已经是完整 URL（http/https/data:），直接返回
  if (/^(https?:|data:|blob:|\/\/)/i.test(localPath)) {
    return localPath
  }

  // CDN 未启用，返回原始路径
  if (!CDN_CONFIG.enabled) {
    return localPath
  }

  // 规范化路径：去掉开头的 /
  let normalized = localPath.replace(/^\/+/, '')

  // 如果路径已经以 keyPrefix 开头，直接拼接
  if (normalized.startsWith(CDN_CONFIG.keyPrefix)) {
    return `${CDN_CONFIG.baseUrl}/${normalized}`
  }

  // 如果路径以 'static/' 开头（去掉了 / 的），也直接拼接
  if (normalized.startsWith('static/')) {
    return `${CDN_CONFIG.baseUrl}/${normalized}`
  }

  // 其他情况，加上 keyPrefix
  return `${CDN_CONFIG.baseUrl}/${CDN_CONFIG.keyPrefix}${normalized}`
}

/**
 * 批量转换路径数组
 * @param {string[]} paths
 * @returns {string[]}
 */
export function cdnUrls(paths) {
  if (!Array.isArray(paths)) return []
  return paths.map(p => cdnUrl(p))
}

/**
 * 获取 CDN 配置（只读）
 */
export function getCdnConfig() {
  return { ...CDN_CONFIG }
}

/**
 * 动态设置 CDN 配置（运行时切换）
 * @param {Object} config - { enabled, baseUrl, keyPrefix }
 */
export function setCdnConfig(config) {
  if (typeof config.enabled === 'boolean') CDN_CONFIG.enabled = config.enabled
  if (typeof config.baseUrl === 'string') CDN_CONFIG.baseUrl = config.baseUrl
  if (typeof config.keyPrefix === 'string') CDN_CONFIG.keyPrefix = config.keyPrefix
}

/**
 * 检查 CDN 是否启用
 */
export function cdnEnabled() {
  return CDN_CONFIG.enabled
}

// ========== Vue3 全局注册辅助 ==========

/**
 * 注册到 Vue app 的 globalProperties，模板中可直接用 $cdn
 * @param {Object} app - createSSRApp 返回的 app 实例
 */
export function registerCdnGlobal(app) {
  app.config.globalProperties.$cdn = cdnUrl
  app.config.globalProperties.$cdnConfig = CDN_CONFIG
}

// ========== 默认导出 ==========
export default {
  cdnUrl,
  cdnUrls,
  getCdnConfig,
  setCdnConfig,
  cdnEnabled,
  registerCdnGlobal,
}

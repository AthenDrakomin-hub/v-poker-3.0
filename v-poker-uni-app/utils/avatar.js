/**
 * V-Poker 头像工具
 * 5套VIP头像，每套对应独立语音包
 */
import { cdnUrl } from './cdn.js'

// 头像配置
export const AVATAR_LIST = [
  { id: 1, name: '烈焰战神', image: '/static/avatars/vip-1.png', voicePack: 'vip-1' },
  { id: 2, name: '暗影刺客', image: '/static/avatars/vip-2.png', voicePack: 'vip-2' },
  { id: 3, name: '碧海蛟龙', image: '/static/avatars/vip-3.png', voicePack: 'vip-3' },
  { id: 4, name: '紫电狂魔', image: '/static/avatars/vip-4.png', voicePack: 'vip-4' },
  { id: 5, name: '黄金帝王', image: '/static/avatars/vip-5.png', voicePack: 'vip-5' },
]

// 默认头像
const DEFAULT_AVATAR = AVATAR_LIST[0]

/**
 * 根据 avatar 字段获取头像配置
 * @param {string|number} avatar - 用户头像字段（可能是 id、vip-x、或 URL）
 * @returns {Object} 头像配置 { id, name, image, voicePack }
 */
export function getAvatarConfig(avatar) {
  if (!avatar) return DEFAULT_AVATAR

  // 如果是完整 URL，直接返回
  if (typeof avatar === 'string' && avatar.startsWith('http')) {
    return { id: 0, name: '自定义', image: avatar, voicePack: 'vip-1' }
  }

  // 如果是数字
  const id = parseInt(avatar, 10)
  if (!isNaN(id) && id >= 1 && id <= 5) {
    return AVATAR_LIST[id - 1]
  }

  // 如果是 "vip-x" 格式
  if (typeof avatar === 'string' && avatar.startsWith('vip-')) {
    const num = parseInt(avatar.replace('vip-', ''), 10)
    if (!isNaN(num) && num >= 1 && num <= 5) {
      return AVATAR_LIST[num - 1]
    }
  }

  return DEFAULT_AVATAR
}

/**
 * 获取头像图片路径
 * 所有头像路径都走 CDN 适配（本地 static 目录为空，资源全部托管在 CDN）
 */
export function getAvatarImage(avatar) {
  const config = getAvatarConfig(avatar)
  return cdnUrl(config.image)
}

/**
 * 获取头像对应的语音包ID
 */
export function getAvatarVoicePack(avatar) {
  return getAvatarConfig(avatar).voicePack
}

/**
 * 获取头像名称
 */
export function getAvatarName(avatar) {
  return getAvatarConfig(avatar).name
}

/**
 * 播放该头像对应的语音包语音
 * @param {string|number} avatar - 用户头像字段
 * @param {string} action - 动作 (enter/deal/look/call/raise/fold/compare/allin/win/lose/wait/chat1/chat2/chat3)
 * @param {object} options - 选项 { volume, interrupt }
 */
export function playVoice(avatar, action, options = {}) {
  try {
    const { getVoiceManager } = require('./sound.js')
    const voicePack = getAvatarVoicePack(avatar)
    const vm = getVoiceManager()
    vm.play(voicePack, action, options)
  } catch (e) {
    console.warn('[avatar] 播放语音失败', e)
  }
}

export default {
  AVATAR_LIST,
  getAvatarConfig,
  getAvatarImage,
  getAvatarVoicePack,
  getAvatarName,
  playVoice,
}

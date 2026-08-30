/**
 * V-Poker 音效管理系统
 * 支持主题音效、发牌声、筹码声、开牌声、背景音乐
 */
import { cdnUrl } from './cdn.js'
// 音频格式配置：WAV 原始 PCM，所有原生播放器 100% 兼容（App端优先）
const AUDIO_FORMAT = 'wav'
// 音频资源版本号（CDN缓存刷新用，更新音频文件后递增）
const AUDIO_VERSION = '1.0.4'
// 主题音效文件名映射（各主题的出牌/赢牌/背景音文件名不同）
const THEME_SOUND_MAP = {
  forbidden_city: {
    deal: 'deal.mp3',
    chip: 'chip.mp3',
    openCard: 'war_drum.mp3',
    win: 'bell.mp3',
    background: 'ambient.mp3',
    fold: 'chip.mp3',
    button: 'chip.mp3',
  },
  jiangnan: {
    deal: 'deal.mp3',
    chip: 'chip.mp3',
    openCard: 'guqin.mp3',
    win: 'water_drop.mp3',
    background: 'ambient.mp3',
    fold: 'chip.mp3',
    button: 'chip.mp3',
  },
  steampunk: {
    deal: 'deal.mp3',
    chip: 'chip.mp3',
    openCard: 'metal_stamp.mp3',
    win: 'steam_release.mp3',
    background: 'ambient.mp3',
    fold: 'chip.mp3',
    button: 'chip.mp3',
  },
  noir: {
    deal: 'deal.mp3',
    chip: 'chip.mp3',
    openCard: 'needle_drop.mp3',
    win: 'jazz_bass.mp3',
    background: 'vinyl_static.mp3',
    lookCard: 'paper_rustle.mp3',
    fold: 'chip.mp3',
    button: 'chip.mp3',
  },
  wallstreet: {
    deal: 'deal.mp3',
    chip: 'chip.mp3',
    openCard: 'trade_success.mp3',
    win: 'cash_register.mp3',
    background: 'terminal_ambient.mp3',
    flop: 'flop.mp3',
    turn: 'turn.mp3',
    river: 'river.mp3',
    fold: 'chip.mp3',
    button: 'chip.mp3',
  },
}

// 游戏类型 ↔ 主题名映射（sound 使用主题名，不使用gameType）
const GAME_TYPE_TO_THEME = {
  niuniu: 'forbidden_city',
  sangong: 'jiangnan',
  tbnn: 'steampunk',
  jinhua: 'noir',
  texas: 'wallstreet',
}

// gameType 或主题名统一解析为主题目录名
function resolveThemeName(themeOrGameType) {
  if (!themeOrGameType) return 'forbidden_city'
  // 如果已经是主题目录名，直接返回
  if (THEME_SOUND_MAP[themeOrGameType]) return themeOrGameType
  // 如果是gameType，映射为主题目录
  if (GAME_TYPE_TO_THEME[themeOrGameType]) return GAME_TYPE_TO_THEME[themeOrGameType]
  return 'forbidden_city'
}


class SoundManager {
  constructor() {
    this.audioContexts = {}
    this.enabled = true
    this.vibrateEnabled = true
    this.volume = 0.5
    this.backgroundVolume = 0.15
    this.currentTheme = 'forbidden_city'
    this.backgroundAudio = null
    this.soundCache = {}
    this.soundPools = {}
    this.poolIndexes = {}
    this.hasUserInteraction = false
  }
  /**
   * 初始化
   */
  init(theme = 'forbidden_city') {
    this.currentTheme = resolveThemeName(theme)
  }

  markUserInteraction() {
    this.hasUserInteraction = true
  }

  /**
   * 设置主题
   */
  setTheme(theme) {
    this.currentTheme = resolveThemeName(theme)
    this.stopBackground()
    this.destroySoundPools()
  }

  /**
   * 预加载音效【仅在用户交互发生后调用】
   */
  preloadSounds() {
    if (!this.hasUserInteraction) return
    console.debug('[Sound] 已获得用户交互授权，音效将在首次播放时创建')
  }

  /**
   * 获取音效文件路径
   */
  getSoundPath(type) {
    const safeTheme = this.currentTheme || 'forbidden_city'
    const themeMap = THEME_SOUND_MAP[safeTheme] || THEME_SOUND_MAP.forbidden_city
    let fileName = themeMap[type] || themeMap[type.toLowerCase()] || `${type}.mp3`
    // 切换音频格式（wav / m4a）
    if (AUDIO_FORMAT !== 'mp3') {
      fileName = fileName.replace(/\.mp3$/i, `.${AUDIO_FORMAT}`)
    }
    const finalUrl = cdnUrl(`/static/sounds/${safeTheme}/${fileName}?v=${AUDIO_VERSION}`)
    console.debug('[SoundPath] type=', type, 'theme=', safeTheme, 'url=', finalUrl)
    return finalUrl
  }

  /**
   * 获取音频实例
   */
  getAudio(type) {
    const key = this.currentTheme + '_' + type
    if (this.soundCache[key]) {
      return this.soundCache[key]
    }
    if (!this.hasUserInteraction) {
      console.warn('[Sound] skip create audio: no user interaction yet', type)
      return null
    }
    const src = this.getSoundPath(type)
    if (!src) return null
    try {
      const audio = uni.createInnerAudioContext()
      audio.cache = false // 关闭uni内置download缓存，修复Android _doc/uniapp_temp 解码器BUG
      audio.volume = this.volume
      audio.src = src
      audio.onError((err) => {
        this.handleAudioError(audio, type, err)
      })
      this.soundCache[key] = audio
      return audio
    } catch (e) {
      console.error('[Sound] 创建音频失败', e)
      return null
    }
  }

  /**
   * 统一音频加载错误处理
   */
  handleAudioError(audio, type, err) {
    const errCode = err && (err.errCode !== undefined ? err.errCode : (err.code !== undefined ? err.code : ''))
    const errMsg = err?.errMsg || err?.message || ''
    if (errCode === -5 && !this.hasUserInteraction) {
      console.debug('[Sound iOS] 尚未用户交互，忽略初始化音频错误', type)
      return
    }
    if (errCode === -5) {
      console.warn('[Sound iOS] 音频会话失效，销毁实例', type)
      const key = this.currentTheme + '_' + type
      delete this.soundCache[key]
      try {
        audio.stop()
        audio.destroy()
      } catch (e) {}
      return
    }
    if (errMsg.includes('CACHE_OPERATION_NOT_SUPPORTED') || errMsg.includes('cache')) {
      console.warn('[Sound] 缓存错误（可忽略）:', type, errMsg)
      return
    }
    if (!audio.__retried) {
      audio.__retried = true
      setTimeout(() => {
        try {
          audio.stop()
          let baseSrc = audio.src || ''
          baseSrc = baseSrc.replace(/(&r=\d+|\?r=\d+)/g, '')
          const sep = baseSrc.includes('?') ? '&' : '?'
          audio.src = baseSrc + sep + 'r=' + Date.now()
        } catch (e) {}
      }, 1200)
      console.warn('[Sound] 音频加载失败，延迟重试:', type, 'errCode:', errCode, errMsg)
    } else {
      console.warn('[Sound] 音频加载最终失败:', type, 'errCode:', errCode, errMsg)
    }
  }

  getPlaybackAudio(type) {
    return this.getAudio(type)
  }

  /**
   * 播放音效
   */
  play(type, options = {}) {
    if (!this.enabled) return
    if (!this.hasUserInteraction) return
    const audio = this.getPlaybackAudio(type)
    if (!audio) return
    try {
      if (options.volume !== undefined) {
        audio.volume = options.volume
      } else {
        audio.volume = this.volume
      }
      audio.seek(0)
      audio.play()
      if (this.vibrateEnabled && options.vibrate) {
        uni.vibrateShort({ type: 'light' })
      }
    } catch (e) {
      console.error('[Sound] 播放失败', type, e)
    }
  }

  playDeal() {
    this.play('deal', { vibrate: false })
  }
  playChip() {
    this.play('chip', { vibrate: true })
  }
  playOpenCard() {
    this.play('openCard', { vibrate: true, volume: 0.8 })
  }
  playWin() {
    this.play('win', { vibrate: true, volume: 0.7 })
  }
  playLookCard() {
    this.play('lookCard', { vibrate: false, volume: 0.4 })
  }
  playFold() {
    this.play('fold', { vibrate: false, volume: 0.3 })
  }
  playButton() {
    this.play('button', { vibrate: false, volume: 0.3 })
  }

  playBackground() {
    if (!this.enabled) return
    if (!this.hasUserInteraction) return
    if (this.backgroundAudio) {
      this.backgroundAudio.volume = this.backgroundVolume
      this.backgroundAudio.play()
      return
    }
    try {
      this.backgroundAudio = uni.createInnerAudioContext()
      this.backgroundAudio.cache = false // 关闭内置缓存
      this.backgroundAudio.loop = true
      this.backgroundAudio.volume = this.backgroundVolume
      this.backgroundAudio.src = this.getSoundPath('background')
      this.backgroundAudio.onError((err) => {
        this.handleAudioError(this.backgroundAudio, 'background', err)
      })
      this.backgroundAudio.play()
    } catch (e) {
      console.error('[Sound] 背景音乐播放失败', e)
    }
  }

  pauseBackground() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause()
    }
  }

  stopBackground() {
    if (this.backgroundAudio) {
      try {
        this.backgroundAudio.stop()
        this.backgroundAudio.destroy()
      } catch (e) {}
      this.backgroundAudio = null
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    Object.values(this.soundCache).forEach(audio => {
      if (audio) audio.volume = this.volume
    })
    Object.values(this.soundPools).forEach(pool => {
      pool.forEach(audio => { audio.volume = this.volume })
    })
  }

  setBackgroundVolume(volume) {
    this.backgroundVolume = Math.max(0, Math.min(1, volume))
    if (this.backgroundAudio) {
      this.backgroundAudio.volume = this.backgroundVolume
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (!enabled) {
      this.stopBackground()
    }
  }

  setVibrateEnabled(enabled) {
    this.vibrateEnabled = enabled
  }

  destroySoundPools() {
    Object.values(this.soundPools).forEach(pool => {
      pool.forEach(audio => {
        try {
          audio.stop()
          audio.destroy()
        } catch (e) {}
      })
    })
    this.soundPools = {}
    this.poolIndexes = {}
  }

  vibrate(type = 'light') {
    if (!this.vibrateEnabled) return
    try {
      if (type === 'long') {
        uni.vibrateLong()
      } else {
        uni.vibrateShort({ type })
      }
    } catch (e) {}
  }

  destroy() {
    this.stopBackground()
    Object.values(this.soundCache).forEach(audio => {
      if (audio) {
        try {
          audio.stop()
          audio.destroy()
        } catch (e) {}
      }
    })
    this.soundCache = {}
    this.destroySoundPools()
    this.hasUserInteraction = false
  }
}

let soundManagerInstance = null
export function getSoundManager() {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager()
  }
  return soundManagerInstance
}
export function destroySoundManager() {
  if (soundManagerInstance) {
    soundManagerInstance.destroy()
    soundManagerInstance = null
  }
}

// ============================================
// 玩家语音管理器（支持方言语音包）
// ============================================
const VOICE_ACTIONS = {
  enter: 'enter',
  deal: 'deal',
  look: 'look',
  call: 'call',
  raise: 'raise',
  fold: 'fold',
  compare: 'compare',
  allin: 'allin',
  win: 'win',
  lose: 'lose',
  wait: 'wait',
  chat1: 'chat1',
  chat2: 'chat2',
  chat3: 'chat3',
}
class VoiceManager {
  constructor() {
    this.enabled = true
    this.volume = 0.8
    this.voiceCache = {}
    this.currentPlaying = null
    this.hasUserInteraction = false
  }
  markUserInteraction() {
    this.hasUserInteraction = true
  }
  init() {
  }
  preloadVoices() {
    if (!this.hasUserInteraction) return
    console.debug('[Voice] 已获得用户交互授权，语音将在首次播放时创建')
  }
  getVoicePath(avatarId, action) {
    const validAction = VOICE_ACTIONS[action] || action
    return cdnUrl(`/static/voices/${avatarId}/${validAction}.mp3?v=${AUDIO_VERSION}`)
  }
  getVoiceAudio(avatarId, action) {
    if (!this.hasUserInteraction) return null
    const key = `${avatarId}_${action}`
    if (this.voiceCache[key]) {
      return this.voiceCache[key]
    }
    try {
      const audio = uni.createInnerAudioContext()
      audio.cache = false // 关闭内置download缓存
      audio.volume = this.volume
      audio.src = this.getVoicePath(avatarId, action)
      this.voiceCache[key] = audio
      return audio
    } catch (e) {
      console.error('[Voice] 创建音频失败', avatarId, action, e)
      return null
    }
  }
  play(avatarId, action, options = {}) {
    if (!this.enabled) return
    if (!avatarId || !action) return
    if (!this.hasUserInteraction) return
    if (options.interrupt && this.currentPlaying) {
      try {
        this.currentPlaying.stop()
      } catch (e) {}
      this.currentPlaying = null
    }
    const audio = this.getVoiceAudio(avatarId, action)
    if (!audio) return
    try {
      audio.volume = options.volume !== undefined ? options.volume : this.volume
      audio.seek(0)
      audio.play()
      this.currentPlaying = audio
      audio.onEnded(() => {
        if (this.currentPlaying === audio) {
          this.currentPlaying = null
        }
      })
    } catch (e) {
      console.error('[Voice] 播放失败', avatarId, action, e)
    }
  }
  stop() {
    if (this.currentPlaying) {
      try {
        this.currentPlaying.stop()
      } catch (e) {}
      this.currentPlaying = null
    }
  }
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    Object.values(this.voiceCache).forEach(audio => {
      if (audio) audio.volume = this.volume
    })
  }
  setEnabled(enabled) {
    this.enabled = enabled
    if (!enabled) {
      this.stop()
    }
  }
  destroy() {
    this.stop()
    Object.values(this.voiceCache).forEach(audio => {
      if (audio) {
        try {
          audio.stop()
          audio.destroy()
        } catch (e) {}
      }
    })
    this.voiceCache = {}
    this.hasUserInteraction = false
  }
}

let voiceManagerInstance = null
export function getVoiceManager() {
  if (!voiceManagerInstance) {
    voiceManagerInstance = new VoiceManager()
  }
  return voiceManagerInstance
}
export function destroyVoiceManager() {
  if (voiceManagerInstance) {
    voiceManagerInstance.destroy()
    voiceManagerInstance = null
  }
}
export default {
  getSoundManager,
  destroySoundManager,
  getVoiceManager,
  destroyVoiceManager,
}

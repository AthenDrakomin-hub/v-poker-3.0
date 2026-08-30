/**
 * V-Poker 音效管理系统
 * 支持主题音效、发牌声、筹码声、开牌声、背景音乐
 */
import { cdnUrl } from './cdn.js'

// 音频格式配置：WAV 原始 PCM，所有原生播放器 100% 兼容（App端优先）
const AUDIO_FORMAT = 'wav'

// 音频资源版本号（CDN缓存刷新用，更新音频文件后递增）
const AUDIO_VERSION = '1.0.4'
const SOUND_POOL_SIZES = {
  deal: 3,
  chip: 3,
  openCard: 2,
}

// 游戏类型 �?主�?�?��名映射（sound �?��用主题名，不�?gameType�?
const GAME_TYPE_TO_THEME = {
  niuniu: 'forbidden_city',
  sangong: 'jiangnan',
  tbnn: 'steampunk',
  jinhua: 'noir',
  texas: 'wallstreet',
}

// �?gameType 或主题名统一解析为主题目录名
function resolveThemeName(themeOrGameType) {
  if (!themeOrGameType) return 'forbidden_city'
  // 如果已经�?��题目录名，直接返�?
  if (THEME_SOUND_MAP[themeOrGameType]) return themeOrGameType
  // 如果�?gameType，映射为主�?�?
  if (GAME_TYPE_TO_THEME[themeOrGameType]) return GAME_TYPE_TO_THEME[themeOrGameType]
  return 'forbidden_city'
}

// 主�?音效文件名映射（各主题的�?�?赢牌/背景音文件名不同�?
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

class SoundManager {
  constructor() {
    this.audioContexts = {}
    this.enabled = true
    this.vibrateEnabled = true
    this.volume = 0.5
    this.backgroundVolume = 0.15
    this.currentTheme = null
    this.backgroundAudio = null
    this.soundCache = {}
    this.soundPools = {}
    this.poolIndexes = {}
  }

  /**
   * 初�?�?
   */
  init(theme = 'forbidden_city') {
    this.currentTheme = resolveThemeName(theme)
    // 预加载常用音�?
    this.preloadSounds()
  }

  /**
   * 设置主�?
   */
  setTheme(theme) {
    this.currentTheme = resolveThemeName(theme)
    this.stopBackground()
    this.destroySoundPools()
    // 预加载新主�?音效
    this.preloadSounds()
  }

  /**
   * 预加载音�?
   */
  preloadSounds() {
    const sounds = ['deal', 'chip', 'openCard', 'win']
    sounds.forEach(type => {
      this.getPlaybackAudio(type)
    })
  }

  /**
   * 获取音效文件�?��
   */
  getSoundPath(type) {
    const themeMap = THEME_SOUND_MAP[this.currentTheme] || THEME_SOUND_MAP.forbidden_city
    let fileName = themeMap[type] || themeMap[type.toLowerCase()] || `${type}.mp3`
    // 切换音�?格式（wav �?m4a�?
    if (AUDIO_FORMAT !== 'wav') {
      fileName = fileName.replace(/\.mp3$/i, `.${AUDIO_FORMAT}`)
    }
    return cdnUrl(`/static/sounds/${this.currentTheme}/${fileName}?v=${AUDIO_VERSION}`)
  }

  /**
   * 获取音�?实例
   */
  getAudio(type) {
    const key = this.currentTheme + '_' + type
    if (this.soundCache[key]) {
      return this.soundCache[key]
    }

    try {
      const audio = uni.createInnerAudioContext()
      audio.volume = this.volume
      audio.src = this.getSoundPath(type)
      // 忽略非致命的缓存错误（如 ERR_CACHE_OPERATION_NOT_SUPPORTED），不影响播放
      audio.onError((err) => {
        const errMsg = err?.errMsg || err?.message || ''
        if (errMsg.includes('CACHE_OPERATION_NOT_SUPPORTED') || errMsg.includes('cache')) {
          console.warn('[Sound] 缓存错误（可忽略）:', type, errMsg)
        } else {
          console.error('[Sound] 音频错误:', type, err)
        }
      })
      this.soundCache[key] = audio
      return audio
    } catch (e) {
      console.error('[Sound] 创建音频失败', e)
      return null
    }
  }

  getPlaybackAudio(type) {
    const poolSize = SOUND_POOL_SIZES[type]
    if (!poolSize) return this.getAudio(type)

    if (!this.soundPools[type]) {
      try {
        this.soundPools[type] = Array.from({ length: poolSize }, () => {
          const audio = uni.createInnerAudioContext()
          audio.volume = this.volume
          audio.src = this.getSoundPath(type)
          // 忽略非致命的缓存错误
          audio.onError((err) => {
            const errMsg = err?.errMsg || err?.message || ''
            if (!errMsg.includes('CACHE_OPERATION_NOT_SUPPORTED') && !errMsg.includes('cache')) {
              console.error('[Sound] 音频池错误:', type, err)
            }
          })
          return audio
        })
        this.poolIndexes[type] = 0
      } catch (e) {
        console.error('[Sound] 创建音效池失败', e)
        return null
      }
    }

    const pool = this.soundPools[type]
    const index = this.poolIndexes[type]
    this.poolIndexes[type] = (index + 1) % pool.length
    return pool[index]
  }

  /**
   * �?��音效
   */
  play(type, options = {}) {
    if (!this.enabled) return

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

      // 震动反�?
      if (this.vibrateEnabled && options.vibrate) {
        uni.vibrateShort({ type: 'light' })
      }
    } catch (e) {
      console.error('[Sound] �?��失败', type, e)
    }
  }

  /**
   * 发牌�?
   */
  playDeal() {
    this.play('deal', { vibrate: false })
  }

  /**
   * 筹码�?
   */
  playChip() {
    this.play('chip', { vibrate: true })
  }

  /**
   * �?牌声
   */
  playOpenCard() {
    this.play('openCard', { vibrate: true, volume: 0.8 })
  }

  /**
   * 赢牌�?
   */
  playWin() {
    this.play('win', { vibrate: true, volume: 0.7 })
  }

  /**
   * 看牌声（炸金花专属）
   */
  playLookCard() {
    this.play('lookCard', { vibrate: false, volume: 0.4 })
  }

  /**
   * 弃牌�?
   */
  playFold() {
    this.play('fold', { vibrate: false, volume: 0.3 })
  }

  /**
   * 按钮点击�?
   */
  playButton() {
    this.play('button', { vibrate: false, volume: 0.3 })
  }

  /**
   * �?��背景音乐
   */
  playBackground() {
    if (!this.enabled) return
    if (this.backgroundAudio) {
      this.backgroundAudio.volume = this.backgroundVolume
      this.backgroundAudio.play()
      return
    }

    try {
      this.backgroundAudio = uni.createInnerAudioContext()
      this.backgroundAudio.loop = true
      this.backgroundAudio.volume = this.backgroundVolume
      this.backgroundAudio.src = this.getSoundPath('background')
      this.backgroundAudio.play()
    } catch (e) {
      console.error('[Sound] 背景音乐�?��失败', e)
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBackground() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause()
    }
  }

  /**
   * 停�?背景音乐
   */
  stopBackground() {
    if (this.backgroundAudio) {
      this.backgroundAudio.stop()
      this.backgroundAudio.destroy()
      this.backgroundAudio = null
    }
  }

  /**
   * 设置音效音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    Object.values(this.soundCache).forEach(audio => {
      if (audio) audio.volume = this.volume
    })
    Object.values(this.soundPools).forEach(pool => {
      pool.forEach(audio => { audio.volume = this.volume })
    })
  }

  /**
   * 设置背景音乐音量（独立于音效音量�?
   */
  setBackgroundVolume(volume) {
    this.backgroundVolume = Math.max(0, Math.min(1, volume))
    if (this.backgroundAudio) {
      this.backgroundAudio.volume = this.backgroundVolume
    }
  }

  /**
   * �?��/禁用音效
   */
  setEnabled(enabled) {
    this.enabled = enabled
    if (!enabled) {
      this.stopBackground()
    }
  }

  /**
   * �?��/禁用震动
   */
  setVibrateEnabled(enabled) {
    this.vibrateEnabled = enabled
  }

  destroySoundPools() {
    Object.values(this.soundPools).forEach(pool => {
      pool.forEach(audio => {
        audio.stop()
        audio.destroy()
      })
    })
    this.soundPools = {}
    this.poolIndexes = {}
  }

  /**
   * 震动反�?
   */
  vibrate(type = 'light') {
    if (!this.vibrateEnabled) return
    try {
      if (type === 'long') {
        uni.vibrateLong()
      } else {
        uni.vibrateShort({ type })
      }
    } catch (e) {
      // 忽略
    }
  }

  /**
   * �?毁所有音�?
   */
  destroy() {
    this.stopBackground()
    Object.values(this.soundCache).forEach(audio => {
      if (audio) {
        audio.stop()
        audio.destroy()
      }
    })
    this.soundCache = {}
    this.destroySoundPools()
  }
}

// 单例
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
// 玩�?�?��管理�?��方言�?��包）
// ============================================

// �?��的�?音动作映�?
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
  }

  /**
   * 初�?�?
   */
  init() {
    // 预加载常用�?�?
    this.preloadVoices()
  }

  /**
   * 预加载常用�?音（每个头像的入�?胜利/失败�?
   */
  preloadVoices() {
    const commonActions = ['enter', 'win', 'lose']
    for (let i = 1; i <= 5; i++) {
      commonActions.forEach(action => {
        this.getVoiceAudio(`vip-${i}`, action)
      })
    }
  }

  /**
   * 获取�?��文件�?��
   */
  getVoicePath(avatarId, action) {
    const validAction = VOICE_ACTIONS[action] || action
    return cdnUrl(`/static/voices/${avatarId}/${validAction}.mp3?v=${AUDIO_VERSION}`)
  }

  /**
   * 获取�?��音�?实例
   */
  getVoiceAudio(avatarId, action) {
    const key = `${avatarId}_${action}`
    if (this.voiceCache[key]) {
      return this.voiceCache[key]
    }

    try {
      const audio = uni.createInnerAudioContext()
      audio.volume = this.volume
      audio.src = this.getVoicePath(avatarId, action)
      this.voiceCache[key] = audio
      return audio
    } catch (e) {
      console.error('[Voice] 创建音�?失败', avatarId, action, e)
      return null
    }
  }

  /**
   * �?��玩�?�?��
   * @param {string} avatarId - 头像ID (vip-1 ~ vip-5)
   * @param {string} action - 动作 (enter/deal/look/call/raise/fold/compare/allin/win/lose/wait/chat1/chat2/chat3)
   * @param {object} options - 选项 { volume, interrupt }
   */
  play(avatarId, action, options = {}) {
    if (!this.enabled) return
    if (!avatarId || !action) return

    // 如果设置�?interrupt，停止当前播放的�?��
    if (options.interrupt && this.currentPlaying) {
      try {
        this.currentPlaying.stop()
      } catch (e) {
        // 忽略
      }
      this.currentPlaying = null
    }

    const audio = this.getVoiceAudio(avatarId, action)
    if (!audio) return

    try {
      audio.volume = options.volume !== undefined ? options.volume : this.volume
      audio.seek(0)
      audio.play()
      this.currentPlaying = audio

      // �?��结束后清除引�?
      audio.onEnded(() => {
        if (this.currentPlaying === audio) {
          this.currentPlaying = null
        }
      })
    } catch (e) {
      console.error('[Voice] �?��失败', avatarId, action, e)
    }
  }

  /**
   * 停�?当前�?��的�?�?
   */
  stop() {
    if (this.currentPlaying) {
      try {
        this.currentPlaying.stop()
      } catch (e) {
        // 忽略
      }
      this.currentPlaying = null
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    Object.values(this.voiceCache).forEach(audio => {
      if (audio) audio.volume = this.volume
    })
  }

  /**
   * �?��/禁用�?��
   */
  setEnabled(enabled) {
    this.enabled = enabled
    if (!enabled) {
      this.stop()
    }
  }

  /**
   * �?毁所有�?�?
   */
  destroy() {
    this.stop()
    Object.values(this.voiceCache).forEach(audio => {
      if (audio) {
        audio.stop()
        audio.destroy()
      }
    })
    this.voiceCache = {}
  }
}

// �?��管理器单�?
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

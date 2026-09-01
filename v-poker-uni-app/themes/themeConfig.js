/**
 * V-Poker 五大游戏主题配置系统
 * 五座斗兽场视觉定义
 */
import { cdnUrl } from '../utils/cdn.js'

export const GAME_THEMES = {
  // ========== 紫禁之巅·斗兽场（抢庄牛牛）==========
  forbidden_city: {
    id: 'forbidden_city',
    name: '紫禁之巅·斗兽场',
    gameType: 'niuniu',
    description: '黑金帝王气场 · 蛛网裂纹 · 破屏金光',

    // 背景图
    backgroundImage: cdnUrl('/static/images/themes/forbidden_city/bg.jpg'),

    // 颜色系统
    colors: {
      bgPrimary: '#0A0A0A',
      bgSecondary: '#1B1C20',
      bgGradient: 'radial-gradient(ellipse at center, #2A1A1A 0%, #1A0A0A 50%, #0A0505 100%)',
      tableFelt: '#1a0a0a',
      tableBorder: '#8B0000',
      primary: '#FFD700',
      secondary: '#FFA500',
      accent: '#8B0000',
      text: '#E8E8E8',
      textMuted: 'rgba(255,255,255,0.7)',
      border: 'rgba(255,215,0,0.48)',
      cardBack: '#1A1A1A',
      cardBackBorder: '#FFD700',
    },

    // 牌桌纹理
    tableTexture: {
      type: 'spider_web',
      opacity: 0.08,
      color: '#FFD700',
    },

    // 粒子效果
    particles: {
      type: 'incense', // 焚香粒子
      count: 15,
      color: '#FFA500',
      size: { min: 2, max: 5 },
      speed: { min: 0.3, max: 0.8 },
      direction: 'up',
      fadeIn: true,
      fadeOut: true,
      opacity: { min: 0.3, max: 0.7 },
    },

    // 开牌高光动画
    openCardEffect: {
      type: 'gold_burst', // 金光炸裂
      duration: 600,
      color: '#FFD700',
      burstRadius: 200,
      particleCount: 30,
      screenShake: { intensity: 5, duration: 300 },
      flashOpacity: 0.3,
    },

    // 音效
    sounds: {
      deal: 'sounds/forbidden_city/deal.mp3',
      chip: 'sounds/forbidden_city/chip.mp3',
      openCard: 'sounds/forbidden_city/war_drum.mp3',
      win: 'sounds/forbidden_city/bell.mp3',
      background: 'sounds/forbidden_city/ambient.mp3',
    },

    // 字体
    fonts: {
      title: '"ZCOOLXiaoWei", "STKaiti", "KaiTi", serif',
      number: '"PlayfairDisplay", Georgia, "Times New Roman", serif',
      body: '-apple-system, sans-serif',
    },

    // 装饰元素
    decorations: {
      cornerPattern: 'imperial_meander', // 帝王回纹
      borderStyle: 'gold_ornate',
    },
  },

  // ========== 江南百景·青玉案（抢庄三公）==========
  jiangnan: {
    id: 'jiangnan',
    name: '江南百景·青玉案',
    gameType: 'sangong',
    description: '月白天青 · 水墨意境 · 水波涟漪',

    // 背景图
    backgroundImage: cdnUrl('/static/images/themes/jiangnan/bg.jpg'),

    colors: {
      bgPrimary: '#E8F4F8',
      bgSecondary: '#D0E8F0',
      bgGradient: 'radial-gradient(ellipse at center, #F0F8FA 0%, #D8ECF2 50%, #C0E0E8 100%)',
      tableFelt: '#4A90A4',
      tableBorder: '#2C5F6D',
      primary: '#4A90A4',
      secondary: '#2C5F6D',
      accent: '#8B7355',
      text: '#2C3E50',
      textMuted: 'rgba(44,62,80,0.5)',
      border: 'rgba(74,144,164,0.3)',
      cardBack: '#4A90A4',
      cardBackBorder: '#2C5F6D',
    },

    tableTexture: {
      type: 'water_ripple',
      opacity: 0.1,
      color: '#4A90A4',
    },

    particles: {
      type: 'falling_leaves', // 落叶粒子
      count: 12,
      color: '#D4A574',
      size: { min: 8, max: 15 },
      speed: { min: 0.5, max: 1.2 },
      direction: 'down',
      sway: true,
      fadeIn: true,
      fadeOut: true,
      opacity: { min: 0.4, max: 0.8 },
    },

    openCardEffect: {
      type: 'ink_spread', // 水墨晕染
      duration: 500,
      color: '#2C5F6D',
      rippleCount: 3,
      rippleMaxRadius: 150,
      screenShake: { intensity: 2, duration: 200 },
    },

    sounds: {
      deal: 'sounds/jiangnan/deal.mp3',
      chip: 'sounds/jiangnan/chip.mp3',
      openCard: 'sounds/jiangnan/guqin.mp3',
      win: 'sounds/jiangnan/water_drop.mp3',
      background: 'sounds/jiangnan/ambient.mp3',
    },

    fonts: {
      title: '"MaShanZheng", "STSong", "SimSun", serif',
      number: '"PlayfairDisplay", Georgia, "Times New Roman", serif',
      body: '-apple-system, sans-serif',
    },

    decorations: {
      cornerPattern: 'cloud_pattern',
      borderStyle: 'ink_wash',
    },
  },

  // ========== 机械迷城·流水线（通比牛牛）==========
  steampunk: {
    id: 'steampunk',
    name: '机械迷城·流水线',
    gameType: 'tbnn',
    description: '蒸汽朋克 · 工业齿轮 · 机械臂冲压',

    // 背景图
    backgroundImage: cdnUrl('/static/images/themes/steampunk/bg.jpg'),

    colors: {
      bgPrimary: '#2D2D2D',
      bgSecondary: '#1D1D1D',
      bgGradient: 'radial-gradient(ellipse at center, #3D3D3D 0%, #252525 50%, #151515 100%)',
      tableFelt: '#3D2817',
      tableBorder: '#8B4513',
      primary: '#CD7F32',
      secondary: '#8B4513',
      accent: '#B8860B',
      text: '#E8DCC8',
      textMuted: 'rgba(232,220,200,0.5)',
      border: 'rgba(205,127,50,0.3)',
      cardBack: '#8B4513',
      cardBackBorder: '#CD7F32',
    },

    tableTexture: {
      type: 'gear_pattern',
      opacity: 0.06,
      color: '#CD7F32',
      animated: true,
    },

    particles: {
      type: 'steam', // 蒸汽粒子
      count: 20,
      color: '#E8E8E8',
      size: { min: 10, max: 25 },
      speed: { min: 0.2, max: 0.5 },
      direction: 'up',
      expand: true,
      fadeIn: true,
      fadeOut: true,
      opacity: { min: 0.2, max: 0.5 },
    },

    openCardEffect: {
      type: 'mechanical_stamp', // 机械臂冲压
      duration: 400,
      color: '#CD7F32',
      screenShake: { intensity: 8, duration: 250 },
      stampSound: true,
      metalFlash: true,
    },

    sounds: {
      deal: 'sounds/steampunk/deal.mp3',
      chip: 'sounds/steampunk/chip.mp3',
      openCard: 'sounds/steampunk/metal_stamp.mp3',
      win: 'sounds/steampunk/steam_release.mp3',
      background: 'sounds/steampunk/ambient.mp3',
    },

    fonts: {
      title: '"ShareTechMono", "OCR-A", "Courier New", monospace',
      number: '"ShareTechMono", "Courier New", monospace',
      body: '-apple-system, sans-serif',
    },

    decorations: {
      cornerPattern: 'rivet_pattern',
      borderStyle: 'metal_rivet',
    },
  },

  // ========== 雾都夜话·黑胶密房（炸金花）==========
  noir: {
    id: 'noir',
    name: '雾都夜话·黑胶密房',
    gameType: 'jinhua',
    description: '聚光灯影 · 心理战 · 黑胶密房',

    // 背景图
    backgroundImage: cdnUrl('/static/images/themes/noir/bg.jpg'),

    colors: {
      bgPrimary: '#0A0A0A',
      bgSecondary: '#000000',
      bgGradient: 'radial-gradient(ellipse at center, #1A1A1A 0%, #0A0A0A 40%, #000000 100%)',
      tableFelt: '#0D0D0D',
      tableBorder: '#1A1A1A',
      primary: '#FFD700',
      secondary: '#8B0000',
      accent: '#4A4A4A',
      text: '#E8E8E8',
      textMuted: 'rgba(255,255,255,0.4)',
      border: 'rgba(255,215,0,0.2)',
      cardBack: '#0A0A0A',
      cardBackBorder: '#333333',
    },

    tableTexture: {
      type: 'velvet',
      opacity: 1,
      color: '#0D0D0D',
    },

    // 聚光灯效果
    spotlight: {
      enabled: true,
      color: 'rgba(255,215,0,0.15)',
      position: 'center',
      radius: '40%',
    },

    particles: {
      type: 'smoke', // 烟雾粒子
      count: 25,
      color: '#4A4A4A',
      size: { min: 20, max: 50 },
      speed: { min: 0.1, max: 0.3 },
      direction: 'random',
      expand: true,
      fadeIn: true,
      fadeOut: true,
      opacity: { min: 0.05, max: 0.15 },
    },

    openCardEffect: {
      type: 'spotlight_narrow', // 聚光灯收窄
      duration: 800,
      color: '#FFD700',
      initialRadius: '60%',
      finalRadius: '20%',
      dimSurroundings: true,
      needleDrop: true, // 黑胶唱针落下
    },

    // 看牌动作
    lookCardEffect: {
      type: 'snake_tongue', // 毒蛇信子
      duration: 200,
      slideDistance: 4,
      tiltAngle: 5,
    },

    sounds: {
      deal: 'sounds/noir/deal.mp3',
      chip: 'sounds/noir/chip.mp3',
      lookCard: 'sounds/noir/paper_rustle.mp3',
      openCard: 'sounds/noir/needle_drop.mp3',
      win: 'sounds/noir/jazz_bass.mp3',
      background: 'sounds/noir/vinyl_static.mp3',
    },

    fonts: {
      title: '"ShareTechMono", "Courier New", monospace',
      number: '"PlayfairDisplay", Georgia, "Times New Roman", serif',
      body: '-apple-system, sans-serif',
    },

    decorations: {
      cornerPattern: 'vinyl_grooves',
      borderStyle: 'dark_metal',
    },
  },

  // ========== 华尔街之狼·信息交易所（德州扑克）==========
  wallstreet: {
    id: 'wallstreet',
    name: '华尔街之狼·信息交易所',
    gameType: 'texas',
    description: '半透明玻璃 · 数据跳动 · 理性竞技',

    // 背景图
    backgroundImage: cdnUrl('/static/images/themes/wallstreet/bg.jpg'),

    colors: {
      bgPrimary: '#0F1923',
      bgSecondary: '#0A1018',
      bgGradient: 'radial-gradient(ellipse at center, #1A2A3A 0%, #0F1923 50%, #0A1018 100%)',
      tableFelt: '#0F1923',
      tableBorder: '#1E3A5F',
      primary: '#00D4FF',
      secondary: '#FF6B35',
      accent: '#4ADE80',
      text: '#E8E8E8',
      textMuted: 'rgba(255,255,255,0.5)',
      border: 'rgba(0,212,255,0.3)',
      cardBack: '#0F1923',
      cardBackBorder: '#00D4FF',
    },

    tableTexture: {
      type: 'perspective_grid',
      opacity: 0.1,
      color: '#00D4FF',
      breathing: true,
    },

    particles: {
      type: 'data_rain', // 数据雨
      count: 30,
      color: '#00D4FF',
      size: { min: 1, max: 2 },
      speed: { min: 1, max: 3 },
      direction: 'down',
      fadeIn: true,
      fadeOut: true,
      opacity: { min: 0.05, max: 0.15 },
      characters: '0123456789$%',
    },

    openCardEffect: {
      type: 'grid_lightup', // 网格线亮起
      duration: 600,
      color: '#00D4FF',
      gridPulse: true,
      dataFlash: true,
      screenShake: { intensity: 3, duration: 200 },
    },

    // 三段式发牌
    dealStages: {
      preflop: { name: '翻牌前', cards: 2 },
      flop: { name: '翻牌', cards: 3 },
      turn: { name: '转牌', cards: 1 },
      river: { name: '河牌', cards: 1 },
    },

    sounds: {
      deal: 'sounds/wallstreet/deal.mp3',
      chip: 'sounds/wallstreet/chip.mp3',
      flop: 'sounds/wallstreet/data_write.mp3',
      turn: 'sounds/wallstreet/data_update.mp3',
      river: 'sounds/wallstreet/data_update.mp3',
      openCard: 'sounds/wallstreet/trade_success.mp3',
      win: 'sounds/wallstreet/cash_register.mp3',
      background: 'sounds/wallstreet/terminal_ambient.mp3',
    },

    fonts: {
      title: '"JetBrainsMono", "Courier New", monospace',
      number: '"JetBrainsMono", "Courier New", monospace',
      body: '-apple-system, sans-serif',
    },

    decorations: {
      cornerPattern: 'circuit_pattern',
      borderStyle: 'glass_neon',
    },
  },
}

// 根据游戏类型获取主题
export function getThemeByGameType(gameType) {
  const map = {
    niuniu: 'forbidden_city',
    sangong: 'jiangnan',
    tbnn: 'steampunk',
    jinhua: 'noir',
    texas: 'wallstreet',
  }
  const themeId = map[gameType] || 'forbidden_city'
  return GAME_THEMES[themeId]
}

// 获取所有主题列表
export function getAllThemes() {
  return Object.values(GAME_THEMES)
}

export default {
  GAME_THEMES,
  getThemeByGameType,
  getAllThemes,
}

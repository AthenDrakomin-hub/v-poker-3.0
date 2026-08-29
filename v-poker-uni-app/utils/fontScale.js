/**
 * V-Poker 字体缩放管理
 * 控制全局字体大小，通过 CSS 变量 --font-scale 实现
 * 档位：小(0.85) / 标准(1.0) / 大(1.15) / 超大(1.3)
 */

const STORAGE_KEY = 'vpoker_font_scale'

// 预设档位
export const FONT_SCALE_OPTIONS = [
  { value: 0.85, label: '小', desc: '适合大屏设备' },
  { value: 1.0, label: '标准', desc: '默认大小' },
  { value: 1.15, label: '大', desc: '适合视力不佳' },
  { value: 1.3, label: '超大', desc: '最大字体' },
]

// 当前缩放比例（内存缓存）
let currentScale = 1.0

/**
 * 从本地存储读取字体缩放比例
 */
export function getFontScale() {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY)
    if (saved && typeof saved === 'number') {
      currentScale = saved
      return saved
    }
  } catch (e) {
    console.warn('[fontScale] 读取失败', e)
  }
  currentScale = 1.0
  return 1.0
}

/**
 * 设置字体缩放比例并保存到本地存储
 * @param {number} scale - 缩放比例
 */
export function setFontScale(scale) {
  if (typeof scale !== 'number' || scale <= 0) {
    console.warn('[fontScale] 无效的缩放比例', scale)
    return
  }
  currentScale = scale
  try {
    uni.setStorageSync(STORAGE_KEY, scale)
  } catch (e) {
    console.warn('[fontScale] 保存失败', e)
  }
  // 同步更新全局 CSS 变量（App端WebView / H5 均生效）
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.setProperty('--font-scale', scale)
    }
  } catch (e) {
    // 非Web环境忽略
  }
  // 全局广播字体变化
  uni.$emit('fontScaleChange', scale)
}

/**
 * 获取当前缩放比例（内存缓存，不读存储）
 */
export function getCurrentScale() {
  return currentScale
}

/**
 * 获取当前档位的 label
 */
export function getCurrentScaleLabel() {
  const opt = FONT_SCALE_OPTIONS.find(o => Math.abs(o.value - currentScale) < 0.01)
  return opt ? opt.label : '标准'
}

/**
 * 初始化：从存储读取并广播初始值
 * 在 App.vue onLaunch 中调用
 */
export function initFontScale() {
  const scale = getFontScale()
  // 延迟广播，确保页面已加载
  setTimeout(() => {
    uni.$emit('fontScaleChange', scale)
  }, 100)
  return scale
}

export default {
  FONT_SCALE_OPTIONS,
  getFontScale,
  setFontScale,
  getCurrentScale,
  getCurrentScaleLabel,
  initFontScale,
}

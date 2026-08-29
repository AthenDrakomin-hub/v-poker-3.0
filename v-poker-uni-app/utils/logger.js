/**
 * V-Poker 日志工具
 * 开发环境：完整输出
 * 生产环境：禁用 log/debug/warn，保留 error
 */

const IS_DEV = (process.env && process.env.NODE_ENV === 'development') || false

// 保存原始方法
const originalConsole = {
  log: console.log.bind(console),
  debug: console.debug.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
}

// 带前缀的日志输出
function prefix(level, args) {
  const time = new Date().toLocaleTimeString()
  return [`[V-Poker ${level} ${time}]`, ...args]
}

export const logger = {
  log(...args) {
    if (IS_DEV) originalConsole.log(...prefix('LOG', args))
  },
  debug(...args) {
    if (IS_DEV) originalConsole.debug(...prefix('DEBUG', args))
  },
  info(...args) {
    if (IS_DEV) originalConsole.info(...prefix('INFO', args))
  },
  warn(...args) {
    if (IS_DEV) originalConsole.warn(...prefix('WARN', args))
  },
  error(...args) {
    // error 始终输出，生产环境也需要
    originalConsole.error(...prefix('ERROR', args))
  },
}

/**
 * 初始化全局控制台拦截
 * 在 main.js 中调用一次即可
 */
export function initLogger() {
  if (!IS_DEV) {
    // 生产环境：静默 log/debug/info/warn，保留 error
    console.log = () => {}
    console.debug = () => {}
    console.info = () => {}
    console.warn = () => {}
    // error 保留但加前缀
    const origError = originalConsole.error
    console.error = (...args) => origError(...prefix('ERROR', args))
  }
}

export default logger

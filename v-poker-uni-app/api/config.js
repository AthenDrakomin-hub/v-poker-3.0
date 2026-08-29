/**
 * V-Poker API 配置
 */

// API基础地址
// 注意：接口文件中的路径已自带 /api 前缀（如 /api/auth/login），此处只填域名
// 开发环境：http://localhost:3001
// 生产环境：https://goodspage.cn
const BASE_URL = 'https://goodspage.cn'

export const API_CONFIG = {
  baseUrl: BASE_URL,
  timeout: 15000,
  tokenKey: 'vpoker_token',
  deviceIdKey: 'vpoker_device_id',
}

export default API_CONFIG

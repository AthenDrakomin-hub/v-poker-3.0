# V-Poker UNI-APP · 横屏沉浸式扑克竞技平台

> Vue 3 + uni-app 跨端框架 · 强制横屏 16:9 · 五大游戏主题 · Socket.io 实时对战 · Canvas 2D 渲染

[![uni-app](https://img.shields.io/badge/uni--app-3.0+-34B7F2?style=flat-square&logo=vuedotjs)](https://uniapp.dcloud.io/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

---

## 核心亮点

| 特性 | 说明 |
|------|------|
| **横屏沉浸** | manifest + pages.json + App.vue 三重锁定横屏，APP 端全屏沉浸 |
| **双渲染层** | DOM 负责 UI/HUD，Canvas (renderjs) 负责卡牌/筹码/粒子动画，逻辑层通过 `data-render-cmd` 桥接 |
| **五大主题** | 紫禁之巅·江南百景·机械迷城·雾都夜话·华尔街之狼，每主题独立配色/粒子/开牌动画/音效/字体 |
| **实时对战** | 手动解析 Socket.io Engine.IO v4 协议 over `uni.connectSocket`，指数退避自动重连 + 25s 心跳 |
| **8 人牌桌** | 8 座位环形布局，两侧紧凑模式，支持庄家标识/自动玩/弃牌/赢家高光 |
| **V3 经济模型** | 3% 抽水，L0/L1/L2 三级代理返佣，平台倒挤守恒，倒金字塔鎏金结算动画 |
| **多角色工作台** | player / agent / top_agent / customer_service / admin 五种角色，路由级权限拦截 |
| **方言语音包** | 5 套 VIP 头像对应语音包，入场/等待/赢/输/操作 语音反馈 |
| **CDN 静态资源** | Cloudflare R2 (`static.yefeng.us.cc`)，字体/卡牌/音效/主题图全部 CDN 分发 |

---

## 游戏主题

| 游戏 | 主题 ID | 主题名 | 视觉风格 | 开牌动画 |
|------|---------|--------|----------|----------|
| 抢庄牛牛 | `forbidden_city` | 紫禁之巅·斗兽场 | 黑金帝王气场 | gold_burst 金光炸裂 |
| 抢庄三公 | `jiangnan` | 江南百景·青玉案 | 月白天青水墨 | ink_spread 水墨晕染 |
| 通比牛牛 | `steampunk` | 机械迷城·流水线 | 蒸汽朋克工业 | mechanical_stamp 机械冲压 |
| 炸金花 | `noir` | 雾都夜话·黑胶密房 | 聚光灯暗影 | spotlight_narrow 聚光灯收窄 |
| 德州扑克 | `wallstreet` | 华尔街之狼·信息交易所 | 半透明玻璃数据 | grid_lightup 网格亮起 |

主题配置统一在 `themes/themeConfig.js`，通过 `getThemeByGameType(gameType)` 获取。

---

## 项目结构

```
v-poker-uni-app/
├── api/                        # API 层（13 个模块）
│   ├── config.js               #   BASE_URL / timeout / tokenKey 配置
│   ├── request.js              #   uni.request 封装（拦截器/Token/设备ID/401跳转）
│   ├── auth.js                 #   登录/注册/登出/改密/获取当前用户
│   ├── rooms.js                #   房间 CRUD/加入/离开/操作/聊天/结算/上下分
│   ├── wallet.js               #   筹码钱包（钱柜转存/账变记录，幂等 requestId）
│   ├── games.js                #   游戏规则查询
│   ├── admin.js                #   管理后台接口
│   ├── agent.js                #   代理接口
│   ├── profile.js              #   个人资料接口
│   ├── common.js               #   健康检查/数据清理/种子数据
│   ├── app.js                  #   APP 端相关接口
│   ├── assets.js               #   静态资源接口
│   └── permissions.js          #   权限接口
├── socket/                     # WebSocket 层（2 个模块）
│   ├── index.js                #   SocketManager 单例（EIO v4 协议解析/重连/心跳）
│   └── roomSocket.js           #   RoomSocketManager（房间事件订阅/加入/离开/游戏操作）
├── store/                      # 状态管理（Vue 3 reactive，2 个模块）
│   ├── user.js                 #   用户状态（Token/角色/筹码/登录态）
│   └── room.js                 #   房间状态（牌局/座位/底池/手牌/公共牌）
├── themes/                     # 主题配置
│   └── themeConfig.js          #   五大主题全量配置 + getThemeByGameType()
├── components/                 # 通用组件（22 个，7 分类）
│   ├── actions/
│   │   └── DynamicActions.vue  #   动态操作按钮（后端 options 驱动渲染）
│   ├── chips/
│   │   ├── ChipStack.vue       #   筹码堆（自动组合/堆叠动画）
│   │   └── PotDisplay.vue      #   底池（毛玻璃胶囊/数字滚动）
│   ├── lobby/
│   │   ├── TopBar.vue          #   大厅顶部栏
│   │   ├── BottomTabBar.vue    #   底部导航
│   │   ├── GameCard.vue        #   游戏卡片
│   │   ├── GameCardSwiper.vue  #   游戏卡片轮播
│   │   ├── RightFloatButtons.vue # 右侧悬浮按钮
│   │   ├── WalletPanel.vue     #   钱包面板
│   │   ├── ProfilePanel.vue    #   个人资料面板
│   │   ├── JoinRoomModal.vue   #   加入房间弹窗
│   │   └── MyRoomsPanel.vue    #   我的房间列表面板
│   ├── poker/
│   │   └── SVGCard.vue         #   SVG 扑克牌组件
│   ├── seat/
│   │   └── PlayerSeat.vue      #   玩家座位（头像/信息/状态/庄家标识）
│   ├── settlement/
│   │   ├── PyramidDistribution.vue # 倒金字塔鎏金分配动画
│   │   └── SettlementPanel.vue #   结算面板（输赢明细+守恒等式）
│   └── ui/
│       ├── VIcon.vue           #   图标组件（base64 图标库）
│       ├── ChatBox.vue         #   聊天框（半透明悬浮）
│       ├── ImmersivePage.vue   #   沉浸页容器
│       ├── OpenCardEffect.vue  #   开牌高潮动画（5 种主题）
│       ├── ParticleSystem.vue  #   粒子系统（Canvas）
│       └── ThemeBackground.vue #   主题背景（纹理/暗角/聚光灯）
├── pages/                      # 页面路由（11 个页面，全部横屏）
│   ├── login/login.vue         #   登录页
│   ├── register/register.vue   #   注册页
│   ├── lobby/lobby.vue         #   大厅页（游戏选择+房间列表+用户信息）
│   ├── join/join.vue           #   加入房间页
│   ├── room/room.vue           #   游戏房间（核心，Canvas+DOM 双渲染）
│   ├── workbench/workbench.vue #   代理工作台
│   ├── customer-service/customer-service.vue # 客服工作台
│   ├── promotion/promotion.vue #   总代推广中心
│   ├── admin/admin.vue         #   管理后台
│   ├── profile/profile.vue     #   个人中心
│   └── settings/settings.vue   #   设置页
├── utils/                      # 工具函数（13 个模块）
│   ├── economy.js              #   V3 经济模型（抽水分配/层级追溯/守恒等式）
│   ├── cards.js                #   卡牌工具（编码解析/牛牛点数/洗牌/排序）
│   ├── authGuard.js            #   权限守卫（角色层级/页面权限/路由拦截）
│   ├── cdn.js                  #   CDN 路径适配（$cdn 全局方法）
│   ├── sound.js                #   音效管理器（主题音效/预加载/音量/震动）
│   ├── format.js               #   数字格式化（千分位/金额缩写/游戏类型）
│   ├── device.js               #   设备信息（ID/UA/屏幕）
│   ├── animation.js            #   动画缓动曲线+时间流控制
│   ├── haptic.js               #   iOS 触觉反馈
│   ├── fontScale.js            #   字体缩放（0.85/1.0/1.15/1.3）
│   ├── avatar.js               #   头像工具
│   ├── featurePermissions.js   #   功能权限
│   └── icons-base64.js         #   图标 base64 资源
├── static/                     # 静态资源
│   ├── images/                 #   cards/(SVG牌面) themes/(5主题) ui/ chips/ game-icons/ banners/
│   ├── sounds/                 #   5 主题音效目录 + quick/
│   ├── voices/                 #   vip-1 ~ vip-5 方言语音包
│   ├── fonts/                  #   定制字体
│   ├── avatars/                #   头像资源
│   └── icons/                  #   图标资源
├── styles/                     # 全局样式
│   └── landscape.css           #   横屏适配规范
├── docs/                       # 文档
│   ├── DESIGN.md               #   完整设计方案
│   ├── openapi.json            #   API 文档（OpenAPI 3.0）
│   └── TEST_CASES_E2E.md       #   E2E 测试用例
├── scripts/                    # 构建脚本（字体压缩等，独立 node_modules）
├── App.vue                     # 根组件（onLaunch 初始化/路由拦截/横屏锁定）
├── main.js                     # 入口文件（createSSRApp + 注册 $cdn）
├── pages.json                  # 页面路由 + easycom 自动组件注册
├── manifest.json               # 应用配置（横屏/权限/图标/打包）
├── uni.scss                    # 全局 SCSS 变量
├── index.html                  # H5 入口模板
└── uni.promisify.adaptor.js    # uni API Promise 化适配
```

---

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Vue 3 (Options API) + uni-app |
| 状态管理 | Vue 3 `reactive` / `ref`（无 Pinia/Vuex） |
| 样式 | SCSS + rpx + vh 响应式 + CSS 变量字体缩放 |
| 网络请求 | `uni.request` 封装（Token/设备ID/401 防抖跳转） |
| 实时通信 | `uni.connectSocket` + 手动 Socket.io EIO v4 协议解析 |
| 游戏渲染 | Canvas 2D (renderjs 视图层) + DOM 混合渲染 |
| 动画 | CSS animation + Canvas requestAnimationFrame + 贝塞尔曲线 |
| 存储 | `uni.setStorageSync` / `uni.getStorageSync` |
| 静态资源 | Cloudflare R2 CDN (`static.yefeng.us.cc`) |
| 构建工具 | HBuilderX（无根 package.json，非 npm 工程） |

---

## 认证与权限

### Token 认证

```javascript
// 登录成功后存储
uni.setStorageSync('vpoker_token', token)

// 请求头自动携带（request.js 拦截器）
Authorization: Bearer <token>
x-vpoker-token: <token>
x-device-id: <device-uuid>
x-app-version: 1.0.0
```

### 角色体系

| 角色 | 层级 | 工作台 | 可访问页面 |
|------|------|--------|-----------|
| `player` | 0 | — | 大厅/房间/个人中心/设置 |
| `agent` | 1 | 代理工作台 | + workbench |
| `top_agent` | 2 | 总代推广中心 | + promotion |
| `customer_service` | 3 | 客服工作台 | + customer-service |
| `admin` | 99 | 管理后台（可见所有工作台入口） | + admin + 全部 |

权限实现：`App.vue onLaunch` 对 `navigateTo/redirectTo/reLaunch/switchTab` 注册 `uni.addInterceptor`，调用 `canAccessPage(path)` 校验，无权限时 Toast 提示并阻止跳转。

---

## 房间页架构（核心）

### 双渲染层

```
┌─────────────────────────────────────────────┐
│  DOM 层 (Vue 模板)                           │
│  · 顶部 HUD（房间名/倒计时/筹码/设置）        │
│  · 房主控制栏（开始/暂停/筹码调整/提前结算）  │
│  · 8 座位（头像/金币/状态标签，DOM 渲染）     │
│  · 底池显示（毛玻璃胶囊）                     │
│  · 操作栏（DynamicActions，后端 options 驱动）│
│  · 聊天框 / 结算面板 / 设置弹窗               │
├─────────────────────────────────────────────┤
│  Canvas 层 (renderjs, WKWebView 视图层)      │
│  · 52 张牌离屏预渲染为 GPU 纹理               │
│  · 发牌动画（贝塞尔抛物线，600ms）            │
│  · 翻牌动画（3D cos 翻转，300ms）             │
│  · 飞行筹码（座位→底池抛物线，500ms）         │
│  · 胜利粒子爆发（最多 80 粒子，重力衰减）     │
│  · 帧率监控（<40fps 持续 180 帧自动降级）     │
├─────────────────────────────────────────────┤
│  桥接: :data-render-cmd + change: 事件       │
│  逻辑层 → renderjs: 7 种命令                 │
│    dealCards / dealCommunityCards / flipCard │
│    flipSeatCards / spawnFlyingChips /        │
│    victoryBurst / clearTable                 │
│  renderjs → 逻辑层: $owner.callMethod()      │
│    onRenderEvent({ type: 'animationComplete' })│
└─────────────────────────────────────────────┘
```

### 8 人座位布局

```
        [0] top-left    [1] top    [2] top-right
[3] left                                      [4] right  (紧凑模式)
        [5] bottom-left [6] bottom [7] bottom-right
                      (me = 6, 我的座位)
```

### Socket 事件订阅

| 事件 | 触发时机 | 处理 |
|------|----------|------|
| `room_update` / `room:update` | 房间信息变化 | 合并 roomInfo |
| `hand_update` / `hand:update` | 牌局状态变化 | updateHandState → 座位/底池/手牌/动画 |
| `action_required` / `action:required` | 轮到玩家 | 设置 isMyTurn + 倒计时 + loadHand |
| `hand_finished` / `hand:finished` | 牌局结束 | 显示结算面板 + 开牌动画 + 胜利粒子 |
| `player_join` / `player:join` | 玩家加入 | 更新座位 + 入场语音 |
| `player_leave` / `player:leave` | 玩家离开 | 清空座位 |
| `chat_message` / `chat:new` | 聊天消息 | 追加到聊天列表 |
| `state_changed` / `state:changed` | 房间状态变更 | loadHand 刷新 |
| `game_starting` / `game:starting` | 游戏开始倒计时 | 更新倒计时 |
| `reconnect` | Socket 重连成功 | 重新 joinRoom 恢复订阅 |

---

## V3 经济模型

```
底池总额 (totalPot)
  │
  ├─ 抽水 = floor(totalPot × 3%)
  │     │
  │     ├─ L0 开房代理  → 抽水 × 1/3  (≈ 流水 1%)
  │     ├─ L1 一级代理  → 抽水 × 0.5/3 (≈ 流水 0.5%)
  │     ├─ L2 总代理    → 抽水 × 0.5/3 (≈ 流水 0.5%)
  │     └─ 平台         → 剩余部分（倒挤确保守恒）
  │
  └─ 剩余 = totalPot - 抽水 → 赢家分配
```

- 不存在的层级份额向上累积（`upperLevelShare`）
- 平台份额倒挤计算：`platformAmount = rakeAmount - Σ(agentAmounts)`
- 守恒等式：`rakeAmount = L0 + L1 + L2 + PLATFORM`
- 房间门槛（仅校验不扣费）：初级 100 / 高级 1000 / 顶级 5000

---

## 快速开始

### 环境要求

- [HBuilderX](https://www.dcloud.io/hbuilderx.html) 3.0+
- Node.js 16+（仅 scripts/ 字体工具需要）
- 后端服务：`https://goodspage.cn`（或修改 `api/config.js` 切换）

### 开发步骤

```bash
# 1. 克隆仓库
git clone https://github.com/AthenDrakomin-hub/v-poker-uni-app.git
cd v-poker-uni-app

# 2. 使用 HBuilderX 打开项目
# 文件 → 打开目录 → 选择 v-poker-uni-app

# 3. 配置 API 地址（可选，默认指向生产环境）
# 修改 api/config.js 中的 BASE_URL
```

### 运行方式

| 方式 | 操作路径 |
|------|----------|
| 浏览器预览 | 运行 → 运行到浏览器 → Chrome |
| 真机调试 | 运行 → 运行到手机或模拟器 |
| 微信小程序 | 发行 → 小程序-微信 |
| APP 打包 | 发行 → 原生 App-云打包 |

---

## 设计规范

### 颜色系统

| 用途 | 色值 |
|------|------|
| 主色（金色） | `#FFD700` |
| 背景（深色） | `#0a0a0a` |
| 文字（浅色） | `#e8e8e8` |
| 毛玻璃背景 | `rgba(255,255,255,0.06)` + `blur(12px)` |

### 字体系统

| 层级 | 大小 (vh × font-scale) | 字重 |
|------|----------------------|------|
| 标题 (text-3xl) | 5vh | Bold |
| 大标题 (text-2xl) | 4vh | Bold |
| 标题 (text-xl) | 3.2vh | Bold |
| 正文大 (text-lg) | 2.6vh | Regular |
| 正文 (text-base) | 2.1vh | Regular |
| 辅助 (text-sm) | 1.8vh | Light |
| 最小 (text-xs) | 1.5vh | Light |

字体缩放可在设置页切换：0.85 / 1.0 / 1.15 / 1.3，通过 CSS 变量 `--font-scale` 全局生效。

### 间距系统（rpx）

`xs: 8` · `sm: 16` · `md: 24` · `lg: 32` · `xl: 48`

### 圆角系统（rpx）

`sm: 8` · `md: 12` · `lg: 16` · `xl: 24` · `full: 9999`

---

## 注意事项

1. **横屏开发**：所有页面均为横屏布局，设计基准 1920×1080，使用 vh 单位适配高度
2. **rpx + vh 混合**：横向布局用 rpx，纵向文字用 vh，确保不同屏幕比例下文字可读
3. **条件编译**：APP 端与 H5 端差异使用 `#ifdef APP-PLUS` / `#ifdef H5`
4. **renderjs 限制**：Canvas 渲染在视图层，不能直接访问逻辑层数据，必须通过 `data-render-cmd` 桥接
5. **性能优化**：动画优先使用 `transform` / `opacity`，Canvas 卡牌使用离屏纹理预渲染
6. **内存管理**：离开房间页时 `onUnload` 务必销毁 Socket 连接、音效管理器、倒计时定时器
7. **Socket 重连**：网络断开后自动指数退避重连（最多 10 次），重连成功后自动重新加入房间
8. **CDN 依赖**：字体/卡牌/音效等静态资源依赖 `static.yefeng.us.cc`，离线环境下资源加载失败

---

## API 文档

完整 API 接口定义见 [docs/openapi.json](./docs/openapi.json)（OpenAPI 3.0 标准），可导入 Swagger UI / Postman / Apifox 查看。

---

## 许可证

仅供学习交流使用

---

**V-Poker 2.0** · 横屏沉浸式扑克竞技平台 · [设计方案 →](./docs/DESIGN.md)

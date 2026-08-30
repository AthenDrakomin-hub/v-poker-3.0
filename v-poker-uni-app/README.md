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
│   ├── images/                 #   cards/(54张SVG牌面) themes/(5主题背景) ui/ chips/ game-scenes/(6张场景)
│   ├── fonts/subset/           #   6 个裁剪字体（APP 本地加载）
│   ├── avatars/                #   vip-1 ~ vip-5 头像（5张）
│   ├── splash/                 #   横屏启动图（12种分辨率）
│   ├── login-background.jpg    #   登录/注册页背景
│   ├── logo.png / logo-horizontal.png  # Logo
│   └── qidongtu.png            #   启动图（manifest 引用）
│   # 注意: sounds/ 和 voices/ 不保留本地文件，完全走 CDN
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

## 修改与打包标准流程（SOP）

> 每次修改代码后必须按此流程执行，否则会出现资源对不齐、版本不更新、旧缓存残留等问题。

### 一、判断修改类型

| 修改内容 | 是否需要传 CDN | 是否需要改版本号 | 是否需要清构建产物 |
|----------|----------------|------------------|-------------------|
| 页面逻辑 / 样式 / JS | 否 | 是（打包时） | 是（打包前） |
| 新增/修改 static/images/ 下图片 | 是 | 是 | 是 |
| 新增/修改音效 / 语音 | 是 | 是 | 是 |
| 新增/修改字体 | 是 | 是 | 是 |
| 修改 manifest.json | 否 | 是（本身就是版本配置） | 是 |
| 修改 pages.json 路由 | 否 | 是 | 是 |
| 仅修改后端 API | 否 | 否 | 否 |

### 二、CDN 资源管理

**CDN 地址**：https://static.yefeng.us.cc/static/（Cloudflare R2，自定义域名）

**资源分流规则**：

| 资源类型 | 本地路径 | 走 CDN | 打包进 APP | 说明 |
|----------|----------|--------|-----------|------|
| 牌面 SVG | static/images/cards/ | 是 | 是 | 本地保留副本，CDN 用于 H5 |
| 主题背景图 | static/images/themes/ | 是 | 是 | 5 套主题 |
| 游戏场景图 | static/images/game-scenes/ | 是 | 是 | 6 张场景 |
| 筹码/UI 图 | static/images/chips/ static/images/ui/ | 是 | 是 | |
| 头像 | static/avatars/ | 是 | 是 | vip-1~5 |
| 字体 | static/fonts/subset/ | 是 | 是 | 6 个裁剪字体 |
| 音效 | —（本地不保留） | 是 | 否 | 5 套主题音效，完全 CDN |
| 语音包 | —（本地不保留） | 是 | 否 | vip-1~5 方言语音，完全 CDN |
| Logo | static/logo.png static/logo-horizontal.png | 否 | 是 | 仅 APP 打包 |
| 登录背景 | static/login-background.jpg | 是 | 是 | 需同步上传 CDN |
| 启动图 | static/qidongtu.png static/splash/ | 否 | 是 | APP 专用，12 种分辨率 |
| 聊天通知音效 | — | 是 | 否 | sounds/notify.mp3，CDN 硬编码 |

**上传 CDN 命令**（修改/新增 CDN 资源后必须执行）：

`ash
cd scripts/cdn

# 全量上传 static/ 目录到 CDN（首次或大量变更时）
node r2-upload.js

# 单文件上传（修改个别文件时，推荐）
node upload-single.js <本地文件路径> static/<CDN路径>
# 示例: node upload-single.js ../../static/images/themes/noir/bg.jpg static/images/themes/noir/bg.jpg
# 示例: node upload-single.js ../../static/login-background.jpg static/login-background.jpg
`

**CDN 版本号机制**：utils/cdn.js 中 ersion 字段控制缓存刷新。修改 CDN 资源后，若发现 APP 端仍加载旧资源，递增 ersion 值（如 1 → 2），URL 会自动附加 ?v=v2 绕过缓存。

**验证 CDN 资源**：
`ash
# 检查某个资源是否可访问
curl -I https://static.yefeng.us.cc/static/images/cards/As.svg
`

### 三、版本号管理

每次 APP 打包前**必须**递增版本号，否则应用商店/用户端可能不识别更新。

需要修改的文件：

| 文件 | 字段 | 当前值 | 说明 |
|------|------|--------|------|
| manifest.json | ersionName | "1.0.5" | 显示给用户的版本号，如 1.0.5 → 1.0.6 |
| manifest.json | ersionCode | 105 | 整数版本码，每次打包 +1，如 105 → 106 |
| pi/config.js | APP_VERSION | "1.0.0" | 请求头 x-app-version，用于后端版本统计 |

**规则**：
- 小修复：versionName 第三位 +1（1.0.5 → 1.0.6），versionCode +1
- 新功能：versionName 第二位 +1（1.0.5 → 1.1.0），versionCode +1
- 大版本：versionName 第一位 +1（1.0.5 → 2.0.0），versionCode +1
- **versionCode 永远只增不减，且每次打包必须 +1**

### 四、打包前检查清单

每次云打包前逐项确认：

- [ ] **1. API 地址**：pi/config.js 中 BASE_URL 指向生产环境 https://goodspage.cn/api
- [ ] **2. WebSocket 地址**：socket/index.js 中 WS_URL 指向 wss://goodspage.cn/socket.io/
- [ ] **3. CDN 资源已同步**：本次修改涉及的图片/音效/字体已上传到 CDN（执行 upload-single.js 或 
2-upload.js）
- [ ] **4. CDN 版本号**：若 CDN 资源有变更，utils/cdn.js 中 ersion 已递增
- [ ] **5. 版本号已递增**：manifest.json 的 ersionName 和 ersionCode 已更新
- [ ] **6. 旧构建产物已清理**：删除 unpackage/dist/、unpackage/debug/、unpackage/logs/（保留 unpackage/res/icons/）
- [ ] **7. 图标正确**：unpackage/res/icons/ 中 17 个图标文件存在，manifest.json 的 pp-plus.distribute.android.icon 指向正确
- [ ] **8. 启动图正确**：static/splash/ 中 12 种分辨率启动图存在，static/qidongtu.png 存在
- [ ] **9. 权限配置**：manifest.json 的 pp-plus.distribute.android.permissions 包含所需权限（INTERNET, ACCESS_NETWORK_STATE 等）
- [ ] **10. 横屏配置**：manifest.json 的 screenOrientation 为 "landscape"，pp-plus.distribute.android 配置了横屏
- [ ] **11. pages.json 路由完整**：所有页面都在 pages.json 中注册，无遗漏
- [ ] **12. 无调试代码**：代码中无 console.log 调试输出、无硬编码的测试账号/密码

### 五、HBuilderX 云打包操作步骤

1. **打开项目**：HBuilderX → 文件 → 打开目录 → 选择 -poker-uni-app
2. **清理旧构建**：手动删除 unpackage/dist/ 目录（或在 HBuilderX 中 运行 → 清理 下的缓存）
3. **发起云打包**：发行 → 原生 App-云打包
4. **配置打包参数**：
   - Android：使用自有证书（-poker-release.keystore），填写证书别名和密码
   - iOS：使用开发者证书（需配置描述文件）
   - 勾选"打自定义调试基座"（测试时）或不勾选（正式发布时）
5. **等待打包完成**：云打包通常 3-10 分钟，完成后下载 APK/IPA
6. **安装测试**：将 APK 安装到真机，验证登录、大厅、房间、游戏、结算全流程

### 六、常见问题排查

| 问题 | 可能原因 | 解决方法 |
|------|----------|----------|
| APP 安装后白屏 | 旧构建产物残留 / pages.json 路由错误 | 删除 unpackage/dist/ 重新打包；检查 pages.json |
| 图片不显示（404） | CDN 资源未上传 / 路径错误 | 执行 upload-single.js 上传；检查 utils/cdn.js 路径拼接 |
| 音效不播放 | CDN 上音效文件缺失 | 检查 https://static.yefeng.us.cc/static/sounds/<主题>/<音效>.mp3 是否可访问 |
| 字体不生效 | CDN 字体未上传 / 版本号未更新 | 上传字体到 CDN；递增 utils/cdn.js 的 ersion |
| 打包后版本号没变 | manifest.json 的 versionCode 未递增 | 每次打包前必须修改 versionCode（整数 +1） |
| 图标还是旧的 | unpackage/res/icons/ 未更新 / 旧构建缓存 | 替换图标文件后删除 unpackage/dist/ 重新打包 |
| 启动图不对 | static/splash/ 分辨率缺失 / manifest 配置错误 | 检查 12 种分辨率启动图是否齐全 |
| 网络请求失败 | API 地址指向了测试环境 / 证书问题 | 检查 pi/config.js 的 BASE_URL；确认 SSL 证书有效 |
| WebSocket 连不上 | WS_URL 错误 / 后端 Socket 服务未启动 | 检查 socket/index.js 的 WS_URL；确认后端 wss://goodspage.cn/socket.io/ 可访问 |
| 横屏不生效 / 闪退 | manifest 横屏配置缺失 / 页面未设置横屏 | 检查 manifest.json 的 screenOrientation；检查 pages.json 每个页面的 style |
| 聊天通知没声音 | sounds/notify.mp3 CDN 缺失 | 上传通知音效到 static/sounds/notify.mp3 |

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
8. **CDN 依赖**：音效/语音完全走 CDN（static.yefeng.us.cc），图片/字体本地+CDN 双份。修改 CDN 资源后必须执行 scripts/cdn/upload-single.js 上传，详见上方「修改与打包标准流程」
9. **打包必看**：每次修改后打包前必须按「修改与打包标准流程（SOP）」执行，包括版本号递增、CDN 同步、旧构建产物清理，否则会出现资源对不齐、版本不更新等问题

---

## API 文档

完整 API 接口定义见 [docs/openapi.json](./docs/openapi.json)（OpenAPI 3.0 标准），可导入 Swagger UI / Postman / Apifox 查看。

---

## 许可证

仅供学习交流使用

---

**V-Poker 2.0** · 横屏沉浸式扑克竞技平台 · [设计方案 →](./docs/DESIGN.md)

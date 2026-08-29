# V-Poker 2.0 棋牌竞技平台

基于 WebSocket 实时通信的多人在线棋牌游戏平台，支持德州扑克、炸金花、抢庄三公、抢庄斗牛、通比牛牛五款游戏。采用前后端分离架构，前端使用 uni-app 一套代码编译 H5 + Android/iOS APP（支持 WGT 热更新）。

> **架构铁律**：前端只负责渲染展示，所有核心业务计算（牌型判定、筹码结算、发牌逻辑、抽水计算）全部在后端 Express 实现，前端绝不做业务计算。

> **V3 经济模型**：全系统只用筹码（points）一种货币，房间抽水按多级代理层级直接分配，不再有信用分房费和返佣提现。

---

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | uni-app（Vue2）+ 自定义 Canvas 渲染引擎 |
| 样式方案 | SCSS + 自定义 CSS 设计系统（玻璃拟态） |
| 状态管理 | 自定义 Store（uni.setStorageSync 持久化） |
| 后端框架 | Express + TypeScript |
| 数据库 | PostgreSQL + Drizzle ORM |
| 实时通信 | Socket.io (WebSocket) |
| 进程管理 | PM2 |
| APP 打包 | HBuilderX（WGT 热更新） |
| 测试框架 | Vitest |

---

## 支持游戏

| 游戏 | 标识 | 抽水基数 | 模式 |
|------|------|---------|------|
| 德州扑克 | `texas` | 赢家盈利总和（flow） | 正常模式 |
| 炸金花 | `jinhua` | 最终底池（pot） | 正常发牌 |
| 抢庄三公 | `sangong` | Σ下注×赔率（pot） | 抢庄模式 |
| 抢庄斗牛 | `niuniu` | Σ下注×赔率（pot） | 抢庄模式 |
| 通比牛牛 | `tbnn` | 底池（pot） | 通比模式（固定底注） |

---

## 经济模型 V3（单一货币 + 多级返佣）

### 唯一货币：筹码（points）

全系统只用筹码一种货币，不再有信用分（credit）和返佣余额（commission）。

| 用途 | 货币 |
|------|------|
| 玩家下注、上下分 | 筹码（points） |
| 代理开房门槛 | 筹码余额校验（只校验不扣费） |
| 代理返佣收入 | 直接进筹码 |
| 客服调整 | 只调整筹码 |

### 开房门槛（筹码余额校验，不扣费）

| 级别 | 筹码门槛 | 带入筹码范围 |
|------|---------|------------|
| 初级场 | ≥ 100 | 50 - 500 |
| 高级场 | ≥ 1,000 | 500 - 5,000 |
| 顶级场 | ≥ 5,000 | 5,000 - 50,000 |

### 多级代理返佣（抽水即分成）

房间结束时，抽水总额（总流水×3%）按代理层级直接分配到各代理筹码账户：

| 层级链 | 开房代理 | 一级代理 | 总代理 | 平台 |
|--------|---------|---------|--------|------|
| 总代→一级→二级（完整三级） | 1% | 0.5% | 0.5% | 1% |
| 总代→二级（跳过一级） | 1% | - | 1% | 1% |
| 一级→玩家（跳过二级） | 1.5% | - | 0.5% | 1% |
| 总代理自己开房 | 2% | - | - | 1% |

> 比例基于总流水。跳过层的份额归上一层。资金守恒：分配之和 = 抽水总额，尾差归平台。

### 层级追溯

通过 `users.invitedById` 向上追溯确定层级，无需额外字段：
- L0 总代理（`role=top_agent`）
- L1 一级代理（`role=agent`，邀请人是总代理）
- L2 二级代理（`role=agent`，邀请人是一级代理）

---

## 角色体系

| 角色 | 标识 | 入口 | 核心权限 |
|------|------|------|---------|
| 管理员 | `admin` | 管理后台 | 全平台管理、用户管理、经济配置、运营报表、系统维护 |
| 客服 | `customer_service` | 客服工作台 | 仅调整代理/总代理筹码、操作流水对账；禁止触碰普通玩家 |
| 总代理 | `top_agent` | 工作台 + 推广中心 | 下线代理管理、推广中心、开房、发展一级/二级代理 |
| 代理 | `agent` | 工作台 | 玩家管理、开房、上下分、发展下线 |
| 玩家 | `player` | 游戏大厅 | 加入房间、游戏对局 |

### 邀请码层级

```
admin（管理后台创建）
  └── top_agent（总代理）
       └── agent（一级代理）
            └── agent（二级代理）
                 └── player（玩家）
```

---

## 项目结构

```
V-poker-2.0/
├── api-server/                       # 后端源码（Express + TypeScript）
│   ├── src/
│   │   ├── index.ts                  # 服务入口
│   │   ├── db/                       # 数据库层（Schema/连接/迁移脚本）
│   │   ├── routes/                   # API 路由（12个模块）
│   │   │   ├── auth.routes.ts        # 认证/注册/登录
│   │   │   ├── rooms.routes.ts       # 房间管理（核心，含游戏操作）
│   │   │   ├── agent.routes.ts       # 代理业务
│   │   │   ├── admin.routes.ts       # 管理功能
│   │   │   ├── economyV2.routes.ts   # 经济配置 CRUD
│   │   │   ├── profile.routes.ts     # 用户资料
│   │   │   ├── games.routes.ts       # 游戏接口
│   │   │   ├── app.routes.ts         # APP 相关
│   │   │   ├── assets.routes.ts      # 素材接口
│   │   │   ├── wallet.routes.ts      # 钱柜/上下分
│   │   │   ├── messages.routes.ts    # 消息/聊天
│   │   │   └── misc.routes.ts        # 健康检查等
│   │   ├── lib/                      # 核心逻辑
│   │   │   ├── engine/               # 游戏引擎门面层（ENGINES映射 + Spec）
│   │   │   ├── games/                # 五款游戏引擎（每款独立目录）
│   │   │   ├── agentHierarchy.ts     # V3 多级代理层级追溯 + 返佣分配
│   │   │   ├── economy.ts            # 抽水/分润/结算计算
│   │   │   ├── settle.ts             # 房间结算（V3 抽水直接分配）
│   │   │   ├── gameEconomy.ts        # 经济配置内存缓存
│   │   │   ├── roomState.ts          # 房间状态持久化
│   │   │   ├── roomLock.ts           # 房间操作锁
│   │   │   ├── auth.ts               # 鉴权工具
│   │   │   ├── audit.ts              # 操作审计日志
│   │   │   └── idempotency.ts        # 幂等性中间件
│   │   ├── services/                 # 后台服务（超时检测/房间回收）
│   │   ├── socket/                   # Socket.io 模块
│   │   ├── middleware/               # Express 中间件
│   │   └── __tests__/                # 单元测试（Vitest）
│   ├── migrations/                   # 数据库迁移脚本
│   └── package.json                  # 后端依赖
├── v-poker-uni-app/                  # 前端源码（uni-app，H5 + APP）
│   ├── pages/                        # 页面
│   │   ├── login/                    # 登录
│   │   ├── register/                 # 注册
│   │   ├── lobby/                    # 游戏大厅
│   │   ├── join/                     # 加入房间
│   │   ├── room/                     # 游戏房间（Canvas渲染，5款游戏）
│   │   ├── workbench/                # 代理工作台
│   │   ├── customer-service/         # 客服工作台
│   │   ├── promotion/                # 推广中心（总代理）
│   │   ├── admin/                    # 管理后台
│   │   ├── economy/                  # 经济配置管理
│   │   ├── profile/                  # 个人中心
│   │   └── settings/                 # 设置
│   ├── components/                   # 组件（ui/lobby/seat/chips/actions/settlement/game/admin/poker）
│   ├── api/                          # API 封装（11个模块）
│   ├── socket/                       # Socket.io 客户端封装
│   ├── store/                        # 状态管理
│   ├── static/                       # 静态资源（图片/音频/字体）
│   ├── themes/                       # 主题
│   ├── utils/                        # 工具函数
│   ├── manifest.json                 # APP 打包配置
│   ├── pages.json                    # 页面路由配置
│   └── package.json                  # 前端依赖
├── scripts/                          # 部署/运维脚本
├── templates/                        # 模板文件（manifest-app.json）
├── .env.example                      # 环境变量示例
├── ecosystem.config.js               # PM2 进程配置（仅后端API）
└── README.md                         # 本文件
```

---

## 架构设计：骨架 + 游戏插件模式

平台采用**"骨架 + 可插拔游戏引擎"**架构：平台骨架负责房间生命周期、实时通信、经济结算、座位布局、聊天、权限等通用能力；每款游戏是一个独立引擎模块，通过统一的 `GameEngine` 接口接入骨架。

### 后端游戏封装结构

每款游戏在 `api-server/src/lib/games/` 下有独立目录，结构一致：

```
api-server/src/lib/games/
├── common/              # 共享：GameEngine 接口、牌库、工具
├── texas/               # 德州扑克（engine.ts / cards.ts / rules.ts）
├── jinhua/              # 炸金花
├── sangong/             # 三公
├── niuniu/              # 抢庄斗牛
├── tbnn/                # 通比牛牛
└── index.ts             # 统一导出
```

**GameEngine 接口**定义三个必须实现的方法：

| 方法 | 职责 |
|------|------|
| `createHand(players, level, roundNo, dealer, fixedAnte, opts)` | 创建一局牌 |
| `optionsFor(state, userId)` | 返回当前玩家可执行的操作列表 |
| `applyAction(state, userId, action, amount)` | 执行操作并修改状态 |

### 平台骨架模块

| 骨架模块 | 路径 | 职责 |
|----------|------|------|
| 房间生命周期 | `lib/rooms.ts`, `lib/roomState.ts` | 创建/加入/离开/准备/开始/结束 |
| 房间操作锁 | `lib/roomLock.ts` | 防止同一房间并发操作 |
| WebSocket 通信 | `socket/roomSocket.ts` | 实时状态同步、广播、聊天 |
| 多级代理返佣 | `lib/agentHierarchy.ts` | 层级追溯 + 抽水分配计算 |
| 经济结算 | `lib/economy.ts`, `lib/settle.ts` | 抽水计算、房间结算 |
| 超时检测 | `services/timeoutChecker.ts` | 玩家30秒无操作自动处理 |
| 房间回收 | `services/roomRecycler.ts` | 回收空闲/异常房间 |
| 鉴权中间件 | `middleware/auth.ts`, `lib/auth.ts` | JWT 验证、角色权限 |
| 幂等性 | `middleware/idempotency.ts` | 防重复提交 |

### Socket 通信模式：信号驱动 + REST 拉取

服务端不直接推送完整游戏状态，而是发送轻量 `state_changed` 信号，各客户端收到后通过 REST 拉取自己视角的完整状态，避免不同玩家视角的牌可见性问题。

### 添加新游戏

新增一款游戏需要：
- **后端**：新建3文件（engine/cards/rules）+ 修改3文件（index导出/ENGINES映射/GameType类型）+ 数据库2处配置（game_economy_config + room_template_config）
- **前端**：在 room.vue Canvas 渲染层添加游戏特定绘制逻辑 + 结算弹窗适配

---

## 数据库 Schema

核心表：

| 表名 | 用途 |
|------|------|
| `users` | 用户表（账号、角色、筹码、钱柜、邀请码、开房冻结） |
| `rooms` | 房间表（游戏类型、级别、状态、房号） |
| `room_players` | 房间玩家关联（座位、筹码、准备状态、挂机） |
| `hand_states` | 牌局状态（JSONB 存储完整游戏状态） |
| `game_rounds` | 游戏回合记录 |
| `room_messages` | 房间消息日志 |
| `chip_transactions` | 筹码流水（上下分/抽水返佣/客服调整） |
| `game_economy_config` | 游戏经济配置（抽水比例等） |
| `room_template_config` | 房间模板配置（准入约束，每游戏3套） |
| `game_economy_history` | 配置变更历史（审计追溯） |
| `room_history` | 房间历史战绩（append-only） |
| `room_invite_tokens` | 房间一次性邀请凭据 |
| `event_logs` | Socket 事件审计（append-only） |
| `audit_logs` | 操作审计日志 |
| `devices` | 登录设备管理 |
| `user_permissions` | 角色功能开关 |
| `cs_conversations` | 客服会话 |
| `cs_messages` | 客服消息 |
| `config_history` | 系统配置历史 |
| `config_drafts` | 系统配置草稿 |
| `distribution_records` | 房间分配明细 |
| `app_versions` | APP 版本管理（WGT 热更新） |
| `login_logs` | 登录日志 |
| `system_config` | 系统配置 |

> V3 已移除信用分相关业务，`credit_transactions` 和 `deduction_records` 表保留兼容历史数据，不再写入新记录。

---

## 核心功能

### 游戏功能
- 五款独立游戏引擎，服务端权威计算
- 实时 WebSocket 状态同步（信号驱动模式）
- 超时自动行动（30秒无操作自动执行默认动作）
- 25局自动结算进入"待续开"状态，代理确认后续开
- 通比牛牛自动亮牌挂机模式
- 对局结算时保存配置快照（历史对局不跟随配置修改变化）

### 经济系统（V3）
- **单一货币**：全系统只用筹码，无信用分房费、无返佣提现
- **多级返佣**：抽水按代理层级直接分配到筹码账户
- **内存缓存**：服务启动加载经济配置到内存，修改后主动刷新
- **账目守恒**：减法倒挤计算原则，确保分配之和=抽水总额

### 多角色工作台
- 代理工作台：房间管理、玩家上下分、收益统计
- 总代理推广中心：下线管理、业绩排行、返佣统计
- 客服工作台：筹码调整、操作流水对账（仅代理/总代理）
- 管理工作台：用户管理、房间管理、经济配置、运营报表、系统维护

---

## 开发指南

### 环境要求
- Node.js >= 18
- PostgreSQL >= 14
- PM2（生产部署）
- HBuilderX（APP 打包）

### 后端启动

```bash
cd api-server
cp .env.example .env
# 编辑 .env：填写 DATABASE_URL、SESSION_SECRET、PORT、CORS_ORIGIN
npm install
npm run build
npm start              # 生产模式：http://localhost:3001
npm run dev            # 开发模式：tsx watch 热重载
npm test               # 运行单元测试
```

### 前端启动（uni-app）

```bash
cd v-poker-uni-app
# 使用 HBuilderX 打开项目
# 运行 → 运行到浏览器 → Chrome（H5开发）
# 发行 → 网站-PC Web或手机H5（H5构建）
# 发行 → 原生App-云打包（APP打包）
```

前端 API 地址配置：`v-poker-uni-app/api/config.js` 中的 `BASE_URL`

### 数据库迁移

```bash
cd api-server
psql "$DATABASE_URL" -f migrations/001_init.sql
# 按顺序执行 migrations/ 目录下的所有 .sql 文件
```

### PM2 部署

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs v-poker-api
pm2 restart all
```

---

## 生产部署

### 环境变量

```bash
# api-server/.env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=<32位随机字符串>
PORT=3001
CORS_ORIGIN=https://yourdomain.com,https://h5.yourdomain.com
```

### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # H5 静态资源（uni-app 编译产物）
    root /var/www/v-poker-h5;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 安全说明

- 密码使用 bcrypt 哈希存储
- 会话 Token 使用 JWT，前端存储于 localStorage / uni.setStorageSync
- 所有 API 请求经过鉴权中间件验证
- 角色权限严格隔离，禁止越权操作
- 服务端权威原则，所有核心算法在后端实现
- 客服操作强制备注，操作日志永久保存不可删除
- 敏感操作二次确认弹窗
- 幂等性中间件防止重复提交
- `.env` 文件已加入 `.gitignore`，禁止提交密钥/证书

---

## License

MIT

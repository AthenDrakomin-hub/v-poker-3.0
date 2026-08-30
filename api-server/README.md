# V-POKER API Server

独立 Express API 服务，为 V-POKER 前端静态站点提供后端接口。

## 快速开始

```bash
cd api-server
cp .env.example .env   # 编辑数据库连接和密钥
npm install
npm run dev            # 开发模式（tsx 热重载）
```

生产环境：

```bash
npm run build
npm start
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `SESSION_SECRET` | 是 | 会话签名密钥 |
| `PORT` | 否 | 服务端口，默认 3001 |
| `BCRYPT_ROUNDS` | 否 | 密码哈希轮数，默认 10 |
| `CORS_ORIGIN` | 否 | 允许的前端域名，逗号分隔 |

## 系统架构

### 目录结构

```
api-server/
├── src/
│   ├── index.ts                 # 入口：Express + Socket.io 启动
│   ├── db/
│   │   ├── index.ts             # Drizzle ORM 连接
│   │   └── schema.ts            # 12张数据表定义
│   ├── routes/
│   │   ├── auth.routes.ts       # 认证（登录/注册/登出）
│   │   ├── rooms.routes.ts      # 房间与对局
│   │   ├── agent.routes.ts      # 代理功能
│   │   ├── admin.routes.ts      # 管理后台
│   │   ├── games.routes.ts      # 游戏规则查询
│   │   ├── profile.routes.ts    # 个人资料
│   │   ├── assets.routes.ts     # 素材清单/下载
│   │   ├── misc.routes.ts       # 健康检查/历史清理/种子数据
│   │   └── app.routes.ts        # APP版本检测/错误上报
│   ├── socket/
│   │   └── roomSocket.ts        # WebSocket房间管理
│   └── lib/
│       ├── auth.ts              # 用户认证、令牌签名
│       ├── audit.ts             # 操作审计日志
│       ├── config.ts            # 全局配置读取（DB system_config 表）
│       ├── settle.ts            # 牌局结算逻辑（抽水/返佣/扣款）
│       ├── hand.ts              # 手牌状态封装（类型导出）
│       ├── rooms.ts             # 房间级别配置
│       ├── rateLimiter.ts       # 限流中间件
│       ├── secureRandom.ts      # 安全随机数
│       ├── compat.ts            # 数据库兼容迁移
│       ├── ensureSeed.ts        # 初始种子账号
│       ├── assets.ts            # 素材文件清单
│       └── games/               # 游戏引擎（5游戏独立封装）
│           ├── common/          # 共享类型、工具函数
│           ├── texas/           # 德州扑克
│           ├── jinhua/          # 炸金花
│           ├── niuniu/          # 抢庄牛牛
│           ├── tbnn/            # 通比牛牛
│           └── sangong/         # 三公
├── migrations/                  # 数据库迁移脚本（由 Drizzle Kit 管理）
├── src/__tests__/               # 单元测试（vitest）
│   ├── texas.test.ts
│   ├── jinhua.test.ts
│   ├── niuniu.test.ts
│   ├── tbnn.test.ts
│   └── sangong.test.ts
└── dist/                        # 编译输出（不提交）
```

### 游戏引擎（5游戏独立封装）

所有游戏引擎独立封装于 `src/lib/games/`，统一实现 `GameEngine` 接口：

```
src/lib/games/
├── common/           # 共享类型和工具
│   ├── types.ts      # GameType, Phase, GameError, ActionResult, ActionEntry
│   ├── cards.ts      # Card类型、freshDeck、shuffle、cardLabel
│   └── utils.ts      # publicState、logAction、finalize、baseHandState
├── texas/            # 德州扑克（89测试用例）
│   ├── engine.ts     # 引擎逻辑
│   ├── cards.ts      # 牌型评分
│   └── rules.ts      # 游戏规则配置
├── jinhua/           # 炸金花（44测试用例）
├── niuniu/           # 抢庄牛牛（39测试用例）
├── tbnn/             # 通比牛牛（16测试用例）
└── sangong/          # 三公（48测试用例）
```

总计：21个测试用例 ✅ 全部通过


---

## 新增游戏开发指南（必看）

后续新增游戏时，必须按以下清单提供所有内容，缺一不可。

### 一、后端必须提供

#### 1. 游戏引擎三件套（`src/lib/games/<gameType>/`）

| 文件 | 必须实现 | 说明 |
|------|----------|------|
| `engine.ts` | `GameEngine` 接口 | 必须实现 3 个方法：`createHand()` / `optionsFor()` / `applyAction()` |
| `cards.ts` | 牌型评分函数 | 如 `xxxScore(cards): { score, name, mult? }` |
| `rules.ts` | 游戏规则常量 | 最大玩家数、牌数、下注规则等 |

**GameEngine 接口签名（必须严格实现）：**
```typescript
interface GameEngine {
  createHand(
    players: { userId: number; account: string; points: number }[],
    level: string,           // junior / senior / top
    roundNo: number,
    dealer: number,
    fixedAnte?: number,
    opts?: { chips?: number[]; cap?: number; baseBet?: number }
  ): HandState;

  optionsFor(st: HandState, userId: number): ActionOption[];

  applyAction(
    st: HandState,
    userId: number,
    action: string,
    amount?: number
  ): ActionResult;  // { ok: boolean, error?: GameError }
}
```

#### 2. 注册游戏类型（2 处必须修改）

**文件 1：`src/lib/games/common/types.ts`**
```typescript
// GameType 联合类型新增
export type GameType = "texas" | "jinhua" | "sangong" | "niuniu" | "tbnn" | "你的gameType";

// GAME_META 新增元信息
export const GAME_META: Record<GameType, { name: string; mode: string; emoji: string }> = {
  // ... 现有 ...
  你的gameType: { name: "游戏显示名", mode: "模式说明", emoji: "🎮" },
};
```

**文件 2：`src/lib/games/index.ts`**
```typescript
export { 你的gameTypeEngine } from "./你的gameType/engine";
```

#### 3. 房间引擎分发（`src/lib/hand.ts` 或 `rooms.routes.ts`）

在创建牌局时，根据 `gameType` 分发到对应引擎：
```typescript
import { 你的gameTypeEngine } from "./games";

const engines: Record<GameType, GameEngine> = {
  texas: texasEngine,
  // ... 现有 ...
  你的gameType: 你的gameTypeEngine,
};
```

#### 4. 经济配置（数据库 `econ_config` 表）

新增游戏必须在 `econ_config` 表中插入对应配置：
- `game_type`: 你的 gameType
- `chip_rake_rate`: 抽水比例
- `rake_base_type`: 抽水基数（pot / flow）
- 房间模板（`room_templates` 表）：每个级别（junior/senior/top）至少 1 个模板

可通过管理后台 API 配置，或执行 SQL 插入。

#### 5. 单元测试（`src/__tests__/<gameType>.test.ts`）

必须提供至少覆盖以下场景的测试：
- 发牌正确性
- 牌型评分正确性（至少 10 种牌型）
- 下注/跟注/加注/弃牌
- 结算正确性（含抽水计算）
- 边界情况（all-in、不足筹码、多人平局）

运行测试：`npm test -- <gameType>`

### 二、前端必须提供

| 项目 | 位置 | 说明 |
|------|------|------|
| 主题配置 | `themes/themeConfig.js` | 新增主题 ID、配色、粒子效果、开牌动画 |
| 游戏场景图 | CDN `static/images/game-scenes/game-<gameType>-v2.jpg` | 大厅游戏卡片背景图 |
| 音效包 | CDN `static/sounds/<theme>/` | 发牌/开牌/筹码等音效 |
| 房间页适配 | `pages/room/room.vue` | 操作按钮渲染（后端 optionsFor 驱动） |
| 大厅游戏卡片 | `pages/lobby/lobby.vue` | 游戏入口卡片 |
| CDN 版本号 | `utils/cdn.js` | 新增资源后递增 version |

### 三、数据库必须提供

| 表 | 操作 | 说明 |
|----|------|------|
| `econ_config` | INSERT | 游戏经济配置（抽水比例/基数/模板） |
| `room_templates` | INSERT | 房间模板（每级别至少 1 个） |
| `games` 表（如有） | INSERT | 游戏元信息 |

### 四、验证清单（新增游戏后必须逐项验证）

- [ ] 后端 `npm run build` 编译通过
- [ ] 后端 `npm test` 全部测试通过
- [ ] `GET /api/games/rules/<gameType>` 返回正确规则
- [ ] 创建房间 → 加入房间 → 开始牌局 → 执行操作 → 结算 全流程正常
- [ ] 抽水计算正确（与 econ_config 配置一致）
- [ ] 前端游戏卡片显示正常
- [ ] 房间页操作按钮正确渲染
- [ ] 开牌动画/音效正常
- [ ] 结算面板显示正确
- [ ] CDN 资源全部 200（图片/音效/字体）

### 经济模型（V3：单一货币）

所有费率从数据库 `system_config` 表动态读取，管理员可在后台修改：

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| `platform_rake_rate` | 3 | 游戏内抽水比例（%） |
| `agent_rebate_rate` | 1 | 开房代理返佣比例（%） |
| `top_agent_rebate_rate` | 1 | 总代理返佣比例（%） |

> V3 已移除信用分房费和返佣提现。房间结束时抽水按代理层级直接分配到各代理 `points`，无需手动操作。

### 数据库表结构（12张表）

| 表名 | 用途 |
|------|------|
| `users` | 用户（角色/筹码/邀请码/开房冻结） |
| `rooms` | 房间（场次/进度/流水/抽水） |
| `room_players` | 座位（筹码/准备状态/观众标记） |
| `game_rounds` | 牌局记录（结果JSON/抽水） |
| `hand_states` | 手牌状态（实时JSON持久化） |
| `chip_transactions` | 筹码流水（上下分/带回出/返佣） |
| `credit_transactions` | 信用分流水（保留兼容，V3不再写入） |
| `deduction_records` | 扣款记录（保留兼容，V3 amount=0） |
| `room_messages` | 聊天消息 |
| `devices` | 设备管理 |
| `system_config` | 系统全局配置 |
| `econ_config` | 经济/模板配置（V2两层体系） |

## API 路由

### 认证
- `POST /api/auth/register` - 注册（需邀请码）
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 当前用户

### 房间与对局
- `POST /api/rooms/create` - 创建房间
- `POST /api/rooms/join` - 加入房间
- `GET /api/rooms/mine` - 我的房间列表
- `GET /api/rooms/joined` - 已加入房间
- `GET /api/rooms/:id` - 房间详情
- `POST /api/rooms/:id/hand` - 开始新牌局
- `PUT /api/rooms/:id/hand` - 执行操作
- `POST /api/rooms/:id/ready` - 准备
- `DELETE /api/rooms/:id/ready` - 离开房间
- `POST /api/rooms/:id/spectate` - 旁观模式
- `POST /api/rooms/:id/gift` - 上分
- `POST /api/rooms/:id/kick` - 踢出玩家
- `POST /api/rooms/:id/early-settle` - 提前结算
- `POST /api/rooms/:id/continue` - 续开房间
- `GET/POST /api/rooms/:id/chat` - 聊天

### 代理功能
- `GET /api/agent/players` - 名下玩家列表
- `POST /api/agent/players` - 上下分
- `GET /api/agent/promotion` - 推广数据（总代理）
- `POST /api/agent/promote` - 提升玩家为代理

### 管理后台（需admin/customer_service权限）
- `GET /api/admin/users` - 用户列表
- `POST /api/admin/users` - 创建用户
- `PATCH /api/admin/users` - 编辑用户
- `DELETE /api/admin/users` - 删除用户
- `POST /api/admin/adjust-credit` - 调整信用分
- `POST /api/admin/adjust-points` - 调整筹码
- `POST /api/admin/set-role` - 修改角色
- `GET /api/admin/ledger` - 对账流水
- `GET /api/admin/stats` - 运营统计
- `GET /api/admin/config` - 获取系统配置
- `PUT /api/admin/config` - 修改系统配置
- `GET /api/admin/rooms` - 房间列表
- `POST /api/admin/rooms/:id/force-end` - 强制结束房间

### 个人资料
- `GET /api/profile` - 个人详情（战绩/流水/设备）
- `PATCH /api/profile` - 修改资料
- `POST /api/profile/password` - 修改密码
- `POST /api/profile/force-change-password` - 首次登录强制改密
- `POST /api/profile/devices` - 注册设备
- `DELETE /api/profile/devices` - 删除设备

### 游戏
- `GET /api/games/rules` - 获取所有游戏规则
- `GET /api/games/rules/:gameType` - 获取指定游戏规则

### 其他
- `GET /api/health` - 健康检查
- `GET /api/app/download` - APP下载链接
- `POST /api/app/error` - APP错误上报
- `GET /api/app/version` - APP版本检测（热更新）
- `GET /api/econ/econ-rates` - 经济配置费率
- `GET /api/assets` - 素材清单（支持 `?format=txt|md`）
- `GET /api/assets/download` - 下载素材
- `GET /api/history/cleanup` - 历史数据清理预览（admin）
- `POST /api/history/cleanup` - 执行历史数据清理
- `GET/POST /api/seed` - 种子账号（测试用）

## 五角色权限体系

| 角色 | 标识 | 信用分 | 核心权限 |
|------|------|--------|----------|
| 玩家 | `player` | ❌ 不需要 | 加入房间、对局、聊天 |
| 代理 | `agent` | ✅ | 开房、上下分、查看扣费 |
| 总代理 | `top_agent` | ✅ | 推广中心、下线管理、返佣 |
| 客服 | `customer_service` | ❌ | 调整信用分、对账（只读） |
| 管理员 | `admin` | ∞ 无限 | 全部权限 + 系统配置 |

## 经济模型（V3：单一筹码）

全系统只用筹码（points）一种货币。房间抽水按代理层级直接分配到各代理筹码账户，不再使用信用分房费和返佣提现。

### 平台收入与支出

**每局抽水**：从赢家盈利中扣除 `platform_rake_rate`%（默认3%）

**房间结束时结算**（`settleRoom` → `calcRoomSettlement`）：
- 按代理层级链分配总抽水：开房代理 `agent_rebate_rate`% + 一级代理（若有）`level1_rebate_rate`% + 总代理（若有）`top_agent_rebate_rate`% + 平台剩余
- 各层级按比例直接写入 `chip_transactions`（type=`room_rake`），加 `points`
- `credit_transactions` 和 `deduction_records` 保留兼容，V3 不再写入新记录

### 筹码流转

```
代理 ──上分/下分──▶ 玩家钱包(users.points)
玩家 ──进房带入──▶ 房间座位(room_players.points)
代理 ──房内上分(gift)──▶ 玩家座位
玩家 ──离开/25局结束──▶ 退回玩家钱包
房间结束时 ──抽水按层级──▶ 各级代理 points（直接到账）
```

### 房间级别门槛

| 级别 | 标识 | 筹码门槛 | 初始筹码范围 | 座位数 |
|------|------|---------|------------|--------|
| 初级 | `junior` | ≥ 100 | 100-1,000 | 6 |
| 高级 | `senior` | ≥ 1,000 | 500-5,000 | 6 |
| 顶级 | `top` | ≥ 5,000 | 5,000-50,000 | 6 |

## 游戏类型

| gameType | 名称 | 模式 | 特色 |
|----------|------|------|------|
| `texas` | 德州扑克 | 正常模式 | 2张手牌+5张公共牌，4轮下注 |
| `jinhua` | 炸金花 | 正常发牌 | 3张手牌比大小 |
| `niuniu` | 抢庄牛牛 | 抢庄模式 | 庄家制，有庄闲比牌 |
| `tbnn` | 通比牛牛 | 通比模式 | 固定底注，通比结算 |
| `sangong` | 三公 | 抢庄模式 | 3张手牌，最大为三公 |

## WebSocket 实时通信

前端通过 Socket.io 连接实时接收状态更新：

```
连接地址：ws://<host>/socket.io/
命名空间：/room/:roomId
```

**服务端推送事件**：
- `state_changed` — 牌局状态变更（前端收到后重新拉取）
- `room_update` — 房间概览更新
- `hand_update` — 手牌详细更新
- `chat_message` — 聊天消息

**客户端事件**：
- `join_room` — 加入房间
- `leave_room` — 离开房间

## 技术栈

- Express 4 + TypeScript
- Socket.io 4（WebSocket实时通信）
- Drizzle ORM + PostgreSQL
- bcrypt 密码哈希
- HMAC-SHA256 令牌签名
- Vitest 单元测试

## 服务状态

当前生产环境：
- `v-poker-2`: 前端静态服务 (端口3000) ✅
- `v-poker-api`: 后端API服务 (端口3001) ✅
- API健康: `{"ok":true}` ✅
- 测试: 21/21 passed ✅

## 与前端配合

前端构建时设置 `NEXT_PUBLIC_API_URL` 指向本服务地址：

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com npm run build
```

前端静态文件可部署到任意 CDN / 静态托管，API 请求会自动跨域到本服务。

---

## 部署指南

### 生产环境信息

| 项目 | 值 |
|------|-----|
| 服务器路径 | `/opt/texas-platform/api-server` |
| PM2 进程名 | `v-poker-api` |
| 服务端口 | `3001` |
| 域名 | `goodspage.cn` |
| API 地址 | `https://goodspage.cn/api/` |
| WebSocket | `wss://goodspage.cn/socket.io/` |
| 数据库 | PostgreSQL `v_poker_3` |

### 标准部署流程（代码更新后）

```bash
# 1. 登录服务器
ssh user@your-server

# 2. 进入项目目录
cd /opt/texas-platform/api-server

# 3. 拉取最新代码
git pull origin main

# 4. 安装依赖（如果 package.json 有变更）
npm ci

# 5. 构建 TypeScript
npm run build

# 6. 数据库迁移（如果有新迁移）
npm run db:migrate

# 7. 重启服务
pm2 reload v-poker-api

# 8. 验证
curl https://goodspage.cn/api/health
pm2 status
pm2 logs v-poker-api --lines 50
```

### 一键部署脚本

项目根目录提供 `deploy-production.sh`，可直接执行：
```bash
bash deploy-production.sh
```

### 回滚

```bash
cd /opt/texas-platform/api-server
git log --oneline -5          # 查看提交历史
git reset --hard <commit-hash> # 回滚到指定版本
npm run build
pm2 reload v-poker-api
```

### 常用运维命令

| 操作 | 命令 |
|------|------|
| 查看服务状态 | `pm2 status` |
| 查看实时日志 | `pm2 logs v-poker-api` |
| 查看最近100行日志 | `pm2 logs v-poker-api --lines 100` |
| 重启服务 | `pm2 reload v-poker-api` |
| 停止服务 | `pm2 stop v-poker-api` |
| 监控资源 | `pm2 monit` |
| 健康检查 | `curl https://goodspage.cn/api/health` |

### 注意事项

1. **`.env` 不提交 Git**：生产环境 `.env` 由服务器维护，部署时不会覆盖
2. **数据库迁移**：新增迁移后必须执行 `npm run db:migrate`，否则新表/字段不存在
3. **PM2 配置**：`ecosystem.config.js` 中 `cwd` 必须指向 `/opt/texas-platform/api-server`
4. **Nginx 反向代理**：`/api/` 和 `/socket.io/` 均代理到 `127.0.0.1:3001`
5. **构建产物**：`dist/` 目录不提交 Git，部署时必须执行 `npm run build`

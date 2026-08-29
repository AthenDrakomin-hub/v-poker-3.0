# V-POKER 后端 API 完整文档

> 基础路径：`/api` | 认证方式：Session Cookie（登录后服务器写入）

---

## 一、认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前用户信息 |

### 登录请求体
```json
{
  "account": "用户名",
  "password": "密码"
}
```

响应字段：
```json
{
  "user": { "id": 1, "account": "xxx", "role": "player", "mustChangePassword": false },
  "token": "HMAC签名令牌",
  "mustChangePassword": false
}
```

> 支持通过 `x-device-id` 请求头关联设备（最多10台）

### 注册请求体
```json
{
  "account": "用户名",
  "password": "密码",
  "confirmPassword": "确认密码",
  "securityCode": "6位安全码",
  "inviteCode": "邀请码",
  "nickname": "昵称"
}
```

> `inviteCode` 可选，不填时默认上级为管理员

---

## 二、房间与对局接口

### 房间管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/rooms/create` | agent/top_agent/admin | 创建房间 |
| POST | `/api/rooms/join` | 已登录 | 加入房间 |
| GET | `/api/rooms/mine` | 已登录 | 我开/代理的房间列表 |
| GET | `/api/rooms/joined` | 已登录 | 已加入的房间列表 |
| GET | `/api/rooms/:id` | 已登录 | 房间详情（含手牌状态） |

#### 创建房间请求体
```json
{
  "gameType": "texas|jinhua|niuniu|tbnn|sangong",
  "level": "junior|senior|top",
  "initialPoints": 1000,
  "password": "房间密码",
  "fixedAnte": 10
}
```

#### 加入房间请求体
```json
{
  "roomNo": "房间号",
  "password": "密码",
  "spectate": false
}
```

> `spectate: true` 加入为观众；`false` 加入为选手（带筹码买入，上限等于房间初始筹码）

---

### 对局操作

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/rooms/:id/hand` | 玩家 | 开始新一局 |
| GET | `/api/rooms/:id/hand` | 任意 | 查询当前手牌状态 |
| PUT | `/api/rooms/:id/hand` | 玩家 | 执行操作 |
| POST | `/api/rooms/:id/ready` | 玩家 | 准备/取消准备 |
| DELETE | `/api/rooms/:id/ready` | 玩家 | 离开房间（带出筹码） |

#### 执行操作请求体
```json
{
  "action": "fold|check|call|raise|all_in",
  "amount": 100
}
```

| action | 说明 | amount |
|--------|------|--------|
| `fold` | 弃牌 | 不需要 |
| `check` | 过牌 | 不需要 |
| `call` | 跟注 | 不需要 |
| `raise` | 加注 | 必须 |
| `all_in` | 全押 | 不需要 |

---

### 房间辅助操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/rooms/:id/spectate` | 玩家切换为观战（退回筹码） |
| POST | `/api/rooms/:id/gift` | 房主给玩家上分 |
| POST | `/api/rooms/:id/kick` | 房主踢出玩家 |
| POST | `/api/rooms/:id/early-settle` | 提前结算房间 |
| POST | `/api/rooms/:id/continue` | 续开房间（25局后重置计数） |
| GET | `/api/rooms/:id/chat` | 获取聊天记录（支持 `?since=ID`） |
| POST | `/api/rooms/:id/chat` | 发送聊天消息 |

#### 上分请求体
```json
{ "targetUserId": 123, "amount": 500 }
```
> 只有房主代理可执行，目标玩家筹码上限为房间初始筹码

#### 踢人请求体
```json
{ "targetUserId": 123 }
```
> 游戏进行中被踢玩家自动弃牌，剩余筹码退回钱包

#### 提前结算请求体
```json
{}
```
> 退还进行中局牌的未分配筹码，按已完成局数扣除水费

#### 续开房间
> 25局结束后由房主调用，重置轮次计数，玩家无需重新进房

---

## 三、游戏规则接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/games/rules` | 获取全部5种游戏规则 |
| GET | `/api/games/rules/:gameType` | 获取指定游戏规则 |

### 返回结构
```json
{
  "gameType": "texas",
  "gameName": "德州扑克",
  "emoji": "♠️",
  "description": "...",
  "config": {
    "HOLE_CARDS": 2,
    "COMMUNITY_CARDS": 5,
    "FLOP_CARDS": 3,
    "TURN_CARDS": 1,
    "RIVER_CARDS": 1,
    "SMALL_BLIND": 1,
    "BIG_BLIND": 2,
    "ACTION_TIMEOUT": 30,
    "MAX_RAISES_PER_STREET": 4
  },
  "handTypes": [
    { "key": "ROYAL_FLUSH", "name": "皇家同花顺", "rank": 9, "multiplier": 1 },
    { "key": "STRAIGHT_FLUSH", "name": "同花顺", "rank": 8 },
    { "key": "FOUR_OF_A_KIND", "name": "四条", "rank": 7 },
    { "key": "FULL_HOUSE", "name": "葫芦", "rank": 6 },
    { "key": "FLUSH", "name": "同花", "rank": 5 },
    { "key": "STRAIGHT", "name": "顺子", "rank": 4 },
    { "key": "THREE_OF_A_KIND", "name": "三条", "rank": 3 },
    { "key": "TWO_PAIR", "name": "两对", "rank": 2 },
    { "key": "ONE_PAIR", "name": "一对", "rank": 1 },
    { "key": "HIGH_CARD", "name": "高牌", "rank": 0 }
  ],
  "flow": [
    { "step": 1, "phase": "盲注", "description": "..." },
    { "step": 2, "phase": "翻牌前（Pre-flop）", "description": "..." },
    { "step": 3, "phase": "翻牌（Flop）", "description": "..." },
    { "step": 4, "phase": "转牌（Turn）", "description": "..." },
    { "step": 5, "phase": "河牌（River）", "description": "..." },
    { "step": 6, "phase": "摊牌（Showdown）", "description": "..." },
    { "step": 7, "phase": "分配奖池", "description": "..." }
  ],
  "actions": [
    { "action": "fold", "name": "弃牌", "availableWhenBlind": true },
    { "action": "check", "name": "过牌", "availableWhenBlind": true },
    { "action": "call", "name": "跟注", "availableWhenBlind": true },
    { "action": "raise", "name": "加注", "availableWhenBlind": true },
    { "action": "all_in", "name": "全押", "availableWhenBlind": true }
  ],
  "specialRules": []
}
```

---

## 四、代理功能接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/agent/players` | agent+ | 名下玩家列表 |
| POST | `/api/agent/players` | agent+ | 上下分 |
| GET | `/api/agent/promotion` | top_agent | 推广数据 |
| POST | `/api/agent/promote` | top_agent/admin | 提升玩家为代理 |

### 上下分请求体
```json
{ "userId": 123, "amount": 500, "note": "备注" }
```
- `amount > 0`：上分（代理筹码 → 玩家筹码）
- `amount < 0`：下分（玩家筹码 → 代理筹码）
- 单次上限：100万

### 推广数据响应（top_agent）
```json
{
  "isTopAgent": true,
  "inviteCode": "XXX",
  "credit": 5000,
  "commission": 100,
  "topAgentCommissionRate": 1,
  "downlines": [{ "id": 1, "account": "xxx", "role": "agent", "credit": 100, "totalFlow": 50000, "commission": 500 }],
  "daily": [{ "date": "2024-01-01", "flow": 50000, "commission": 500 }],
  "todayFlow": 5000,
  "todayCommission": 50,
  "totalFlow": 500000,
  "totalCommission": 5000
}
```

---

## 五、管理后台接口（需 admin/customer_service）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表（支持 `?q=搜索&role=角色`） |
| POST | `/api/admin/users` | 创建用户 |
| PATCH | `/api/admin/users` | 编辑用户 |
| DELETE | `/api/admin/users?id=123` | 删除用户 |
| POST | `/api/admin/adjust-points` | 调整筹码 |
| POST | `/api/admin/set-role` | 修改角色 |
| GET | `/api/admin/ledger` | 对账流水 |
| GET | `/api/admin/stats` | 运营统计 |
| GET | `/api/admin/config` | 全局配置 |
| PUT | `/api/admin/config` | 修改全局配置 |
| GET | `/api/admin/rooms` | 房间列表（支持 `?status=playing`） |
| POST | `/api/admin/rooms/:id/force-end` | 强制结束房间 |

### 创建用户请求体
```json
{
  "account": "用户名",
  "password": "密码",
  "role": "player|agent|top_agent|customer_service",
  "securityCode": "0000",
  "credit": 100,
  "invitedByCode": "上级邀请码"
}
```
> 仅管理员可创建用户

### 编辑用户请求体
```json
{
  "id": 123,
  "account": "新用户名",
  "password": "新密码",
  "role": "agent",
  "securityCode": "1234",
  "points": 1000,
  "openRoomBlocked": false,
  "invitedByCode": "上级邀请码"
}
```

### 调整信用分请求体
```json
{ "userId": 123, "amount": 100, "note": "备注" }
```
> 增加信用分时自动补扣失败的扣款记录

### 调整筹码请求体
```json
{ "userId": 123, "amount": 500, "note": "备注" }
```
> 单次上限：100万，不能调整管理员筹码

### 全局配置项
| 配置键 | 类型 | 范围 | 说明 |
|--------|------|------|------|
| `platform_rake_rate` | number | 0-100 | 平台抽水比例（%） |
| `agent_deduct_rate` | number | 0-100 | 代理扣费率（%） |
| `agent_commission_rate` | number | 0-100 | 代理返佣比例（%） |
| `top_agent_commission_rate` | number | 0-100 | 总代理返佣比例（%） |
| `app_version` | string | - | APP版本号 |
| `app_wgt_url` | string | - | APP热更新包地址 |
| `app_wgt_force` | string | "0"|"1" | 是否强制更新 |
| `app_changelog` | string | - | 更新日志 |
| `app_download_url` | string | - | APP下载链接 |

---

## 六、个人资料接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/profile` | 个人详情（战绩/流水/设备） |
| PATCH | `/api/profile` | 修改昵称/头像/签名/设置 |
| POST | `/api/profile/password` | 修改密码 |
| POST | `/api/profile/force-change-password` | 首次登录强制改密 |
| POST | `/api/profile/devices` | 注册/更新设备 |
| DELETE | `/api/profile/devices?id=123` | 删除设备 |

### 修改资料请求体
```json
{
  "nickname": "新昵称",
  "avatar": "2",
  "signature": "个性签名",
  "settings": { "sound": true, "music": true, "vibrate": true }
}
```

### 修改密码请求体
```json
{
  "oldPassword": "旧密码",
  "newPassword": "新密码",
  "confirmPassword": "确认密码"
}
```

---

## 七、系统接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/app-download` | APP下载链接 |
| GET | `/api/assets` | 素材清单（支持 `?format=txt|md`） |
| GET | `/api/assets/download` | 下载素材文件 |
| GET | `/api/history/cleanup` | 历史数据清理预览（admin） |
| POST | `/api/history/cleanup` | 执行历史数据清理 |
| POST | `/api/app/error` | APP错误上报 |
| GET | `/api/seed` | 种子账号列表（测试用） |
| POST | `/api/seed` | 初始化种子账号（测试用） |

### 历史数据清理请求体
```json
{
  "messageDays": 3,
  "keepRounds": 25
}
```

---

## 八、游戏类型说明

| gameType | 名称 | 模式 | 特色 |
|----------|------|------|------|
| `texas` | 德州扑克 | 正常模式 | 2张手牌+5张公共牌，4轮下注 |
| `jinhua` | 炸金花 | 正常发牌 | 3张手牌比大小 |
| `niuniu` | 抢庄牛牛 | 抢庄模式 | 庄家制，有庄闲比牌 |
| `tbnn` | 通比牛牛 | 通比模式 | 固定底注，通比结算 |
| `sangong` | 三公 | 抢庄模式 | 3张手牌，最大为三公 |

---

## 九、数据模型说明

### HandState（手牌状态）
```typescript
interface HandState {
  gameType: GameType;       // texas|jinhua|niuniu|tbnn|sangong
  roundNo: number;          // 第几局
  phase: Phase;             // preflop|flop|turn|river|betting|showdown|...
  seats: Seat[];            // 玩家座位
  deck: Card[];             // 剩余牌堆
  community: Card[];        // 公共牌
  turn: number;             // 当前操作者座位索引
  dealer: number;           // 庄家座位索引
  pot: number;              // 奖池
  currentBet: number;       // 当前下注额
  minRaise: number;         // 最小加注额
  baseBet: number;          // 基础注
  chips: number[];          // 各玩家下注额
  cap: number;              // 加注上限
  bankerIdx: number | null; // 庄家索引
  log: string[];            // 操作日志
  actionLog: ActionEntry[]; // 结构化操作日志
  finished: boolean;        // 是否已结束
  result: HandResult | null;
  fixedAnte?: number;       // 通比牛牛固定底注
  lastActionTime: number;
  rakeRate?: number;        // 抽水比例
}

interface Seat {
  userId: number;
  account: string;
  cards: Card[];            // 私有手牌（仅本人可见）
  points: number;
  streetBet: number;        // 本轮下注
  totalBet: number;         // 本局累计下注
  folded: boolean;
  allin: boolean;
  acted: boolean;
  looked: boolean;          // 炸金花查看手牌
  diceRoll: number | null;
  autoPlay?: boolean;
  revealed?: boolean;       // 是否亮牌
  hasPrepared?: boolean;    // 三公：是否已准备
}
```

### Phase（游戏阶段）
```
preflop | flop | turn | river | betting | grab | grab_result
| waiting_start | blind_grab | dealt | showdown | settlement
```

---

## 十、五角色权限体系

| 角色 | 标识 | 信用分 | 核心权限 |
|------|------|--------|----------|
| 玩家 | `player` | ❌ 不需要 | 加入房间、对局、聊天 |
| 代理 | `agent` | ✅ | 开房、上下分、查看扣费 |
| 总代理 | `top_agent` | ✅ | 推广中心、下线管理、返佣 |
| 客服 | `customer_service` | ❌ | 调整信用分、对账（只读） |
| 管理员 | `admin` | ∞ 无限 | 全部权限 + 系统配置 |

---

## 十一、房间级别配置

| 级别 | 标识 | 信用分要求 | 初始筹码范围 | 座位数 |
|------|------|-----------|------------|--------|
| 初级 | `junior` | 100 | 100-1,000 | 6 |
| 高级 | `senior` | 500 | 1,000-10,000 | 6 |
| 顶级 | `top` | 2,000 | 10,000-100,000 | 6 |

---

## 十二、经济模型

### 每局抽水
从赢家盈利中扣除 3%（可在后台调整 `platform_rake_rate`）

### 房间结算时
- 代理信用分扣除：流水 × 2%（`agent_deduct_rate`，开房成本）
- 代理返佣：流水 × 1%（`agent_commission_rate`，从抽水支付）
- 总代理返佣：流水 × 1%（`top_agent_commission_rate`，从抽水支付）

### 筹码流转
```
代理 ──上分/下分──▶ 玩家钱包(users.points)
玩家 ──进房带入──▶ 房间座位(room_players.points)
代理 ──房内上分(gift)──▶ 玩家座位
玩家 ──离开/25局结束──▶ 退回玩家钱包
```

---

## 十三、WebSocket 实时通信

前端通过 Socket.io 连接实时接收状态更新：

```
连接地址：ws://<host>/socket.io/
命名空间：/room/:roomId
```

**服务器推送事件**：
- `stateChanged` — 手牌状态变更（含广播）
- `chat` — 新聊天消息
- `joined` / `left` — 玩家进出
- `gameStart` / `gameEnd` — 对局开始/结束

**客户端可发送事件**：
- `ready` — 准备/取消准备
- `action` — 执行游戏操作
- `chat` — 发送聊天消息

---

*文档生成时间：2026-08-20*
*基于代码版本：72690ad*

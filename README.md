# V-Poker 3.0 棋牌竞技平台

基于 WebSocket 实时通信的多人在线棋牌游戏平台，支持德州扑克、炸金花、抢庄三公、抢庄斗牛、通比牛牛五款游戏。采用前后端分离架构，前端使用 uni-app（Vue3）一套代码编译 H5 + Android/iOS APP。

> **架构铁律**：前端只负责渲染展示，所有核心业务计算（牌型判定、筹码结算、发牌逻辑、抽水计算）全部在后端 Express 实现，前端绝不做业务计算。

> **V3 经济模型**：全系统只用筹码（points）一种货币，房间抽水按多级代理层级直接分配，不再有信用分房费和返佣提现。

---

## 目录

- [技术栈](#技术栈)
- [支持游戏](#支持游戏)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [部署流程](#部署流程)
- [环境变量配置](#环境变量配置)
- [开发注意事项](#开发注意事项)
- [要点注意点](#要点注意点)
- [常用命令](#常用命令)
- [安全规范](#安全规范)

---

## 技术栈

| 层级 | 技术选型 | 版本 |
|------|---------|------|
| 前端框架 | uni-app（Vue3）+ 自定义 Canvas 渲染引擎 | Vue 3.x |
| 样式方案 | SCSS + 自定义 CSS 设计系统（玻璃拟态） | - |
| 状态管理 | 自定义 Store（uni.setStorageSync 持久化） | - |
| 后端框架 | Express + TypeScript | Express 4.x, TS 5.x |
| 数据库 | PostgreSQL + Drizzle ORM | PG 16, Drizzle 0.45 |
| 实时通信 | Socket.io (WebSocket) | 4.x |
| 进程管理 | PM2 | 7.x |
| APP 打包 | HBuilderX（云打包） | - |
| 反向代理 | Nginx | 1.24 |
| 测试框架 | Vitest | - |

---

## 支持游戏

| 游戏 | 标识 | 抽水基数 | 模式 | 操作超时 |
|------|------|---------|------|---------|
| 德州扑克 | `texas` | 赢家盈利总和（flow） | 正常模式 | 30秒 |
| 炸金花 | `jinhua` | 最终底池（pot） | 正常发牌 | 30秒 |
| 抢庄三公 | `sangong` | Σ下注×赔率（pot） | 抢庄模式 | 30秒 |
| 抢庄斗牛 | `niuniu` | Σ下注×赔率（pot） | 抢庄模式 | 30秒 |
| 通比牛牛 | `tbnn` | 底池（pot） | 通比模式（固定底注） | 30秒 |

---

## 项目结构

```
V-poker-2.0/
├── api-server/                    # 后端服务
│   ├── src/
│   │   ├── index.ts              # 入口文件
│   │   ├── db/                   # 数据库配置 & Schema
│   │   ├── lib/
│   │   │   └── games/            # 游戏引擎
│   │   │       ├── common/       # 公共工具（牌型、发牌）
│   │   │       ├── texas/        # 德州扑克引擎
│   │   │       ├── jinhua/       # 炸金花引擎
│   │   │       ├── niuniu/       # 抢庄牛牛引擎
│   │   │       ├── sangong/      # 三公引擎
│   │   │       └── tbnn/         # 通比牛牛引擎
│   │   ├── middleware/            # 中间件（鉴权、限流、日志）
│   │   ├── routes/                # API 路由
│   │   │   ├── auth.routes.ts    # 认证
│   │   │   ├── rooms.routes.ts   # 房间管理
│   │   │   ├── profile.routes.ts # 用户资料 & 游戏记录
│   │   │   ├── admin.routes.ts   # 管理员后台
│   │   │   ├── agent.routes.ts   # 代理后台
│   │   │   └── bot.routes.ts     # 机器人
│   │   ├── services/              # 业务服务
│   │   │   ├── botService.ts     # 机器人服务
│   │   │   └── timeoutChecker.ts # 超时自动行动
│   │   ├── socket/                # Socket.io 事件处理
│   │   └── __tests__/            # 单元测试
│   ├── migrations/                # 数据库迁移文件
│   ├── scripts/                   # 运维脚本
│   ├── dist/                      # 构建产物（tsc 输出）
│   ├── .env                       # 环境变量（不提交 Git）
│   ├── .env.example               # 环境变量示例
│   ├── package.json
│   ├── tsconfig.json
│   └── drizzle.config.ts
│
├── v-poker-uni-app/               # 前端应用（uni-app）
│   ├── pages/                     # 页面
│   │   ├── login/                 # 登录
│   │   ├── register/              # 注册
│   │   ├── lobby/                 # 大厅（房间列表）
│   │   ├── room/                  # 游戏房间（核心）
│   │   ├── profile/               # 个人中心
│   │   ├── economy/               # 经济系统（上下分）
│   │   ├── promotion/             # 代理推广
│   │   └── customer-service/      # 客服
│   ├── components/                # 组件
│   │   ├── room/                  # 房间组件
│   │   ├── seat/                  # 玩家座位
│   │   ├── chips/                 # 筹码显示
│   │   ├── actions/               # 操作按钮
│   │   ├── settlement/            # 结算面板
│   │   ├── ui/                    # 通用 UI
│   │   └── game/                  # 游戏相关（比牌面板、牌型提示）
│   ├── api/                       # API 请求封装
│   │   ├── config.js              # API 基础地址配置（重要！）
│   │   ├── request.js             # 请求封装
│   │   ├── auth.js
│   │   ├── rooms.js
│   │   └── profile.js
│   ├── socket/                    # Socket.io 封装
│   │   ├── index.js               # 全局 Socket
│   │   └── roomSocket.js          # 房间 Socket
│   ├── store/                     # 状态管理
│   ├── utils/                     # 工具函数
│   ├── themes/                    # 主题配置
│   ├── static/                    # 静态资源
│   │   ├── images/cards/          # 扑克牌 SVG
│   │   ├── avatars/               # 头像
│   │   ├── fonts/                 # 字体
│   │   ├── sounds/                # 音效（空目录，走 CDN）
│   │   └── voices/                # 语音（空目录，走 CDN）
│   ├── unpackage/                 # 打包产物（不提交 Git）
│   ├── manifest.json              # uni-app 配置（App 打包）
│   ├── pages.json                 # 页面路由配置
│   ├── App.vue                    # 根组件
│   ├── main.js                    # 入口
│   └── vue.config.js              # Vue 配置（开发代理）
│
├── deploy-full.sh                 # 一键部署脚本
├── DEPLOY-GUIDE.md                # 部署指南
├── ecosystem.config.js            # PM2 配置
├── .gitignore
└── README.md                      # 本文件
```

---

## 快速开始

### 后端开发

```bash
cd api-server

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入数据库连接和 SESSION_SECRET

# 3. 执行数据库迁移
npm run db:migrate

# 4. 启动开发服务器（热重载）
npm run dev

# 5. 构建生产版本
npm run build

# 6. 启动生产版本
npm start
```

### 前端开发

```bash
cd v-poker-uni-app

# 1. 用 HBuilderX 打开项目
# 2. 确认 api/config.js 中 BASE_URL = 'http://localhost:3001'
# 3. 运行 → 运行到浏览器 → Chrome
#    （开发服务器端口 8080，自动代理 /api 和 /socket.io 到 3001）
```

---

## 部署流程

### 服务器要求

- 操作系统：Ubuntu 20.04+ / Debian 11+
- Node.js：18+（推荐 20 LTS）
- PostgreSQL：14+
- 内存：2GB+
- 磁盘：20GB+

### 一键部署（推荐）

```bash
# 1. 上传部署脚本到服务器
scp deploy-full.sh root@你的服务器IP:/root/

# 2. SSH 登录
ssh root@你的服务器IP

# 3. 执行部署
chmod +x /root/deploy-full.sh
bash /root/deploy-full.sh
```

### 手动部署步骤

#### 1. 安装系统依赖

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs postgresql postgresql-contrib nginx git
npm install -g pm2
```

#### 2. 配置数据库

```bash
sudo -u postgres psql
# 在 psql 中执行：
CREATE USER v_poker WITH PASSWORD '你的密码';
CREATE DATABASE v_poker_3 OWNER v_poker;
GRANT ALL PRIVILEGES ON DATABASE v_poker_3 TO v_poker;
\q
```

#### 3. 部署后端

```bash
mkdir -p /path/to/api-server
cd /path/to/api-server

# 拉取代码（或上传）
git clone https://github.com/AthenDrakomin-hub/v-poker-3.0.git /tmp/repo
cp -r /tmp/repo/api-server/* /path/to/api-server/

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DATABASE_URL 和 SESSION_SECRET

# 安装依赖 & 迁移 & 构建
npm ci
npm run db:migrate
npm run build

# 启动服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. 部署 H5 前端

```bash
# 本地用 HBuilderX 打包：发行 → 网站-PC Web或手机H5
# 打包产物在：unpackage/dist/build/web/

# 上传到服务器
scp -r unpackage/dist/build/web/* root@[YOUR_SERVER_IP]:/path/to/h5/

# 修复权限
ssh root@[YOUR_SERVER_IP] "chmod -R 755 /path/to/h5/ && find /path/to/h5/ -type f -exec chmod 644 {} \;"
```

#### 5. 配置 Nginx

```bash
cat > /etc/nginx/sites-available/goodspage.cn << 'EOF'
server {
    listen 80;
    server_name goodspage.cn www.goodspage.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name goodspage.cn www.goodspage.cn;

    ssl_certificate /etc/nginx/ssl/goodspage.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/goodspage.cn.key;

    # H5 前端
    location / {
        root /path/to/h5;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/goodspage.cn /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### 6. 配置 HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d goodspage.cn -d www.goodspage.cn
```

### 生产环境信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | [YOUR_SERVER_IP] |
| 域名 | [YOUR_DOMAIN] |
| 后端路径 | /path/to/api-server/ |
| H5 路径 | /path/to/h5/ |
| 数据库 | v_poker_3 @ localhost:5432 |
| 后端端口 | 3001（本地，Nginx 反代） |
| API 地址 | https://[YOUR_DOMAIN]/api/ |
| WebSocket | wss://[YOUR_DOMAIN]/socket.io/ |

---

## 环境变量配置

### 后端 .env（api-server/.env）

```bash
# 服务端口
PORT=3001

# PostgreSQL 数据库连接串（必填）
# 格式: postgresql://用户名:密码@主机:端口/数据库名
DATABASE_URL=postgresql://v_poker:你的密码@127.0.0.1:5432/v_poker_3

# 会话签名密钥（必填，生产环境用随机字符串）
# 生成方式: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=你的随机密钥

# Bcrypt 哈希轮数（生产环境建议 10-12）
BCRYPT_ROUNDS=10

# 数据库连接池
DB_POOL_MAX=20

# CORS 允许的源（逗号分隔，App 端建议留空允许所有）
CORS_ORIGIN=https://goodspage.cn

# 节点环境
NODE_ENV=production
```

### 前端 API 配置（v-poker-uni-app/api/config.js）

```javascript
// 开发环境
const BASE_URL = 'http://localhost:3001'

// 生产环境（打包前必须改！）
const BASE_URL = 'https://goodspage.cn'
```

> **重要**：打包 App 或 H5 前，必须确认 `BASE_URL` 指向生产环境，否则打包后无法连接后端。

---

## 开发注意事项

### 架构原则

1. **服务端权威**：所有游戏逻辑（发牌、牌型判定、结算、抽水）必须在后端实现，前端只做渲染和用户交互
2. **版本控制**：每次操作携带 `version` 字段，后端校验版本一致性，防止并发冲突
3. **乐观更新**：前端操作后先乐观更新 UI，等待后端确认后修正
4. **超时自动行动**：玩家 30 秒未操作，后端自动执行默认行动（弃牌/跟注）

### 前端开发

1. **API 地址切换**：开发时用 `http://localhost:3001`，打包前必须改为 `https://goodspage.cn`
2. **Canvas 渲染**：游戏桌面使用自定义 Canvas 引擎（renderjs），卡牌/筹码/动画全部在 Canvas 绘制
3. **横屏适配**：游戏房间强制横屏，使用 `vh/vw` 单位适配不同屏幕
4. **Socket 重连**：网络断开后自动重连，重连成功后同步最新房间状态
5. **音效资源**：音效和语音走 CDN，本地 `static/sounds/` 和 `static/voices/` 为空目录

### 后端开发

1. **数据库迁移**：表结构变更使用 `npm run db:generate` 生成迁移文件，然后 `npm run db:migrate` 执行
2. **游戏引擎扩展**：新增游戏在 `src/lib/games/` 下创建目录，实现 `engine.ts`（状态机）和 `rules.ts`（牌型规则）
3. **Socket 事件**：房间实时事件在 `src/socket/` 处理，API 请求在 `src/routes/` 处理
4. **日志审计**：关键操作（结算、上下分、权限变更）记录到 `event_logs` 表
5. **异常捕获**：所有路由和 Socket 事件必须有 try-catch，防止未捕获异常导致进程崩溃

### Git 工作流

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 创建功能分支
git checkout -b feature/xxx

# 3. 开发完成后提交
git add .
git commit -m "feat: xxx功能"

# 4. 合并到 main
git checkout main
git merge feature/xxx

# 5. 推送到远程
git push origin main

# 6. 服务器更新
ssh root@[YOUR_SERVER_IP] "cd /path/to/api-server && git pull && npm ci && npm run build && pm2 reload v-poker-api"
```

---

## 要点注意点

### 部署相关

1. **.env 不提交 Git**：`.gitignore` 已配置，严禁将 `.env` 提交到远程仓库
2. **数据库权限**：部署后必须执行 `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO v_poker;`，否则会出现 `permission denied` 错误
3. **Nginx WebSocket**：必须配置 `Upgrade` 和 `Connection` 头，否则 Socket.io 无法连接
4. **HTTPS 必需**：iOS App 要求所有网络请求使用 HTTPS，HTTP 会被 App Transport Security 拦截
5. **文件权限**：H5 静态文件目录权限必须为 755，文件权限 644，否则 Nginx 无法读取

### 打包相关

1. **API 地址**：打包前必须确认 `api/config.js` 中 `BASE_URL = 'https://goodspage.cn'`
2. **横屏配置**：`manifest.json` 中 `screenOrientation` 设为 `landscape`（横屏）
3. **启动图和图标**：iOS 打包需要配置 App 图标和启动图，尺寸参考 Apple 规范
4. **证书配置**：iOS 打包需要 `.p12` 发布证书 + `.mobileprovision` 描述文件
5. **Bundle ID**：必须与 Apple Developer 后台注册的 App ID 一致

### 游戏相关

1. **25局总结算**：每个房间默认 25 局后自动总结算，显示所有玩家累计输赢和抽水分配
2. **庄家赔付不足**：抢庄模式下庄家筹码不足赔付时，系统按比例分配并提示
3. **机器人**：房间人数不足时自动加入机器人，机器人账号前缀为 `bot_`
4. **超时自动行动**：玩家 30 秒未操作自动弃牌/跟注，剩余 5 秒时前端震动提醒
5. **断线重连**：玩家断线后保留座位 30 秒，重连后自动恢复游戏状态

### 安全相关

1. **SQL 注入**：使用 Drizzle ORM 参数化查询，禁止拼接 SQL
2. **XSS 防护**：用户输入（昵称、聊天消息）前端转义，后端校验长度
3. **越权防护**：所有操作校验用户身份和房间权限，禁止越权操作
4. **敏感信息**：`.env`、证书、密钥严禁提交 Git，生产环境使用强密码
5. **日志脱敏**：日志中不记录密码、Token 等敏感信息

---

## 常用命令

### 后端命令

```bash
cd api-server

# 开发
npm run dev                    # 启动开发服务器（热重载）
npm run build                  # 构建 TypeScript
npm start                      # 启动生产服务器

# 数据库
npm run db:generate            # 生成迁移文件
npm run db:migrate             # 执行迁移
npm run db:push                # 直接推送 schema（开发用）
npm run db:studio              # 打开 Drizzle Studio

# 测试
npm test                       # 运行单元测试
npm run test:watch             # 监听模式测试
```

### 前端命令

```bash
cd v-poker-uni-app

# HBuilderX 操作：
# 运行 → 运行到浏览器 → Chrome（开发）
# 发行 → 网站-PC Web或手机H5（H5 打包）
# 发行 → 原生App-云打包（App 打包）
```

### 服务器运维命令

```bash
# SSH 登录
ssh root@[YOUR_SERVER_IP]

# PM2 服务管理
pm2 status                     # 查看服务状态
pm2 logs v-poker-api           # 查看实时日志
pm2 logs v-poker-api --lines 100  # 查看最近100行日志
pm2 reload v-poker-api         # 重载服务（零停机）
pm2 restart v-poker-api        # 重启服务
pm2 stop v-poker-api           # 停止服务

# Nginx
nginx -t                       # 测试配置
systemctl reload nginx         # 重载配置
systemctl restart nginx        # 重启 Nginx
tail -f /var/log/nginx/error.log  # 查看错误日志

# PostgreSQL
sudo -u postgres psql          # 进入数据库
systemctl status postgresql     # 查看状态

# 更新后端代码
cd /path/to/api-server
git pull origin main
npm ci
npm run db:migrate
npm run build
pm2 reload v-poker-api

# 更新 H5 前端（本地打包后上传）
scp -r unpackage/dist/build/web/* root@[YOUR_SERVER_IP]:/path/to/h5/
```

---

## 安全规范

### 严禁提交到 Git 的文件

- `.env`（环境变量，包含数据库密码和密钥）
- `*.p12` / `*.keystore` / `*.mobileprovision`（签名证书）
- `node_modules/`（依赖目录）
- `unpackage/`（打包产物）
- `*.log`（日志文件）
- `database_full_backup_*.sql`（数据库备份）

### 生产环境检查清单

- [ ] `.env` 中 `SESSION_SECRET` 使用随机字符串（非默认值）
- [ ] `.env` 中 `BCRYPT_ROUNDS >= 10`
- [ ] 数据库用户使用强密码
- [ ] Nginx 配置 HTTPS，HTTP 自动跳转
- [ ] 防火墙只开放 22/80/443 端口
- [ ] PM2 设置开机自启
- [ ] 数据库定期备份
- [ ] 日志定期轮转清理

---

## 许可证

私有项目，未经授权禁止商用。

---

## 联系方式

- 仓库：https://github.com/AthenDrakomin-hub/v-poker-3.0

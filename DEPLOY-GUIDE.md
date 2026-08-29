# V-Poker 3.0 完整生产环境部署指南

> 适用系统：Ubuntu 20.04+ / Debian 11+
> 域名：goodspage.cn
> 部署内容：后端 API + H5 Web端
> 后端路径：/opt/texas-platform/api-server
> H5路径：/opt/texas-platform/h5
> 后端端口：3001

---

## 目录

1. [架构说明](#架构说明)
2. [方式一：一键部署脚本](#方式一一键部署脚本推荐)
3. [方式二：手动分步部署](#方式二手动分步部署)
   - [第一部分：后端 API 部署](#第一部分后端-api-部署)
   - [第二部分：H5 Web端打包与部署](#第二部分h5-web端打包与部署)
   - [第三部分：Nginx 配置](#第三部分nginx-配置)
   - [第四部分：HTTPS 证书](#第四部分https-证书)
4. [验证部署](#验证部署)
5. [日常运维](#日常运维)
6. [常见问题](#常见问题)

---

## 架构说明

```
                    ┌─────────────────┐
                    │   用户浏览器/App │
                    └────────┬────────┘
                             │ HTTPS (443)
                             ▼
                    ┌─────────────────┐
                    │   Nginx 反向代理  │
                    │  goodspage.cn    │
                    └───┬─────────┬───┘
                        │         │
              /         │         │ /api, /socket.io
                        ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │  H5 静态文件   │  │  后端 API     │
              │  /opt/texas/  │  │  Express      │
              │  platform/h5  │  │  :3001        │
              └──────────────┘  └──────┬───────┘
                                         │
                                         ▼
                                 ┌──────────────┐
                                 │  PostgreSQL   │
                                 │  :5432 vpoker │
                                 └──────────────┘
```

---

## 方式一：一键部署脚本（推荐）

```bash
# 1. 上传脚本到服务器（本地执行）
scp deploy-full.sh root@你的服务器IP:/root/

# 2. SSH 登录服务器
ssh root@你的服务器IP

# 3. 执行部署
chmod +x /root/deploy-full.sh
bash /root/deploy-full.sh
```

脚本会自动完成：
- 系统环境安装（Node.js / PM2 / PostgreSQL / Nginx）
- 后端代码拉取、依赖安装、数据库迁移、构建启动
- H5 产物上传确认
- Nginx 配置（静态托管 + API代理 + WebSocket）
- HTTPS 证书申请

---

## 方式二：手动分步部署

### 第一部分：后端 API 部署

#### 步骤 1：安装系统依赖

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 安装 PM2
npm install -g pm2

# 安装 PostgreSQL 14
apt install -y postgresql postgresql-contrib

# 安装 Nginx
apt install -y nginx

# 安装 Git
apt install -y git

# 验证
node -v && npm -v && pm2 -v && psql --version && nginx -v
```

#### 步骤 2：配置 PostgreSQL 数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 psql 中执行：
CREATE USER vpoker WITH PASSWORD '你的数据库密码';
CREATE DATABASE vpoker OWNER vpoker;
GRANT ALL PRIVILEGES ON DATABASE vpoker TO vpoker;
\q

# 验证连接
psql -U vpoker -d vpoker -h localhost -c "SELECT version();"
```

#### 步骤 3：拉取后端代码

```bash
# 创建项目目录
mkdir -p /opt/texas-platform/api-server
mkdir -p /opt/texas-platform/h5
mkdir -p /var/log/v-poker

# 克隆仓库
cd /opt/texas-platform
git clone https://github.com/AthenDrakomin-hub/v-poker-3.0.git /tmp/v-poker-repo

# 复制后端代码
cp -r /tmp/v-poker-repo/api-server/* /opt/texas-platform/api-server/
cp -r /tmp/v-poker-repo/api-server/.* /opt/texas-platform/api-server/ 2>/dev/null || true
rm -rf /tmp/v-poker-repo

cd /opt/texas-platform/api-server
ls -la
```

#### 步骤 4：配置后端环境变量

```bash
cd /opt/texas-platform/api-server

# 生成随机 SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 创建 .env 文件
cat > .env << 'EOF'
PORT=3001
DATABASE_URL=postgresql://vpoker:你的数据库密码@localhost:5432/vpoker
SESSION_SECRET=上面生成的64位随机字符串
BCRYPT_ROUNDS=10
DB_POOL_MAX=20
CORS_ORIGIN=
NODE_ENV=production
EOF

# 验证配置
cat .env
```

#### 步骤 5：安装后端依赖

```bash
cd /opt/texas-platform/api-server
npm ci
```

#### 步骤 6：执行数据库迁移

```bash
cd /opt/texas-platform/api-server
npm run db:migrate

# 验证表结构
psql -U vpoker -d vpoker -h localhost -c "\dt"
```

#### 步骤 7：构建并启动后端服务

```bash
cd /opt/texas-platform/api-server

# 构建 TypeScript
npm run build

# 验证构建产物
ls -la dist/index.js

# PM2 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs v-poker-api --lines 50

# 设置开机自启
pm2 save
pm2 startup systemd -u root --hp /root
```

#### 步骤 8：验证后端服务

```bash
# 端口监听
netstat -tlnp | grep 3001

# 本地健康检查
curl http://127.0.0.1:3001/health

# 预期返回：{"status":"ok","timestamp":"..."}
```

---

### 第二部分：H5 Web端打包与部署

#### 步骤 1：本地打包 H5（HBuilderX）

```
1. 打开 HBuilderX
2. 导入项目：v-poker-uni-app
3. 确认 api/config.js 中 BASE_URL = 'https://goodspage.cn'
4. 菜单：发行 → 网站-PC Web或手机H5
5. 填写配置：
   - 网站标题：V-Poker
   - 网站域名：https://goodspage.cn
   - 路由模式：hash（推荐，避免刷新404）
6. 点击「发行」
7. 等待打包完成
8. 打包产物位置：unpackage/build/h5/
```

#### 步骤 2：上传 H5 产物到服务器

```bash
# 本地执行（在 v-poker-uni-app 目录下）
cd v-poker-uni-app/unpackage/build/h5

# 上传到服务器
scp -r ./* root@你的服务器IP:/opt/texas-platform/h5/

# 或者用 rsync（增量同步，更快）
rsync -avz --delete ./ root@你的服务器IP:/opt/texas-platform/h5/
```

#### 步骤 3：服务器上验证 H5 产物

```bash
ssh root@你的服务器IP

ls -la /opt/texas-platform/h5/
# 应该看到 index.html, static/, js/, css/ 等文件

# 验证 index.html 存在
cat /opt/texas-platform/h5/index.html | head -5
```

---

### 第三部分：Nginx 配置

#### 步骤 1：创建 Nginx 配置文件

```bash
cat > /etc/nginx/sites-available/goodspage.cn << 'EOF'
# V-Poker 完整 Nginx 配置
# H5 静态文件 + 后端 API 反向代理 + WebSocket

server {
    listen 80;
    server_name goodspage.cn www.goodspage.cn;

    # H5 前端静态文件
    location / {
        root /opt/texas-platform/h5;
        index index.html;
        try_files $uri $uri/ /index.html;

        # 静态资源缓存30天
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # HTML 不缓存
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Socket.io WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 健康检查
    location = /health {
        proxy_pass http://127.0.0.1:3001/health;
    }

    # gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
}
EOF
```

#### 步骤 2：启用站点配置

```bash
# 创建软链接启用站点
ln -sf /etc/nginx/sites-available/goodspage.cn /etc/nginx/sites-enabled/

# 删除默认站点
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx

# 查看 Nginx 状态
systemctl status nginx
```

---

### 第四部分：HTTPS 证书

#### 步骤 1：安装 Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

#### 步骤 2：申请 SSL 证书

```bash
# 自动配置 Nginx HTTPS
certbot --nginx -d goodspage.cn -d www.goodspage.cn

# 按提示输入邮箱、同意协议、选择重定向
```

#### 步骤 3：验证自动续期

```bash
# 测试续期
certbot renew --dry-run

# Certbot 会自动创建定时任务，每天检查续期
cat /etc/cron.d/certbot
```

---

## 验证部署

### 1. 后端服务验证

```bash
# PM2 状态
pm2 status

# 端口监听
netstat -tlnp | grep 3001

# 本地健康检查
curl http://127.0.0.1:3001/health

# 预期返回：{"status":"ok",...}
```

### 2. H5 前端验证

```bash
# 检查静态文件
ls -la /opt/texas-platform/h5/index.html

# 本地访问测试
curl -I http://127.0.0.1/
# 预期返回：HTTP/1.1 200 OK
```

### 3. 外网访问验证

```bash
# HTTP 访问（应自动跳转到 HTTPS）
curl -I http://goodspage.cn

# HTTPS 访问
curl -I https://goodspage.cn

# API 健康检查
curl https://goodspage.cn/api/health

# 浏览器访问
# 打开 https://goodspage.cn 应该能看到游戏页面
```

### 4. WebSocket 验证

```bash
# 检查 Nginx WebSocket 配置
grep -A 10 "socket.io" /etc/nginx/sites-available/goodspage.cn

# 浏览器控制台测试
# new WebSocket('wss://goodspage.cn/socket.io/?EIO=4&transport=websocket')
```

### 5. 防火墙配置

```bash
# 开放端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

---

## 日常运维

### 后端更新

```bash
cd /opt/texas-platform/api-server
git pull origin main
npm ci
npm run db:migrate
npm run build
pm2 reload v-poker-api
pm2 logs v-poker-api --lines 30
```

### H5 更新

```bash
# 1. 本地 HBuilderX 重新打包 H5
# 2. 上传新产物（本地执行）
cd v-poker-uni-app/unpackage/build/h5
rsync -avz --delete ./ root@你的服务器IP:/opt/texas-platform/h5/

# 3. 服务器重载 Nginx（可选，静态文件不需要）
ssh root@你的服务器IP "systemctl reload nginx"
```

### 查看日志

```bash
# 后端日志
pm2 logs v-poker-api

# 后端错误日志
pm2 logs v-poker-api --err

# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# PostgreSQL 日志
tail -f /var/log/postgresql/postgresql-*.log
```

### 数据库备份

```bash
# 手动备份
pg_dump -U vpoker -h localhost vpoker > /backup/vpoker_$(date +%Y%m%d).sql

# 恢复备份
psql -U vpoker -h localhost vpoker < /backup/vpoker_20260101.sql
```

### 服务管理

```bash
# 重启后端
pm2 restart v-poker-api

# 停止后端
pm2 stop v-poker-api

# 重载 Nginx
systemctl reload nginx

# 重启 Nginx
systemctl restart nginx

# 重启 PostgreSQL
systemctl restart postgresql
```

---

## 常见问题

### Q1: 后端启动失败，端口被占用

```bash
# 查看占用进程
lsof -i :3001
# 杀掉进程
kill -9 <PID>
# 重新启动
pm2 restart v-poker-api
```

### Q2: 数据库连接失败

```bash
# 检查 PostgreSQL 状态
systemctl status postgresql

# 检查 .env 中 DATABASE_URL 格式
# 格式: postgresql://用户名:密码@主机:端口/数据库名

# 测试数据库连接
psql -U vpoker -d vpoker -h localhost -c "SELECT 1"
```

### Q3: H5 页面空白 / 404

```bash
# 检查静态文件是否存在
ls -la /opt/texas-platform/h5/index.html

# 检查 Nginx 配置
nginx -t

# 检查 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 确认 H5 路由模式（推荐 hash 模式）
# 如果是 history 模式，需要确保 try_files 配置正确
```

### Q4: WebSocket 连接失败

- 确认 Nginx 配置中 `Upgrade` 和 `Connection` 头已设置
- 确认 Nginx 版本 ≥ 1.3.13
- 检查防火墙是否允许长连接
- 浏览器控制台查看具体错误信息

### Q5: HTTPS 证书申请失败

- 确认域名 DNS 已解析到服务器 IP
- 确认 80 端口可访问（防火墙未拦截）
- 确认 Nginx 配置中 server_name 正确
- 手动执行：`certbot certonly --webroot -w /opt/texas-platform/h5 -d goodspage.cn`

### Q6: API 请求跨域错误

- 确认后端 `.env` 中 `CORS_ORIGIN` 配置正确
- App 端建议留空（允许所有来源）
- H5 端如果域名固定，可以填写具体域名
- 修改后重启后端：`pm2 reload v-poker-api`

### Q7: 静态资源缓存导致更新不生效

```bash
# 强制刷新浏览器（Ctrl+Shift+R）
# 或者在 Nginx 配置中给 HTML 设置不缓存（已配置）
# 静态资源文件名带 hash，更新后文件名会变化，自动失效缓存
```

---

## 部署完成检查清单

- [ ] Node.js 20 已安装
- [ ] PM2 已安装并配置开机自启
- [ ] PostgreSQL 已安装，数据库和用户已创建
- [ ] Nginx 已安装
- [ ] 后端代码已拉取到 /opt/texas-platform/api-server
- [ ] 后端 .env 已配置（DATABASE_URL / SESSION_SECRET）
- [ ] 后端依赖已安装（npm ci）
- [ ] 数据库迁移已执行（npm run db:migrate）
- [ ] 后端已构建（npm run build）
- [ ] 后端服务已启动（pm2 start）
- [ ] 后端健康检查通过（curl http://127.0.0.1:3001/health）
- [ ] H5 已打包并上传到 /opt/texas-platform/h5
- [ ] Nginx 配置已创建并启用
- [ ] Nginx 配置测试通过（nginx -t）
- [ ] HTTPS 证书已申请
- [ ] 防火墙已开放 80/443 端口
- [ ] 外网访问 https://goodspage.cn 正常
- [ ] API 访问 https://goodspage.cn/api/health 正常
- [ ] WebSocket 连接正常

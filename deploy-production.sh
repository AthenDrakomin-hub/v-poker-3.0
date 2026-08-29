#!/bin/bash
# ============================================
# V-Poker 3.0 后端生产环境一键部署脚本
# 适用：Ubuntu 20.04+ / Debian 11+
# 域名：goodspage.cn
# 路径：/opt/texas-platform/api-server
# ============================================

set -e

echo "============================================"
echo "V-Poker 3.0 后端生产环境部署"
echo "============================================"

# ---------- 1. 系统环境检查 ----------
echo ""
echo "[1/8] 检查系统环境..."

# Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，正在安装 Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "✅ Node.js 版本: $(node -v)"
fi

# PM2
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 未安装，正在安装..."
    npm install -g pm2
else
    echo "✅ PM2 版本: $(pm2 -v)"
fi

# PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL 未安装，请先安装 PostgreSQL 14+"
    echo "   安装命令: apt-get install -y postgresql postgresql-contrib"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ PostgreSQL 已安装"
fi

# Nginx
if ! command -v nginx &> /dev/null; then
    echo "⚠️  Nginx 未安装，正在安装..."
    apt-get install -y nginx
else
    echo "✅ Nginx 已安装"
fi

# ---------- 2. 创建项目目录 ----------
echo ""
echo "[2/8] 创建项目目录..."
mkdir -p /opt/texas-platform
mkdir -p /var/log/v-poker
echo "✅ 目录已创建: /opt/texas-platform, /var/log/v-poker"

# ---------- 3. 拉取/更新代码 ----------
echo ""
echo "[3/8] 拉取代码..."
cd /opt/texas-platform

if [ -d "api-server/.git" ]; then
    echo "📦 已有 Git 仓库，正在拉取最新代码..."
    cd api-server
    git fetch origin
    git checkout main
    git pull origin main
else
    echo "📦 首次部署，正在克隆仓库..."
    git clone https://github.com/AthenDrakomin-hub/v-poker-3.0.git .
    # 如果仓库结构是根目录包含 api-server，则需要调整
    if [ -d "api-server" ]; then
        echo "📂 检测到 api-server 子目录"
    fi
fi

cd /opt/texas-platform/api-server
echo "✅ 代码已更新到最新版本"

# ---------- 4. 配置环境变量 ----------
echo ""
echo "[4/8] 配置环境变量..."

if [ ! -f ".env" ]; then
    echo "📝 创建 .env 配置文件..."
    cat > .env << 'EOF'
# ============================================
# V-POKER API Server 生产环境变量
# ============================================

# 服务端口
PORT=3001

# PostgreSQL 数据库连接串（必填）
# 格式: postgresql://用户名:密码@主机:端口/数据库名
DATABASE_URL=postgresql://vpoker:YOUR_DB_PASSWORD@localhost:5432/vpoker

# 会话签名密钥（必填，生产环境请用随机字符串）
# 生成方式: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=YOUR_RANDOM_SECRET_HERE

# Bcrypt 哈希轮数（生产环境建议 10-12）
BCRYPT_ROUNDS=10

# 数据库连接池
DB_POOL_MAX=20

# CORS 允许的源（逗号分隔，App 端建议留空或 *）
# 生产环境 App 来源不固定，建议留空允许所有
CORS_ORIGIN=

# 节点环境
NODE_ENV=production
EOF
    echo "⚠️  请编辑 .env 文件，填入真实的数据库密码和 SESSION_SECRET"
    echo "   命令: nano /opt/texas-platform/api-server/.env"
    read -p "配置完成后按回车继续..."
else
    echo "✅ .env 已存在，跳过创建"
fi

# ---------- 5. 安装依赖 ----------
echo ""
echo "[5/8] 安装后端依赖..."
cd /opt/texas-platform/api-server
npm ci --production=false
echo "✅ 依赖安装完成"

# ---------- 6. 数据库初始化 ----------
echo ""
echo "[6/8] 数据库初始化..."

# 检查数据库是否存在
DB_NAME=$(grep -oP 'DATABASE_URL=\K[^/]+$' .env | cut -d'?' -f1)
echo "📊 数据库名: $DB_NAME"

# 创建数据库（如果不存在）
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME" || {
    echo "📝 创建数据库 $DB_NAME..."
    sudo -u postgres createdb "$DB_NAME"
}

# 执行迁移
echo "📝 执行数据库迁移..."
npm run db:migrate
echo "✅ 数据库迁移完成"

# ---------- 7. 构建并启动 ----------
echo ""
echo "[7/8] 构建 TypeScript 并启动服务..."

# 构建
npm run build
echo "✅ TypeScript 构建完成"

# PM2 启动
if pm2 list | grep -q "v-poker-api"; then
    echo "🔄 重启已有服务..."
    pm2 reload v-poker-api
else
    echo "🚀 启动新服务..."
    pm2 start ecosystem.config.js
fi

# 保存 PM2 进程列表
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "✅ 服务已启动"
sleep 2
pm2 status

# ---------- 8. Nginx 配置 ----------
echo ""
echo "[8/8] 配置 Nginx 反向代理..."

NGINX_CONF="/etc/nginx/sites-available/goodspage.cn"

if [ ! -f "$NGINX_CONF" ]; then
    cat > "$NGINX_CONF" << 'EOF'
# V-Poker API 反向代理
server {
    listen 80;
    server_name goodspage.cn www.goodspage.cn;

    # API 反向代理
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
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
    }
}
EOF

    # 启用站点
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # 测试配置
    nginx -t
    systemctl reload nginx
    echo "✅ Nginx 配置完成"
else
    echo "✅ Nginx 配置已存在，跳过"
fi

# ---------- 部署完成 ----------
echo ""
echo "============================================"
echo "✅ V-Poker 3.0 后端部署完成！"
echo "============================================"
echo ""
echo "📋 验证命令："
echo "  1. 服务状态: pm2 status"
echo "  2. 服务日志: pm2 logs v-poker-api"
echo "  3. 端口监听: netstat -tlnp | grep 3001"
echo "  4. API 健康: curl http://127.0.0.1:3001/health"
echo "  5. 外网访问: curl https://goodspage.cn/api/health"
echo ""
echo "🔧 常用命令："
echo "  重启服务: pm2 reload v-poker-api"
echo "  查看日志: pm2 logs v-poker-api --lines 100"
echo "  停止服务: pm2 stop v-poker-api"
echo "  更新代码: cd /opt/texas-platform/api-server && git pull && npm ci && npm run build && pm2 reload v-poker-api"
echo ""
echo "⚠️  后续步骤："
echo "  1. 配置 HTTPS（Certbot）: certbot --nginx -d goodspage.cn -d www.goodspage.cn"
echo "  2. 确认 .env 中 DATABASE_URL 和 SESSION_SECRET 已填写真实值"
echo "  3. 防火墙开放 80/443 端口: ufw allow 80,443/tcp"
echo "============================================"

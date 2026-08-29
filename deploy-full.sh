#!/bin/bash
# ============================================
# V-Poker 3.0 完整生产环境部署脚本
# 包含：后端 API + H5 Web端
# 适用：Ubuntu 20.04+ / Debian 11+
# 域名：goodspage.cn
# ============================================

set -e

echo "============================================"
echo "V-Poker 3.0 完整生产环境部署"
echo "包含：后端 API + H5 Web端"
echo "============================================"

# ========== 第一部分：后端 API 部署 ==========
echo ""
echo "============================================"
echo "第一部分：后端 API 部署"
echo "============================================"

# ---------- 1. 系统环境检查 ----------
echo ""
echo "[1/10] 检查系统环境..."

if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "✅ Node.js: $(node -v)"

if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi
echo "✅ PM2: $(pm2 -v)"

if ! command -v psql &> /dev/null; then
    echo "📦 安装 PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
fi
echo "✅ PostgreSQL 已安装"

if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    apt-get install -y nginx
fi
echo "✅ Nginx 已安装"

# ---------- 2. 创建目录 ----------
echo ""
echo "[2/10] 创建项目目录..."
mkdir -p /opt/texas-platform/api-server
mkdir -p /opt/texas-platform/h5
mkdir -p /var/log/v-poker
echo "✅ 目录已创建"

# ---------- 3. 拉取代码 ----------
echo ""
echo "[3/10] 拉取代码..."
cd /opt/texas-platform

if [ -d "api-server/.git" ]; then
    cd api-server
    git fetch origin && git checkout main && git pull origin main
else
    git clone https://github.com/AthenDrakomin-hub/v-poker-3.0.git /tmp/v-poker-repo
    cp -r /tmp/v-poker-repo/api-server/* /opt/texas-platform/api-server/
    cp -r /tmp/v-poker-repo/api-server/.* /opt/texas-platform/api-server/ 2>/dev/null || true
    rm -rf /tmp/v-poker-repo
fi
cd /opt/texas-platform/api-server
echo "✅ 代码已更新"

# ---------- 4. 配置数据库 ----------
echo ""
echo "[4/10] 配置 PostgreSQL 数据库..."

# 检查数据库用户和数据库
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='vpoker'" | grep -q 1 || {
    echo "📝 创建数据库用户 vpoker..."
    DB_PASS=$(openssl rand -hex 16)
    sudo -u postgres psql -c "CREATE USER vpoker WITH PASSWORD '$DB_PASS';"
    echo "⚠️  数据库密码: $DB_PASS"
    echo "   请记录此密码，稍后配置 .env 使用"
}

sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "vpoker" || {
    echo "📝 创建数据库 vpoker..."
    sudo -u postgres createdb vpoker -O vpoker
}
echo "✅ 数据库已配置"

# ---------- 5. 配置环境变量 ----------
echo ""
echo "[5/10] 配置后端环境变量..."

if [ ! -f ".env" ]; then
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    cat > .env << EOF
PORT=3001
DATABASE_URL=postgresql://vpoker:${DB_PASS:-YOUR_DB_PASSWORD}@localhost:5432/vpoker
SESSION_SECRET=${SESSION_SECRET}
BCRYPT_ROUNDS=10
DB_POOL_MAX=20
CORS_ORIGIN=
NODE_ENV=production
EOF
    echo "✅ .env 已自动生成（SESSION_SECRET 已随机生成）"
    echo "⚠️  请确认 DATABASE_URL 中的数据库密码正确"
    read -p "确认后按回车继续..."
else
    echo "✅ .env 已存在"
fi

# ---------- 6. 安装依赖 ----------
echo ""
echo "[6/10] 安装后端依赖..."
npm ci
echo "✅ 依赖安装完成"

# ---------- 7. 数据库迁移 ----------
echo ""
echo "[7/10] 执行数据库迁移..."
npm run db:migrate
echo "✅ 数据库迁移完成"

# ---------- 8. 构建并启动 ----------
echo ""
echo "[8/10] 构建 TypeScript 并启动后端服务..."
npm run build

if pm2 list | grep -q "v-poker-api"; then
    pm2 reload v-poker-api
else
    pm2 start ecosystem.config.js
fi
pm2 save
echo "✅ 后端服务已启动"
sleep 2
pm2 status

# 验证后端
echo ""
echo "验证后端服务..."
curl -s http://127.0.0.1:3001/health && echo "" || echo "⚠️  后端健康检查失败，请检查日志: pm2 logs v-poker-api"


# ========== 第二部分：H5 Web端部署 ==========
echo ""
echo "============================================"
echo "第二部分：H5 Web端部署"
echo "============================================"

# ---------- 9. 部署 H5 静态文件 ----------
echo ""
echo "[9/10] 部署 H5 Web端..."

echo ""
echo "📋 H5 打包说明："
echo "  1. 在本地用 HBuilderX 打开 v-poker-uni-app 项目"
echo "  2. 菜单：发行 → 网站-PC Web或手机H5"
echo "  3. 网站标题：V-Poker"
echo "  4. 网站域名：https://goodspage.cn"
echo "  5. 点击发行，等待打包完成"
echo "  6. 打包产物在：unpackage/build/h5/"
echo ""
echo "📤 上传 H5 产物到服务器（本地执行）："
echo "  scp -r unpackage/build/h5/* root@你的服务器IP:/opt/texas-platform/h5/"
echo ""

read -p "H5 产物是否已上传到 /opt/texas-platform/h5/？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "✅ H5 产物已确认"
    ls -la /opt/texas-platform/h5/
else
    echo "⚠️  请先上传 H5 产物，Nginx 配置仍会继续"
fi

# ---------- 10. 配置 Nginx ----------
echo ""
echo "[10/10] 配置 Nginx（API反向代理 + H5静态托管）..."

cat > /etc/nginx/sites-available/goodspage.cn << 'NGINX_EOF'
# V-Poker 完整 Nginx 配置
# 前端 H5 静态文件 + 后端 API 反向代理 + WebSocket

server {
    listen 80;
    server_name goodspage.cn www.goodspage.cn;

    # H5 前端静态文件
    location / {
        root /opt/texas-platform/h5;
        index index.html;
        try_files $uri $uri/ /index.html;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # HTML 不缓存（保证更新及时）
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
NGINX_EOF

# 启用站点
ln -sf /etc/nginx/sites-available/goodspage.cn /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t
systemctl reload nginx
echo "✅ Nginx 配置完成"


# ========== 第三部分：HTTPS 配置 ==========
echo ""
echo "============================================"
echo "第三部分：HTTPS 证书配置（iOS App 必须）"
echo "============================================"

read -p "是否现在配置 HTTPS 证书？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 安装 Certbot..."
    apt install -y certbot python3-certbot-nginx

    echo "📝 申请 SSL 证书..."
    certbot --nginx -d goodspage.cn -d www.goodspage.cn --non-interactive --agree-tos -m admin@goodspage.cn --redirect

    echo "✅ HTTPS 配置完成"
    echo "   访问: https://goodspage.cn"
else
    echo "⚠️  跳过 HTTPS 配置"
    echo "   后续可手动执行: certbot --nginx -d goodspage.cn -d www.goodspage.cn"
fi


# ========== 部署完成 ==========
echo ""
echo "============================================"
echo "✅ V-Poker 3.0 完整部署完成！"
echo "============================================"
echo ""
echo "🌐 访问地址："
echo "  H5 Web端:  https://goodspage.cn"
echo "  API 接口:  https://goodspage.cn/api/health"
echo "  WebSocket: wss://goodspage.cn/socket.io/"
echo ""
echo "📋 服务状态："
pm2 status
echo ""
echo "🔧 常用命令："
echo "  后端日志:     pm2 logs v-poker-api"
echo "  重启后端:     pm2 reload v-poker-api"
echo "  重载 Nginx:   systemctl reload nginx"
echo "  Nginx 日志:   tail -f /var/log/nginx/access.log"
echo ""
echo "📦 更新代码："
echo "  后端更新: cd /opt/texas-platform/api-server && git pull && npm ci && npm run build && pm2 reload v-poker-api"
echo "  H5更新:   scp -r unpackage/build/h5/* root@服务器IP:/opt/texas-platform/h5/ && systemctl reload nginx"
echo ""
echo "⚠️  防火墙："
echo "  ufw allow 22,80,443/tcp && ufw enable"
echo "============================================"

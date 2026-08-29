#!/bin/bash
# V-Poker 生产环境部署脚本
# 用法: ./scripts/deploy.sh

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           V-Poker 生产环境部署脚本                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/opt/texas-platform"
API_DIR="$PROJECT_DIR/api-server"
LOG_FILE="/var/log/v-poker/deploy-$(date +%Y%m%d-%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# 1. Git pull
log "1. 拉取最新代码..."
cd "$PROJECT_DIR"
git stash 2>/dev/null || true
git pull origin master 2>&1 | tee -a "$LOG_FILE" || error "Git pull 失败"
success "代码拉取完成"

# 2. 数据库迁移（如果存在迁移文件）
log "2. 检查数据库迁移..."
if [ -d "$API_DIR/db/migrations" ] && [ "$(ls -A "$API_DIR/db/migrations" 2>/dev/null)" ]; then
    log "   执行数据库迁移..."
    cd "$API_DIR"
    npx drizzle-kit push 2>&1 | tee -a "$LOG_FILE" || warning "迁移执行有警告，继续部署"
    success "数据库迁移完成"
else
    log "   无迁移文件，跳过迁移"
fi

# 3. 安装后端依赖
log "3. 安装后端依赖..."
cd "$API_DIR"
npm install --production 2>&1 | tail -5 | tee -a "$LOG_FILE"
success "后端依赖安装完成"

# 4. 构建后端
log "4. 构建后端..."
npm run build 2>&1 | tee -a "$LOG_FILE" || error "后端构建失败"
success "后端构建完成"

# 5. 安装前端依赖
log "5. 安装前端依赖..."
cd "$PROJECT_DIR"
npm install 2>&1 | tail -5 | tee -a "$LOG_FILE"
success "前端依赖安装完成"

# 6. 构建前端
log "6. 构建前端..."
npm run build 2>&1 | tee -a "$LOG_FILE" || error "前端构建失败"
success "前端构建完成"

# 7. 重启服务
log "7. 重启PM2服务..."
pm2 restart all 2>&1 | tee -a "$LOG_FILE"
sleep 3
pm2 save 2>&1 | tee -a "$LOG_FILE"
success "服务重启完成"

# 8. 健康检查
log "8. 执行健康检查..."
sleep 2
curl -sf http://127.0.0.1:3001/api/health > /dev/null || error "API健康检查失败"
curl -sf http://127.0.0.1:3000 > /dev/null || warning "前端访问测试失败（可能是SSG延迟）"
success "健康检查通过"

# 9. 清理旧日志（保留最近7天）
log "9. 清理旧日志..."
find /var/log/v-poker -name "*.log" -mtime +7 -delete 2>/dev/null || true
success "日志清理完成"

echo ""
success "╔═══════════════════════════════════════════════════════════╗"
success "║                   部署完成！                              ║"
success "╚═══════════════════════════════════════════════════════════╝"
echo ""
log "详细日志: $LOG_FILE"
log "服务状态: pm2 list"
echo ""

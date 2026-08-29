#!/bin/bash
# V-Poker 服务器常用指令速查表
# 复制以下内容到服务器执行

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         V-Poker 服务器常用指令速查表                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "【1. 连接服务器】"
echo "  ssh root@45.77.31.155"
echo ""

echo "【2. 进入项目目录】"
echo "  cd /opt/texas-platform"
echo ""

echo "【3. 查看系统状态】"
echo "  pm2 list"
echo "  top -bn1 | head -5"
echo "  df -h"
echo ""

echo "【4. Git 操作】"
echo "  git pull origin master    # 拉取最新代码"
echo "  git status                # 查看状态"
echo "  git log --oneline -5      # 最近提交"
echo ""

echo "【5. 后端操作 (api-server)】"
echo "  cd /opt/texas-platform/api-server"
echo "  npm install               # 安装依赖"
echo "  npm run build             # 编译TypeScript"
echo "  pm2 restart v-poker-api   # 重启服务"
echo ""

echo "【6. 前端操作 (root)】"
echo "  cd /opt/texas-platform"
echo "  npm install               # 安装依赖"
echo "  npm run build             # 构建静态文件"
echo "  pm2 restart v-poker-2     # 重启服务"
echo ""

echo "【7. PM2 管理】"
echo "  pm2 list                  # 查看进程"
echo "  pm2 restart all           # 重启所有"
echo "  pm2 logs --lines 50       # 查看日志"
echo "  pm2 logs v-poker-api --err # 查看错误日志"
echo "  pm2 save                  # 保存配置"
echo ""

echo "【8. 数据库操作】"
echo "  sudo -u postgres psql -d v_poker_2"
echo "  \dt                       # 列出所有表"
echo "  SELECT count(*) FROM users;                    # 用户数"
echo "  SELECT id, room_no, game_type, status FROM rooms;  # 房间列表"
echo "  SELECT * FROM econ_config;                     # 经济配置"
echo "  \q                                        # 退出"
echo ""

echo "【9. 数据库备份】"
echo "  sudo -u postgres pg_dump -d v_poker_2 --schema-only > schema_backup.sql"
echo "  sudo -u postgres pg_dump -d v_poker_2 > full_backup.sql"
echo ""

echo "【10. Nginx 操作】"
echo "  nginx -t                  # 测试配置"
echo "  systemctl reload nginx    # 重载配置"
echo "  systemctl status nginx    # 查看状态"
echo "  tail -f /var/log/nginx/error.log  # 查看错误日志"
echo ""

echo "【11. 日志查看】"
echo "  tail -f /var/log/v-poker/api-out.log"
echo "  tail -f /var/log/v-poker/api-error.log"
echo "  tail -f /var/log/v-poker/frontend-out.log"
echo ""

echo "【12. 一键部署（推荐）】"
echo "  cd /opt/texas-platform"
echo "  ./scripts/deploy.sh"
echo ""

echo "【13. 健康检查】"
echo "  curl -s http://127.0.0.1:3001/api/health"
echo "  curl -s https://goodspage.cn/ -o /dev/null -w '%{http_code}'"
echo ""

echo "【14. 紧急重启】"
echo "  pm2 restart all && pm2 save && systemctl reload nginx"
echo ""

echo "【15. 清理缓存】"
echo "  rm -rf .next out api-server/dist"
echo "  npm cache clean --force"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "服务器信息："
echo "  IP: 45.77.31.155"
echo "  域名: goodspage.cn"
echo "  项目: /opt/texas-platform"
echo "  数据库: PostgreSQL v_poker_2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

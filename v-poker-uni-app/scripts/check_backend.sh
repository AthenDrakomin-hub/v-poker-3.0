#!/bin/bash
cd /opt/texas-platform

echo "=== 数据库角色枚举 ==="
sudo -u postgres psql -d v_poker_2 -t -c "SELECT DISTINCT role, count(*) FROM users GROUP BY role ORDER BY role;"

echo ""
echo "=== users表代理相关字段 ==="
sudo -u postgres psql -d v_poker_2 -c "\d users" | grep -iE "role|parent|invite|level|agent"

echo ""
echo "=== agent.routes.ts完整路由 ==="
grep -nE "router\.(get|post|put|delete)|requireRole" api-server/src/routes/agent.routes.ts

echo ""
echo "=== admin.routes.ts完整路由 ==="
grep -nE "router\.(get|post|put|delete)|requireRole" api-server/src/routes/admin.routes.ts

echo ""
echo "=== 后端服务状态 ==="
pm2 list | grep -E "v-poker|name"

#!/bin/bash
cd /opt/texas-platform/api-server

echo "=== 修复前 ==="
sed -n '606p' src/routes/agent.routes.ts

# 使用sed替换，注意转义
sed -i 's/d.amount || 0/d.commissionAmount || 0/g' src/routes/agent.routes.ts

echo ""
echo "=== 修复后 ==="
sed -n '606p' src/routes/agent.routes.ts

echo ""
echo "=== 重新编译 ==="
npm run build 2>&1 | tail -10

echo ""
echo "=== 重启服务 ==="
pm2 restart v-poker-api 2>&1 | tail -5

echo ""
echo "=== 服务状态 ==="
pm2 list 2>&1 | tail -5

#!/bin/bash
cd /opt/texas-platform/api-server

echo "=== 验证修复后的规则 ==="
grep -E "name:|multiplier:" src/lib/games/sangong/rules.ts | head -20

echo ""
echo "=== 重新编译 ==="
npm run build 2>&1 | tail -15

echo ""
echo "=== 重启服务 ==="
pm2 restart v-poker-api 2>&1 | tail -5

echo ""
echo "=== 验证API返回 ==="
sleep 2
curl -s http://localhost:3000/api/games/rules/sangong 2>&1 | head -5

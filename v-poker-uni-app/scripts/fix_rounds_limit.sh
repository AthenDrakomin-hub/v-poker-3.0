#!/bin/bash
cd /opt/texas-platform/api-server

echo "=== 修复前 ==="
sed -n '536,550p' src/routes/rooms.routes.ts

# 修复：将limit(30)改为limit(25)，注释也改为25局
sed -i 's/最多30局/最多25局/g' src/routes/rooms.routes.ts
sed -i 's/\.limit(30)/.limit(25)/g' src/routes/rooms.routes.ts

echo ""
echo "=== 修复后 ==="
sed -n '536,550p' src/routes/rooms.routes.ts

echo ""
echo "=== 重新编译 ==="
npm run build 2>&1 | tail -5

echo ""
echo "=== 重启服务 ==="
pm2 restart v-poker-api 2>&1 | tail -3

echo ""
echo "=== 验证数据库中的记录数量 ==="
sudo -u postgres psql -d v_poker_2 -c "SELECT room_id, COUNT(*) as round_count FROM game_rounds GROUP BY room_id ORDER BY round_count DESC LIMIT 10;" 2>&1 | head -15

#!/bin/bash
cd /opt/texas-platform

echo "=== 后端房间轮次记录接口 ==="
grep -nE "rounds|game_rounds|GET.*rounds" api-server/src/routes/rooms.routes.ts | head -15

echo ""
echo "=== 轮次记录接口实现 ==="
grep -nA 20 "router.get.*rounds" api-server/src/routes/rooms.routes.ts | head -40

echo ""
echo "=== game_rounds表结构 ==="
grep -rnE "game_rounds|GameRound|roundNo" api-server/src/db/schema.ts 2>/dev/null | head -10
grep -rnE "game_rounds|GameRound|roundNo" api-server/src/schema.ts 2>/dev/null | head -10

echo ""
echo "=== 数据库中游戏记录数量 ==="
sudo -u postgres psql -d v_poker_2 -c "SELECT roomId, COUNT(*) as round_count FROM game_rounds GROUP BY roomId ORDER BY round_count DESC LIMIT 10;" 2>&1 | head -20

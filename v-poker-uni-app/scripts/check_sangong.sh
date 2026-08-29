#!/bin/bash
cd /opt/texas-platform

echo "=== 抢庄三公规则完整内容 ==="
cat api-server/src/lib/games/sangong/rules.ts

echo ""
echo "=== 抢庄三公牌型判断 ==="
grep -nE "handType|handName|multiplier|倍数|牌型|三公|二公|一公|无公|mixed|all|score" api-server/src/lib/games/sangong/cards.ts | head -30

echo ""
echo "=== 抢庄三公engine中的结算逻辑 ==="
grep -nE "handName|multiplier|倍数|牌型|三公|二公|一公|无公|score|settle" api-server/src/lib/games/sangong/engine.ts | head -30

echo ""
echo "=== 前端游戏规则展示组件 ==="

#!/bin/bash
cd /opt/texas-platform

echo "=== 后端五个游戏引擎核心方法统计 ==="
for game in texas niuniu tbnn jinhua sangong; do
  echo ""
  echo "--- $game ---"
  grep -nE "^export (async )?function" api-server/src/lib/games/$game/engine.ts
done

echo ""
echo "=== 后端游戏规则文件 ==="
for game in texas niuniu tbnn jinhua sangong; do
  echo ""
  echo "--- $game rules ---"
  head -30 api-server/src/lib/games/$game/rules.ts
done

echo ""
echo "=== 后端卡牌编码格式 ==="
grep -nE "cardLabel|cardCode|toString|label" api-server/src/lib/games/common/cards.ts | head -15

echo ""
echo "=== 后端测试文件 ==="
ls -la api-server/src/__tests__/*.test.ts

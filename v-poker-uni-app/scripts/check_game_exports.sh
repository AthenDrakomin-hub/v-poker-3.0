#!/bin/bash
cd /opt/texas-platform

echo "=== niuniu engine 导出 ==="
grep -nE "^export |^class |^interface |^type " api-server/src/lib/games/niuniu/engine.ts | head -15

echo ""
echo "=== jinhua engine 导出 ==="
grep -nE "^export |^class |^interface |^type " api-server/src/lib/games/jinhua/engine.ts | head -15

echo ""
echo "=== sangong engine 导出 ==="
grep -nE "^export |^class |^interface |^type " api-server/src/lib/games/sangong/engine.ts | head -15

echo ""
echo "=== texas engine 导出 ==="
grep -nE "^export |^class |^interface |^type " api-server/src/lib/games/texas/engine.ts | head -15

echo ""
echo "=== tbnn engine 导出 ==="
grep -nE "^export |^class |^interface |^type " api-server/src/lib/games/tbnn/engine.ts | head -15

echo ""
echo "=== 房间路由中游戏引擎调用 ==="
grep -nE "import.*games/|Engine|engine|settleHand|createHand|dealCards|handleAction" api-server/src/routes/rooms.routes.ts | head -20

echo ""
echo "=== WebSocket游戏事件 ==="
grep -rnE "hand_update|state_changed|game_action|action_required|hand_finished|emit|broadcast" api-server/src/ --include="*.ts" | grep -v node_modules | grep -v __tests__ | head -20

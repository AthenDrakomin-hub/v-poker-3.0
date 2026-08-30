#!/bin/bash
cd /opt/texas-platform

echo "=== engine模块文件 ==="
ls -la api-server/src/lib/engine* 2>/dev/null
ls -la api-server/src/lib/engine/ 2>/dev/null

echo ""
echo "=== GameEngine接口定义 ==="
grep -rn "interface GameEngine\|type GameEngine" api-server/src/lib/ --include="*.ts" 2>/dev/null | head -5

echo ""
echo "=== 游戏引擎注册映射 ==="
grep -rn "texasEngine\|niuniuEngine\|jinhuaEngine\|sangongEngine\|tbnnEngine" api-server/src/lib/engine.ts 2>/dev/null | head -10
grep -rn "texasEngine\|niuniuEngine\|jinhuaEngine\|sangongEngine\|tbnnEngine" api-server/src/lib/engine/index.ts 2>/dev/null | head -10

echo ""
echo "=== createHand函数 ==="
grep -n "export function createHand\|export const createHand" api-server/src/lib/engine.ts 2>/dev/null | head -5
grep -n "export function createHand\|export const createHand" api-server/src/lib/engine/index.ts 2>/dev/null | head -5

echo ""
echo "=== 运行后端测试 ==="
cd /opt/texas-platform/api-server
npm test -- --testPathPattern="texas|niuniu|tbnn|jinhua|sangong" 2>&1 | tail -40

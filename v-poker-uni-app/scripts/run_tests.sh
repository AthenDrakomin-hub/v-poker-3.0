#!/bin/bash
cd /opt/texas-platform/api-server

echo "=== GameEngine接口完整定义 ==="
sed -n '181,220p' src/lib/games/common/types.ts

echo ""
echo "=== 运行所有游戏测试 ==="
npx vitest run src/__tests__/texas.test.ts src/__tests__/niuniu.test.ts src/__tests__/tbnn.test.ts src/__tests__/sangong.test.ts src/__tests__/jinhua.test.ts 2>&1 | tail -60

echo ""
echo "=== 运行结算守恒测试 ==="
npx vitest run src/__tests__/games/settlement-conservation.test.ts 2>&1 | tail -20

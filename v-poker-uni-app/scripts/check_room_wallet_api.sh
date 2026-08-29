#!/bin/bash
cd /opt/texas-platform

echo "=== 后端房间路由接口 ==="
grep -nE "router\.(get|post|put|delete)" api-server/src/routes/rooms.routes.ts | head -25

echo ""
echo "=== 后端钱包路由文件 ==="
ls -la api-server/src/routes/wallet* 2>/dev/null

echo ""
echo "=== 后端钱包路由接口 ==="
grep -nE "router\.(get|post|put|delete)" api-server/src/routes/wallet.routes.ts 2>/dev/null | head -15

echo ""
echo "=== 后端主路由注册 ==="
grep -nE "wallet|rooms|profile" api-server/src/index.ts 2>/dev/null | head -10
grep -nE "wallet|rooms|profile" api-server/src/app.ts 2>/dev/null | head -10

echo ""
echo "=== 前端wallet API文件 ==="
echo "检查前端api/wallet.js"

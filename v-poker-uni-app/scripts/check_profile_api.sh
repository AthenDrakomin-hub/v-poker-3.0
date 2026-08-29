#!/bin/bash
cd /opt/texas-platform

echo "=== 后端profile路由文件 ==="
ls -la api-server/src/routes/profile* 2>/dev/null

echo ""
echo "=== 后端profile路由接口 ==="
grep -nE "router\.(get|post|put|delete)" api-server/src/routes/profile.routes.ts 2>/dev/null | head -25

echo ""
echo "=== 后端auth路由中的修改密码 ==="
grep -nE "router\.(get|post|put|delete).*password|changePassword" api-server/src/routes/auth.routes.ts 2>/dev/null | head -10

echo ""
echo "=== 后端主路由注册 ==="
grep -nE "profile|auth" api-server/src/index.ts 2>/dev/null | head -10
grep -nE "profile|auth" api-server/src/app.ts 2>/dev/null | head -10
grep -nE "profile|auth" api-server/src/server.ts 2>/dev/null | head -10

echo ""
echo "=== 后端users表结构（头像、昵称、语音包字段） ==="
grep -nE "avatar|nickname|voice|phone" api-server/src/db/schema.ts 2>/dev/null | head -15
grep -nE "avatar|nickname|voice|phone" api-server/src/schema.ts 2>/dev/null | head -15

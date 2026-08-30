#!/bin/bash
cd /opt/texas-platform

echo "=== 后端钱包GET接口返回 ==="
sed -n '40,80p' api-server/src/routes/wallet.routes.ts

echo ""
echo "=== 后端钱包transactions接口返回 ==="
sed -n '222,280p' api-server/src/routes/wallet.routes.ts

echo ""
echo "=== 后端房间mine接口返回 ==="
sed -n '339,390p' api-server/src/routes/rooms.routes.ts

echo ""
echo "=== 后端房间joined接口返回 ==="
sed -n '495,540p' api-server/src/routes/rooms.routes.ts

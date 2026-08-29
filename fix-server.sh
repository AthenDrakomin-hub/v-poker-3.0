#!/bin/bash
echo "=== 1. api-server/.env 状态 ==="
ls -la /opt/texas-platform/api-server/.env 2>/dev/null || echo "不存在"

echo ""
echo "=== 2. 复制 .env 到 api-server 目录 ==="
if [ -f /opt/texas-platform/.env ] && [ ! -f /opt/texas-platform/api-server/.env ]; then
    cp /opt/texas-platform/.env /opt/texas-platform/api-server/.env
    echo "✅ 已复制 .env 到 api-server 目录"
else
    echo "ℹ️ .env 已存在或源文件不存在"
fi

echo ""
echo "=== 3. 数据库表 owner 检查 ==="
sudo -u postgres psql -d v_poker_3 -t -c "SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' ORDER BY tablename LIMIT 15;" 2>&1

echo ""
echo "=== 4. 修复数据库表权限 ==="
sudo -u postgres psql -d v_poker_3 -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO v_poker;" 2>&1
sudo -u postgres psql -d v_poker_3 -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO v_poker;" 2>&1
sudo -u postgres psql -d v_poker_3 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO v_poker;" 2>&1
sudo -u postgres psql -d v_poker_3 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO v_poker;" 2>&1
echo "✅ 数据库权限已修复"

echo ""
echo "=== 5. 验证 hand_states 表权限 ==="
sudo -u postgres psql -d v_poker_3 -c "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='hand_states' AND grantee='v_poker' LIMIT 5;" 2>&1

echo ""
echo "=== 6. H5 目录状态 ==="
echo "out 目录:"
ls -la /opt/texas-platform/out/ 2>/dev/null | head -5 || echo "不存在"
echo "hbuilder 目录:"
ls -la /opt/texas-platform/hbuilder/ 2>/dev/null || echo "不存在"
echo "h5 目录:"
ls -la /opt/texas-platform/h5/ 2>/dev/null || echo "不存在"

echo ""
echo "=== 7. 重启后端服务 ==="
pm2 reload v-poker-api 2>&1
sleep 2
pm2 status

echo ""
echo "=== 8. 后端健康检查 ==="
curl -s http://127.0.0.1:3001/api/health 2>&1 || curl -s http://127.0.0.1:3001/health 2>&1 || echo "健康检查失败"

echo ""
echo "=== 9. 后端最新日志（10行） ==="
pm2 logs v-poker-api --lines 10 --nostream 2>&1 | tail -15

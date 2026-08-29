#!/bin/bash
# Nginx配置检查和重载脚本
# 用法: ./scripts/reload-nginx.sh

set -e

echo "=== Nginx 配置检查和重载 ==="
echo ""

# 1. 测试配置语法
echo "1. 测试Nginx配置语法..."
nginx -t 2>&1 || {
    echo "❌ Nginx配置测试失败"
    exit 1
}
echo "✅ 配置语法正确"
echo ""

# 2. 重载Nginx
echo "2. 重载Nginx服务..."
systemctl reload nginx 2>&1 || {
    echo "❌ Nginx重载失败"
    exit 1
}
echo "✅ Nginx重载成功"
echo ""

# 3. 检查服务状态
echo "3. 检查Nginx状态..."
systemctl is-active nginx && echo "✅ Nginx服务运行中" || echo "❌ Nginx服务未运行"
echo ""

echo "=== 完成 ==="

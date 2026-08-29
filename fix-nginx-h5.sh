#!/bin/bash
echo "=== 1. 创建 H5 目录 ==="
mkdir -p /opt/texas-platform/h5
echo "✅ H5 目录已创建"

echo ""
echo "=== 2. 创建临时维护页面 ==="
cat > /opt/texas-platform/h5/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V-Poker 部署中</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container {
            text-align: center;
            padding: 40px;
        }
        .logo {
            font-size: 48px;
            font-weight: bold;
            color: #ffd700;
            margin-bottom: 20px;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }
        .status {
            font-size: 24px;
            margin-bottom: 10px;
            color: #4ade80;
        }
        .desc {
            font-size: 16px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .api-status {
            display: inline-block;
            padding: 10px 20px;
            background: rgba(74, 222, 128, 0.1);
            border: 1px solid rgba(74, 222, 128, 0.3);
            border-radius: 8px;
            font-size: 14px;
            color: #4ade80;
        }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #ffd700;
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
            vertical-align: middle;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">V-Poker 3.0</div>
        <div class="status"><span class="spinner"></span>后端服务已启动</div>
        <div class="desc">
            后端 API 服务已部署完成<br>
            H5 前端页面正在打包上传中...<br>
            请使用 iOS App 访问，或等待 H5 部署完成
        </div>
        <div class="api-status">API 状态: 正常运行 (https://goodspage.cn/api/health)</div>
    </div>
</body>
</html>
HTMLEOF
echo "✅ 临时页面已创建"

echo ""
echo "=== 3. 备份原 Nginx 配置 ==="
cp /etc/nginx/sites-enabled/poker /etc/nginx/sites-enabled/poker.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 已备份"

echo ""
echo "=== 4. 修改 Nginx 配置（root 指向 h5 目录） ==="
sed -i 's|root /opt/texas-platform/out;|root /opt/texas-platform/h5;|' /etc/nginx/sites-enabled/poker
echo "✅ Nginx root 已修改为 /opt/texas-platform/h5"

echo ""
echo "=== 5. 测试 Nginx 配置 ==="
nginx -t 2>&1

echo ""
echo "=== 6. 重载 Nginx ==="
systemctl reload nginx
echo "✅ Nginx 已重载"

echo ""
echo "=== 7. 验证外网访问 ==="
curl -s -o /dev/null -w 'HTTP状态: %{http_code}\n' https://goodspage.cn/
curl -s https://goodspage.cn/ | grep -o '<title>[^<]*</title>'
echo ""
echo "API 健康检查:"
curl -s https://goodspage.cn/api/health

echo ""
echo "=== 8. 后端服务状态 ==="
pm2 status

/**
 * 前后端 API 对齐审计脚本
 * 提取前端所有 API 调用和后端所有路由定义，对比找出差异
 */
const fs = require('fs');
const path = require('path');

const FE_API_DIR = path.join(__dirname, '..', '..', 'v-poker-uni-app', 'api');
const BE_ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');

// 后端路由挂载前缀
const ROUTE_MOUNTS = {
  'misc.routes.ts': '/api',
  'games.routes.ts': '/api/games',
  'app.routes.ts': '/api/app',
  'auth.routes.ts': '/api/auth',
  'admin.routes.ts': '/api/admin',
  'economyV2.routes.ts': '/api/admin/economy-v2',
  'agent.routes.ts': '/api/agent',
  'profile.routes.ts': '/api/profile',
  'rooms.routes.ts': '/api/rooms',
  'bot.routes.ts': '/api/bot',
  'assets.routes.ts': '/api/assets',
  'wallet.routes.ts': '/api/wallet',
  'messages.routes.ts': '/api/messages',
};

// 提取前端 API 调用
function extractFrontendAPIs() {
  const apis = [];
  const files = fs.readdirSync(FE_API_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(FE_API_DIR, file), 'utf-8');
    // 匹配 get('/api/...') 或 post('/api/...') 等
    const regex = /\b(get|post|put|patch|delete)\(\s*['"`](\/api\/[^'"`?]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      apis.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: file,
      });
    }
  }
  return apis;
}

// 提取后端路由
function extractBackendRoutes() {
  const routes = [];
  for (const [file, prefix] of Object.entries(ROUTE_MOUNTS)) {
    const filePath = path.join(BE_ROUTES_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    // 匹配 router.get('/path', ...) 或 router.post('/path', ...)
    const regex = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      let routePath = match[2];
      // 处理参数 :id → ${id} 格式统一
      routePath = routePath.replace(/:([a-zA-Z_]+)/g, '${$1}');
      routes.push({
        method: match[1].toUpperCase(),
        path: prefix + routePath,
        file: file,
      });
    }
  }
  return routes;
}

// 规范化路径用于比较（忽略参数名差异）
function normalizePath(p) {
  return p.replace(/\$\{[^}]+\}/g, ':param').replace(/\/$/, '');
}

function main() {
  const feApis = extractFrontendAPIs();
  const beRoutes = extractBackendRoutes();

  // 去重
  const feUnique = new Map();
  for (const api of feApis) {
    const key = `${api.method} ${normalizePath(api.path)}`;
    if (!feUnique.has(key)) feUnique.set(key, api);
  }

  const beUnique = new Map();
  for (const route of beRoutes) {
    const key = `${route.method} ${normalizePath(route.path)}`;
    if (!beUnique.has(key)) beUnique.set(key, route);
  }

  console.log('========================================');
  console.log('  前后端 API 对齐审计报告');
  console.log('========================================');
  console.log(`前端 API 调用（去重后）: ${feUnique.size}`);
  console.log(`后端路由定义（去重后）: ${beUnique.size}`);
  console.log('');

  // 前端调用了但后端没有的
  console.log('=== 前端调用但后端缺失的 API ===');
  let missingCount = 0;
  for (const [key, api] of feUnique) {
    if (!beUnique.has(key)) {
      // 尝试模糊匹配（同路径不同方法）
      const pathOnly = key.split(' ')[1];
      const fuzzy = [...beUnique.keys()].filter(k => k.split(' ')[1] === pathOnly);
      const fuzzyNote = fuzzy.length > 0 ? `  [后端有: ${fuzzy.join(', ')}]` : '';
      console.log(`  ${api.method} ${api.path}  (${api.file})${fuzzyNote}`);
      missingCount++;
    }
  }
  if (missingCount === 0) console.log('  无');
  console.log(`  合计: ${missingCount}`);
  console.log('');

  // 后端有但前端没调用的
  console.log('=== 后端存在但前端未调用的 API（可能是旧接口/管理端专用） ===');
  let unusedCount = 0;
  for (const [key, route] of beUnique) {
    if (!feUnique.has(key)) {
      console.log(`  ${route.method} ${route.path}  (${route.file})`);
      unusedCount++;
    }
  }
  if (unusedCount === 0) console.log('  无');
  console.log(`  合计: ${unusedCount}`);
  console.log('');

  // 对齐的
  const matched = [...feUnique.keys()].filter(k => beUnique.has(k));
  console.log(`=== 前后端对齐的 API: ${matched.length} 个 ===`);
  console.log('');

  console.log('========================================');
  console.log('  总结');
  console.log('========================================');
  console.log(`对齐: ${matched.length}`);
  console.log(`前端缺失后端: ${missingCount}`);
  console.log(`后端未被前端调用: ${unusedCount}`);
}

main();

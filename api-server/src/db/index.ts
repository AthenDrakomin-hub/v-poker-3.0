import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * 懒初始化数据库连接池。
 * - 模块加载时不报错（避免构建时无 DATABASE_URL 失败）
 * - 首次使用时才创建连接，并缓存到 globalThis（开发热重载不重建）
 */
const globalForDb = globalThis as typeof globalThis & {
  __vpokerPool?: Pool;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required\n" +
      "请复制 .env.example → .env 并填入实际 PostgreSQL 连接串。"
    );
  }
  const poolMax = parseInt(process.env.DB_POOL_MAX || "30", 10);
  return new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const pool: Pool =
  globalForDb.__vpokerPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__vpokerPool = pool;
}

export const db = drizzle(pool);

// ── 优雅关闭 ────────────────────────────────────────────────────────────────
// 注意：PM2 重启时会发 SIGTERM。如果主动 pool.end() 但进程未立即退出，
// 后续在途请求会报 "Cannot use a pool after calling end on the pool"。
// 生产环境交由进程退出自动清理，开发环境保留便于热重载调试。
function setupGracefulShutdown() {
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] Received ${signal}, exiting...`);
    // 给在途请求 2 秒完成，然后强制退出
    setTimeout(() => process.exit(0), 2000);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (process.env.NODE_ENV !== "test") {
  setupGracefulShutdown();
}

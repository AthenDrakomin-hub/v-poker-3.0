import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle ORM 配置
 * - schema: 数据库表结构定义
 * - out: 迁移文件输出目录（与现有手动迁移共存）
 * - dialect: PostgreSQL
 * - dbCredentials: 从环境变量 DATABASE_URL 读取
 *
 * 常用命令：
 *   npm run db:generate   — 对比 schema.ts 生成迁移 SQL（不执行）
 *   npm run db:push       — 直接将 schema.ts 同步到数据库（开发用）
 *   npm run db:migrate    — 执行 migrations/ 目录下的迁移文件
 *   npm run db:studio     — 启动 Drizzle Studio 可视化管理
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/vpoker",
  },
  // 严格模式：生成迁移时需要确认破坏性操作
  strict: true,
  // 详细输出
  verbose: true,
});

/**
 * 数据库兼容层（已废弃）
 *
 * 历史背景：
 * 本模块曾在应用启动时通过 ALTER TABLE 动态添加 GENERATED 别名列
 * （username / password_hash / display_name / avatar_path / credit_score /
 * parent_agent_id / agent_tier / deduction_failed）和 pending_fee 字段，
 * 用于兼容旧版客户端的字段命名。
 *
 * 现状（2026-08-22 重构）：
 * - 所有字段已在 db/schema.ts 中明确定义（含 pending_fee）
 * - 金额字段统一使用 numeric 自定义类型（amount），与生产 DB 一致
 * - GENERATED 别名列的清理已纳入迁移脚本 004_db_foundation.sql（PART 4）
 * - 数据库结构变更统一通过 migrations/ 目录下的 SQL 脚本管理
 *
 * 本模块保留空实现，仅为兼容现有调用方（auth.routes.ts / misc.routes.ts），
 * 不再执行任何 ALTER TABLE 操作。后续可安全移除调用方和本文件。
 */

let warned = false;

export async function ensureCompatColumns(): Promise<void> {
  if (!warned) {
    warned = true;
    console.log(
      "[compat] ensureCompatColumns 已废弃，数据库结构由 migrations/004_db_foundation.sql 管理"
    );
  }
  // 空操作：不再执行运行时 ALTER TABLE
}

import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * 系统APP配置（非经济模型）
 * APP版本、下载链接等通用配置仍存放在 system_config 表
 */

/** 读取配置值（字符串），不存在则返回默认值 */
export async function getConfig(key: string): Promise<string> {
  const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  if (rows.length) return rows[0].value;
  return "";
}

/** 读取所有APP配置 */
export async function getAllAppConfig(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemConfig);
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value;
  return result;
}

/** 设置配置值（管理员用） */
export async function setConfig(key: string, value: string): Promise<void> {
  const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  if (existing.length) {
    await db.update(systemConfig).set({ value, updatedAt: new Date() }).where(eq(systemConfig.key, key));
  } else {
    await db.insert(systemConfig).values({ key, value });
  }
}

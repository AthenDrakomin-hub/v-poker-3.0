import { db } from "@/db";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

/**
 * 平台唯一内置账号：超级管理员。
 * 其余所有账号（客服 / 代理 / 玩家）均由管理员在后台创建。
 * 任何时候 admin 缺失都会自动补建，避免数据库清空后无法登录。
 */
export const SEED_ACCOUNTS: {
  account: string;
  password: string;
  role: string;
  inviteCode: string;
  invitedByCode: string | null;
  nickname: string;
}[] = [
  {
    account: "admin",
    password: "admin888",
    role: "admin",
    inviteCode: "VPOKER01",
    invitedByCode: null,
    nickname: "超级管理员",
  },
];

export async function ensureSeed() {
  try {
    const accounts = SEED_ACCOUNTS.map((a) => a.account);
    const existing = await db
      .select({ account: users.account })
      .from(users)
      .where(inArray(users.account, accounts));
    const have = new Set(existing.map((e) => e.account));

    const missing = SEED_ACCOUNTS.filter((a) => !have.has(a.account));
    if (!missing.length) return;

    for (const a of missing) {
      await db
        .insert(users)
        .values({
          account: a.account,
          password: hashPassword(a.password),
          securityCode: "8888",
          role: a.role,
          nickname: a.nickname,
          avatar: "1",
          inviteCode: a.inviteCode,
          invitedByCode: a.invitedByCode,
          points: 0,
          mustChangePassword: true, // 默认账号首次登录强制改密
        })
        .onConflictDoNothing();
    }
  } catch {
    // 初始化失败不阻塞登录流程
  }
}

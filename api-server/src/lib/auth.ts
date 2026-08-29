import type { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users, devices } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const rawSecret = process.env.SESSION_SECRET;

if (!rawSecret) {
  console.error(
    "[FATAL] SESSION_SECRET 未设置。请复制 .env.example → .env 并生成随机密钥"
  );
  process.exit(1);
}

const SECRET: string = rawSecret;
const COOKIE = "vpoker_session";
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

export interface SessionUser {
  id: number;
  account: string;
  role: string;
  mustChangePassword?: boolean;
}

// ── 密码哈希 ─────────────────────────────────────────────────────────────────

function isLegacyHmacHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  pw: string,
  storedHash: string,
  userId: number
): Promise<{ ok: boolean; needsMigration: boolean }> {
  if (isLegacyHmacHash(storedHash)) {
    const hmacHash = crypto
      .createHmac("sha256", SECRET)
      .update("pw:" + pw)
      .digest("hex");
    const ok = hmacHash === storedHash;
    if (ok) {
      const newHash = bcrypt.hashSync(pw, BCRYPT_ROUNDS);
      try {
        await db.update(users).set({ password: newHash }).where(eq(users.id, userId));
      } catch {
        // ignore
      }
    }
    return { ok, needsMigration: true };
  }
  const ok = await bcrypt.compare(pw, storedHash);
  return { ok, needsMigration: false };
}

/** 不触发数据库迁移的纯密码校验（用于房间密码等场景） */
export async function verifyPasswordNoMigrate(pw: string, storedHash: string): Promise<boolean> {
  if (isLegacyHmacHash(storedHash)) {
    const hmacHash = crypto
      .createHmac("sha256", SECRET)
      .update("pw:" + pw)
      .digest("hex");
    return hmacHash === storedHash;
  }
  return bcrypt.compare(pw, storedHash);
}

// ── Token ───────────────────────────────────────────────────────────────────

export function makeToken(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): SessionUser | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser;
  } catch {
    return null;
  }
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

// ── Cookie 会话（Express 适配）──────────────────────────────────────────────

export function setSession(res: Response, user: SessionUser) {
  res.cookie(COOKIE, makeToken(user), {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7 * 1000,
  });
}

export function clearSession(res: Response) {
  res.cookie(COOKIE, "", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

// ── 获取当前用户（Express 适配）─────────────────────────────────────────────

export async function getCurrentUser(
  req: Request
): Promise<(typeof users.$inferSelect) & { mustChangePassword?: boolean } | null> {
  const s = getSession(req);
  if (!s) return null;
  // 设备验证：如果请求携带x-device-id，检查该设备是否仍关联
  const deviceId = req.headers["x-device-id"];
  if (deviceId && typeof deviceId === "string" && deviceId.trim()) {
    const devRows = await db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, s.id), eq(devices.deviceId, deviceId.trim())))
      .limit(1);
    if (devRows.length === 0) {
      // 设备已被解除，返回null强制下线
      return null;
    }
    // 更新设备最后活跃时间
    await db.update(devices).set({ lastActiveAt: new Date() }).where(eq(devices.id, devRows[0].id));
  }
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, s.id))
    .limit(1);
  return rows[0] ?? null;
}

export function getSession(req: Request): SessionUser | null {
  try {
    const auth = req.headers["authorization"] || req.headers["x-vpoker-token"];
    if (auth) {
      const raw = typeof auth === "string" && auth.startsWith("Bearer ")
        ? auth.slice(7)
        : String(auth);
      const u = verifyToken(raw.trim());
      if (u) return u;
    }
    const cookieToken = req.cookies?.[COOKIE];
    if (cookieToken) {
      return verifyToken(String(cookieToken));
    }
    return null;
  } catch {
    return null;
  }
}

// ── 工具函数 ────────────────────────────────────────────────────────────────

export function genInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function genRoomNo(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

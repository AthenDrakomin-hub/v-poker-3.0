import type { Request, Response, NextFunction } from "express";

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();
const WINDOW_MS = 60_000;
const DEFAULT_MAX = 20;

function getLimit(path: string): number {
  if (
    path.includes("/auth/login") ||
    path.includes("/auth/register") ||
    path.includes("/profile/password")
  ) {
    return 5;
  }
  return DEFAULT_MAX;
}

export function checkRateLimit(ip: string, path: string): {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
} {
  const limit = getLimit(path);
  const now = Date.now();
  const key = `${ip}:${path}`;

  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, remaining: limit - entry.count, retryAfter: 0 };
}

export function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

setInterval(cleanupExpired, 30_000);

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || "unknown";
}

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ip = getClientIp(req);
  const path = req.path;
  const { allowed, remaining, retryAfter } = checkRateLimit(ip, path);
  if (!allowed) {
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: `请求过于频繁，请 ${retryAfter} 秒后重试` });
    return;
  }
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  next();
}

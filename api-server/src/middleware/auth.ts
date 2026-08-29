import type { Request, Response, NextFunction } from "express";
import { getSession } from "@/lib/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    account: string;
    role: string;
    mustChangePassword?: boolean;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  req.user = session;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    if (!roles.includes(session.role)) {
      res.status(403).json({ error: "无权限" });
      return;
    }
    req.user = session;
    next();
  };
}

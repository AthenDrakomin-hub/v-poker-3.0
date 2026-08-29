import type { Request } from "express";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { eventLogs, loginLogs, riskTags, approvalRequests } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

const LOG_FILE = path.join(process.cwd(), "audit.log");

export interface AuditEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  event: string;
  userId?: number;
  account?: string;
  ip?: string;
  device?: string;
  detail?: string;
  // 新增字段
  operatorId?: number;
  operatorAccount?: string;
  targetId?: number;
  targetType?: string;
  beforeValue?: Record<string, any>;
  afterValue?: Record<string, any>;
  reason?: string;
  requestId?: string;
}

function formatEntry(e: AuditEntry): string {
  return JSON.stringify({
    ts: e.timestamp,
    level: e.level,
    event: e.event,
    userId: e.userId,
    account: e.account,
    ip: e.ip,
    device: e.device,
    detail: e.detail,
    operatorId: e.operatorId,
    operatorAccount: e.operatorAccount,
    targetId: e.targetId,
    targetType: e.targetType,
    beforeValue: e.beforeValue,
    afterValue: e.afterValue,
    reason: e.reason,
    requestId: e.requestId,
  });
}

function writeLog(entry: AuditEntry) {
  const line = formatEntry(entry) + "\n";
  if (entry.level === "ERROR" || entry.level === "WARN") {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }
  try {
    fs.appendFile(LOG_FILE, line, () => {});
  } catch {
    // ignore
  }
}

// 异步写入数据库（不阻塞响应）
async function writeAuditToDb(entry: AuditEntry) {
  try {
    await db.insert(eventLogs).values({
      eventType: entry.event,
      payload: {
        userId: entry.userId,
        account: entry.account,
        ip: entry.ip,
        device: entry.device,
        detail: entry.detail,
        operatorId: entry.operatorId,
        operatorAccount: entry.operatorAccount,
        targetId: entry.targetId,
        targetType: entry.targetType,
        beforeValue: entry.beforeValue,
        afterValue: entry.afterValue,
        reason: entry.reason,
        requestId: entry.requestId,
      },
    });
  } catch (e) {
    console.error("[audit] Failed to write to DB:", e);
  }
}

export const audit = {
  info(event: string, opts?: Pick<AuditEntry, 
    "userId" | "account" | "ip" | "device" | "detail" | 
    "operatorId" | "operatorAccount" | "targetId" | "targetType" |
    "beforeValue" | "afterValue" | "reason" | "requestId">) {
    const entry: AuditEntry = { 
      timestamp: new Date().toISOString(), 
      level: "INFO", 
      event, 
      ...opts 
    };
    writeLog(entry);
    writeAuditToDb(entry);
  },
  warn(event: string, opts?: Pick<AuditEntry, 
    "userId" | "account" | "ip" | "device" | "detail" |
    "operatorId" | "operatorAccount" | "targetId" | "targetType" |
    "beforeValue" | "afterValue" | "reason" | "requestId">) {
    const entry: AuditEntry = { 
      timestamp: new Date().toISOString(), 
      level: "WARN", 
      event, 
      ...opts 
    };
    writeLog(entry);
    writeAuditToDb(entry);
  },
  error(event: string, opts?: Pick<AuditEntry, 
    "userId" | "account" | "ip" | "device" | "detail" |
    "operatorId" | "operatorAccount" | "targetId" | "targetType" |
    "beforeValue" | "afterValue" | "reason" | "requestId">) {
    const entry: AuditEntry = { 
      timestamp: new Date().toISOString(), 
      level: "ERROR", 
      event, 
      ...opts 
    };
    writeLog(entry);
    writeAuditToDb(entry);
  },
};

export function getRequestIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || "unknown";
}

export function getRequestDevice(req: Request): string {
  const ua = req.headers["user-agent"] || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  return "Other";
}

export function getRequestId(req: Request): string {
  return req.headers["x-request-id"] as string || 
         req.headers["x-id"] as string || 
         `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// 登录日志记录
export async function logLogin(userId: number, ip: string, device: string, success: boolean, failReason?: string, userAgent?: string) {
  try {
    await db.insert(loginLogs).values({
      userId,
      ip,
      device,
      platform: device,
      userAgent,
      success,
      failReason,
    });
  } catch (e) {
    console.error("[audit] Failed to log login:", e);
  }
}

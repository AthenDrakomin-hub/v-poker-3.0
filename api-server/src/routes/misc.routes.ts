import { Router, Request, Response } from "express";
import { db } from "@/db";
import { rooms, gameRounds, roomMessages, handStates } from "@/db/schema";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed, SEED_ACCOUNTS } from "@/lib/ensureSeed";
import { ensureCompatColumns } from "@/lib/compat";
import { audit } from "@/lib/audit";
import { getConfig } from "@/lib/config";

const router = Router();

// GET /api/health
router.get("/health", async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`select 1`);
    await ensureCompatColumns();
    await ensureSeed();
    audit.info("health_check", { detail: "ok" });
    res.json({ ok: true });
  } catch (e) {
    audit.error("health_check_failed", { detail: String(e) });
    res.status(500).json({ ok: false });
  }
});

// GET /api/app-download（公开，返回APP下载链接）
// 优先从外部分发接口获取，失败则使用系统配置中的默认链接
let cachedDownloadUrl: string | null = null;
let cachedDownloadTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 缓存5分钟

router.get("/app-download", async (_req: Request, res: Response) => {
  // 直接使用固定的APP下载链接
  const downloadUrl = await getConfig("app_download_url");
  res.json({ url: downloadUrl || "https://nktjz.peiioh.cn:1443/api/c/rzhxgeen" });
});

// GET /api/seed
router.get("/seed", async (_req: Request, res: Response) => {
  await ensureSeed();
  res.json({
    ok: true,
    accounts: SEED_ACCOUNTS.map((a) => ({
      account: a.account,
      // 不再返回明文密码，仅展示角色和邀请码
      role: a.role,
      inviteCode: a.inviteCode,
    })),
  });
});

// POST /api/seed
router.post("/seed", async (_req: Request, res: Response) => {
  await ensureSeed();
  res.json({
    ok: true,
    accounts: SEED_ACCOUNTS.map((a) => ({
      account: a.account,
      role: a.role,
      inviteCode: a.inviteCode,
    })),
  });
});

// GET /api/history/cleanup
router.get("/history/cleanup", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可查看" });
    return;
  }
  const [roomStat] = await db
    .select({ total: sql<number>`count(*)`, archived: sql<number>`count(archived_at)` })
    .from(rooms);
  const [msgStat] = await db.select({ total: sql<number>`count(*)` }).from(roomMessages);
  const [roundStat] = await db.select({ total: sql<number>`count(*)` }).from(gameRounds);
  res.json({
    rooms: Number(roomStat?.total ?? 0),
    archivedRooms: Number(roomStat?.archived ?? 0),
    messages: Number(msgStat?.total ?? 0),
    rounds: Number(roundStat?.total ?? 0),
  });
});

// POST /api/history/cleanup
router.post("/history/cleanup", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  if (u.role !== "admin") {
    res.status(403).json({ error: "仅管理员可执行清理" });
    return;
  }
  const body = req.body || {};
  const messageDays = Math.max(1, Number(body?.messageDays) || 3);
  const keepRounds = Math.max(10, Number(body?.keepRounds) || 25);
  const result = { archivedRooms: 0, clearedHandStates: 0, deletedMessages: 0, trimmedRounds: 0 };

  const finished = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.settled, true), isNull(rooms.archivedAt)));
  if (finished.length) {
    const ids = finished.map((r) => r.id);
    await db.update(rooms).set({ archivedAt: new Date() }).where(inArray(rooms.id, ids));
    result.archivedRooms = ids.length;
    const hs = await db.delete(handStates).where(inArray(handStates.roomId, ids)).returning({ roomId: handStates.roomId });
    result.clearedHandStates = hs.length;
  }

  const cutoff = new Date(Date.now() - messageDays * 86400_000);
  const delMsg = await db.delete(roomMessages).where(lt(roomMessages.createdAt, cutoff)).returning({ id: roomMessages.id });
  result.deletedMessages = delMsg.length;

  const trimmed = await db.execute(sql`
    DELETE FROM game_rounds gr
    WHERE gr.id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY room_id, COALESCE(room_no, '') ORDER BY round_no DESC
        ) AS rn
        FROM game_rounds
      ) t WHERE t.rn <= ${keepRounds}
    )
  `);
  result.trimmedRounds = (trimmed as unknown as { rowCount?: number }).rowCount ?? 0;

  res.json({ ok: true, ...result });
});

export default router;

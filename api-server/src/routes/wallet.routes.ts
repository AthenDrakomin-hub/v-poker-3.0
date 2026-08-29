/**
 * Wallet / Vault routes
 * Shared ledger with room buyin/cashout (chip_transactions table)
 *
 * Endpoints:
 *   GET  /api/wallet               Wallet overview
 *   POST /api/wallet/vault-transfer  Vault transfer (idempotent)
 *   GET  /api/wallet/transactions  Transaction history
 */
import { Router, Request, Response } from "express";
import { db } from "@/db";
import { users, chipTransactions } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const router = Router();

// Transaction type -> human-readable remark
const TYPE_REMARKS: Record<string, string> = {
  vault_deposit: "Deposit to vault",
  vault_withdraw: "Withdraw from vault",
  room_buyin: "Room buy-in",
  room_settlement: "Room settlement",
  agent_gift_in: "Agent grant in",
  agent_gift_out: "Agent grant out",
  activity_reward: "Activity reward",
  agent_grant: "Agent grant",
  rake: "Platform rake",
  agent_add: "Agent add points",
  agent_sub: "Agent subtract points",
  buyin: "Buy-in",
  cashout: "Cash-out",
  room_gift: "Room gift",
  room_rake: "Room rake rebate",
};

// ============================================================
// GET /api/wallet - Wallet overview
// ============================================================
router.get("/", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const row = await db
      .select({
        points: users.points,
        vaultPoints: users.vaultPoints,
      })
      .from(users)
      .where(eq(users.id, u.id))
      .limit(1);

    if (row.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const availablePoints = Number(row[0].points) || 0;
    const vaultPoints = Number(row[0].vaultPoints) || 0;

    res.json({
      availablePoints,
      vaultPoints,
      totalPoints: availablePoints + vaultPoints,
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[Wallet] get wallet failed", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ============================================================
// POST /api/wallet/vault-transfer - Vault transfer
// body: { direction: "deposit" | "withdraw", amount: number, requestId: string }
// ============================================================
router.post("/vault-transfer", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { direction, amount, requestId } = req.body || {};

    if (direction !== "deposit" && direction !== "withdraw") {
      res.status(400).json({ error: "direction must be deposit or withdraw" });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isInteger(amt)) {
      res.status(400).json({ error: "amount must be a positive integer" });
      return;
    }
    if (!requestId || typeof requestId !== "string" || requestId.length > 64) {
      res.status(400).json({ error: "requestId is missing or invalid" });
      return;
    }

    const txType = direction === "deposit" ? "vault_deposit" : "vault_withdraw";
    const remark = TYPE_REMARKS[txType];

    // Idempotency check: same requestId already processed
    const existing = await db
      .select()
      .from(chipTransactions)
      .where(eq(chipTransactions.requestId, requestId))
      .limit(1);
    if (existing.length > 0) {
      const ex = existing[0];
      res.json({
        ok: true,
        idempotent: true,
        availablePoints: Number(ex.balanceAfter) || 0,
        vaultPoints: Number(ex.vaultBalanceAfter) || 0,
        transaction: {
          id: ex.id,
          type: ex.type,
          amount: Number(ex.amount) || 0,
          createdAt: ex.createdAt,
        },
      });
      return;
    }

    // Single transaction: update balances + insert transaction record
    const result = await db.transaction(async (tx) => {
      // Lock user row
      const locked = await tx
        .select({
          id: users.id,
          points: users.points,
          vaultPoints: users.vaultPoints,
        })
        .from(users)
        .where(eq(users.id, u.id))
        .limit(1)
        .for("update");

      if (locked.length === 0) {
        throw new Error("User not found");
      }

      const currentPoints = Number(locked[0].points) || 0;
      const currentVault = Number(locked[0].vaultPoints) || 0;

      let nextPoints: number;
      let nextVault: number;

      if (direction === "deposit") {
        if (amt > currentPoints) {
          throw new Error("Insufficient available points");
        }
        nextPoints = currentPoints - amt;
        nextVault = currentVault + amt;
      } else {
        if (amt > currentVault) {
          throw new Error("Insufficient vault balance");
        }
        nextPoints = currentPoints + amt;
        nextVault = currentVault - amt;
      }

      // Update user balances
      await tx
        .update(users)
        .set({ points: nextPoints, vaultPoints: nextVault })
        .where(eq(users.id, u.id));

      // Insert transaction record (amount is always positive, direction in type)
      const inserted = await tx
        .insert(chipTransactions)
        .values({
          userId: u.id,
          operatorId: u.id,
          amount: amt,
          balanceAfter: nextPoints,
          vaultBalanceAfter: nextVault,
          type: txType,
          note: remark,
          requestId,
        })
        .returning();

      return {
        availablePoints: nextPoints,
        vaultPoints: nextVault,
        transaction: inserted[0],
      };
    });

    res.json({
      ok: true,
      availablePoints: result.availablePoints,
      vaultPoints: result.vaultPoints,
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: Number(result.transaction.amount) || 0,
        createdAt: result.transaction.createdAt,
      },
    });
  } catch (e: any) {
    console.error("[Wallet] vault transfer failed", e);
    const msg = e.message || "Operation failed";
    if (msg.includes("Insufficient") || msg.includes("must be") || msg.includes("missing")) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ============================================================
// GET /api/wallet/transactions - Transaction history
// query: page, pageSize, type
// ============================================================
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const u = await getCurrentUser(req);
    if (!u) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const typeFilter = req.query.type as string | undefined;

    const conditions = [eq(chipTransactions.userId, u.id)];
    if (typeFilter) {
      conditions.push(eq(chipTransactions.type, typeFilter));
    }

    // Total count
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(chipTransactions)
      .where(and(...conditions));
    const total = Number(countRow[0]?.count) || 0;

    // Paginated query
    const rows = await db
      .select()
      .from(chipTransactions)
      .where(and(...conditions))
      .orderBy(desc(chipTransactions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const items = rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount) || 0,
      availableBalance: Number(r.balanceAfter) || 0,
      vaultBalance: r.vaultBalanceAfter != null ? Number(r.vaultBalanceAfter) : undefined,
      remark: r.note || TYPE_REMARKS[r.type] || r.type,
      roomId: r.roomId,
      createdAt: r.createdAt,
    }));

    res.json({ items, total, page, pageSize });
  } catch (e: any) {
    console.error("[Wallet] get transactions failed", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default router;


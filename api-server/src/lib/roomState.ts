import { db } from "@/db";
import { handStates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HandState } from "./hand";
import { getSpec } from "./engine";

/**
 * 加载房间牌局状态
 * @param roomId 房间ID
 * @param opts.tx 可选事务实例，传入则在事务内查询
 * @param opts.forUpdate 是否使用 SELECT FOR UPDATE 行锁（必须在事务内使用）
 */
export async function loadState(
  roomId: number,
  opts?: { tx?: any; forUpdate?: boolean }
): Promise<HandState | null> {
  const exec = opts?.tx ?? db;
  let query = exec.select().from(handStates).where(eq(handStates.roomId, roomId));
  if (opts?.forUpdate) {
    query = query.for("update");
  }
  const rows = await query.limit(1);
  if (!rows.length) return null;
  const st = rows[0].state as HandState;
  // 修复：从数据库加载后重新设置 spec（包含函数，JSON序列化会丢失）
  if (!st.spec || !st.spec.canSeeCards) {
    try {
      st.spec = getSpec(st.gameType);
    } catch (e) {
      // ignore
    }
  }
  return st;
}

/**
 * 保存房间牌局状态
 * @param tx 可选事务实例，传入则在事务内执行
 */
export async function saveState(roomId: number, st: HandState, tx?: any) {
  const exec = tx ?? db;
  const existing = await exec
    .select()
    .from(handStates)
    .where(eq(handStates.roomId, roomId))
    .limit(1);
  if (existing.length) {
    await exec
      .update(handStates)
      .set({ state: st, updatedAt: new Date() })
      .where(eq(handStates.roomId, roomId));
  } else {
    await exec.insert(handStates).values({ roomId, state: st });
  }
}

/**
 * 超时自动行动检查器
 *
 * 职责：定期扫描进行中的牌局，对超时玩家自动执行默认行动。
 * 原位于 rooms.routes.ts，抽取为独立服务模块以降低单文件复杂度。
 *
 * 分支：
 * - grab_result：抢庄结果展示3秒后自动进入下注阶段
 * - grab：抢庄阶段，遍历未掷骰子玩家自动掷骰
 * - dealt：亮牌阶段（niuniu/sangong/tbnn），遍历未开牌玩家自动开牌
 * - 普通 turn：根据游戏类型决定默认行动（check/call/fold/bet/confirm/reveal/prepare）
 *
 * 并发控制：
 * - processingRooms Set 防止同一房间被重复处理
 * - 普通 turn 分支使用事务 + SELECT FOR UPDATE 行锁，防止与玩家行动并发覆盖
 */
import { db } from "@/db";
import { handStates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HandState, applyAction } from "@/lib/hand";
import { commitHand } from "@/lib/settle";
import { broadcastStateChanged } from "@/socket/roomSocket";
import { loadState, saveState } from "@/lib/roomState";
import { processingRooms } from "@/lib/roomLock";
import { settleHand as tbnnSettleHand } from "@/lib/games/tbnn/engine";

// 超时配置
const TIMEOUT_MS = 30 * 1000; // 玩家操作超时30秒
const GRAB_RESULT_MS = 3 * 1000; // 抢庄结果展示3秒
const GRAB_TIE_MS = 2500; // 平局展示2.5秒后自动重掷
const CHECK_INTERVAL = 5 * 1000; // 每5秒检查一次

/**
 * 超时检查主函数：扫描所有进行中的牌局，对超时玩家自动行动
 */
async function autoTimeoutCheck() {
  try {
    const rows = await db.select().from(handStates);
    for (const row of rows) {
      const st = row.state as HandState;
      if (st.finished) continue;

      // grab_result阶段：展示3秒后自动进入下注
      if (st.phase === "grab_result") {
        if (Date.now() - (st.lastActionTime || 0) < GRAB_RESULT_MS) continue;
        if (processingRooms.has(row.roomId)) continue;
        processingRooms.add(row.roomId);
        try {
          const bi = st.bankerIdx ?? 0;
          st.seats.forEach((s) => (s.acted = false));
          st.phase = "betting";
          st.turn = (bi + 1) % st.seats.length;
          st.log.push("下注阶段：闲家请依次下注筹码（可多次点击累加）");
          st.lastActionTime = Date.now();
          await saveState(row.roomId, st);
          broadcastStateChanged(row.roomId);
        } catch (e) {
          console.error(`[grab_result] room ${row.roomId} error:`, e);
        } finally {
          processingRooms.delete(row.roomId);
        }
        continue;
      }

      // grab_tie阶段：平局展示2.5秒后，重置平局玩家骰子，回到grab阶段重掷
      if (st.phase === "grab_tie") {
        if (Date.now() - (st.lastActionTime || 0) < GRAB_TIE_MS) continue;
        if (processingRooms.has(row.roomId)) continue;
        processingRooms.add(row.roomId);
        try {
          const maxRoll = Math.max(...st.seats.map((s) => s.diceRoll ?? 0));
          const tiedIndices = st.seats
            .map((s, i) => ({ i, roll: s.diceRoll }))
            .filter((x) => x.roll === maxRoll)
            .map((x) => x.i);
          // 重置平局玩家的骰子，让他们重新掷
          tiedIndices.forEach((i) => {
            st.seats[i].diceRoll = null;
            st.seats[i].acted = false;
          });
          st.phase = "grab";
          st.turn = -1;
          st.lastActionTime = Date.now();
          st.log.push(`🔄 平局玩家重新掷骰`);
          await saveState(row.roomId, st);
          broadcastStateChanged(row.roomId);
        } catch (e) {
          console.error(`[grab_tie] room ${row.roomId} error:`, e);
        } finally {
          processingRooms.delete(row.roomId);
        }
        continue;
      }

      // grab阶段：遍历所有未掷骰子的玩家自动掷骰
      if (st.phase === "grab") {
        if (Date.now() - (st.lastActionTime || 0) < TIMEOUT_MS) continue;
        if (processingRooms.has(row.roomId)) continue;
        processingRooms.add(row.roomId);
        try {
          const nonRolled = st.seats.filter((s) => s.diceRoll === null);
          if (nonRolled.length > 0) {
            // 并行掷骰：遍历所有未掷骰玩家同时自动掷骰（而非轮流制）
            let anyRolled = false;
            for (const player of nonRolled) {
              const result = applyAction(st, player.userId, "roll");
              if (result.ok) {
                anyRolled = true;
                st.log.push(`⏱ ${player.account} 超时自动掷骰`);
              }
            }
            if (anyRolled) {
              st.lastActionTime = Date.now();
              await saveState(row.roomId, st);
              broadcastStateChanged(row.roomId);
            }
          }
        } catch (e) {
          console.error(`[grab timeout] room ${row.roomId} error:`, e);
        } finally {
          processingRooms.delete(row.roomId);
        }
        continue;
      }

      // dealt阶段（niuniu/sangong/tbnn）：遍历未开牌玩家自动开牌
      if (
        st.phase === "dealt" &&
        (st.gameType === "niuniu" || st.gameType === "sangong" || st.gameType === "tbnn")
      ) {
        if (Date.now() - (st.lastActionTime || 0) < TIMEOUT_MS) continue;
        if (processingRooms.has(row.roomId)) continue;
        processingRooms.add(row.roomId);
        try {
          const nonRevealed = st.seats.filter((s) => !s.acted && !s.folded);
          if (nonRevealed.length > 0) {
            // 并行开牌：遍历所有未开牌玩家同时自动开牌（而非轮流制）
            // niuniu/sangong 用 "confirm"，tbnn 用 "reveal"
            const revealAction = (st.gameType === "niuniu" || st.gameType === "sangong") ? "confirm" : "reveal";
            let anyRevealed = false;
            for (const player of nonRevealed) {
              const result = applyAction(st, player.userId, revealAction);
              if (result.ok) {
                anyRevealed = true;
                st.log.push(`⏱ ${player.account} 超时自动开牌`);
              }
            }
            if (anyRevealed) {
              st.lastActionTime = Date.now();
              await saveState(row.roomId, st);
              if (st.finished) {
                await commitHand(row.roomId, st);
              }
              broadcastStateChanged(row.roomId);
            }
          } else if (st.gameType === "tbnn" && !st.finished) {
            // tbnn 兜底：发牌后所有玩家 acted=true，若 scheduleTbnnSettlement 失败导致30秒未结算，直接强制结算
            console.log(`[tbnn兜底开牌] room=${row.roomId} 超时强制结算`);
            tbnnSettleHand(st);
            await saveState(row.roomId, st);
            await commitHand(row.roomId, st);
            broadcastStateChanged(row.roomId);
          }
        } catch (e) {
          console.error(`[dealt timeout] room ${row.roomId} error:`, e);
        } finally {
          processingRooms.delete(row.roomId);
        }
        continue;
      }

      // 普通 turn 分支
      if (st.turn < 0) continue;
      if (Date.now() - (st.lastActionTime || 0) < TIMEOUT_MS) continue;
      if (processingRooms.has(row.roomId)) continue;
      processingRooms.add(row.roomId);

      try {
        const txResult = await db.transaction(async (tx) => {
          const freshSt = await loadState(row.roomId, { tx, forUpdate: true });
          if (!freshSt || freshSt.finished) return { ok: false };
          if (freshSt.turn < 0) return { ok: false };
          if (Date.now() - (freshSt.lastActionTime || 0) < TIMEOUT_MS) return { ok: false };

          const currentSeat = freshSt.seats[freshSt.turn];
          if (!currentSeat) return { ok: false };

          let defaultAction = "fold";
          let defaultAmount: number | undefined;
          if (
            freshSt.gameType === "sangong" ||
            freshSt.gameType === "niuniu" ||
            freshSt.gameType === "tbnn"
          ) {
            if (freshSt.phase === "betting") {
              if (currentSeat.totalBet >= freshSt.baseBet) {
                defaultAction = "confirm_bet";
              } else {
                defaultAction = "bet";
                defaultAmount = freshSt.chips[0];
              }
            } else if (freshSt.phase === "dealt") {
              if (freshSt.gameType === "niuniu" || freshSt.gameType === "sangong") {
                defaultAction = "confirm";
              } else {
                defaultAction = "reveal";
              }
            }
          } else if (freshSt.gameType === "texas") {
            const toCall = Math.max(0, freshSt.currentBet - currentSeat.streetBet);
            if (toCall === 0) {
              defaultAction = "check";
            } else if (currentSeat.points >= toCall) {
              defaultAction = "call";
            } else {
              defaultAction = "fold";
            }
          } else if (freshSt.gameType === "jinhua") {
            const mult = currentSeat.looked ? 1 : 0.5;
            const callAmt = Math.max(1, Math.round(freshSt.currentBet * mult));
            defaultAction = currentSeat.points >= callAmt ? "call" : "fold";
          }

          const result = applyAction(freshSt, currentSeat.userId, defaultAction, defaultAmount);
          if (result.ok && defaultAction === "bet") {
            applyAction(freshSt, currentSeat.userId, "confirm_bet");
          }
          if (!result.ok) return { ok: false };

          const actionLabel =
            defaultAction === "fold" ? "弃牌" :
            defaultAction === "roll" ? "掷骰" :
            defaultAction === "confirm" ? "确认" :
            defaultAction === "check" ? "过牌" :
            defaultAction === "confirm_bet" ? "确认下注" :
            defaultAction === "reveal" ? "亮牌" :
            defaultAction === "prepare" ? "准备就绪" : "下注";
          freshSt.lastActionTime = Date.now();
          freshSt.log.push(`⏱ ${currentSeat.account} 超时自动${actionLabel}`);
          await saveState(row.roomId, freshSt, tx);
          return { ok: true, st: freshSt };
        });

        if (txResult.ok && txResult.st) {
          if (txResult.st.finished) {
            await commitHand(row.roomId, txResult.st);
          }
          broadcastStateChanged(row.roomId);
        }
      } catch (e) {
        console.error(`[timeout] room ${row.roomId} error:`, e);
      } finally {
        processingRooms.delete(row.roomId);
      }
    }
  } catch (e) {
    console.error("[timeout] check error:", e);
  }
}

/**
 * 启动超时检查器（在服务器启动时调用）
 */
export function startTimeoutChecker() {
  setInterval(autoTimeoutCheck, CHECK_INTERVAL);
  console.log("[V-POKER API] 超时自动行动已启动 (30秒)");
}

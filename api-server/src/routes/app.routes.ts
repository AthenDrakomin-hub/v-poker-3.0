import { Router } from "express";
import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { audit } from "../lib/audit";
import { getConfig } from "../lib/config";
import { getGameEconomy, getAllGameEconomies } from "../lib/gameEconomy";

const router = Router();

// 获取APP版本信息
router.get("/version", async (req, res) => {
  try {
    const [version, wgtUrl, force, changelog] = await Promise.all([
      getConfig("app_version"),
      getConfig("app_wgt_url"),
      getConfig("app_wgt_force"),
      getConfig("app_changelog"),
    ]);

    res.json({
      version: version || "1.0.0",
      wgtUrl: wgtUrl || null,
      forceUpdate: force === "1",
      changelog: changelog || "",
    });
  } catch (err: any) {
    console.error("获取APP版本失败:", err);
    res.status(500).json({ error: err.message });
  }
});

// APP错误上报接口
router.post("/error", async (req, res) => {
  try {
    const {
      platform,
      version,
      device,
      osVersion,
      errorType,
      errorMessage,
      stackTrace,
      page,
      timestamp,
      additional,
    } = req.body;

    console.error(`[APP ERROR] ${new Date().toISOString()}`, {
      platform,
      version,
      device,
      osVersion,
      errorType,
      errorMessage,
      stackTrace: stackTrace?.slice(0, 500),
      page,
      ip: req.ip,
    });

    // 记录到审计日志（只传detail字段）
    audit.warn("app_error", {
      detail: JSON.stringify({
        platform,
        version,
        device,
        errorType,
        errorMessage: errorMessage?.slice(0, 500),
        stackTrace: stackTrace?.slice(0, 1000),
        page,
      }),
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("处理错误上报失败:", err);
    res.status(500).json({ error: err.message });
  }
});

// 获取经济配置（公开接口，供前端计算使用）
// V2 重构：从 game_economy_config 读取，支持可选 gameType 参数
// 返回关键费率：抽水率、房费率、返佣率、抽水基数类型
router.get("/econ-rates", async (req, res) => {
  try {
    const gameType = (req.query.gameType as string) || "texas";
    const economy = getGameEconomy(gameType);

    const result = {
      chipRakeRate: economy.rakeRate,
      agentRebateRate: economy.agentRebateRate,
      topAgentRebateRate: economy.topAgentRebateRate,
      platformRate: economy.platformRate,
      rakeCap: economy.rakeCap,
      minRakePot: economy.minRakePot,
      rakeBaseType: economy.rakeBaseType,
      rakeBaseDesc: economy.rakeBaseDesc,
      gameType: economy.gameType,
      gameName: economy.gameName,
      // 返回所有游戏的配置摘要，供前端展示
      allGames: getAllGameEconomies().map((g) => ({
        gameType: g.gameType,
        gameName: g.gameName,
        rakeRate: g.rakeRate,
        rakeBaseType: g.rakeBaseType,
        rakeBaseDesc: g.rakeBaseDesc,
      })),
    };

    res.json(result);
  } catch (err: any) {
    console.error("获取经济配置失败:", err);
    // 返回默认值，避免影响前端功能
    res.json({
      chipRakeRate: 0.03,
      agentRebateRate: 0.01,
      topAgentRebateRate: 0.01,
      platformRate: 0.01,
      rakeCap: 0,
      minRakePot: 0,
      rakeBaseType: "pot",
      rakeBaseDesc: "",
      gameType: "texas",
      gameName: "德州扑克",
      allGames: [],
    });
  }
});

export const appRouter = router;

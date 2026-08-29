import { Router, Request, Response } from "express";
import { rules as texasRules } from "../lib/games/texas/rules";
import { rules as jinhuaRules } from "../lib/games/jinhua/rules";
import { rules as niuniuRules } from "../lib/games/niuniu/rules";
import { rules as tbnnRules } from "../lib/games/tbnn/rules";
import { rules as sangongRules } from "../lib/games/sangong/rules";

const router = Router();

// GET /api/games/rules - 获取所有游戏规则
router.get("/rules", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    rules: {
      texas: texasRules,
      jinhua: jinhuaRules,
      niuniu: niuniuRules,
      tbnn: tbnnRules,
      sangong: sangongRules,
    },
  });
});

// GET /api/games/rules/:gameType - 获取单个游戏规则
router.get("/rules/:gameType", (req: Request, res: Response) => {
  const gameType = req.params.gameType;
  const ruleMap: Record<string, any> = {
    texas: texasRules,
    jinhua: jinhuaRules,
    niuniu: niuniuRules,
    tbnn: tbnnRules,
    sangong: sangongRules,
  };
  const rule = ruleMap[gameType];
  
  if (!rule) {
    res.status(404).json({ error: "游戏类型不存在" });
    return;
  }
  
  res.json({ ok: true, rule });
});

export default router;

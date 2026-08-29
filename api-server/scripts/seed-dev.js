/**
 * 本地开发环境种子数据脚本
 * 执行：node scripts/seed-dev.js
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { db } from "../src/db/index.ts";
import { users, gameEconomyConfig, roomTemplateConfig, userPermissions } from "../src/db/schema.ts";

const GAMES = [
  { type: "texas", name: "德州扑克", rakeBase: "flow", rakeRate: 0.03 },
  { type: "jinhua", name: "炸金花", rakeBase: "pot", rakeRate: 0.03 },
  { type: "sangong", name: "抢庄三公", rakeBase: "pot", rakeRate: 0.03 },
  { type: "niuniu", name: "抢庄斗牛", rakeBase: "pot", rakeRate: 0.03 },
  { type: "tbnn", name: "通比牛牛", rakeBase: "pot", rakeRate: 0.03 },
];

const TEMPLATES = [
  { code: "junior", name: "初级场", min: 100, max: 1000, baseBet: 10, chips: [10, 25, 50, 100], cap: 0, order: 1 },
  { code: "senior", name: "高级场", min: 1000, max: 10000, baseBet: 50, chips: [50, 100, 250, 500], cap: 0, order: 2 },
  { code: "top", name: "顶级场", min: 10000, max: 100000, baseBet: 200, chips: [200, 500, 1000, 2000], cap: 0, order: 3 },
];

async function main() {
  console.log("=== 开始种子数据 ===");

  // 1. 创建管理员
  const adminPassword = await bcrypt.hash("admin123", 8);
  const adminCode = "ADMIN" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [admin] = await db.insert(users).values({
    account: "admin",
    password: adminPassword,
    securityCode: "888888",
    role: "admin",
    nickname: "超级管理员",
    inviteCode: adminCode,
    points: 9999999,
  }).returning();
  console.log(`✅ 管理员创建: admin / admin123 (ID: ${admin.id})`);

  // 2. 创建总代理
  const topAgentPassword = await bcrypt.hash("agent123", 8);
  const topAgentCode = "TOP" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [topAgent] = await db.insert(users).values({
    account: "topagent",
    password: topAgentPassword,
    securityCode: "888888",
    role: "top_agent",
    nickname: "测试总代理",
    inviteCode: topAgentCode,
    invitedById: admin.id,
    points: 100000,
  }).returning();
  console.log(`✅ 总代理创建: topagent / agent123 (邀请码: ${topAgentCode})`);

  // 3. 创建一级代理
  const agentPassword = await bcrypt.hash("agent123", 8);
  const agentCode = "AG" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [agent] = await db.insert(users).values({
    account: "agent01",
    password: agentPassword,
    securityCode: "888888",
    role: "agent",
    nickname: "测试代理",
    inviteCode: agentCode,
    invitedById: topAgent.id,
    points: 50000,
  }).returning();
  console.log(`✅ 一级代理创建: agent01 / agent123 (邀请码: ${agentCode})`);

  // 4. 创建测试玩家
  const playerPassword = await bcrypt.hash("player123", 8);
  const playerCode = "PL" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [player] = await db.insert(users).values({
    account: "player01",
    password: playerPassword,
    securityCode: "888888",
    role: "player",
    nickname: "测试玩家",
    inviteCode: playerCode,
    invitedById: agent.id,
    points: 10000,
  }).returning();
  console.log(`✅ 测试玩家创建: player01 / player123`);

  // 5. 插入游戏经济配置
  for (const g of GAMES) {
    await db.insert(gameEconomyConfig).values({
      gameType: g.type,
      gameName: g.name,
      rakeMode: "percentage",
      rakeRate: g.rakeRate,
      rakeCap: 0,
      rakeBaseType: g.rakeBase,
      rakeBaseDesc: g.rakeBase === "pot" ? "底池" : "赢家盈利总和",
      minRakePot: 0,
      agentRebateRate: 0.01,
      topAgentRebateRate: 0.01,
      platformRate: 0.01,
      rebateCapEnabled: false,
      rebateCap: 0,
      isActive: true,
      updatedBy: admin.id,
    });
    console.log(`✅ 游戏经济配置: ${g.name}`);
  }

  // 6. 插入房间模板（5游戏 × 3级别 = 15套）
  for (const g of GAMES) {
    for (const t of TEMPLATES) {
      await db.insert(roomTemplateConfig).values({
        templateName: `${g.name}-${t.name}`,
        templateCode: `${g.type}_${t.code}`,
        minBuyIn: t.min,
        maxBuyIn: t.max,
        chipDenomination: 1,
        maxBetPerRound: 0,
        chips: t.chips,
        cap: t.cap,
        baseBet: t.baseBet,
        gameType: g.type,
        defaultRounds: 25,
        maxSeats: 8,
        isActive: true,
        sortOrder: t.order,
        updatedBy: admin.id,
      });
    }
    console.log(`✅ 房间模板: ${g.name} (3套)`);
  }

  // 7. 插入默认权限配置
  const roles = ["admin", "top_agent", "agent", "customer_service", "player"];
  const features = ["create_room", "join_room", "manage_users", "manage_economy", "view_reports", "customer_service", "promotion_center"];
  for (const role of roles) {
    for (const feature of features) {
      let enabled = false;
      if (role === "admin") enabled = true;
      if (role === "top_agent" && ["create_room", "join_room", "promotion_center"].includes(feature)) enabled = true;
      if (role === "agent" && ["create_room", "join_room"].includes(feature)) enabled = true;
      if (role === "customer_service" && ["customer_service"].includes(feature)) enabled = true;
      if (role === "player" && ["join_room"].includes(feature)) enabled = true;
      await db.insert(userPermissions).values({ role, featureKey: feature, enabled, updatedBy: admin.id });
    }
  }
  console.log(`✅ 权限配置: ${roles.length} 角色 × ${features.length} 功能`);

  console.log("\n=== 种子数据完成 ===");
  console.log("测试账号:");
  console.log("  管理员: admin / admin123");
  console.log("  总代理: topagent / agent123");
  console.log("  代理:   agent01 / agent123");
  console.log("  玩家:   player01 / player123");
  process.exit(0);
}

main().catch((e) => {
  console.error("种子数据失败:", e);
  process.exit(1);
});

import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import agentRoutes from "./routes/agent.routes";
import profileRoutes from "./routes/profile.routes";
import roomsRoutes from "./routes/rooms.routes";
import { startTimeoutChecker } from "./services/timeoutChecker";
import { startRoomRecycler } from "./services/roomRecycler";
import assetsRoutes from "./routes/assets.routes";
import miscRoutes from "./routes/misc.routes";
import gamesRoutes from "./routes/games.routes";
import economyV2Routes from "./routes/economyV2.routes";
import walletRoutes from "./routes/wallet.routes";
import messagesRoutes from "./routes/messages.routes";
import { loadGameEconomyConfig } from "./lib/gameEconomy";
import { ensureEconomySeed } from "./lib/ensureSeed";
import { appRouter } from "./routes/app.routes";
import { setupRoomSockets } from "./socket/roomSocket";
import { errorHandler } from "./lib/appError";

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || "3001", 10);

// Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Socket.io CORS] 拒绝来源: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
  path: "/socket.io",
  transports: ["websocket"],
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
});

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean) : null;
const appOrigins = process.env.APP_ORIGINS ? process.env.APP_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : [];
const appSchemes = ["vpoker://", "app://", "myapp://", "http://localhost", "http://127.0.0.1"];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!allowedOrigins) return true;
  if (origin && allowedOrigins.includes(origin)) return true;
  if (origin && appOrigins.includes(origin)) return true;
  if (!origin || origin === "null" || origin.startsWith("file://")) return true;
  if (origin && appSchemes.some((s) => origin.startsWith(s))) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] 拒绝来源: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-vpoker-token", "x-device-id", "x-app-version"],
    exposedHeaders: ["x-vpoker-token", "x-device-id"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

import rateLimit from "express-rate-limit";
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: { error: "请求过于频繁，请稍后再试" },
  standardHeaders: true,
  legacyHeaders: false,
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "请求过于频繁，请稍后再试" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);
app.use("/api/rooms/:id/chat", chatLimiter);

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use("/api", miscRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/app", appRouter);
app.use("/api/econ", appRouter);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/economy-v2", economyV2Routes);
app.use("/api/agent", agentRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/messages", messagesRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API 不存在" });
});

app.use(errorHandler);

setupRoomSockets(io);

process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

server.listen(PORT, () => {
  console.log(`[V-POKER API] 服务已启动: http://localhost:${PORT}`);
  console.log(`[V-POKER API] 数据库: ${process.env.DATABASE_URL ? "已配置" : "未配置 DATABASE_URL"}`);
  console.log(`[V-POKER API] WebSocket: 已启用`);
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.SESSION_SECRET) {
    console.error("[FATAL] 生产环境必须设置 SESSION_SECRET");
    process.exit(1);
  }
  if (isProd && process.env.CORS_ORIGIN) {
    console.log(`[V-POKER API] CORS 已限制为: ${process.env.CORS_ORIGIN}`);
  } else if (isProd) {
    console.warn("[WARN] 生产环境未设置 CORS_ORIGIN，将允许所有来源。建议设置 CORS_ORIGIN=https://yourdomain.com");
  }

  // 先初始化经济配置默认数据（DB为空时自动写入），再加载到内存缓存
  ensureEconomySeed().then(() => {
    loadGameEconomyConfig().catch((e) => {
      console.warn("[economy_v2] 配置加载失败（表可能尚未创建）:", e.message);
    });
  });

  startTimeoutChecker();
  startRoomRecycler();
});

export { io };

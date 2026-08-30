import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";

/**
 * 金额字段自定义类型：
 * - 数据库层面：numeric（支持小数，与生�?DB 一致）
 * - TypeScript 层面：number（与现有业务代码兼容，直接参与计算）
 * - 驱动层转换：写入�?number �?string，读取时 string �?number
 */
const amount = customType<{ data: number; driverData: string }>({
  dataType() {
    return "numeric";
  },
  toDriver(value: number): string {
    return String(value);
  },
  fromDriver(value: string): number {
    return Number(value);
  },
});

// Roles: admin | customer_service | top_agent | agent | player
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  account: text("account").notNull().unique(),
  password: text("password").notNull(),
  securityCode: text("security_code").notNull(),
  role: text("role").notNull().default("player"),
  // 个人资料
  nickname: text("nickname"),
  avatar: text("avatar").notNull().default("1"),
  signature: text("signature"),
  // 设置�?(JSON: sound/music/vibrate �?
  settings: jsonb("settings"),
  lastLoginAt: timestamp("last_login_at"),
  // Invite code this user OWNS (agents/top agents share to downlines)
  inviteCode: text("invite_code").notNull().unique(),
  // Which invite code was used to register (links to upline)
  invitedByCode: text("invited_by_code"),
  invitedById: integer("invited_by_id"),
  // In-game points wallet (players carry points across rooms). numeric 支持小数筹码
  points: amount("points").notNull().default(0),
  // 钱包钱柜余额（玩家通过钱柜上下分）
  vaultPoints: amount("vault_points").notNull().default(0),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // 账号状态
  frozen: boolean("frozen").notNull().default(false),
  // 客服接待状态（仅customer_service角色使用）
  csStatus: text("cs_status").notNull().default("offline"), // offline | online
  // 新增字段：账号治理
  deletedAt: timestamp("deleted_at"),
  riskLevel: text("risk_level").notNull().default("normal"),
  freezeReason: text("freeze_reason"),
  freezeUntil: timestamp("freeze_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Rooms
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  roomNo: text("room_no").notNull().unique(),
  password: text("password").notNull(),
  gameType: text("game_type").notNull(), // texas | jinhua | sangong | niuniu | tbnn
  level: text("level").notNull(), // junior | senior | top
  initialPoints: integer("initial_points").notNull(),
  agentId: integer("agent_id").notNull(),
  status: text("status").notNull().default("waiting"), // waiting | playing | waiting_continue | finished | paused
  currentRound: integer("current_round").notNull().default(0),
  totalRounds: integer("total_rounds").notNull().default(25),
  maxSeats: integer("max_seats").notNull().default(8),
  // Accumulated stats �?numeric 支持小数累计
  totalRake: amount("total_rake").notNull().default(0), // 3% platform rake accumulated
  totalFlow: amount("total_flow").notNull().default(0), // total winnings flow across rounds
  fixedAnte: amount("fixed_ante").notNull().default(0), // 通比牛牛固定底注�?=使用基础底注�?
  settled: boolean("settled").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Players present in a room (seat + points)
export const roomPlayers = pgTable("room_players", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  seat: integer("seat").notNull(),
  points: amount("points").notNull(), // 桌上筹码，numeric 支持小数
  isSpectator: boolean("is_spectator").notNull().default(false),
  ready: boolean("ready").notNull().default(false),
  autoPlay: boolean("auto_play").notNull().default(false), // 自动挂机：跨局持久化，开启后每局自动开�?亮牌/准备下一局
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// Each played round's result
export const gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  roomNo: text("room_no"), // 房间号，房间ID复用时区分不同实例，永久保留可追�?
  roundNo: integer("round_no").notNull(),
  gameType: text("game_type").notNull(),
  // full result payload (hands, winner, etc.)
  result: jsonb("result").notNull(),
  winnerUserId: integer("winner_user_id"),
  potBeforeRake: amount("pot_before_rake").notNull().default(0), // 底池总额
  rake: amount("rake").notNull().default(0), // 3% of winnings
  turnover: amount("turnover").notNull().default(0), // 流水（底池或Σ下注×赔率�?
  resultIsSummary: boolean("result_is_summary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Live hand state for an in-progress deal (real-time player actions)
export const handStates = pgTable("hand_states", {
  roomId: integer("room_id").primaryKey(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  version: integer("version").notNull().default(0), // Phase 3: 状态版本号
  sequence: integer("sequence").notNull().default(0), // Phase 3: 有序事件序号
});

// Phase 3: 客户端操作幂等表
export const clientActions = pgTable("client_actions", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  clientActionId: text("client_action_id").notNull(),
  actionVersion: integer("action_version").notNull().default(0),
  responseSnapshot: jsonb("response_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 玩家筹码流水（代理上下分审计�?
export const chipTransactions = pgTable("chip_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),      // 玩家
  operatorId: integer("operator_id"),         // 操作代理
  amount: amount("amount").notNull(),        // + 上分 / - 下分
  balanceAfter: amount("balance_after").notNull(),
  vaultBalanceAfter: amount("vault_balance_after"), // 钱柜余额快照
  type: text("type").notNull(),               // agent_add | agent_sub | buyin | cashout | room_gift | room_rake | vault_add | vault_sub
  note: text("note"),
  requestId: text("request_id"),              // 幂等请求ID（防重复转账）
  roomId: integer("room_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 房间聊天 / 互动消息
export const roomMessages = pgTable("room_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull(), // text | quick | emoji | interact
  content: text("content").notNull(),
  targetUserId: integer("target_user_id"), // 互动表情的目标玩�?
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 设备关联（登录设备管理）
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  name: text("name").notNull(),
  platform: text("platform"),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  trusted: boolean("trusted").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


// 系统全局配置（管理员可修改的比例等）
export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 经济模型配置�?
// 重构：从全局单套改为按游�?房间级别独立配置
// game_type: texas | jinhua | sangong | niuniu | tbnn | global(全局默认模板)
// room_level: junior | senior | top | all(全级别通用)
// 复合唯一约束: (game_type, room_level, key)
export const econConfig = pgTable("econ_config", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull().default("global"), // 游戏类型
  roomLevel: text("room_level").notNull().default("all"), // 房间级别
  category: text("category").notNull(), // base | rake | rebate | credit | settlement | security | frontend
  key: text("key").notNull(), // 配置键（不再全局唯一，改为复合唯一�?
  value: jsonb("value").notNull(),
  defaultValue: jsonb("default_value").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull().default("text"), // text | number | select | switch | textarea | upload
  options: jsonb("options"), // select 选项列表
  minValue: integer("min_value"),
  maxValue: integer("max_value"),
  step: integer("step").notNull().default(1),
  required: boolean("required").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 经济模型配置修改历史�?
export const econConfigHistory = pgTable("econ_config_history", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull().default("global"), // 游戏类型
  roomLevel: text("room_level").notNull().default("all"), // 房间级别
  configKey: text("config_key").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value").notNull(),
  reason: text("reason"),
  operatorId: integer("operator_id").notNull(),
  operatorIp: text("operator_ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 经济模型配置 V2（两层配置体系）
// 第一层：游戏维度配置（每个游�?套，核心：抽�?& 分润模型�?
// 第二层：房间模板配置（对局准入约束，不包含抽水/分润�?
// ============================================================

/**
 * 游戏经济配置表（第一层：游戏维度�?
 * 每个游戏全局一套抽水计算逻辑，所有房间玩同一个游戏共用这套规�?
 * game_type: texas | jinhua | sangong | niuniu | tbnn
 */
export const gameEconomyConfig = pgTable("game_economy_config", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull().unique(), // 游戏类型，唯一
  gameName: text("game_name").notNull(), // 游戏显示名称
  // 抽水规则
  rakeMode: text("rake_mode").notNull().default("percentage"), // percentage(固定比例) | pot_cap(底池上限抽成)
  rakeRate: amount("rake_rate").notNull().default(0.03), // 抽水百分比（0.03=3%�?
  rakeCap: amount("rake_cap").notNull().default(0), // 单局抽水封顶阈值，0=不封�?
  rakeBaseType: text("rake_base_type").notNull().default("pot"), // 抽水基数类型：pot(底池) | flow(赢家盈利总和)
  rakeBaseDesc: text("rake_base_desc").notNull().default(""), // 抽水基数描述
  minRakePot: amount("min_rake_pot").notNull().default(0), // 起抽门槛，底池低于此值不抽水�?=不限�?
  // 房费分润比例（抽出来的房费怎么分，三者之和应=1�?
  agentRebateRate: amount("agent_rebate_rate").notNull().default(0.3333), // 开房代理分润比例(1/3)
  level1RebateRate: amount("level1_rebate_rate").notNull().default(0.1667), // 一级代理分润比例(0.5/3)
  topAgentRebateRate: amount("top_agent_rebate_rate").notNull().default(0.1667), // 总代理分润比例(0.5/3)
  platformRate: amount("platform_rate").notNull().default(0.3333), // 平台留存比例(倒挤参考值)
  // 返佣上限
  rebateCapEnabled: boolean("rebate_cap_enabled").notNull().default(false), // 是否启用单局代理返佣上限
  rebateCap: amount("rebate_cap").notNull().default(0), // 单局代理返佣上限�?=不限�?


  isActive: boolean("is_active").notNull().default(true),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * 房间模板配置表（第二层：房间模板�?
 * 模板 = 对局准入约束，只控制玩家进来能玩的筹码条件，不包含抽�?分润
 * 创建房间时选择模板，自动带入全部准入参数；房间实例只存模板ID
 */
export const roomTemplateConfig = pgTable("room_template_config", {
  id: serial("id").primaryKey(),
  templateName: text("template_name").notNull(), // 模板名称：初级局模板/高级局模板/顶级局模板
  templateCode: text("template_code").notNull().unique(), // 模板编码：junior/senior/top
  // 对局准入约束
  minBuyIn: amount("min_buy_in").notNull().default(100), // 最小带入筹�?
  maxBuyIn: amount("max_buy_in").notNull().default(1000), // 最大带入筹�?
  chipDenomination: amount("chip_denomination").notNull().default(1), // 筹码面额（最小筹码单位）�?deprecated，保留兼�?
  maxBetPerRound: amount("max_bet_per_round").notNull().default(0), // 单注最大限制，0=不限�?�?deprecated，保留兼�?
  // 按游戏特性独立配置（V2�?
  chips: jsonb("chips").notNull().default([]), // 下注选项数组：德�?筹码面额，牛/三公=下注档位，炸金花/通比�?�?
  cap: integer("cap").notNull().default(0), // 单注/累计上限：德�?单注封顶，炸金花=看上上限，牛/三公=累计下注上限
  baseBet: integer("base_bet").notNull().default(0), // 基础注额：德�?大盲，炸金花=闷跟额，�?三公=最小下注，通比�?固定底注ante
  // 关联游戏类型（决定这个房间跑哪套抽水公式�?
  gameType: text("game_type").notNull(), // 绑定的游戏类�?
  // 房间基础参数
  defaultRounds: integer("default_rounds").notNull().default(25), // 默认局�?
  maxSeats: integer("max_seats").notNull().default(8), // 最大座位数
  // 状�?
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 经济配置V2修改历史�?
export const gameEconomyHistory = pgTable("game_economy_history", {
  id: serial("id").primaryKey(),
  configType: text("config_type").notNull(), // game_economy | room_template
  targetId: integer("target_id").notNull(), // 配置记录ID
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value").notNull(),
  reason: text("reason"),
  operatorId: integer("operator_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 事件日志表（append-only�?
// 记录所有客户端→服务端�?Socket 事件，用于审计和问题排查
// 只插入不更新不删�?
export const eventLogs = pgTable("event_logs", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id"),
  playerId: integer("player_id"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  clientRequestId: text("client_request_id"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

// 房间历史战绩表（append-only�?
// 房间结束时写入汇总记录，永久保留，不�?rooms 表复用而丢�?
// 代理/管理员可查询历史开过的所有房间及其战绩汇�?
export const roomHistory = pgTable("room_history", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id, { onDelete: "set null" }),
  roomNo: text("room_no").notNull(), // 房间号（永久标识，与 game_rounds.room_no 对应）
  agentId: integer("agent_id").notNull(), // 房主代理ID
  gameType: text("game_type").notNull(), // 游戏类型
  level: text("level").notNull().default("junior"), // 场次等级
  totalRounds: integer("total_rounds").notNull().default(0), // 实际完成局�?
  totalRake: amount("total_rake").notNull().default(0), // 总抽�?
  totalFlow: amount("total_flow").notNull().default(0), // 总流�?
  agentNetCost: amount("agent_net_cost"), // 代理净成本（房费扣�?- 代理返佣�?
  platformIncome: amount("platform_income"), // 平台净收益
  endReason: text("end_reason").notNull().default("normal"), // normal/early_settle/player_left/force_end
  createdAt: timestamp("created_at").notNull().defaultNow(), // 房间创建时间
  endedAt: timestamp("ended_at").notNull().defaultNow(), // 房间结束/归档时间
});

// 房间临时邀请凭据表
// 房主可生成一次性分享凭据，玩家凭此加入房间无需密码
export const roomInviteTokens = pgTable("room_invite_tokens", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  token: text("token").notNull().unique(),
  usedByUserId: integer("used_by_user_id"), // 已使用的玩家ID（防重复使用）
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: integer("created_by").notNull(), // 创建者（房主ID）
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 用户权限配置表（替代前端本地存储）
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // admin | customer_service | top_agent | agent | player
  featureKey: text("feature_key").notNull(), // feature key: game.niuniu, tab.rooms, profile.downline
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 房间级分配明细表
export const distributionRecords = pgTable("distribution_records", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  agentId: integer("agent_id").notNull(),
  playerId: integer("player_id").notNull(),
  gameType: text("game_type").notNull(),
  level: text("level").notNull(),
  flow: amount("flow").notNull().default(0),
  commissionRate: amount("commission_rate").notNull().default(0),
  commissionAmount: amount("commission_amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Customer service messages (agent <-> cs communication)
export const csMessages = pgTable("cs_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),
  receiverId: integer("receiver_id").notNull(),
  receiverRole: text("receiver_role").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // text | chip_request | chip_response
  status: text("status").notNull().default("unread"), // unread | read | processed
  relatedData: jsonb("related_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Login logs table
export const loginLogs = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ip: text("ip"),
  device: text("device"),
  platform: text("platform"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  failReason: text("fail_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Risk tags table
export const riskTags = pgTable("risk_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tagType: text("tag_type").notNull(),
  tagValue: text("tag_value").notNull(),
  reason: text("reason"),
  createdBy: integer("created_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Approval requests table
export const approvalRequests = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  requestType: text("request_type").notNull(),
  targetId: integer("target_id"),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  amount: amount("amount"),
  beforeState: jsonb("before_state").notNull().default({}),
  afterState: jsonb("after_state").notNull().default({}),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewerId: integer("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewComment: text("review_comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Room anomalies table
export const roomAnomalies = pgTable("room_anomalies", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  anomalyType: text("anomaly_type").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
});

// CS conversations table
export const csConversations = pgTable("cs_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  csId: integer("cs_id").notNull().references(() => users.id),
  status: text("status").notNull().default("open"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  satisfaction: integer("satisfaction"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Config history table
export const configHistory = pgTable("config_history", {
  id: serial("id").primaryKey(),
  configKey: text("config_key").notNull(),
  configValue: jsonb("config_value").notNull(),
  changedBy: integer("changed_by").references(() => users.id),
  changeReason: text("change_reason"),
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Config drafts table
export const configDrafts = pgTable("config_drafts", {
  id: serial("id").primaryKey(),
  configKey: text("config_key").notNull(),
  configValue: jsonb("config_value").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});

-- ============================================================
-- 经济模型配置 V2 迁移脚本
-- 两层配置体系：游戏维度配置 + 房间模板配置
-- 从861项细粒度配置 → 5游戏配置 + 3房间模板
-- ============================================================

-- 1. 游戏经济配置表（第一层：游戏维度）
CREATE TABLE IF NOT EXISTS game_economy_config (
  id SERIAL PRIMARY KEY,
  game_type TEXT NOT NULL UNIQUE,
  game_name TEXT NOT NULL,
  rake_mode TEXT NOT NULL DEFAULT 'percentage',
  rake_rate NUMERIC NOT NULL DEFAULT 0.03,
  rake_cap NUMERIC NOT NULL DEFAULT 0,
  agent_rebate_rate NUMERIC NOT NULL DEFAULT 0.01,
  top_agent_rebate_rate NUMERIC NOT NULL DEFAULT 0.01,
  platform_rate NUMERIC NOT NULL DEFAULT 0.01,
  rebate_cap_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rebate_cap NUMERIC NOT NULL DEFAULT 0,
  credit_fee_rate NUMERIC NOT NULL DEFAULT 0.03,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. 房间模板配置表（第二层：房间模板）
CREATE TABLE IF NOT EXISTS room_template_config (
  id SERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  template_code TEXT NOT NULL UNIQUE,
  min_buy_in NUMERIC NOT NULL DEFAULT 100,
  max_buy_in NUMERIC NOT NULL DEFAULT 1000,
  chip_denomination NUMERIC NOT NULL DEFAULT 1,
  max_bet_per_round NUMERIC NOT NULL DEFAULT 0,
  game_type TEXT NOT NULL,
  default_rounds INTEGER NOT NULL DEFAULT 25,
  max_seats INTEGER NOT NULL DEFAULT 8,
  credit_requirement NUMERIC NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. 经济配置V2修改历史表
CREATE TABLE IF NOT EXISTS game_economy_history (
  id SERIAL PRIMARY KEY,
  config_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  reason TEXT,
  operator_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 初始化数据：5款游戏默认经济配置
-- 第一版目标：把硬编码值挪到数据库，业务输出结果100%和旧版本一致
-- 默认值：抽水3%、房费3%、代理返佣1%、总代返佣1%、平台1%
-- ============================================================
INSERT INTO game_economy_config (game_type, game_name, rake_mode, rake_rate, rake_cap, agent_rebate_rate, top_agent_rebate_rate, platform_rate, rebate_cap_enabled, rebate_cap, credit_fee_rate) VALUES
  ('texas',  '德州扑克',   'percentage', 0.03, 0, 0.01, 0.01, 0.01, FALSE, 0, 0.03),
  ('jinhua', '炸金花',     'percentage', 0.03, 0, 0.01, 0.01, 0.01, FALSE, 0, 0.03),
  ('sangong','抢庄三公',   'percentage', 0.03, 0, 0.01, 0.01, 0.01, FALSE, 0, 0.03),
  ('niuniu', '抢庄斗牛',   'percentage', 0.03, 0, 0.01, 0.01, 0.01, FALSE, 0, 0.03),
  ('tbnn',   '通比牛牛',   'percentage', 0.03, 0, 0.01, 0.01, 0.01, FALSE, 0, 0.03)
ON CONFLICT (game_type) DO NOTHING;

-- ============================================================
-- 初始化数据：3套房间模板（初级/高级/顶级）
-- 模板只管控对局准入约束，不管理抽水/分润
-- 默认值参考现有硬编码 LEVELS 常量
-- ============================================================
INSERT INTO room_template_config (template_name, template_code, min_buy_in, max_buy_in, chip_denomination, max_bet_per_round, game_type, default_rounds, max_seats, credit_requirement, sort_order) VALUES
  ('初级局模板', 'junior', 100,  1000,  1, 0, 'texas', 25, 8, 100,  1),
  ('高级局模板', 'senior', 1000, 10000, 1, 0, 'texas', 25, 8, 500,  2),
  ('顶级局模板', 'top',    10000,100000,1, 0, 'texas', 25, 8, 2000, 3)
ON CONFLICT (template_code) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_game_economy_config_game_type ON game_economy_config(game_type);
CREATE INDEX IF NOT EXISTS idx_room_template_config_code ON room_template_config(template_code);
CREATE INDEX IF NOT EXISTS idx_room_template_config_game_type ON room_template_config(game_type);
CREATE INDEX IF NOT EXISTS idx_game_economy_history_config_type ON game_economy_history(config_type);

-- 新增功能数据库迁移 (2026-08-26)
-- 1. users表添加frozen字段
-- 2. 创建user_permissions权限配置表
-- 3. 创建distribution_records分配明细表

-- 1. 用户冻结功能
ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;

-- 2. 权限配置表
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- 3. 房间级分配明细表
CREATE TABLE IF NOT EXISTS distribution_records (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  agent_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  game_type TEXT NOT NULL,
  level TEXT NOT NULL,
  flow NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_distribution_records_agent_id ON distribution_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_distribution_records_room_id ON distribution_records(room_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_role ON user_permissions(role);

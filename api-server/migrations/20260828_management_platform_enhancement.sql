-- V-Poker 管理工作台能力增强 - 数据库迁移
-- 执行时间: 2026-08-28
-- 版本: Phase 4

-- =====================================================
-- P0: 资金安全增强
-- =====================================================

-- 1. 扩展event_logs表（审计日志增强）
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS operator_id INTEGER;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS operator_account TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS target_id INTEGER;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS before_value JSONB DEFAULT '{}';
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS after_value JSONB DEFAULT '{}';
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS reason TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_event_logs_operator ON event_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_target ON event_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_ip ON event_logs(ip);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(received_at DESC);

-- 2. 新建login_logs表（登录日志）
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip TEXT,
  device TEXT,
  platform TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  fail_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_ip ON login_logs(ip);

-- 3. 新建risk_tags表（风险标签）
CREATE TABLE IF NOT EXISTS risk_tags (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_tags_user_id ON risk_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_tags_tag_type ON risk_tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_risk_tags_active ON risk_tags(user_id, is_active) WHERE is_active = true;

-- 4. 新建approval_requests表（审批请求）
CREATE TABLE IF NOT EXISTS approval_requests (
  id SERIAL PRIMARY KEY,
  request_type TEXT NOT NULL,
  target_id INTEGER,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  amount NUMERIC(15,2),
  before_state JSONB DEFAULT '{}',
  after_state JSONB DEFAULT '{}',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON approval_requests(created_at DESC);

-- 5. 扩展users表
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'normal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS freeze_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS freeze_until TIMESTAMP;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_risk_level ON users(risk_level);
CREATE INDEX IF NOT EXISTS idx_users_freeze_until ON users(freeze_until) WHERE freeze_until IS NOT NULL;

-- =====================================================
-- P1: 运营效率增强
-- =====================================================

-- 6. 新建room_anomalies表（房间异常事件）
CREATE TABLE IF NOT EXISTS room_anomalies (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_room_anomalies_room_id ON room_anomalies(room_id);
CREATE INDEX IF NOT EXISTS idx_room_anomalies_resolved ON room_anomalies(resolved);

-- 7. 新建cs_conversations表（客服会话）
CREATE TABLE IF NOT EXISTS cs_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  cs_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'open',
  assigned_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
 满意度 INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cs_conversations_user_id ON cs_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_conversations_cs_id ON cs_conversations(cs_id);
CREATE INDEX IF NOT EXISTS idx_cs_conversations_status ON cs_conversations(status);

-- =====================================================
-- P2: 系统配置版本化
-- =====================================================

-- 8. 新建config_history表（配置历史）
CREATE TABLE IF NOT EXISTS config_history (
  id SERIAL PRIMARY KEY,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  change_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_history_version ON config_history(config_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_config_history_current ON config_history(is_current);

-- 9. 新建config_drafts表（配置草稿）
CREATE TABLE IF NOT EXISTS config_drafts (
  id SERIAL PRIMARY KEY,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_config_drafts_key ON config_drafts(config_key);

-- =====================================================
-- 初始化数据
-- =====================================================

-- 为现有用户设置默认风险等级
UPDATE users SET risk_level = 'normal' WHERE risk_level IS NULL;

-- 标记软删除的用户（如果需要）
-- UPDATE users SET deleted_at = NOW() WHERE ...;

COMMENT ON TABLE event_logs IS '操作审计日志表';
COMMENT ON TABLE login_logs IS '用户登录日志表';
COMMENT ON TABLE risk_tags IS '用户风险标签表';
COMMENT ON TABLE approval_requests IS '审批请求表';
COMMENT ON TABLE room_anomalies IS '房间异常事件表';
COMMENT ON TABLE cs_conversations IS '客服会话表';
COMMENT ON TABLE config_history IS '配置变更历史表';
COMMENT ON TABLE config_drafts IS '配置草稿表';

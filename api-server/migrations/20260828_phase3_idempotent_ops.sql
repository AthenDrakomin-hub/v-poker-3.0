-- Phase 3: 幂等操作确认 + 状态版本号 + 有序 Socket 事件
-- 执行时间: 2026-08-28

-- 1. hand_states 表新增 version 和 sequence 字段
ALTER TABLE hand_states ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hand_states ADD COLUMN IF NOT EXISTS sequence BIGINT NOT NULL DEFAULT 0;

-- 2. 创建客户端操作幂等表
CREATE TABLE IF NOT EXISTS client_actions (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  client_action_id TEXT NOT NULL,
  action_version INTEGER NOT NULL DEFAULT 0,
  response_snapshot JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, client_action_id)
);

-- 3. 为 client_actions 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_client_actions_room_user ON client_actions(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_client_actions_action_id ON client_actions(client_action_id);

-- 4. 更新现有 hand_states 的 version 和 sequence（基于 updatedAt 排序）
WITH ranked AS (
  SELECT room_id, updated_at,
         ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY updated_at) as seq
  FROM hand_states
)
UPDATE hand_states hs
SET version = ranked.seq,
    sequence = ranked.seq
FROM ranked
WHERE hs.room_id = ranked.room_id;

-- 5. 验证
SELECT 'hand_states columns:' as info;
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'hand_states' AND column_name IN ('version', 'sequence');

SELECT 'client_actions table:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'client_actions';

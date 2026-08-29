-- 009: 房间临时邀请凭据表
-- 用于房主生成一次性分享链接/凭据，玩家凭此加入房间无需密码

CREATE TABLE IF NOT EXISTS room_invite_tokens (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,              -- 临时邀请凭据（随机生成）
  used_by_user_id INTEGER,                -- 已使用的玩家ID（防重复使用）
  expires_at TIMESTAMP NOT NULL,          -- 过期时间
  created_by INTEGER NOT NULL,            -- 创建者（房主ID）
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_room_invite_tokens_token ON room_invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_room_invite_tokens_room_id ON room_invite_tokens(room_id);
CREATE INDEX IF NOT EXISTS idx_room_invite_tokens_expires ON room_invite_tokens(expires_at);

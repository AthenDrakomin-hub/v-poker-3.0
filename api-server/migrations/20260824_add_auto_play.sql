-- 通比牛牛自动挂机功能：room_players 表新增 auto_play 字段
-- 跨局持久化：玩家开启挂机后，每局自动开始/亮牌/准备下一局
ALTER TABLE room_players ADD COLUMN IF NOT EXISTS auto_play BOOLEAN NOT NULL DEFAULT FALSE;

-- 索引：按房间查询挂机玩家（创建手牌时批量读取）
CREATE INDEX IF NOT EXISTS idx_room_players_auto_play ON room_players(room_id, auto_play) WHERE auto_play = TRUE;

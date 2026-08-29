-- 007: game_rounds 增加 room_no 字段，支持房间ID复用时区分不同房间实例的牌局记录
-- 房间ID复用后 room_no 会变化，通过 room_no 可永久追溯历史牌局归属的房间

ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS room_no TEXT;

-- 为已有数据回填 room_no（通过 room_id 关联 rooms 表获取当前 room_no）
-- 注意：已被复用的房间其 room_no 已变更，旧记录无法准确回填，只能取当前值
UPDATE game_rounds gr
SET room_no = r.room_no
FROM rooms r
WHERE gr.room_id = r.id AND gr.room_no IS NULL;

-- 创建索引加速按 room_no 查询历史记录
CREATE INDEX IF NOT EXISTS idx_game_rounds_room_no ON game_rounds(room_no);
CREATE INDEX IF NOT EXISTS idx_game_rounds_room_id_round_no ON game_rounds(room_id, round_no DESC);

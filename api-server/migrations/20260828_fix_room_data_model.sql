-- 管理工作台数据模型优化
-- 1. 修复房间复用逻辑
-- 2. 统一金额字段精度
-- 3. 新增必要字段和索引

-- =====================================================
-- 1. room_history表增加room_id字段
-- =====================================================
ALTER TABLE room_history ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_room_history_room_id ON room_history(room_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_history_room_no_unique ON room_history(room_no) WHERE room_no IS NOT NULL;

-- 回填room_id（通过rooms表关联）
UPDATE room_history rh
SET room_id = r.id
FROM rooms r
WHERE rh.room_no = r.room_no
  AND rh.room_id IS NULL;

-- =====================================================
-- 2. game_rounds表添加唯一约束
-- =====================================================
-- 唯一约束：(room_no, round_no)，排除汇总记录
-- 注意：PostgreSQL不支持条件唯一索引，需在应用层保证
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rounds_room_round_unique 
ON game_rounds(room_no, round_no) 
WHERE result_is_summary = false;

-- =====================================================
-- 3. 更新金额字段精度（如需修改现有字段）
-- 注意：修改字段精度会锁表，建议在低峰期执行
-- =====================================================
-- ALTER TABLE game_rounds ALTER COLUMN pot_before_rake TYPE NUMERIC(20,2);
-- ALTER TABLE game_rounds ALTER COLUMN rake TYPE NUMERIC(20,2);
-- ALTER TABLE room_history ALTER COLUMN total_rake TYPE NUMERIC(20,2);
-- ALTER TABLE room_history ALTER COLUMN total_flow TYPE NUMERIC(20,2);
-- ALTER TABLE room_history ALTER COLUMN agent_net_cost TYPE NUMERIC(20,2);
-- ALTER TABLE room_history ALTER COLUMN platform_income TYPE NUMERIC(20,2);

-- =====================================================
-- 4. 验证数据完整性
-- =====================================================
-- 检查是否有重复的room_no和round_no组合
SELECT room_no, round_no, COUNT(*) 
FROM game_rounds 
WHERE result_is_summary = false
GROUP BY room_no, round_no 
HAVING COUNT(*) > 1;

-- 检查room_history中空的room_id
SELECT COUNT(*) FROM room_history WHERE room_id IS NULL;

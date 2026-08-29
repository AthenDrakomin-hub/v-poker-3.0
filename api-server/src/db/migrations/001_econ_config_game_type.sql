-- ============================================================
-- V-poker-2.0 经济模型配置重构迁移
-- 从全局单套配置 → 按游戏+房间级别独立配置
-- 执行前请备份数据库
-- ============================================================

-- 1. econ_config 表增加 game_type 和 room_level 字段
ALTER TABLE econ_config ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'global';
ALTER TABLE econ_config ADD COLUMN IF NOT EXISTS room_level TEXT NOT NULL DEFAULT 'all';

-- 2. 移除旧的 key 唯一约束（如果存在）
-- 注意：PostgreSQL 中 unique 约束会自动创建索引，需要先删除
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'econ_config_key_key'
    ) THEN
        ALTER TABLE econ_config DROP CONSTRAINT econ_config_key_key;
    END IF;
END $$;

-- 3. 添加复合唯一约束 (game_type, room_level, key)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'econ_config_game_type_room_level_key_key'
    ) THEN
        ALTER TABLE econ_config
        ADD CONSTRAINT econ_config_game_type_room_level_key_key
        UNIQUE (game_type, room_level, key);
    END IF;
END $$;

-- 4. econ_config_history 表增加 game_type 和 room_level 字段
ALTER TABLE econ_config_history ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'global';
ALTER TABLE econ_config_history ADD COLUMN IF NOT EXISTS room_level TEXT NOT NULL DEFAULT 'all';

-- 5. 为查询性能添加索引
CREATE INDEX IF NOT EXISTS idx_econ_config_game_type ON econ_config(game_type);
CREATE INDEX IF NOT EXISTS idx_econ_config_room_level ON econ_config(room_level);
CREATE INDEX IF NOT EXISTS idx_econ_config_category ON econ_config(category);
CREATE INDEX IF NOT EXISTS idx_econ_config_history_game_type ON econ_config_history(game_type);
CREATE INDEX IF NOT EXISTS idx_econ_config_history_config_key ON econ_config_history(config_key);

-- 6. 将现有全局配置标记为 global/all（默认值已处理，此处确认）
-- 现有数据的 game_type='global', room_level='all' 即为全局默认模板

-- 7. 验证迁移结果
-- SELECT game_type, room_level, COUNT(*) FROM econ_config GROUP BY game_type, room_level;

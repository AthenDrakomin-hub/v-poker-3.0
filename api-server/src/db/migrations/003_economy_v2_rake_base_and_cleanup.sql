-- ============================================================
-- 经济模型配置 V2 迁移脚本 003
-- 1. game_economy_config 增加抽水方式字段
-- 2. 清理旧 econ_config 表数据（业务已全部切换到 V2）
-- ============================================================

-- 1. 增加抽水基数类型字段（pot=底池 / flow=赢家盈利总和）
ALTER TABLE game_economy_config ADD COLUMN IF NOT EXISTS rake_base_type TEXT NOT NULL DEFAULT 'pot';
-- 抽水基数描述（用于展示和文档）
ALTER TABLE game_economy_config ADD COLUMN IF NOT EXISTS rake_base_desc TEXT NOT NULL DEFAULT '';
-- 起抽门槛（底池低于此值不抽水，0=不限制）
ALTER TABLE game_economy_config ADD COLUMN IF NOT EXISTS min_rake_pot NUMERIC NOT NULL DEFAULT 0;

-- 2. 更新5款游戏的抽水方式默认值
-- 德州扑克：抽水基数=底池（主池+边池总和），市面标准做法
UPDATE game_economy_config SET rake_base_type = 'pot', rake_base_desc = '底池（主池+边池总和）', min_rake_pot = 0 WHERE game_type = 'texas';
-- 炸金花：抽水基数=最终底池
UPDATE game_economy_config SET rake_base_type = 'pot', rake_base_desc = '最终底池', min_rake_pot = 0 WHERE game_type = 'jinhua';
-- 通比牛牛：抽水基数=底池（玩家数×底注）
UPDATE game_economy_config SET rake_base_type = 'pot', rake_base_desc = '底池（玩家数×底注）', min_rake_pot = 0 WHERE game_type = 'tbnn';
-- 抢庄牛牛：抽水基数=Σ下注×赔率（即底池）
UPDATE game_economy_config SET rake_base_type = 'pot', rake_base_desc = 'Σ下注×赔率', min_rake_pot = 0 WHERE game_type = 'niuniu';
-- 抢庄三公：抽水基数=Σ下注×赔率（即底池）
UPDATE game_economy_config SET rake_base_type = 'pot', rake_base_desc = 'Σ下注×赔率', min_rake_pot = 0 WHERE game_type = 'sangong';

-- 3. 清理旧 econ_config 表数据（业务已全部切换到 V2，旧表保留结构但清空数据）
TRUNCATE TABLE econ_config RESTART IDENTITY CASCADE;
TRUNCATE TABLE econ_config_history RESTART IDENTITY CASCADE;

-- 验证
SELECT game_type, game_name, rake_base_type, rake_base_desc, rake_rate, rake_cap, min_rake_pot, agent_rebate_rate, top_agent_rebate_rate, platform_rate, credit_fee_rate
FROM game_economy_config ORDER BY id;

-- V-Poker 经济模型 V2 动态费率迁移
-- 新增 level1_rebate_rate 字段（一级代理分润比例）
-- 费率含义变更：以抽水总额为基数（原默认值0.01为流水比例，现改为抽水比例）
-- 执行时间：部署时执行，表为空时seed会自动写入正确默认值

-- 1. 新增一级代理分润比例字段
ALTER TABLE game_economy_config
ADD COLUMN IF NOT EXISTS level1_rebate_rate numeric(10,4) NOT NULL DEFAULT 0.1667;

-- 2. 更新字段默认值（以抽水为基数：开房代理1/3，一级0.5/3，总代0.5/3，平台倒挤1/3）
ALTER TABLE game_economy_config
ALTER COLUMN agent_rebate_rate SET DEFAULT 0.3333;

ALTER TABLE game_economy_config
ALTER COLUMN top_agent_rebate_rate SET DEFAULT 0.1667;

ALTER TABLE game_economy_config
ALTER COLUMN platform_rate SET DEFAULT 0.3333;

-- 3. 如果表中有旧数据（默认值0.01），更新为新的抽水比例默认值
-- 仅当 agent_rebate_rate = 0.01 时更新（判断为旧数据）
UPDATE game_economy_config
SET
  agent_rebate_rate = 0.3333,
  level1_rebate_rate = 0.1667,
  top_agent_rebate_rate = 0.1667,
  platform_rate = 0.3333
WHERE agent_rebate_rate = 0.01;

-- 验证
SELECT game_type, game_name, rake_rate, agent_rebate_rate, level1_rebate_rate, top_agent_rebate_rate, platform_rate
FROM game_economy_config
ORDER BY game_type;

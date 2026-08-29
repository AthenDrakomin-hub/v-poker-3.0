-- 010: V3 经济模型清理 - 移除废弃的信用分/佣金相关字段和表
-- V3 使用单一货币 points（筹码），不再使用 credit（信用分）系统

-- ============================================================
-- 1. 清理 users 表废弃列
-- ============================================================

-- 删除信用分余额（V3 不再使用）
ALTER TABLE users DROP COLUMN IF EXISTS credit;

-- 删除佣金余额（V3 不再写入）
ALTER TABLE users DROP COLUMN IF EXISTS commission;

-- 删除代理佣金率（已迁移至 econ_config.agent_rebate_rate）
ALTER TABLE users DROP COLUMN IF EXISTS agent_commission_rate;

-- 删除总代理佣金率（已迁移至 econ_config.top_agent_rebate_rate）
ALTER TABLE users DROP COLUMN IF EXISTS top_agent_commission_rate;

-- 删除待扣费金额（V3 不再使用 pendingFee）
ALTER TABLE users DROP COLUMN IF EXISTS pending_fee;

-- 删除禁止开房标记（V3 不再使用 openRoomBlocked）
ALTER TABLE users DROP COLUMN IF EXISTS open_room_blocked;

-- ============================================================
-- 2. 清理 game_economy_config 表废弃列
-- ============================================================

-- 删除信用分房费比例（V3 不再从信用分扣房费）
ALTER TABLE game_economy_config DROP COLUMN IF EXISTS credit_fee_rate;

-- ============================================================
-- 3. 清理 room_template_config 表废弃列
-- ============================================================

-- 注意：credit_requirement 字段在 V3 中重新用作"开房筹码门槛"，保留不删除

-- ============================================================
-- 4. 删除废弃表
-- ============================================================

-- 删除信用分交易记录表（V3 不再记录 credit 流水）
DROP TABLE IF EXISTS credit_transactions;

-- 删除扣减记录表（V3 amount=0，仅兼容旧数据）
DROP TABLE IF EXISTS deduction_records;

-- ============================================================
-- 5. 清理索引（如果存在）
-- ============================================================

DROP INDEX IF EXISTS idx_credit_transactions_user_id;
DROP INDEX IF EXISTS idx_deduction_records_room_id;
DROP INDEX IF EXISTS idx_deduction_records_agent_id;

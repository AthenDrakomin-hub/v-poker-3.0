-- 钱包钱柜功能：用户钱柜余额 + 账变记录扩展
-- 钱柜与房间上下分、结算共用同一筹码账本（chip_transactions）

-- 1. 用户表增加钱柜余额
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_points numeric(15,2) NOT NULL DEFAULT 0;

-- 2. 账变记录表增加钱柜余额快照（vault 操作时记录）
ALTER TABLE chip_transactions ADD COLUMN IF NOT EXISTS vault_balance_after numeric(15,2);

-- 3. 账变记录表增加幂等请求 ID（防重复转账），仅 vault 操作填写
ALTER TABLE chip_transactions ADD COLUMN IF NOT EXISTS request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chip_tx_request_id ON chip_transactions(request_id) WHERE request_id IS NOT NULL;

-- 4. 账变类型索引（按类型查询加速）
CREATE INDEX IF NOT EXISTS idx_chip_tx_user_type ON chip_transactions(user_id, type);

-- 批量充值脚本：给所有用户账户加10000筹码
-- 执行时间: 2026-08-29

BEGIN;

-- 1. 更新所有用户的筹码余额
UPDATE users 
SET points = points + 10000
WHERE deleted_at IS NULL;

-- 2. 记录充值流水（使用正确的字段名）
INSERT INTO chip_transactions (
  user_id, 
  amount, 
  balance_after, 
  type, 
  note, 
  created_at
)
SELECT 
  u.id,
  10000,
  u.points,
  'recharge',
  '系统初始充值',
  NOW()
FROM users u
WHERE u.deleted_at IS NULL;

-- 3. 验证结果
SELECT 
  COUNT(*) as total_users,
  AVG(points) as avg_points,
  MIN(points) as min_points,
  MAX(points) as max_points
FROM users
WHERE deleted_at IS NULL;

COMMIT;

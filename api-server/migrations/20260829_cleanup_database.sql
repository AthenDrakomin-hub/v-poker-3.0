-- V-Poker 数据库清理脚本（修正版）
-- 保留所有用户账号，清理所有业务数据
-- 执行时间: 2026-08-29
-- 使用 CASCADE 处理外键约束

BEGIN;

-- =====================================================
-- 1. 清理游戏数据（按依赖顺序）
-- =====================================================
TRUNCATE game_rounds RESTART IDENTITY CASCADE;
TRUNCATE room_history RESTART IDENTITY CASCADE;
TRUNCATE hand_states RESTART IDENTITY CASCADE;
TRUNCATE room_players RESTART IDENTITY CASCADE;

-- =====================================================
-- 2. 清理房间数据
-- =====================================================
TRUNCATE rooms RESTART IDENTITY CASCADE;

-- =====================================================
-- 3. 清理交易流水
-- =====================================================
TRUNCATE chip_transactions RESTART IDENTITY CASCADE;

-- =====================================================
-- 4. 清理审计日志
-- =====================================================
TRUNCATE event_logs RESTART IDENTITY CASCADE;
TRUNCATE login_logs RESTART IDENTITY CASCADE;

-- =====================================================
-- 5. 清理风控数据
-- =====================================================
TRUNCATE risk_tags RESTART IDENTITY CASCADE;
TRUNCATE approval_requests RESTART IDENTITY CASCADE;

-- =====================================================
-- 6. 清理客服数据
-- =====================================================
TRUNCATE cs_conversations RESTART IDENTITY CASCADE;
TRUNCATE cs_messages RESTART IDENTITY CASCADE;

-- =====================================================
-- 7. 清理异常事件
-- =====================================================
TRUNCATE room_anomalies RESTART IDENTITY CASCADE;

-- =====================================================
-- 8. 清理系统配置草稿
-- =====================================================
TRUNCATE config_drafts RESTART IDENTITY CASCADE;

-- =====================================================
-- 9. 清理邀请令牌
-- =====================================================
TRUNCATE room_invite_tokens RESTART IDENTITY CASCADE;

-- =====================================================
-- 验证清理结果
-- =====================================================
SELECT 
  'game_rounds' as table_name, COUNT(*) FROM game_rounds
UNION ALL SELECT 'room_history', COUNT(*) FROM room_history
UNION ALL SELECT 'hand_states', COUNT(*) FROM hand_states
UNION ALL SELECT 'room_players', COUNT(*) FROM room_players
UNION ALL SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL SELECT 'chip_transactions', COUNT(*) FROM chip_transactions
UNION ALL SELECT 'event_logs', COUNT(*) FROM event_logs
UNION ALL SELECT 'login_logs', COUNT(*) FROM login_logs
UNION ALL SELECT 'risk_tags', COUNT(*) FROM risk_tags
UNION ALL SELECT 'approval_requests', COUNT(*) FROM approval_requests
UNION ALL SELECT 'cs_conversations', COUNT(*) FROM cs_conversations
UNION ALL SELECT 'room_anomalies', COUNT(*) FROM room_anomalies
UNION ALL SELECT 'config_drafts', COUNT(*) FROM config_drafts
UNION ALL SELECT 'room_invite_tokens', COUNT(*) FROM room_invite_tokens
UNION ALL SELECT 'users', COUNT(*) FROM users
ORDER BY table_name;

COMMIT;

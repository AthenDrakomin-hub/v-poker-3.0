# V-Poker 数据库维护指南

## 常用维护操作

### 清理数据库（保留账号）
```sql
-- 执行迁移文件
sudo -u postgres psql -d v_poker_2 -f api-server/migrations/20260829_cleanup_database.sql
```

### 查看表记录数
```sql
SELECT 'table_name' as table_name, COUNT(*) FROM table_name
UNION ALL
SELECT 'users', COUNT(*) FROM users
ORDER BY table_name;
```

### 查看数据库大小
```sql
SELECT pg_size_pretty(pg_database_size('v_poker_2'));
```

## 表说明

| 表名 | 说明 | 是否可清理 |
|------|------|-----------|
| users | 用户账号 | ❌ 保留 |
| rooms | 房间记录 | ✅ 可清理 |
| game_rounds | 游戏对局 | ✅ 可清理 |
| room_history | 房间汇总 | ✅ 可清理 |
| chip_transactions | 筹码交易 | ✅ 可清理 |
| event_logs | 事件日志 | ✅ 可清理 |
| login_logs | 登录日志 | ✅ 可清理 |
| risk_tags | 风险标签 | ✅ 可清理 |
| approval_requests | 审批请求 | ✅ 可清理 |
| cs_conversations | 客服会话 | ✅ 可清理 |
| room_anomalies | 异常事件 | ✅ 可清理 |

## 外键依赖关系
```
rooms
  ├── chip_transactions (FK: room_id)
  ├── game_rounds (FK: room_id)
  ├── hand_states (FK: room_id)
  ├── room_players (FK: room_id)
  ├── room_messages (FK: room_id)
  ├── room_invite_tokens (FK: room_id)
  ├── distribution_records (FK: room_id)
  └── room_anomalies (FK: room_id)
```

**重要**：清理rooms表时必须使用 CASCADE 选项，否则会因为外键约束失败。

## 迁移文件位置
- `api-server/src/db/migrations/` - Drizzle ORM迁移
- `api-server/migrations/` - 手工SQL迁移（推荐）
---
name: vpoker-admin-backend-dev
description: V-Poker管理工作台后端开发 - API接口、数据库迁移、权限控制
category: v-poker
---

# V-Poker 管理工作台后端开发工作流

## 触发条件
当需要为V-Poker管理平台开发新的后端功能时加载此技能。

## 核心规范

### 数据库迁移规范
```
ALTER TABLE ADD COLUMN → UPDATE回填历史数据 → CREATE INDEX → 验证COUNT
```
- migration文件存在于两个目录：`api-server/src/db/migrations/` 和 `api-server/migrations/`
- 新增.ts服务文件后必须重启PM2才能加载新代码

### API响应格式
所有列表接口统一使用 `paginatedResponse` 格式：
```typescript
{
  data: [...],
  pagination: { page, pageSize, total, totalPages }
}
```
`parsePagination` 函数解析 page/pageSize 参数（默认20，最大100）

### 权限控制模式
```typescript
// 管理员专用
if (u.role !== "admin") { res.status(403).json({ error: "无权限" }); return; }

// 多级角色判断
if (!["agent", "top_agent", "admin"].includes(u.role)) { res.status(403)... }
```

### 房间权限逻辑
- 房主（agent_id匹配）可查看所有记录
- 房间成员（roomPlayers）可查看记录
- 管理员和客服可查看所有房间记录
- 其他用户需要有roomPlayers记录才能查看

## 已实现功能（Phase 4）

### P0 - 资金安全增强
| 接口 | 说明 |
|------|------|
| GET /api/admin/audit-logs | 审计日志（支持前后值、IP、设备、请求ID） |
| POST /api/admin/users/:id/soft-delete | 用户软删除 |
| POST /api/admin/users/:id/restore | 用户恢复 |
| POST /api/admin/users/:id/risk-tag | 添加风险标签 |
| DELETE /api/admin/users/:id/risk-tag/:tagId | 移除风险标签 |
| GET /api/admin/risk-tags | 风险标签列表 |
| GET /api/admin/login-logs | 登录日志查询 |
| GET /api/admin/approvals/pending | 待审核列表 |
| POST /api/admin/approvals/:id/approve | 审核通过 |
| POST /api/admin/approvals/:id/reject | 审核拒绝 |

### P1 - 运营效率增强
| 接口 | 说明 |
|------|------|
| GET /api/admin/rooms/:id/anomalies | 房间异常事件 |
| POST /api/admin/rooms/:id/anomalies | 创建异常记录 |
| GET /api/admin/cs/conversations | 客服会话列表 |
| PUT /api/admin/cs-status/:id | 客服接待状态切换 |
| GET /api/admin/agents/tree | 代理树结构 |
| GET /api/admin/agents/:id/commission-report | 佣金结算报表 |

### P2 - 系统优化
| 接口 | 说明 |
|------|------|
| GET /api/admin/config/history | 配置变更历史 |
| POST /api/admin/config/draft | 创建配置草稿 |
| PUT /api/admin/config/draft/:id/publish | 发布草稿 |
| POST /api/admin/config/rollback | 回滚配置 |

### 房间查询接口
| 接口 | 说明 |
|------|------|
| GET /api/profile/room-history | 用户房间汇总战绩 |
| GET /api/profile/room-history/:roomNo/rounds | 用户逐局记录 |
| GET /api/admin/room-history | 管理端房间汇总查询 |
| GET /api/admin/rooms/:roomNo/rounds | 管理端单局审计 |
| GET /api/rooms | 房间列表（支持分页和筛选） |

## 关键表结构

### event_logs（审计日志）
- 新增字段：operator_id, before_value, after_value, ip, device, reason, client_id
- 用于记录所有关键操作的前后值对比

### room_history（房间历史）
- 新增字段：room_id（外键关联rooms表）
- 唯一约束：(room_no) WHERE room_no IS NOT NULL
- 索引：agent_id, game_type, ended_at, room_id

### game_rounds（游戏对局）
- 唯一约束：(room_no, round_no) WHERE result_is_summary = false
- 金额字段：NUMERIC(20,2)
- 不包含汇总记录（result_is_summary=true）

## 健康检查
- 正确路径：`https://goodspage.cn/api/health`
- 错误路径：`https://goodspage.cn/health`（返回前端HTML）

## 用户偏好
- 要求一次性正确，不接受半成品
- 对分析深度要求高，不喜欢敷衍或模糊描述
- 偏好简洁直接，不喜欢多余解释
- 要求核实数据后再下结论
- 所有bug都是严重的
- 测试多次后表达明显疲惫和不满
- 要求明确批准后再操作

## 文件位置
- API路由：`/opt/texas-platform/api-server/src/routes/admin.routes.ts`
- Schema定义：`/opt/texas-platform/api-server/src/db/schema.ts`
- 迁移文件：`/opt/texas-platform/api-server/migrations/`
- 审计日志库：`/opt/texas-platform/api-server/src/lib/audit.ts`
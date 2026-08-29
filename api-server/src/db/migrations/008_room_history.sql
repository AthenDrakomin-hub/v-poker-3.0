-- 008: 房间历史战绩表（room_history）
-- 房间结束时写入汇总记录，永久保留，不随 rooms 表复用而丢失
-- 代理/管理员可查询历史开过的所有房间及其战绩汇总

CREATE TABLE IF NOT EXISTS room_history (
  id SERIAL PRIMARY KEY,
  room_no TEXT NOT NULL,              -- 房间号（永久标识，与 game_rounds.room_no 对应）
  agent_id INTEGER NOT NULL,          -- 房主代理ID
  game_type TEXT NOT NULL,            -- 游戏类型：texas/jinhua/niuniu/sangong/tbnn
  level TEXT NOT NULL DEFAULT 'junior', -- 场次等级：junior/senior/top
  total_rounds INTEGER NOT NULL DEFAULT 0,   -- 实际完成局数
  total_rake NUMERIC(15,2) NOT NULL DEFAULT 0,  -- 总抽水
  total_flow NUMERIC(15,2) NOT NULL DEFAULT 0,  -- 总流水
  agent_net_cost NUMERIC(15,2),       -- 代理净成本（房费扣除 - 代理返佣）
  platform_income NUMERIC(15,2),      -- 平台净收益（抽水 + 房费 - 所有返佣）
  end_reason TEXT NOT NULL DEFAULT 'normal', -- 结束原因：normal/early_settle/player_left/force_end
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 房间创建时间
  ended_at TIMESTAMP NOT NULL DEFAULT NOW()    -- 房间结束/归档时间
);

-- 索引：按代理查询历史房间
CREATE INDEX IF NOT EXISTS idx_room_history_agent_id ON room_history(agent_id, ended_at DESC);
-- 索引：按房间号查询（与 game_rounds 关联）
CREATE INDEX IF NOT EXISTS idx_room_history_room_no ON room_history(room_no);
-- 索引：按结束时间范围查询
CREATE INDEX IF NOT EXISTS idx_room_history_ended_at ON room_history(ended_at DESC);

-- 006: 房间模板按游戏特性独立配置（chips/cap/base_bet）
-- 增加字段
ALTER TABLE room_template_config ADD COLUMN IF NOT EXISTS chips JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE room_template_config ADD COLUMN IF NOT EXISTS cap INTEGER NOT NULL DEFAULT 0;
ALTER TABLE room_template_config ADD COLUMN IF NOT EXISTS base_bet INTEGER NOT NULL DEFAULT 0;

-- 德州：chips=筹码面额, cap=单注封顶, base_bet=大盲
UPDATE room_template_config SET chips='[5,10,25]', cap=200, base_bet=10, min_buy_in=500, max_buy_in=2000, credit_requirement=100 WHERE template_code='texas_junior';
UPDATE room_template_config SET chips='[25,50,100]', cap=1000, base_bet=50, min_buy_in=2500, max_buy_in=10000, credit_requirement=1000 WHERE template_code='texas_senior';
UPDATE room_template_config SET chips='[100,200,500]', cap=4000, base_bet=200, min_buy_in=10000, max_buy_in=40000, credit_requirement=5000 WHERE template_code='texas_top';

-- 炸金花：chips=空(全固定金额), cap=看上上限(base*4), base_bet=闷跟额
UPDATE room_template_config SET chips='[]', cap=20, base_bet=5, min_buy_in=100, max_buy_in=1000, credit_requirement=100 WHERE template_code='jinhua_junior';
UPDATE room_template_config SET chips='[]', cap=80, base_bet=20, min_buy_in=500, max_buy_in=5000, credit_requirement=1000 WHERE template_code='jinhua_senior';
UPDATE room_template_config SET chips='[]', cap=160, base_bet=40, min_buy_in=2000, max_buy_in=20000, credit_requirement=3000 WHERE template_code='jinhua_top';

-- 抢庄牛牛：chips=下注档位, cap=累计下注上限, base_bet=最小下注
UPDATE room_template_config SET chips='[5,10,20,50]', cap=100, base_bet=5, min_buy_in=100, max_buy_in=1000, credit_requirement=100 WHERE template_code='niuniu_junior';
UPDATE room_template_config SET chips='[25,50,100,200]', cap=500, base_bet=25, min_buy_in=500, max_buy_in=5000, credit_requirement=1000 WHERE template_code='niuniu_senior';
UPDATE room_template_config SET chips='[100,200,500,1000]', cap=2000, base_bet=100, min_buy_in=2000, max_buy_in=20000, credit_requirement=5000 WHERE template_code='niuniu_top';

-- 抢庄三公：chips=下注档位, cap=累计下注上限, base_bet=最小下注
UPDATE room_template_config SET chips='[5,10,20,50]', cap=100, base_bet=5, min_buy_in=200, max_buy_in=2000, credit_requirement=100 WHERE template_code='sangong_junior';
UPDATE room_template_config SET chips='[25,50,100,200]', cap=500, base_bet=25, min_buy_in=1000, max_buy_in=10000, credit_requirement=1000 WHERE template_code='sangong_senior';
UPDATE room_template_config SET chips='[100,200,500,1000]', cap=2000, base_bet=100, min_buy_in=5000, max_buy_in=50000, credit_requirement=5000 WHERE template_code='sangong_top';

-- 通比牛牛：chips=空(无下注阶段), cap=0, base_bet=固定底注ante
UPDATE room_template_config SET chips='[]', cap=0, base_bet=10, min_buy_in=100, max_buy_in=1000, credit_requirement=100 WHERE template_code='tbnn_junior';
UPDATE room_template_config SET chips='[]', cap=0, base_bet=25, min_buy_in=500, max_buy_in=5000, credit_requirement=1000 WHERE template_code='tbnn_senior';
UPDATE room_template_config SET chips='[]', cap=0, base_bet=50, min_buy_in=2000, max_buy_in=20000, credit_requirement=5000 WHERE template_code='tbnn_top';

-- 验证
SELECT game_type, template_code, min_buy_in, max_buy_in, chips, cap, base_bet, credit_requirement FROM room_template_config ORDER BY game_type, sort_order;

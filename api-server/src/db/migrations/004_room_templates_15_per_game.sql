-- ============================================================
-- 经济模型配置 V2 迁移脚本 004
-- 房间模板修正：5游戏 × 3级别 = 15套模板
-- 信用分门槛统一：初级100 / 高级1000 / 顶级3000
-- ============================================================

-- 1. 清空现有模板（旧的3套全绑texas，不符合业务）
TRUNCATE TABLE room_template_config RESTART IDENTITY CASCADE;

-- 2. 为每个游戏创建3套模板（初级/高级/顶级）
-- 游戏列表：texas(德州扑克)、jinhua(炸金花)、sangong(抢庄三公)、niuniu(抢庄斗牛)、tbnn(通比牛牛)

-- ===== 德州扑克 =====
INSERT INTO room_template_config (template_name, template_code, min_buy_in, max_buy_in, chip_denomination, max_bet_per_round, game_type, default_rounds, max_seats, credit_requirement, sort_order, created_at, updated_at)
VALUES
('德州扑克-初级场', 'texas_junior', 100, 1000, 1, 0, 'texas', 25, 8, 100, 1, NOW(), NOW()),
('德州扑克-高级场', 'texas_senior', 1000, 10000, 1, 0, 'texas', 25, 8, 1000, 2, NOW(), NOW()),
('德州扑克-顶级场', 'texas_top', 10000, 100000, 1, 0, 'texas', 25, 8, 3000, 3, NOW(), NOW());

-- ===== 炸金花 =====
INSERT INTO room_template_config (template_name, template_code, min_buy_in, max_buy_in, chip_denomination, max_bet_per_round, game_type, default_rounds, max_seats, credit_requirement, sort_order, created_at, updated_at)
VALUES
('炸金花-初级场', 'jinhua_junior', 100, 1000, 1, 0, 'jinhua', 25, 8, 100, 1, NOW(), NOW()),
('炸金花-高级场', 'jinhua_senior', 1000, 10000, 1, 0, 'jinhua', 25, 8, 1000, 2, NOW(), NOW()),
('炸金花-顶级场', 'jinhua_top', 10000, 100000, 1, 0, 'jinhua', 25, 8, 3000, 3, NOW(), NOW());

-- ===== 抢庄三公 =====
INSERT INTO room_template_config (template_name, template_code, min_buy_in, max_buy_in, chip_denomination, max_bet_per_round, game_type, default_rounds, max_seats, credit_requirement, sort_order, created_at, updated_at)
VALUES
('抢庄三公-初级场', 'sangong_junior', 100, 1000, 1, 0, 'sangong', 25, 8, 100, 1, NOW(), NOW()),
('抢庄三公-高级场', 'sangong_senior', 1000, 10000, 1, 0, 'sangong', 25, 8, 1000, 2, NOW(), NOW()),
('抢庄三公-顶级场', 'sangong_top', 10000, 100000, 1, 0, 'sangong', 25, 8, 3000, 3, NOW(), NOW());

-- ===== 抢庄斗牛 =====
INSERT INTO room_template_config (template_name, template_code, min_buy_in, max_buy_in, chip_denomination, max_bet_per_round, game_type, default_rounds, max_seats, credit_requirement, sort_order, created_at, updated_at)
VALUES
('抢庄斗牛-初级场', 'niuniu_junior', 100, 1000, 1, 0, 'niuniu', 25, 8, 100, 1, NOW(), NOW()),
('抢庄斗牛-高级场', 'niuniu_senior', 1000, 10000, 1, 0, 'niuniu', 25, 8, 1000, 2, NOW(), NOW()),
('抢庄斗牛-顶级场', 'niuniu_top', 10000, 100000, 1, 0, 'niuniu', 25, 8, 3000, 3, NOW(), NOW());

-- ===== 通比牛牛 =====
INSERT INTO room_template_config (template_name, template_code, min_buy_in, max_buy_in, chip_denomination, max_bet_per_round, game_type, default_rounds, max_seats, credit_requirement, sort_order, created_at, updated_at)
VALUES
('通比牛牛-初级场', 'tbnn_junior', 100, 1000, 1, 0, 'tbnn', 25, 8, 100, 1, NOW(), NOW()),
('通比牛牛-高级场', 'tbnn_senior', 1000, 10000, 1, 0, 'tbnn', 25, 8, 1000, 2, NOW(), NOW()),
('通比牛牛-顶级场', 'tbnn_top', 10000, 100000, 1, 0, 'tbnn', 25, 8, 3000, 3, NOW(), NOW());

-- 3. 验证：按游戏分组统计
SELECT game_type, COUNT(*) as template_count,
       STRING_AGG(template_name, ', ' ORDER BY sort_order) as templates,
       STRING_AGG(credit_requirement::text, ', ' ORDER BY sort_order) as credit_requirements
FROM room_template_config
GROUP BY game_type
ORDER BY game_type;

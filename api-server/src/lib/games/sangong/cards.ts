// Sangong (三公) specific card evaluation
// 牌型与倍数（V3规则）：
// 1. 大三公×6：三张都是公牌(J/Q/K)且点数完全相同（JJJ/QQQ/KKK）
// 2. 小三公×5：三张都是公牌，恰好两张点数相同（JJQ/QQK/KKJ）
// 3. 混三公×5：三张都是公牌且点数各不相同（JQK）
// 4. 豹子×4：三张牌相同（非三公，如AAA/222/.../101010）
// 5. 双公9点×3：恰好两张公牌，第三张点数为9
// 6. 9点×3：单公或无公，三张点数相加取个位为9
// 7. 双公8点×2：恰好两张公牌，第三张点数为8
// 8. 8点×2：单公或无公，点数为8
// 9. 7点及以下×1：其他所有情况（双公0~7点、单公0~7点、无公0~7点）
// 点数计算：A=1, 2~9=对应点数, 10/J/Q/K=0, 三张相加取个位
// 比较规则：牌型优先；同牌型按最大牌比较；同点庄家赢

import { Card } from "../common/cards";

function sangongPoint(rank: number): number {
  if (rank >= 10 && rank <= 13) return 0; // 10/J/Q/K = 0点
  if (rank === 14) return 1; // A = 1点
  return rank; // 2~9 = 对应点数
}

export function sangongScore(three: Card[]): { score: number; name: string; mult: number } {
  const faces = three.filter((c) => c.rank >= 11 && c.rank <= 13).length; // J/Q/K的数量
  const ranks = three.map((c) => c.rank).sort((a, b) => b - a);
  const maxRank = ranks[0];
  const uniq = [...new Set(ranks)];
  const sum = three.reduce((a, c) => a + sangongPoint(c.rank), 0);
  const point = sum % 10;

  // 1. 大三公：三张都是公牌且完全相同（KKK/QQQ/JJJ）×6
  if (faces === 3 && uniq.length === 1) {
    return { score: 90000 + maxRank, name: "大三公", mult: 6 };
  }

  // 2. 小三公：三张都是公牌，恰好两张相同（JJQ/QQK/KKJ）×5
  if (faces === 3 && uniq.length === 2) {
    return { score: 80000 + maxRank, name: "小三公", mult: 5 };
  }

  // 3. 混三公：三张都是公牌且各不相同（JQK）×5
  if (faces === 3 && uniq.length === 3) {
    return { score: 79000 + maxRank, name: "混三公", mult: 5 };
  }

  // 4. 豹子：三张牌相同（非三公，因为三公已在上面判断）×4
  //    包括 AAA/222/.../101010
  if (uniq.length === 1) {
    return { score: 70000 + maxRank, name: "豹子", mult: 4 };
  }

  // 5. 双公9点：恰好两张公牌，第三张点数为9 ×3
  if (faces === 2 && point === 9) {
    return { score: 60000 + maxRank, name: "双公9点", mult: 3 };
  }

  // 6. 9点：单公或无公，点数为9 ×3
  if (point === 9) {
    return { score: 59000 + maxRank, name: "9点", mult: 3 };
  }

  // 7. 双公8点：恰好两张公牌，第三张点数为8 ×2
  if (faces === 2 && point === 8) {
    return { score: 50000 + maxRank, name: "双公8点", mult: 2 };
  }

  // 8. 8点：单公或无公，点数为8 ×2
  if (point === 8) {
    return { score: 49000 + maxRank, name: "8点", mult: 2 };
  }

  // 9. 7点及以下：其他所有情况 ×1
  //    包括双公0~7点、单公0~7点、无公0~7点
  // 分数设计：point*1000 + faces*100 + maxRank
  //   - 点数优先（point占千位）
  //   - 同点数时公牌多者胜（faces占百位）
  //   - 同点数同公牌数时最大牌大者胜（maxRank占个位）
  const name = point === 0 ? "无点" : `${point}点`;
  return { score: point * 1000 + faces * 100 + maxRank, name, mult: 1 };
}

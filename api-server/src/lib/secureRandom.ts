import crypto from "crypto";

/**
 * 生成 [0, 1) 之间的安全随机数（使用 crypto）
 */
export function secureRandom(): number {
  // 生成4字节随机数，除以 2^32 得到 [0, 1)
  const buf = crypto.randomBytes(4);
  return buf.readUInt32BE(0) / 0x100000000;
}

/**
 * 生成 [min, max) 之间的安全随机整数
 */
export function secureRandomInt(min: number, max: number): number {
  return Math.floor(secureRandom() * (max - min)) + min;
}

/**
 * Fisher-Yates 洗牌（使用安全随机数）
 */
export function secureShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 掷骰子：返回 1-6
 */
export function rollDice(): number {
  return secureRandomInt(1, 7);
}

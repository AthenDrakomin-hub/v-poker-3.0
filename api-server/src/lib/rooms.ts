export const LEVELS = {
  junior: {
    name: "初级场",
    min: 50,
    max: 500,
    creditReq: 100,
    /** 可用筹码面额 */
    chips: [1, 5, 10] as number[],
    /** 单次下注封顶 */
    cap: 50,
  },
  senior: {
    name: "高级场",
    min: 500,
    max: 5000,
    creditReq: 1000,
    chips: [5, 10, 50] as number[],
    cap: 250,
  },
  top: {
    name: "顶级场",
    min: 5000,
    max: 50000,
    creditReq: 5000,
    chips: [10, 50, 100] as number[],
    cap: 1000,
  },
} as const;

export type Level = keyof typeof LEVELS;

export function levelForCredit(credit: number): Level[] {
  const arr: Level[] = ["junior"];
  if (credit >= LEVELS.senior.creditReq) arr.push("senior");
  if (credit >= LEVELS.top.creditReq) arr.push("top");
  return arr;
}

export function chipsFor(level: string): number[] {
  return [...(LEVELS[level as Level]?.chips ?? LEVELS.junior.chips)];
}

export function capFor(level: string): number {
  return LEVELS[level as Level]?.cap ?? LEVELS.junior.cap;
}

/** 底注 = 最小面额 */
export function anteFor(level: string): number {
  return chipsFor(level)[0];
}

export function limitText(level: string): string {
  const c = chipsFor(level);
  return `${c.join(" / ")} · 单注封顶 ${capFor(level)}`;
}

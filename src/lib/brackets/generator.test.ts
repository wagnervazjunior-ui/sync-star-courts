import { describe, it, expect } from "vitest";
import { generateDoubleElim, standardSeedOrder, evaluateMatch } from "./generator";

describe("standardSeedOrder", () => {
  it("size 16 produces expected pairs", () => {
    const order = standardSeedOrder(16);
    const pairs: [number, number][] = [];
    for (let i = 0; i < order.length / 2; i++) pairs.push([order[i * 2], order[i * 2 + 1]]);
    expect(pairs).toEqual([
      [1, 16], [8, 9], [4, 13], [5, 12],
      [2, 15], [7, 10], [3, 14], [6, 11],
    ]);
  });
});

describe("generateDoubleElim", () => {
  it("16 teams produces complete WB + LB + final four", () => {
    const m = generateDoubleElim(16);
    expect(m.filter((x) => x.phase === "WB" && x.round === 1)).toHaveLength(8);
    expect(m.find((x) => x.phase === "SEMI" && x.position === 1)).toBeTruthy();
    expect(m.find((x) => x.phase === "FINAL")).toBeTruthy();
    expect(m.find((x) => x.phase === "THIRD")).toBeTruthy();
  });
  it("handles non-power-of-2 (18 teams) with byes", () => {
    const m = generateDoubleElim(18);
    const r1 = m.filter((x) => x.phase === "WB" && x.round === 1);
    expect(r1.length).toBeGreaterThan(0);
    const byes = r1.filter((x) => x.bye);
    expect(byes.length).toBeGreaterThan(0);
  });
});

describe("evaluateMatch", () => {
  it("single_set returns winner", () => {
    expect(evaluateMatch([{ a: 18, b: 12 }], "single_set")).toBe("a");
    expect(evaluateMatch([{ a: 10, b: 18 }], "single_set")).toBe("b");
  });
  it("best_of_3 needs 2 wins", () => {
    expect(evaluateMatch([{ a: 6, b: 4 }], "best_of_3_tiebreak")).toBeNull();
    expect(evaluateMatch([{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 15, b: 12 }], "best_of_3_tiebreak")).toBe("a");
    expect(evaluateMatch([{ a: 6, b: 4 }, { a: 6, b: 4 }], "best_of_3_tiebreak")).toBe("a");
  });
});

import { describe, expect, test } from "bun:test";
import { passAtOne, round, wilson95 } from "./stats.mjs";

describe("passAtOne", () => {
  test("empty outcomes is 0, not NaN", () => {
    expect(passAtOne([])).toBe(0);
  });

  test("fraction of passing outcomes", () => {
    expect(passAtOne([{ pass: true }, { pass: true }, { pass: false }, { pass: false }])).toBe(0.5);
  });

  test("all pass is 1", () => {
    expect(passAtOne([{ pass: true }, { pass: true }])).toBe(1);
  });
});

describe("wilson95", () => {
  test("n=0 returns zero-width interval at zero, not NaN/Infinity", () => {
    expect(wilson95(0, 0)).toEqual({ low: 0, high: 0 });
  });

  test("interval always contains the point estimate", () => {
    const { low, high } = wilson95(3, 4);
    const phat = 3 / 4;
    expect(low).toBeLessThanOrEqual(phat);
    expect(high).toBeGreaterThanOrEqual(phat);
  });

  test("bounds stay within [0, 1]", () => {
    const { low, high } = wilson95(5, 5);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
  });

  test("wider n narrows the interval for the same proportion", () => {
    const small = wilson95(5, 10);
    const large = wilson95(50, 100);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
  });
});

describe("round", () => {
  test("defaults to 4 decimal places", () => {
    expect(round(1 / 3)).toBe(0.3333);
  });

  test("respects an explicit precision", () => {
    expect(round(1 / 3, 2)).toBe(0.33);
  });

  test("stable comparison: two floats that differ past precision compare equal", () => {
    expect(round(0.1 + 0.2, 4)).toBe(round(0.3, 4));
  });
});

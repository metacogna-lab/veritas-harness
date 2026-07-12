/**
 * Shared statistics for the benchmark harness and the reproducibility guard.
 * Kept dependency-free so both .mjs scripts can import it.
 */

/** pass@1 = fraction of tasks that passed. */
export function passAtOne(outcomes) {
  if (outcomes.length === 0) return 0;
  const passed = outcomes.filter((o) => o.pass === true).length;
  return passed / outcomes.length;
}

/**
 * Wilson score interval for a binomial proportion at 95% (z = 1.96).
 * Returns { low, high }. Small-n results should be reported WITH this interval,
 * never as a definitive point estimate (see plan 05 standing rule).
 */
export function wilson95(passed, n) {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.959963984540054;
  const phat = passed / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/** Round to a fixed number of decimals for stable comparison. */
export function round(x, dp = 4) {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

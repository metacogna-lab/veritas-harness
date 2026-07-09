import { test, expect } from "bun:test";
import { ContextWindow } from "./context-window.ts";

test("render stays at or under the hard token ceiling as turns accumulate", () => {
  const win = new ContextWindow({ maxTokens: 50 }); // ~200 chars
  for (let i = 0; i < 40; i++) win.append(`turn ${i}: ${"x".repeat(40)}`);
  expect(win.tokens()).toBeLessThanOrEqual(50);
});

test("older turns roll into the summary; recent turns stay verbatim", () => {
  const win = new ContextWindow({ maxTokens: 8 }); // ~32 chars — forces eviction across 3 turns
  win.append("first turn content here");
  win.append("second turn content here");
  win.append("third turn content here");
  // The most recent turn is always retained verbatim.
  expect(win.recent.at(-1)).toBe("third turn content here");
  // Something was evicted into the summary.
  expect(win.summary.length).toBeGreaterThan(0);
});

test("keeps at least one recent turn even when a single turn is large", () => {
  const win = new ContextWindow({ maxTokens: 10 });
  win.append("a very long single turn that alone exceeds the ceiling ".repeat(5));
  expect(win.recent).toHaveLength(1);
  // Last-resort truncation still bounds the rendered window.
  expect(win.tokens()).toBeLessThanOrEqual(10);
});

test("scratchpad is included in the rendered window", () => {
  const win = new ContextWindow({ maxTokens: 100 });
  win.append("turn one");
  win.setScratchpad("hypothesis: X");
  expect(win.render()).toContain("hypothesis: X");
});

test("rejects a non-positive ceiling", () => {
  expect(() => new ContextWindow({ maxTokens: 0 })).toThrow(/positive/);
});

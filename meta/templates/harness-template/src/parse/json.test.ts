import { test, expect } from "bun:test";
import { parseLastObject } from "./json.ts";

test("parses a fenced object surrounded by prose", () => {
  const text = 'Here is my answer:\n```json\n{"action":"read","path":"a"}\n```\nDone.';
  expect(parseLastObject(text)).toEqual({ action: "read", path: "a" });
});

test("returns the LAST parseable object when several are present", () => {
  const text = '{"draft":1} ... on reflection: {"action":"final","answer":"ok"}';
  expect(parseLastObject(text)).toEqual({ action: "final", answer: "ok" });
});

test("braces inside strings do not corrupt balance", () => {
  expect(parseLastObject('{"note":"a } b { c"}')).toEqual({ note: "a } b { c" });
});

test("returns undefined when nothing parses", () => {
  expect(parseLastObject("no json here")).toBeUndefined();
});

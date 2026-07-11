import { describe, expect, test } from "bun:test";
import { parseLastObject, parseLastArray } from "./json.ts";

describe("parseLastObject", () => {
  test("parses a bare object", () => {
    expect(parseLastObject('{"a":1}')).toEqual({ a: 1 });
  });

  test("strips a fenced json block", () => {
    const text = 'Here is the plan:\n```json\n{"action":"read","path":"x"}\n```\nDone.';
    expect(parseLastObject(text)).toEqual({ action: "read", path: "x" });
  });

  test("ignores trailing prose after the object", () => {
    const text = '{"tool":"http_get"}\nI will now call it.';
    expect(parseLastObject(text)).toEqual({ tool: "http_get" });
  });

  test("returns the LAST valid object when several are present", () => {
    const text = 'First thought: {"draft":true}\nFinal answer: {"draft":false,"answer":42}';
    expect(parseLastObject(text)).toEqual({ draft: false, answer: 42 });
  });

  test("tolerates stray braces inside string values", () => {
    const text = '{"note":"use { and } carefully","ok":true}';
    expect(parseLastObject(text)).toEqual({ note: "use { and } carefully", ok: true });
  });

  test("tolerates escaped quotes inside strings", () => {
    const text = '{"q":"she said \\"hi\\""}';
    expect(parseLastObject(text)).toEqual({ q: 'she said "hi"' });
  });

  test("does not treat a bare array as an object", () => {
    expect(parseLastObject("[1,2,3]")).toBeUndefined();
  });

  test("returns undefined when nothing parses", () => {
    expect(parseLastObject("no json here at all")).toBeUndefined();
  });

  test("handles nested objects", () => {
    const text = 'prose {"outer":{"inner":{"deep":1}}} more prose';
    expect(parseLastObject(text)).toEqual({ outer: { inner: { deep: 1 } } });
  });
});

describe("parseLastArray", () => {
  test("parses a bare array", () => {
    expect(parseLastArray("[1,2,3]")).toEqual([1, 2, 3]);
  });

  test("returns the last valid array", () => {
    const text = "candidates [1,2] then final [3,4,5]";
    expect(parseLastArray(text)).toEqual([3, 4, 5]);
  });

  test("strips fences around arrays", () => {
    expect(parseLastArray('```json\n["a","b"]\n```')).toEqual(["a", "b"]);
  });

  test("does not treat an object as an array", () => {
    expect(parseLastArray('{"a":1}')).toBeUndefined();
  });

  test("returns undefined when nothing parses", () => {
    expect(parseLastArray("nothing")).toBeUndefined();
  });
});

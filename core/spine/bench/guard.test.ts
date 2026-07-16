import { describe, expect, test } from "bun:test";
import { antiFittingGuard, AntiFittingViolation } from "./guard.ts";

describe("antiFittingGuard", () => {
  test("passes a task-agnostic solver", () => {
    const sources = ["export const solve = (input) => checkScope(input.call, input.scope);"];
    expect(() => antiFittingGuard({ sources, taskIds: ["sg-01", "sg-02"], oracleAnswers: ["allow", "deny"] })).not.toThrow();
  });

  test("FAILS the build when the solver references a specific task id (deliberately-bad case)", () => {
    const sources = ['function solve(t){ if (t.id === "sg-01") return "allow"; return "deny"; }'];
    expect(() => antiFittingGuard({ sources, taskIds: ["sg-01", "sg-02"], oracleAnswers: ["allow", "deny"] })).toThrow(
      AntiFittingViolation,
    );
  });

  test("FAILS when the solver embeds a distinctive oracle answer literal", () => {
    const sources = ['const answer = "the-secret-expected-output-42";'];
    expect(() =>
      antiFittingGuard({ sources, taskIds: ["t1"], oracleAnswers: ["the-secret-expected-output-42"] }),
    ).toThrow(AntiFittingViolation);
  });

  test("does not flag short generic domain tokens like allow/deny", () => {
    const sources = ['return decision.allowed ? "allow" : "deny";'];
    expect(() => antiFittingGuard({ sources, taskIds: ["t1"], oracleAnswers: ["allow", "deny"] })).not.toThrow();
  });
});

/**
 * Solver for the scope-gate suite: the system under test is the harness's own
 * scope gate. Given a task's { call, scope }, run checkScope and map the
 * decision to the oracle's vocabulary ("allow"/"deny").
 *
 * TASK-AGNOSTIC by construction: it never references a task id or a per-task
 * answer — it applies the same gate to every input. The anti-fitting guard
 * scans this file to enforce that.
 */
import { checkScope } from "../../../../core/spine/safety/scope.ts";

export function solve(input) {
  const decision = checkScope(input.call, input.scope);
  return decision.allowed ? "allow" : "deny";
}

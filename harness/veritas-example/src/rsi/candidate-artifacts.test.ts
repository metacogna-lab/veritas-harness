import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeLoadoutCandidateArtifacts } from "./candidate-artifacts.ts";

test("writeLoadoutCandidateArtifacts writes review files", () => {
  const root = mkdtempSync(join(tmpdir(), "rsi-art-"));
  try {
    const paths = writeLoadoutCandidateArtifacts(root, {
      proposal: {
        id: "dry-p1",
        patternId: "p1",
        targetPath: "src/safety/scope.ts",
        description: "tighten",
        diff: "--- a\n+++ b\n",
        rationale: "test",
      },
      validation: {
        proposalId: "dry-p1",
        heldInPass: false,
        heldOutPass: false,
        eligible: false,
        detail: "skipped",
      },
      pattern: { id: "p1", signature: "SCOPE DENIED", count: 1, members: [], groundedBy: "verifier" },
      instructions: "review only",
    });
    expect(existsSync(paths.reasoning)).toBe(true);
    expect(readFileSync(paths.reasoning, "utf8")).toContain("SCOPE DENIED");
    expect(existsSync(paths.proposedLoadout)).toBe(true);
    expect(existsSync(paths.candidateEval)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

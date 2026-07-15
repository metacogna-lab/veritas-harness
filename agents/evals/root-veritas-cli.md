# Eval — root `veritas` CLI launcher

**Date:** 2026-07-15  **Scope:** `meta/veritas.ts`, root `package.json` `bin` + `scripts.veritas`.

## Definition of done → evidence

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Root can invoke the harness CLI as `veritas [flags]` | ✅ | `package.json` `"bin": { "veritas": "./meta/veritas.ts" }` + `"scripts": { "veritas": "bun meta/veritas.ts" }` |
| Launcher resolves a registered harness | ✅ | defaults to research-capable (`veritas-example`); `--harness` / `VERITAS_HARNESS` override |
| Launcher forwards argv to `harness/<name>/src/cli.ts` | ✅ | `launchVeritas` strips meta flags then spawns `bun <cli> …` with caller cwd |
| Unit coverage for selection + peel + spawn | ✅ | `meta/veritas.test.ts` |

## Test results

- Meta suite including new launcher tests: green (`bun test meta`).

## Safety review

- Thin spawn-only wrapper; inherits existing harness scope/approval gates. No safety bypass.

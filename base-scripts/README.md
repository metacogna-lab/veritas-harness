# base-scripts

Scripts applicable to every harness in this repo. Harnesses reference these via their `package.json` scripts rather than duplicating them locally.

## Usage

Reference from any harness `package.json`:

```json
{
  "scripts": {
    "doctor":         "bun ../../base-scripts/doctor.mjs",
    "veritas-config": "bun ../../base-scripts/veritas-config.mjs"
  }
}
```

Domain-specific scripts (bench, verify-claims, lessons, etc.) live in each harness's own `scripts/` directory and import shared utilities from `../../base-scripts/lib/`.

## Contents

| Path | Purpose |
|------|---------|
| `doctor.mjs` | Universal environment health check — structural files, Bun/Node version, config load, provider credentials, PATH |
| `veritas-config.mjs` | Interactive config wizard — writes `src/config/local.json` (gitignored) |
| `lib/stats.mjs` | Shared statistics utilities — `passAtOne`, `wilson95`, `round` — used by bench and verify-claims |

## Rules

- Scripts run via `bun run <script>` from a harness package directory; `process.cwd()` is the harness root
- Use `process.cwd()` + dynamic `await import(...)` to access harness-specific TypeScript modules (`src/config/`, etc.)
- No harness-specific business logic here — only cross-cutting infrastructure
- Adding a new base script: create it here, add it to the table above, update `meta/templates/harness-template/package.json`

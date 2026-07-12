# Veritas Use Cases

A field guide for operators: what to run, when to run it, and where things land.

---

## Mental model first

Three concepts that are easy to conflate:

| Concept | What it is | Where it lives |
|---------|-----------|----------------|
| **Harness** | An instantiated agent domain (ReAct loop + tools + specialists + safety spine) | `harness/<name>/` — created by `bun run create-harness <name>` |
| **Target / scope** | What the harness is *authorised to touch* on this mission | Passed as `--target`; enforced by the scope gate — never a folder in this repo |
| **Mission output** | Runs, findings, transcripts, experience data | `.veritas/runs/` inside the harness; experience store at `resources/experience/` |

**The repo does not contain a `projects/` folder and should not.** Projects you want to analyse live wherever they naturally live on your filesystem. You grant the harness access to them at runtime via `--target`, and the scope gate (`src/safety/scope.ts`) enforces that nothing outside that path (or host) is ever touched.

---

## Use case 1 — Research a topic from a brief

**When:** You have a research question. You want the harness to read a corpus of sources, synthesise findings, and produce a verified report.

```bash
# 1. Write your brief to the ingest buffer
cp my-topic-brief.md harness/veritas-research/ingest/NEW.md

# 2. Compile it into a structured research plan
cd harness/veritas-research
bun run ingest --input ingest/NEW.md

# Output: missions/<slug>/research-plan.json

# 3. Evaluate the plan (dogma gate — catches bad scope, missing sources)
bun run dev eval --plan missions/<slug>/research-plan.json

# 4. Digest sources (fetch + summarise in scope)
bun run dev digest --plan missions/<slug>/research-plan.json

# 5. Run the full mission
bun run dev start --plan missions/<slug>/research-plan.json
```

**Scope for this use case:** The research harness accepts either a filesystem path (a directory of source files) or a comma-separated list of hostnames. Your `research/processed/` folder is the canonical source corpus — run missions against it:

```bash
bun run dev start "identify open problems in RSI literature" \
  --target research/processed/
```

The scope gate will allow reads inside `research/processed/` and deny everything outside it.

**Output lands in:** `.veritas/runs/<mission-id>/` (snapshot + transcript) and `resources/experience/<mission-id>/` (queryable history for the RSI loop).

---

## Use case 2 — Audit a codebase

**When:** You want to point the harness at an existing codebase (anywhere on your filesystem) and have it summarise or audit it.

```bash
cd harness/veritas-research

bun run dev start "identify security anti-patterns in the auth module" \
  --target /path/to/your/project \
  --loadout codebase-audit \
  --role auditor
```

The `codebase-audit` loadout uses `read_file` and `list_dir` only. The scope gate restricts every tool call to paths under `/path/to/your/project`. Nothing outside that tree is readable, and filesystem writes and shell are disabled by default.

**To audit this repo's own harness source:**

```bash
bun run dev start "summarise the safety plane architecture" \
  --target /Users/nullzero/sensai-org/veritas/harness/veritas-research/src/safety \
  --loadout codebase-audit
```

---

## Use case 3 — Web reconnaissance on authorised hosts

**When:** You have explicit authorisation to gather information from a set of hosts.

```bash
bun run dev start "map the public API surface of example.com" \
  --target example.com \
  --loadout web-recon
```

The `web-recon` loadout uses `http_get` only. Loopback and private ranges are denied by the scope gate even if you accidentally include them in the target string. Only the exact hosts (and their subdomains) declared in `--target` are reachable.

---

## Use case 4 — Create a new harness for a new domain

**When:** You have a new capability domain that needs its own tools, specialists, and benchmark — but wants to reuse the Veritas loop, safety spine, and evidence ledger.

```bash
# From the meta-harness root:
bun run create-harness my-domain

cd harness/my-domain
bun install && bun test
```

The pipeline scaffolds the full 8-plane spine under `harness/my-domain/`, installs capability packs, writes `harness.json`, and registers the harness in `harnesses.json`. You then edit exactly three things:

1. `src/tools/` — add the tools your domain needs
2. `src/agent/specialists.ts` — define roles, system prompts, and tool allowlists
3. The `TargetAdapter` in your loadout — how a domain-specific target string becomes a `MissionScope`

Everything else (ReAct loop, scope gate, approval tiers, evidence ledger, refuter, RSI pipeline, benchmarks) is inherited unchanged.

**New harnesses never go into a `projects/` folder.** The registry (`harnesses.json`) and the canonical path (`harness/<name>/`) are the contract.

---

## Use case 5 — Self-improvement (RSI outer loop)

**When:** You've accumulated mission history and want the harness to propose improvements to its own loadouts.

```bash
cd harness/veritas-research

# Dry-run only — proposes edits, never applies them without human release
bun run dev rsi

# Or via the slash command in Claude Code:
# /evolve-harness
```

The RSI loop:
1. Mines failure patterns from `resources/experience/`
2. Proposes bounded loadout edits
3. Validates the candidate against committed benchmarks (`bun run bench`)
4. Surfaces a human review packet — you decide whether to apply

**The loop never self-applies.** Invariant #5: human before consequence.

---

## Use case 6 — Verify a finding

**When:** A mission produced a finding you want to adversarially verify before acting on it.

```bash
bun run verify-finding
```

This runs the refuter (`src/evidence/refuter.ts`) against the finding: a separate model instance at different temperature tries to disprove it using only committed mission evidence. If the refuter fails → confirmed. If it succeeds → retracted with the reason logged.

---

## Where things live (quick reference)

```
harness/veritas-research/
  .veritas/runs/             mission snapshots (VERITAS_RUNS_DIR)
  resources/experience/      queryable per-mission history (RSI input)
  resources/lessons.json     lessons delta store
  missions/<slug>/           ingested research plans
  resources/summary/<slug>/  source digests (from bun run dev digest)
  bench/                     committed oracle suites + baseline results
  ingest/                    NEW.md (your brief, gitignored), TEMP.md

research/                    source material (above the harness, in the meta root)
  raw/                       PDFs + markdown summaries of source papers
  processed/                 structured digests, one per paper (canonical --target corpus)
  meta-analyses/             cross-paper synthesis outputs
```

---

## What `--target` is (and is not)

`--target` is a scope declaration, not an output path, not a project folder, not a harness location.

- `--target /some/path` → the harness may read (and, if the loadout allows, write) inside that path. The scope gate enforces this at every tool call.
- `--target example.com` → the harness may make HTTP GET requests to `example.com` and its subdomains.
- Projects you want to analyse live wherever they naturally live. You grant temporary, scoped access at mission start. When the mission ends, no harness state is written inside the target — output always goes to `.veritas/runs/` and `resources/experience/`.

---

## Safety invariants that apply to every use case

| # | Invariant | Effect |
|---|-----------|--------|
| 1 | Scope before action | No tool fires outside the declared `--target` |
| 2 | Fail-safe deny | Unattended gated tools (intrusive/credential/dangerous) are denied, never silently fired |
| 3 | Provenance before claim | A finding without a real tool observation in the transcript is rejected |
| 4 | Refute before confirm | A second model must fail to disprove before a finding is promoted |
| 5 | Human before consequence | Send / publish / delete / deploy actions stop one step short — you execute |
| 6 | Reproduce before report | Every headline number re-derives from committed artifacts via `bun run verify-claims` |
| 7 | Honest decomposition | Orchestrator workers always see a truthful description of their subtask |
| 8 | Compose, don't fork | New domains are a new Loadout + tool registration, never a copy of the agent loop |

These invariants are baked into code and tests. They are not configuration.

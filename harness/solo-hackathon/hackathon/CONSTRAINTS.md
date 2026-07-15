# CONSTRAINTS

## Time

| Bound | Value |
|---|---|
| Total sitting | ≤ 4 hours |
| Step 1 framing | ≤ 20 min (files already written = framing locked) |
| Step 2 MVP lock | ≤ 15 min |
| Step 3 build | ≥ 2.5 hours |
| Step 4 demo package | ≤ 30 min |

## Tools (in)

- This harness (`harness/solo-hackathon`) and its `read_file` spine
- Meta `create-harness --from-spec` path already used to mint this kit
- Local editor + `bun` test/doctor only

## Tools (out)

- Live network providers unless `ANTHROPIC_API_KEY` (or local provider) is explicitly configured for a later mission
- Multi-repo refactors outside `harness/solo-hackathon/`
- New permanent dependencies without a human release

## Scope paths (in)

- `harness/solo-hackathon/`
- `agents/specs/solo-hackathon.json`
- `scripts/test-solo-hackathon-harness.sh`
- `logs/solo-hackathon-run-*.md`

## Out of scope

- Changing `veritas-research` / `veritas-example` domain logic
- Forking the ReAct loop (invariant #8)
- Dangerous / credential risk-tier tools
- Publishing, deploying, or disclosing anything external (human-before-consequence)

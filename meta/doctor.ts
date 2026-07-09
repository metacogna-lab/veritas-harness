/**
 * `bun run harness-doctor` — meta-level healthcheck.
 *
 * Verifies the meta layer is coherent: registry loads, every registered harness
 * exists on disk with a package.json and a harness.json manifest, and each
 * manifest agrees with its registry entry. Per-harness runtime health (providers,
 * keys) is the individual harness's own `bun run doctor`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readRegistry } from "./registry.ts";
import { readManifest } from "./manifest.ts";

interface Check {
  ok: boolean;
  label: string;
  detail?: string;
}

export function runDoctor(root: string): Check[] {
  const checks: Check[] = [];
  let registry;
  try {
    registry = readRegistry(root);
    checks.push({ ok: true, label: "registry loads", detail: `${registry.harnesses.length} harness(es)` });
  } catch (err) {
    checks.push({ ok: false, label: "registry loads", detail: (err as Error).message });
    return checks;
  }

  for (const h of registry.harnesses) {
    const dir = join(root, h.path);
    const dirOk = existsSync(dir);
    checks.push({ ok: dirOk, label: `#${h.index} ${h.name}: directory`, detail: h.path });
    if (!dirOk) continue;

    checks.push({ ok: existsSync(join(dir, "package.json")), label: `#${h.index} ${h.name}: package.json` });

    try {
      const manifest = readManifest(dir);
      const agrees = manifest.name === h.name && manifest.index === h.index;
      checks.push({
        ok: agrees,
        label: `#${h.index} ${h.name}: manifest agrees with registry`,
        detail: agrees ? undefined : `manifest says ${manifest.name}#${manifest.index}`,
      });
    } catch (err) {
      checks.push({ ok: false, label: `#${h.index} ${h.name}: harness.json`, detail: (err as Error).message });
    }
  }
  return checks;
}

function main(): void {
  const checks = runDoctor(process.cwd());
  for (const c of checks) {
    const mark = c.ok ? "✅" : "❌";
    process.stdout.write(`${mark} ${c.label}${c.detail ? ` — ${c.detail}` : ""}\n`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  if (failed > 0) {
    process.stdout.write(`\n${failed} check(s) failed.\n`);
    process.exit(1);
  }
  process.stdout.write("\nMeta layer healthy.\n");
}

if (import.meta.main) main();

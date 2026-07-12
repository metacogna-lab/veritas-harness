#!/usr/bin/env bun
/**
 * Interactive harness config wizard — writes src/config/local.json.
 * Run via `bun run veritas-config` from any harness directory.
 *
 *   bun run veritas-config
 */
import { createInterface } from "node:readline/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const CONFIG_DIR = join(root, "src/config");
const OUTPUT = join(CONFIG_DIR, "local.json");

const { listProviders, getProviderDef } = await import(join(root, "src/config/providers.ts"));

const rl = createInterface({ input: process.stdin, output: process.stdout });

function print(msg) {
  process.stdout.write(`${msg}\n`);
}

async function ask(prompt, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${prompt}${suffix}: `)).trim();
  return answer || defaultValue || "";
}

async function pickProvider(prompt, defaultId) {
  const providers = listProviders();
  print("\nProviders:");
  providers.forEach((p, i) => print(`  ${i + 1}. ${p.id} — ${p.label}`));

  while (true) {
    const raw = await ask(prompt, defaultId);
    const byNum = Number(raw);
    if (byNum >= 1 && byNum <= providers.length) return providers[byNum - 1].id;
    const match = providers.find((p) => p.id === raw);
    if (match) return match.id;
    print(`Invalid choice. Enter 1-${providers.length} or a provider id.`);
  }
}

async function pickModel(provider) {
  const def = getProviderDef(provider);
  print(`\nModels for ${provider}:`);
  def.availableModels.forEach((m, i) => print(`  ${i + 1}. ${m}`));

  while (true) {
    const raw = await ask("Model (number, name, or custom)", def.defaultModel);
    const byNum = Number(raw);
    if (byNum >= 1 && byNum <= def.availableModels.length) return def.availableModels[byNum - 1];
    if (def.availableModels.includes(raw)) return raw;
    if (raw) return raw;
    print("Enter a model name or number from the list.");
  }
}

async function main() {
  print("Veritas harness config wizard");
  print("Writes src/config/local.json (gitignored).\n");

  const defaultProvider = await pickProvider("Default provider", "anthropic");
  const defaultModel = await pickModel(defaultProvider);

  const providers = [{ provider: defaultProvider, model: defaultModel }];

  const addFallback = await ask("Add fallback providers? (y/N)", "N");
  if (addFallback.toLowerCase() === "y") {
    let more = true;
    while (more) {
      const fb = await pickProvider("Fallback provider", "ollama");
      if (providers.some((p) => p.provider === fb)) {
        print(`${fb} already in chain.`);
      } else {
        const model = await pickModel(fb);
        const entry = { provider: fb, model };
        if (fb === "ollama") {
          entry.baseUrl = await ask(
            "Ollama baseUrl",
            getProviderDef("ollama").defaultBaseUrl ?? "http://127.0.0.1:11434/v1",
          );
        }
        providers.push(entry);
      }
      const again = await ask("Add another fallback? (y/N)", "N");
      more = again.toLowerCase() === "y";
    }
  }

  if (defaultProvider === "ollama") {
    const primary = providers.find((p) => p.provider === "ollama");
    if (primary && !primary.baseUrl) {
      primary.baseUrl = await ask(
        "Ollama baseUrl",
        getProviderDef("ollama").defaultBaseUrl ?? "http://127.0.0.1:11434/v1",
      );
    }
  }

  const config = { defaultProvider, providers };
  print("\nPreview:");
  print(JSON.stringify(config, null, 2));

  const confirm = await ask("Write local.json? (Y/n)", "Y");
  if (confirm.toLowerCase() === "n") {
    print("Aborted.");
    rl.close();
    return 0;
  }

  writeFileSync(OUTPUT, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  print(`\nWrote ${OUTPUT}`);
  print("Run: bun run doctor");
  rl.close();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  });

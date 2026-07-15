/**
 * Default loadout registry — empty unless HarnessSpec codegen wrote entries
 * into loadouts.generated.ts (--from-spec path).
 */
import { LoadoutRegistry, fromGeneratedLoadout } from "./specialists.ts";
import { generatedLoadouts } from "./loadouts.generated.ts";

/** Build the registry used by CLI / control plane entry points. */
export function defaultLoadouts(): LoadoutRegistry {
  const reg = new LoadoutRegistry();
  for (const g of generatedLoadouts) {
    reg.register(fromGeneratedLoadout(g));
  }
  return reg;
}

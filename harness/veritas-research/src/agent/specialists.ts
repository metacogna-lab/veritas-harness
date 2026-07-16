/**
 * Specialists and Loadouts — invariant #8: compose, don't fork.
 *
 * A new "purpose" (domain objective) is added by registering a Loadout, never
 * by copying the agent loop. A Loadout bundles:
 *   - specialists (role + system prompt + tool allowlist),
 *   - the tool subset the domain needs,
 *   - a target adapter (how a mission's scope is described for this domain),
 *   - an optional benchmark suite name.
 *
 * The agent loop, gates, ledger, refuter, and control plane are all reused
 * unchanged. Only the three things in `Loadout` vary per domain.
 */
import type { MissionScope } from "@spine/safety/scope.ts";

export interface Specialist {
  role: string;
  systemPrompt: string;
  /** Names of tools this specialist may use (subset of the loadout's tools). */
  toolAllowlist: string[];
}

/**
 * A target adapter turns a domain's notion of "what am I allowed to touch" into
 * a concrete MissionScope, and renders that scope as human-readable text for
 * prompts and reports. This is the ONLY place a domain expresses its target.
 */
export interface TargetAdapter {
  name: string;
  /** Build a MissionScope from a domain-specific target description. */
  buildScope: (target: string) => MissionScope;
  /** Human-readable one-line description of a scope, for prompts/reports. */
  describeScope: (scope: MissionScope) => string;
}

export interface Loadout {
  name: string;
  description: string;
  specialists: Specialist[];
  /** Tool names this loadout exposes (a subset of the base registry). */
  toolNames: string[];
  targetAdapter: TargetAdapter;
  benchmark?: string;
}

/** Registry of loadouts — the mechanism that makes the harness multi-purpose. */
export class LoadoutRegistry {
  private readonly loadouts = new Map<string, Loadout>();

  register(loadout: Loadout): this {
    if (this.loadouts.has(loadout.name)) {
      throw new Error(`loadout "${loadout.name}" already registered`);
    }
    // A specialist may only allowlist tools the loadout actually exposes.
    for (const s of loadout.specialists) {
      for (const t of s.toolAllowlist) {
        if (!loadout.toolNames.includes(t)) {
          throw new Error(
            `loadout "${loadout.name}": specialist "${s.role}" allowlists "${t}" which the loadout does not expose`,
          );
        }
      }
    }
    this.loadouts.set(loadout.name, loadout);
    return this;
  }

  get(name: string): Loadout | undefined {
    return this.loadouts.get(name);
  }

  has(name: string): boolean {
    return this.loadouts.has(name);
  }

  list(): Loadout[] {
    return [...this.loadouts.values()];
  }

  /** Find the specialist within a loadout by role, or the first one. */
  specialist(loadoutName: string, role?: string): Specialist | undefined {
    const loadout = this.loadouts.get(loadoutName);
    if (!loadout) return undefined;
    if (!role) return loadout.specialists[0];
    return loadout.specialists.find((s) => s.role === role);
  }

  /** Alias for specialist() — select a specialist by role within a loadout. */
  selectSpecialist(loadoutName: string, role?: string): Specialist | undefined {
    return this.specialist(loadoutName, role);
  }
}

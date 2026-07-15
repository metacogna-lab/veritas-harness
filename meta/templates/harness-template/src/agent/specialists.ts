/**
 * Specialists and Loadouts — invariant #8: compose, don't fork.
 * Template copy of the registry spine; generated harnesses register via loadouts.ts.
 */
import type { MissionScope } from "../safety/scope.ts";

export interface Specialist {
  role: string;
  systemPrompt: string;
  /** Names of tools this specialist may use (subset of the loadout's tools). */
  toolAllowlist: string[];
}

/** Domain → MissionScope adapter (the only place a domain expresses its target). */
export interface TargetAdapter {
  name: string;
  buildScope: (target: string) => MissionScope;
  describeScope: (scope: MissionScope) => string;
}

export interface Loadout {
  name: string;
  description: string;
  specialists: Specialist[];
  toolNames: string[];
  targetAdapter: TargetAdapter;
  benchmark?: string;
}

/** Filesystem target: scope is the given path root. */
export const pathAdapter: TargetAdapter = {
  name: "path",
  buildScope: (target) => ({ hosts: [], paths: [target] }),
  describeScope: (scope) => `paths=${scope.paths.join(",") || "(none)"}`,
};

/** Host target: scope is the given hostname (http(s) URL or bare host). */
export const hostAdapter: TargetAdapter = {
  name: "host",
  buildScope: (target) => {
    try {
      const url = new URL(target.includes("://") ? target : `https://${target}`);
      return { hosts: [url.hostname], paths: [] };
    } catch {
      return { hosts: [target], paths: [] };
    }
  },
  describeScope: (scope) => `hosts=${scope.hosts.join(",") || "(none)"}`,
};

/** Compact row from HarnessSpec codegen (loadouts.generated.ts). */
export interface GeneratedLoadout {
  name: string;
  adapter: "path" | "host";
  toolNames: string[];
  specialists: { role: string; focus: string }[];
}

/** Lift a generated row into a registerable Loadout. */
export function fromGeneratedLoadout(g: GeneratedLoadout): Loadout {
  return {
    name: g.name,
    description: `Generated loadout "${g.name}" (${g.adapter} adapter)`,
    specialists: g.specialists.map((s) => ({
      role: s.role,
      systemPrompt: `You are the ${s.role} specialist. Focus: ${s.focus}.`,
      toolAllowlist: [...g.toolNames],
    })),
    toolNames: [...g.toolNames],
    targetAdapter: g.adapter === "host" ? hostAdapter : pathAdapter,
  };
}

/** Registry of loadouts — the mechanism that makes the harness multi-purpose. */
export class LoadoutRegistry {
  private readonly loadouts = new Map<string, Loadout>();

  register(loadout: Loadout): this {
    if (this.loadouts.has(loadout.name)) {
      throw new Error(`loadout "${loadout.name}" already registered`);
    }
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

  specialist(loadoutName: string, role?: string): Specialist | undefined {
    const loadout = this.loadouts.get(loadoutName);
    if (!loadout) return undefined;
    if (!role) return loadout.specialists[0];
    return loadout.specialists.find((s) => s.role === role);
  }

  selectSpecialist(loadoutName: string, role?: string): Specialist | undefined {
    return this.specialist(loadoutName, role);
  }
}

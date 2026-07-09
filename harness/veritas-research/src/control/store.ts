/**
 * Mission store — persists mission snapshots to disk so the CLI's `status` and
 * `report` verbs can read a mission started by an earlier `start` invocation.
 *
 * Snapshots are the frozen, serializable output of `Mission.snapshot()`. The
 * store only ever writes whole snapshots (append-only semantics are preserved
 * inside the Mission itself; the store just records the latest snapshot).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { MissionSnapshot } from "../mission/types.ts";

export class MissionStore {
  constructor(private readonly dir: string) {
    mkdirSync(this.dir, { recursive: true });
  }

  private pathFor(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  save(snapshot: MissionSnapshot): void {
    writeFileSync(this.pathFor(snapshot.id), JSON.stringify(snapshot, null, 2), "utf8");
  }

  load(id: string): MissionSnapshot | undefined {
    const path = this.pathFor(id);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as MissionSnapshot;
  }

  list(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
  }
}

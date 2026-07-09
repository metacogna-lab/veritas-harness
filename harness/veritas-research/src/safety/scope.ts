/**
 * Scope gate — invariant #1: scope before action.
 *
 * A PURE predicate. No I/O, no network, no filesystem. Given a tool call's
 * declared targets and a mission's scope, it decides allow/deny. Off-scope
 * hosts/paths, loopback, and private IP ranges are DENIED BY DEFAULT; a mission
 * must opt in explicitly to reach them.
 *
 * This module owns the scope types because it is built before the Mission
 * object and must not depend on it.
 */

export type ScopeTargetKind = "network" | "fs-read" | "fs-write" | "shell";

export interface ScopeTarget {
  kind: ScopeTargetKind;
  /** For network: a URL or host. For fs: a path. For shell: the command. */
  value: string;
}

export interface MissionScope {
  /** Allowed hostnames (exact or parent-domain of the target). */
  hosts: string[];
  /** Allowed filesystem roots (absolute paths). */
  paths: string[];
  /** Opt in to loopback targets (127.0.0.0/8, ::1, localhost). Default false. */
  allowLoopback?: boolean;
  /** Opt in to RFC1918 / link-local private ranges. Default false. */
  allowPrivate?: boolean;
  /** Opt in to shell targets at all. Default false (no shell tool in BASIC). */
  allowShell?: boolean;
}

export interface ScopeCall {
  toolName: string;
  targets: ScopeTarget[];
}

export type ScopeDecision = { allowed: true } | { allowed: false; reason: string };

const DENY = (detail: string): ScopeDecision => ({ allowed: false, reason: `SCOPE DENIED: ${detail}` });
const ALLOW: ScopeDecision = { allowed: true };

/** Check every target of a call against the mission scope. First deny wins. */
export function checkScope(call: ScopeCall, scope: MissionScope): ScopeDecision {
  for (const target of call.targets) {
    const decision = checkTarget(target, scope);
    if (!decision.allowed) return decision;
  }
  return ALLOW;
}

function checkTarget(target: ScopeTarget, scope: MissionScope): ScopeDecision {
  switch (target.kind) {
    case "network":
      return checkNetwork(target.value, scope);
    case "fs-read":
    case "fs-write":
      return checkPath(target.value, scope, target.kind);
    case "shell":
      return checkShell(target.value, scope);
    default:
      return DENY(`unknown target kind for "${target.value}"`);
  }
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

function extractHost(value: string): string | undefined {
  // Accept a bare host or a full URL.
  try {
    const url = new URL(value.includes("://") ? value : `http://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function stripIpv6Brackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isLoopback(host: string): boolean {
  if (host === "localhost") return true;
  const h = stripIpv6Brackets(host);
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  // 127.0.0.0/8
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4 && Number(v4[1]) === 127) return true;
  return false;
}

function isPrivate(host: string): boolean {
  const h = stripIpv6Brackets(host);
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  const lower = h.toLowerCase();
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  return false;
}

function hostAllowed(host: string, allowed: string[]): boolean {
  return allowed.some((entry) => {
    const e = entry.toLowerCase();
    return host === e || host.endsWith(`.${e}`);
  });
}

function checkNetwork(value: string, scope: MissionScope): ScopeDecision {
  const host = extractHost(value);
  if (!host) return DENY(`unparseable network target "${value}"`);
  if (isLoopback(host) && !scope.allowLoopback) return DENY(`loopback host "${host}" not permitted`);
  if (isPrivate(host) && !scope.allowPrivate) return DENY(`private-range host "${host}" not permitted`);
  if (!hostAllowed(host, scope.hosts)) return DENY(`host "${host}" not in mission scope`);
  return ALLOW;
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

/** Normalize a POSIX-style path without touching the filesystem. */
function normalizePath(p: string): string {
  const isAbs = p.startsWith("/");
  const segments: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") segments.pop();
      else if (!isAbs) segments.push("..");
      // for absolute paths, ".." at root is dropped
    } else {
      segments.push(seg);
    }
  }
  return (isAbs ? "/" : "") + segments.join("/");
}

function checkPath(value: string, scope: MissionScope, kind: ScopeTargetKind): ScopeDecision {
  // Reject traversal sequences outright before normalization collapses them.
  if (value.split("/").includes("..")) return DENY(`path traversal in "${value}"`);
  const target = normalizePath(value);
  const within = scope.paths.some((root) => {
    const r = normalizePath(root);
    return target === r || target.startsWith(r.endsWith("/") ? r : `${r}/`);
  });
  if (!within) return DENY(`${kind} path "${target}" outside mission scope`);
  return ALLOW;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function checkShell(value: string, scope: MissionScope): ScopeDecision {
  if (!scope.allowShell) return DENY(`shell execution not permitted ("${value}")`);
  return ALLOW;
}

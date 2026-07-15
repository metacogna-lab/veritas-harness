/**
 * Safety plane — scope gate (invariant #1: scope before action).
 *
 * A PURE predicate. No I/O, no network, no filesystem. Given a tool call's
 * declared targets and a mission's scope, it decides allow/deny. Off-scope
 * hosts/paths, loopback, and private IP ranges are DENIED BY DEFAULT; a mission
 * must opt in explicitly to reach them.
 */

export type ScopeTargetKind = "network" | "fs-read" | "fs-write" | "shell";

export interface ScopeTarget {
  kind: ScopeTargetKind;
  value: string;
}

export interface MissionScope {
  hosts: string[];
  paths: string[];
  allowLoopback?: boolean;
  allowPrivate?: boolean;
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

function extractHost(value: string): string | undefined {
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
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4 && Number(v4[1]) === 127) return true;
  return false;
}

function isPrivate(host: string): boolean {
  const h = stripIpv6Brackets(host);
  const lower = h.toLowerCase();
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
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

function normalizePath(p: string): string {
  const isAbs = p.startsWith("/");
  const segments: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") segments.pop();
      else if (!isAbs) segments.push("..");
    } else {
      segments.push(seg);
    }
  }
  return (isAbs ? "/" : "") + segments.join("/");
}

function checkPath(value: string, scope: MissionScope, kind: ScopeTargetKind): ScopeDecision {
  if (value.split("/").includes("..")) return DENY(`path traversal in "${value}"`);
  const target = normalizePath(value);
  const within = scope.paths.some((root) => {
    const r = normalizePath(root);
    return target === r || target.startsWith(r.endsWith("/") ? r : `${r}/`);
  });
  if (!within) return DENY(`${kind} path "${target}" outside mission scope`);
  return ALLOW;
}

function checkShell(value: string, scope: MissionScope): ScopeDecision {
  if (!scope.allowShell) return DENY(`shell execution not permitted ("${value}")`);
  return ALLOW;
}

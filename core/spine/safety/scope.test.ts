import { describe, expect, test } from "bun:test";
import { checkScope, type MissionScope, type ScopeCall } from "./scope.ts";

const scope = (over: Partial<MissionScope> = {}): MissionScope => ({
  hosts: ["example.com"],
  paths: ["/work/project"],
  ...over,
});

const call = (kind: ScopeCall["targets"][number]["kind"], value: string): ScopeCall => ({
  toolName: "t",
  targets: [{ kind, value }],
});

describe("network scope", () => {
  test("allows an in-scope host", () => {
    expect(checkScope(call("network", "https://example.com/x"), scope()).allowed).toBe(true);
  });

  test("allows a subdomain of an in-scope host", () => {
    expect(checkScope(call("network", "https://api.example.com"), scope()).allowed).toBe(true);
  });

  test("denies an off-scope host", () => {
    const d = checkScope(call("network", "https://evil.com"), scope());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toStartWith("SCOPE DENIED:");
  });

  test("denies loopback by default", () => {
    expect(checkScope(call("network", "http://127.0.0.1"), scope()).allowed).toBe(false);
    expect(checkScope(call("network", "http://localhost:8080"), scope()).allowed).toBe(false);
  });

  test("denies IPv6 loopback ::1 by default", () => {
    expect(checkScope(call("network", "http://[::1]:3000"), scope()).allowed).toBe(false);
  });

  test("denies private ranges by default", () => {
    for (const ip of ["http://10.0.0.5", "http://172.16.3.1", "http://192.168.1.1", "http://169.254.1.1"]) {
      expect(checkScope(call("network", ip), scope()).allowed).toBe(false);
    }
  });

  test("denies IPv6 unique-local fc00::/7", () => {
    expect(checkScope(call("network", "http://[fc00::1]"), scope()).allowed).toBe(false);
    expect(checkScope(call("network", "http://[fd12:3456::1]"), scope()).allowed).toBe(false);
  });

  test("allows loopback only when explicitly opted in AND host in scope", () => {
    const s = scope({ hosts: ["localhost"], allowLoopback: true });
    expect(checkScope(call("network", "http://localhost:8080"), s).allowed).toBe(true);
  });

  test("mixed-case hostname is matched case-insensitively", () => {
    expect(checkScope(call("network", "https://EXAMPLE.com"), scope()).allowed).toBe(true);
    expect(checkScope(call("network", "https://ExAmPlE.CoM/api"), scope()).allowed).toBe(true);
  });

  test("denies an unparseable network target", () => {
    expect(checkScope(call("network", "http://"), scope()).allowed).toBe(false);
  });

  test("a public IP must be listed explicitly", () => {
    expect(checkScope(call("network", "http://8.8.8.8"), scope()).allowed).toBe(false);
    const s = scope({ hosts: ["8.8.8.8"] });
    expect(checkScope(call("network", "http://8.8.8.8"), s).allowed).toBe(true);
  });
});

describe("filesystem scope", () => {
  test("allows a path inside a scope root", () => {
    expect(checkScope(call("fs-read", "/work/project/src/a.ts"), scope()).allowed).toBe(true);
  });

  test("allows the scope root itself", () => {
    expect(checkScope(call("fs-read", "/work/project"), scope()).allowed).toBe(true);
  });

  test("denies a path outside the scope root", () => {
    expect(checkScope(call("fs-write", "/etc/passwd"), scope()).allowed).toBe(false);
  });

  test("denies path traversal even if it would resolve inside", () => {
    const d = checkScope(call("fs-read", "/work/project/../../etc/passwd"), scope());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("traversal");
  });

  test("denies a sibling directory that shares a name prefix", () => {
    // /work/project-secret must NOT be treated as inside /work/project
    expect(checkScope(call("fs-read", "/work/project-secret/x"), scope()).allowed).toBe(false);
  });
});

describe("shell scope", () => {
  test("denies shell by default", () => {
    expect(checkScope(call("shell", "ls"), scope()).allowed).toBe(false);
  });

  test("allows shell only when opted in", () => {
    expect(checkScope(call("shell", "ls"), scope({ allowShell: true })).allowed).toBe(true);
  });
});

describe("multi-target calls", () => {
  test("first denied target fails the whole call", () => {
    const c: ScopeCall = {
      toolName: "multi",
      targets: [
        { kind: "network", value: "https://example.com" },
        { kind: "network", value: "https://evil.com" },
      ],
    };
    expect(checkScope(c, scope()).allowed).toBe(false);
  });

  test("all-allowed targets pass", () => {
    const c: ScopeCall = {
      toolName: "multi",
      targets: [
        { kind: "network", value: "https://example.com" },
        { kind: "fs-read", value: "/work/project/a" },
      ],
    };
    expect(checkScope(c, scope()).allowed).toBe(true);
  });

  test("a call with no targets is allowed (inert tool)", () => {
    expect(checkScope({ toolName: "noop", targets: [] }, scope()).allowed).toBe(true);
  });
});

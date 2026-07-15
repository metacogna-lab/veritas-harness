import { test, expect } from "bun:test";
import { checkScope, type MissionScope } from "./scope.ts";

const scope: MissionScope = { hosts: ["example.com"], paths: ["/work"] };

test("in-scope host is allowed; off-scope host is denied", () => {
  expect(checkScope({ toolName: "t", targets: [{ kind: "network", value: "https://example.com/x" }] }, scope).allowed).toBe(true);
  expect(checkScope({ toolName: "t", targets: [{ kind: "network", value: "https://evil.com" }] }, scope).allowed).toBe(false);
});

test("loopback and private ranges are denied by default", () => {
  expect(checkScope({ toolName: "t", targets: [{ kind: "network", value: "http://127.0.0.1" }] }, scope).allowed).toBe(false);
  expect(checkScope({ toolName: "t", targets: [{ kind: "network", value: "http://10.0.0.5" }] }, scope).allowed).toBe(false);
});

test("fs reads are scope-checked and traversal is rejected", () => {
  expect(checkScope({ toolName: "t", targets: [{ kind: "fs-read", value: "/work/a.txt" }] }, scope).allowed).toBe(true);
  expect(checkScope({ toolName: "t", targets: [{ kind: "fs-read", value: "/etc/passwd" }] }, scope).allowed).toBe(false);
  expect(checkScope({ toolName: "t", targets: [{ kind: "fs-read", value: "/work/../etc/passwd" }] }, scope).allowed).toBe(false);
});

test("shell is denied unless explicitly opted in", () => {
  expect(checkScope({ toolName: "t", targets: [{ kind: "shell", value: "ls" }] }, scope).allowed).toBe(false);
  expect(checkScope({ toolName: "t", targets: [{ kind: "shell", value: "ls" }] }, { ...scope, allowShell: true }).allowed).toBe(true);
});

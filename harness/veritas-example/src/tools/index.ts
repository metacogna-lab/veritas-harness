/**
 * Tool barrel: exports the registry and a factory that builds a registry
 * pre-loaded with the safe/active starter tools. New tools register here (the
 * tool-adder skill in Phase 4 automates this).
 */
export * from "./registry.ts";
export { readFileTool } from "./read-file.ts";
export { listDirTool } from "./list-dir.ts";
export { httpGetTool } from "./http-get.ts";
export { makeRecordFindingTool } from "./record-finding.ts";

import { ToolRegistry } from "./registry.ts";
import { readFileTool } from "./read-file.ts";
import { listDirTool } from "./list-dir.ts";
import { httpGetTool } from "./http-get.ts";

/** A fresh registry with the starter tools registered. */
export function starterRegistry(): ToolRegistry {
  return new ToolRegistry().register(readFileTool).register(listDirTool).register(httpGetTool);
}

/**
 * Route SANDBOX_PROVIDER=local|docker|modal (default local).
 */
import type { SandboxProvider, SandboxProviderName } from "../../../../core/sandbox/types.ts";
import { LocalProvider } from "./local-provider.ts";
import { DockerProvider } from "./docker-provider.ts";
import { ModalProvider } from "./modal-provider.ts";

export function selectProvider(name?: string): SandboxProvider {
  const key = (name ?? process.env.SANDBOX_PROVIDER ?? "local").toLowerCase() as SandboxProviderName;
  switch (key) {
    case "docker":
      return new DockerProvider();
    case "modal":
      return new ModalProvider();
    case "local":
    default:
      return new LocalProvider();
  }
}

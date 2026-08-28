import { dirname, join } from "node:path";
import type { InstalledTarget } from "./types";

export function resolveDestRoot(target: InstalledTarget, cwd: string, home: string): string {
  switch (target) {
    case "global":
      return join(home, ".config", "opencode");
    case "project":
      return join(cwd, ".opencode");
    case "claude":
      return join(cwd, ".claude");
  }
}

export function resolveConfigPath(target: InstalledTarget, destRoot: string): string | undefined {
  switch (target) {
    case "global":
      return join(destRoot, "opencode.json");
    case "project":
      return join(dirname(destRoot), "opencode.json");
    case "claude":
      return undefined;
  }
}

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ensureState } from "machine-core/src/state";
import type { MachineState } from "machine-core/src/types";

export type InitArgs = {
  projectDir: string;
};

export type InitResult = {
  state: MachineState;
  discoveryDir: string;
  created: boolean;
};

export function discoveryDir(projectDir: string): string {
  return join(projectDir, "discovery");
}

export async function machine_discovery_init(args: InitArgs): Promise<InitResult> {
  const { projectDir } = args;
  const dir = discoveryDir(projectDir);
  const existed = existsSync(dir);

  await mkdir(join(projectDir, "inputs"), { recursive: true });
  await mkdir(dir, { recursive: true });

  const state = await ensureState(projectDir);

  return { state, discoveryDir: dir, created: !existed };
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { MachineState } from "./types";

export function getStatePath(projectDir: string): string {
  return join(projectDir, ".machine", "state.json");
}

function defaultState(): MachineState {
  return { phase: "", inputs: [], approvals: {} };
}

export async function writeState(projectDir: string, state: MachineState): Promise<void> {
  const statePath = getStatePath(projectDir);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

export async function readState(projectDir: string): Promise<MachineState> {
  const statePath = getStatePath(projectDir);
  const file = Bun.file(statePath);
  if (!(await file.exists())) {
    return ensureState(projectDir);
  }
  const raw = await readFile(statePath, "utf8");
  try {
    return JSON.parse(raw) as MachineState;
  } catch {
    throw new Error(
      `state.json corrupto en ${statePath}: JSON invalido. Corrige o restaura el archivo manualmente; no fue sobrescrito.`,
    );
  }
}

export async function ensureState(projectDir: string): Promise<MachineState> {
  const statePath = getStatePath(projectDir);
  const file = Bun.file(statePath);
  if (await file.exists()) {
    return readState(projectDir);
  }
  const initial = defaultState();
  await writeState(projectDir, initial);
  return initial;
}

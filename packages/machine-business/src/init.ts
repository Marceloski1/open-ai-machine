import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ensureState } from "machine-core/src/state";
import type { MachineState } from "machine-core/src/types";

export type InitArgs = {
  projectDir: string;
};

export type InitResult = {
  state: MachineState;
  indexPath: string;
  created: boolean;
};

const INDEX_FILENAME = "INDEX.md";

export function indexPath(projectDir: string): string {
  return join(projectDir, INDEX_FILENAME);
}

function indexContent(): string {
  return [
    "# Indice del proyecto",
    "",
    "- `inputs/` - insumos originales",
    "- `business/` - artefactos de la fase de negocio",
    "- `.machine/state.json` - estado del pipeline",
    "",
  ].join("\n");
}

export async function machine_business_init(args: InitArgs): Promise<InitResult> {
  const { projectDir } = args;

  await mkdir(join(projectDir, "inputs"), { recursive: true });
  await mkdir(join(projectDir, "business"), { recursive: true });

  const state = await ensureState(projectDir);

  const idxPath = indexPath(projectDir);
  const idxFile = Bun.file(idxPath);
  const existed = await idxFile.exists();
  if (!existed) {
    await Bun.write(idxFile, indexContent());
  }

  return { state, indexPath: idxPath, created: !existed };
}

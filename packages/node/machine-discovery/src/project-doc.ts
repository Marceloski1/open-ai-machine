import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertGateApproved, setGatePending } from "machine-core/src/approvals";
import { readState, writeState } from "machine-core/src/state";
import type { MachineState } from "machine-core/src/types";
import { estimationPath } from "./estimation";
import { hlaPath } from "./hla";
import { planningPath } from "./planning";
import { prdsDir } from "./prds";
import { requirementsPath } from "./requirements";

const GATE = "project";
const UPSTREAM_GATE = "requirements";

type ArtifactKind = "file" | "directory";

type Artifact = {
  gate: string;
  title: string;
  kind: ArtifactKind;
  resolve: (projectDir: string) => string;
};

const ARTIFACTS: Artifact[] = [
  { gate: "requirements", title: "Requisitos", kind: "file", resolve: requirementsPath },
  { gate: "hla", title: "Arquitectura de alto nivel", kind: "file", resolve: hlaPath },
  { gate: "prds", title: "PRD por unidad funcional", kind: "directory", resolve: prdsDir },
  { gate: "estimation", title: "Estimacion", kind: "file", resolve: estimationPath },
  { gate: "planning", title: "Plan de trabajo", kind: "file", resolve: planningPath },
];

export type ProjectDocArgs = {
  projectDir: string;
};

export type ProjectDocResult = {
  state: MachineState;
  outputPath: string;
  included: string[];
  pending: string[];
  missing: string[];
};

export function projectDocPath(projectDir: string): string {
  return join(projectDir, "discovery", "project.md");
}

function isApproved(state: MachineState, gate: string): boolean {
  return state.approvals[gate]?.status === "approved";
}

async function readArtifact(artifact: Artifact, projectDir: string): Promise<string | undefined> {
  const path = artifact.resolve(projectDir);
  if (artifact.kind === "file") {
    try {
      return await readFile(path, "utf8");
    } catch {
      return undefined;
    }
  }

  let entries: string[];
  try {
    entries = (await readdir(path)).filter((entry) => entry.endsWith(".md")).sort();
  } catch {
    return undefined;
  }
  if (entries.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  for (const entry of entries) {
    parts.push(await readFile(join(path, entry), "utf8"));
  }
  return parts.join("\n");
}

export async function machine_discovery_project_doc(args: ProjectDocArgs): Promise<ProjectDocResult> {
  const { projectDir } = args;
  const state = await readState(projectDir);

  assertGateApproved(state, UPSTREAM_GATE);

  const sections: string[] = ["# Documento de proyecto", ""];
  const included: string[] = [];
  const pending: string[] = [];
  const missing: string[] = [];

  for (const artifact of ARTIFACTS) {
    const content = await readArtifact(artifact, projectDir);
    sections.push(`## ${artifact.title}`, "");

    if (content === undefined) {
      missing.push(artifact.gate);
      sections.push(`Artefacto no generado: falta ejecutar la fase que produce "${artifact.gate}".`, "");
      continue;
    }
    if (!isApproved(state, artifact.gate)) {
      pending.push(artifact.gate);
      sections.push(
        `Artefacto pendiente de aprobacion: la puerta "${artifact.gate}" no esta en approved, asi que su contenido no se incorpora. Ejecuta machine-approve sobre esa puerta.`,
        "",
      );
      continue;
    }

    included.push(artifact.gate);
    sections.push(content.trim(), "");
  }

  const outputPath = projectDocPath(projectDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, `${sections.join("\n").trimEnd()}\n`);

  const nextState = setGatePending(
    state,
    GATE,
    ARTIFACTS.map((artifact) => artifact.gate),
  );
  await writeState(projectDir, nextState);

  return { state: nextState, outputPath, included, pending, missing };
}

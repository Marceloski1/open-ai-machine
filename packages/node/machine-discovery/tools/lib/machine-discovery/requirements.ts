import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertGateApproved, setGatePending } from "./approvals";
import { readState, writeState } from "./state";
import type { MachineState } from "./types";

const NEEDS_INPUT = "NEEDS INPUT";
const GATE = "requirements";
const UPSTREAM_GATE = "proposal";

export type RequirementsSections = {
  scope?: string;
  functional?: string;
  nonFunctional?: string;
  constraints?: string;
};

const SECTION_TITLES: Record<keyof RequirementsSections, string> = {
  scope: "Alcance",
  functional: "Requisitos funcionales",
  nonFunctional: "Requisitos no funcionales",
  constraints: "Restricciones",
};

const SECTION_ORDER: (keyof RequirementsSections)[] = [
  "scope",
  "functional",
  "nonFunctional",
  "constraints",
];

export type RequirementsArgs = {
  projectDir: string;
  sections: RequirementsSections;
};

export type RequirementsResult = {
  state: MachineState;
  outputPath: string;
};

export function requirementsPath(projectDir: string): string {
  return join(projectDir, "discovery", "requirements.md");
}

function renderSection(title: string, content: string | undefined): string {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT;
  return `## ${title}\n\n${body}\n`;
}

function renderRequirements(sections: RequirementsSections): string {
  const body = SECTION_ORDER.map((key) => renderSection(SECTION_TITLES[key], sections[key])).join("\n");
  return `# Requisitos\n\n${body}`;
}

export async function machine_discovery_requirements(
  args: RequirementsArgs,
): Promise<RequirementsResult> {
  const { projectDir, sections } = args;
  const state = await readState(projectDir);

  assertGateApproved(state, UPSTREAM_GATE);

  const hasDiscoveryInputs = state.inputs.some((input) => input.route === "discovery");
  if (!hasDiscoveryInputs) {
    throw new Error(
      `No hay insumos con route: "discovery" registrados en ${projectDir}. Ejecuta machine-process-input antes de generar los requisitos.`,
    );
  }

  const outputPath = requirementsPath(projectDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, renderRequirements(sections));

  const nextState = setGatePending(state, GATE, [UPSTREAM_GATE]);
  await writeState(projectDir, nextState);

  return { state: nextState, outputPath };
}

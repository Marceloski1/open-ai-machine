import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setGatePending } from "./approvals";
import { readState, writeState } from "./state";
import type { MachineState } from "./types";

const NEEDS_INPUT = "NEEDS INPUT";
const GATE = "proposal";

export type ProposalSections = {
  market?: string;
  problem?: string;
  solution?: string;
  estimate?: string;
};

const SECTION_TITLES: Record<keyof ProposalSections, string> = {
  market: "Mercado",
  problem: "Problema",
  solution: "Solucion",
  estimate: "Estimacion",
};

const SECTION_ORDER: (keyof ProposalSections)[] = ["market", "problem", "solution", "estimate"];

export type ProposalArgs = {
  projectDir: string;
  sections: ProposalSections;
};

export type ProposalResult = {
  state: MachineState;
  outputPath: string;
};

export function proposalPath(projectDir: string): string {
  return join(projectDir, "business", "proposal.md");
}

function renderSection(title: string, content: string | undefined): string {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT;
  return `## ${title}\n\n${body}\n`;
}

function renderProposal(sections: ProposalSections): string {
  const body = SECTION_ORDER.map((key) => renderSection(SECTION_TITLES[key], sections[key])).join("\n");
  return `# Propuesta de negocio\n\n${body}`;
}

export async function machine_business_proposal(args: ProposalArgs): Promise<ProposalResult> {
  const { projectDir, sections } = args;
  const state = await readState(projectDir);

  const hasBusinessInputs = state.inputs.some((input) => input.route === "business");
  if (!hasBusinessInputs) {
    throw new Error(
      `No hay insumos con route: "business" registrados en ${projectDir}. Ejecuta machine-process-input antes de generar la propuesta.`,
    );
  }

  const outputPath = proposalPath(projectDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, renderProposal(sections));

  const nextState = setGatePending(state, GATE);
  await writeState(projectDir, nextState);

  return { state: nextState, outputPath };
}

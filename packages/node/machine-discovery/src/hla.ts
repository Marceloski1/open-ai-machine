import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertGateApproved, setGatePending } from "machine-core/src/approvals";
import { readState, writeState } from "machine-core/src/state";
import type { MachineState } from "machine-core/src/types";

const NEEDS_INPUT = "NEEDS INPUT";
const GATE = "hla";
const UPSTREAM_GATE = "requirements";
const FENCE = "```";

export type HlaSections = {
  overview?: string;
  components?: string;
  integrations?: string;
  decisions?: string;
};

export type HlaDiagram = {
  title: string;
  mermaid: string;
};

const SECTION_TITLES: Record<keyof HlaSections, string> = {
  overview: "Vision general",
  components: "Componentes",
  integrations: "Integraciones",
  decisions: "Decisiones tecnicas",
};

const SECTION_ORDER: (keyof HlaSections)[] = ["overview", "components", "integrations", "decisions"];

export type HlaArgs = {
  projectDir: string;
  sections: HlaSections;
  diagrams?: HlaDiagram[];
};

export type HlaResult = {
  state: MachineState;
  outputPath: string;
};

export function hlaPath(projectDir: string): string {
  return join(projectDir, "discovery", "hla.md");
}

function renderSection(title: string, content: string | undefined): string {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT;
  return `## ${title}\n\n${body}\n`;
}

// TODO(mermaid): pre-renderizar estos bloques a imagen antes de invocar Pandoc y declarar el
// motor como externalRequirement del paquete; Pandoc no interpreta Mermaid.
function renderDiagram(diagram: HlaDiagram): string {
  return `### ${diagram.title}\n\n${FENCE}mermaid\n${diagram.mermaid.trim()}\n${FENCE}\n`;
}

function renderDiagrams(diagrams: HlaDiagram[]): string {
  const usable = diagrams.filter((diagram) => diagram.mermaid.trim());
  if (usable.length === 0) {
    return `## Diagramas\n\n${NEEDS_INPUT}\n`;
  }
  return `## Diagramas\n\n${usable.map(renderDiagram).join("\n")}`;
}

function renderHla(sections: HlaSections, diagrams: HlaDiagram[]): string {
  const body = SECTION_ORDER.map((key) => renderSection(SECTION_TITLES[key], sections[key])).join("\n");
  return `# Arquitectura de alto nivel\n\n${body}\n${renderDiagrams(diagrams)}`;
}

export async function machine_discovery_hla(args: HlaArgs): Promise<HlaResult> {
  const { projectDir, sections } = args;
  const diagrams = args.diagrams ?? [];
  const state = await readState(projectDir);

  assertGateApproved(state, UPSTREAM_GATE);

  const outputPath = hlaPath(projectDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, renderHla(sections, diagrams));

  const nextState = setGatePending(state, GATE, [UPSTREAM_GATE]);
  await writeState(projectDir, nextState);

  return { state: nextState, outputPath };
}

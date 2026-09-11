import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { assertGateApproved, setGatePending } from "./approvals";
import { readState, writeState } from "./state";
import type { MachineState } from "./types";

const NEEDS_INPUT = "NEEDS INPUT";
const GATE = "prds";
const UPSTREAM_GATE = "requirements";

export type PrdUnit = {
  title: string;
  objective?: string;
  scope?: string;
  acceptanceCriteria?: string;
  outOfScope?: string;
};

const SECTION_TITLES: Record<Exclude<keyof PrdUnit, "title">, string> = {
  objective: "Objetivo",
  scope: "Alcance",
  acceptanceCriteria: "Criterios de aceptacion",
  outOfScope: "Fuera de alcance",
};

const SECTION_ORDER: Exclude<keyof PrdUnit, "title">[] = [
  "objective",
  "scope",
  "acceptanceCriteria",
  "outOfScope",
];

export type DraftPrdsArgs = {
  projectDir: string;
  units: PrdUnit[];
};

export type DraftPrdsResult = {
  state: MachineState;
  outputPaths: string[];
};

export function prdsDir(projectDir: string): string {
  return join(projectDir, "discovery", "prds");
}

export function unitSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function renderSection(title: string, content: string | undefined): string {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT;
  return `## ${title}\n\n${body}\n`;
}

function renderPrd(unit: PrdUnit): string {
  const body = SECTION_ORDER.map((key) => renderSection(SECTION_TITLES[key], unit[key])).join("\n");
  return `# ${unit.title.trim()}\n\n${body}`;
}

function assertNoSlugCollisions(units: PrdUnit[]): Map<string, PrdUnit> {
  const bySlug = new Map<string, PrdUnit>();
  for (const unit of units) {
    const slug = unitSlug(unit.title);
    if (!slug) {
      throw new Error(`Unidad funcional sin titulo utilizable: "${unit.title}".`);
    }
    const existing = bySlug.get(slug);
    if (existing) {
      throw new Error(
        `Dos unidades funcionales colisionan en el archivo "${slug}.md": "${existing.title}" y "${unit.title}". Renombra una para distinguirlas.`,
      );
    }
    bySlug.set(slug, unit);
  }
  return bySlug;
}

async function clearPreviousDrafts(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.endsWith(".md")) {
      await rm(join(dir, entry), { force: true });
    }
  }
}

export async function machine_discovery_draft_prds(args: DraftPrdsArgs): Promise<DraftPrdsResult> {
  const { projectDir, units } = args;
  const state = await readState(projectDir);

  assertGateApproved(state, UPSTREAM_GATE);

  if (units.length === 0) {
    throw new Error(
      `No hay ninguna unidad funcional identificada en los requisitos aprobados de ${projectDir}. Revisa requirements.md antes de generar los PRD.`,
    );
  }

  const bySlug = assertNoSlugCollisions(units);

  const dir = prdsDir(projectDir);
  await mkdir(dir, { recursive: true });
  await clearPreviousDrafts(dir);

  const outputPaths: string[] = [];
  for (const [slug, unit] of bySlug) {
    const outputPath = join(dir, `${slug}.md`);
    await Bun.write(outputPath, renderPrd(unit));
    outputPaths.push(outputPath);
  }

  const nextState = setGatePending(state, GATE, [UPSTREAM_GATE]);
  await writeState(projectDir, nextState);

  return { state: nextState, outputPaths };
}

import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertGateApproved, setGatePending } from "./approvals";
import { readState, writeState } from "./state";
import type { MachineState } from "./types";
import { prdsDir, unitSlug } from "./prds";

const NEEDS_INPUT = "NEEDS INPUT";
const GATE = "estimation";
const UPSTREAM_GATE = "requirements";
const PRDS_GATE = "prds";

export type UnitEstimate = {
  unit: string;
  effort?: string;
  rationale?: string;
};

export type EstimationArgs = {
  projectDir: string;
  estimates: UnitEstimate[];
};

export type EstimationResult = {
  state: MachineState;
  outputPath: string;
  estimated: string[];
  missing: string[];
};

export function estimationPath(projectDir: string): string {
  return join(projectDir, "discovery", "estimation.md");
}

async function readPrdTitles(projectDir: string): Promise<Map<string, string>> {
  const dir = prdsDir(projectDir);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return new Map();
  }

  const titles = new Map<string, string>();
  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    const slug = entry.slice(0, -3);
    const content = await readFile(join(dir, entry), "utf8");
    const heading = content.split("\n").find((line) => line.startsWith("# "));
    titles.set(slug, heading ? heading.slice(2).trim() : slug);
  }
  return titles;
}

function renderRow(title: string, effort: string | undefined, rationale: string | undefined): string {
  const effortCell = effort?.trim() ? effort.trim() : NEEDS_INPUT;
  const rationaleCell = rationale?.trim() ? rationale.trim() : NEEDS_INPUT;
  return `| ${title} | ${effortCell} | ${rationaleCell} |`;
}

export async function machine_discovery_time_estimation(
  args: EstimationArgs,
): Promise<EstimationResult> {
  const { projectDir, estimates } = args;
  const state = await readState(projectDir);

  assertGateApproved(state, UPSTREAM_GATE);

  const titles = await readPrdTitles(projectDir);
  if (titles.size === 0) {
    throw new Error(
      `No hay ningun PRD generado en ${prdsDir(projectDir)}. Ejecuta machine-draft-prds antes de estimar.`,
    );
  }

  const bySlug = new Map<string, UnitEstimate>();
  for (const estimate of estimates) {
    const slug = unitSlug(estimate.unit);
    if (!titles.has(slug)) {
      throw new Error(
        `La unidad "${estimate.unit}" no tiene PRD aguas arriba. Solo pueden estimarse unidades con un PRD generado; revisa machine-draft-prds.`,
      );
    }
    bySlug.set(slug, estimate);
  }

  const rows: string[] = [];
  const estimated: string[] = [];
  const missing: string[] = [];
  for (const [slug, title] of titles) {
    const estimate = bySlug.get(slug);
    if (estimate?.effort?.trim()) {
      estimated.push(slug);
    } else {
      missing.push(slug);
    }
    rows.push(renderRow(title, estimate?.effort, estimate?.rationale));
  }

  const markdown = [
    "# Estimacion",
    "",
    "| Unidad | Esfuerzo | Justificacion |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");

  const outputPath = estimationPath(projectDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, markdown);

  const nextState = setGatePending(state, GATE, [PRDS_GATE]);
  await writeState(projectDir, nextState);

  return { state: nextState, outputPath, estimated, missing };
}

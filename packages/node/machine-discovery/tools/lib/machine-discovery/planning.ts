import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertGateApproved, setGatePending } from "./approvals";
import { readState, writeState } from "./state";
import type { MachineState } from "./types";
import { estimationPath } from "./estimation";
import { unitSlug } from "./prds";

const NEEDS_INPUT = "NEEDS INPUT";
const GATE = "planning";
const UPSTREAM_GATE = "requirements";
const ESTIMATION_GATE = "estimation";

export type PlanningItem = {
  unit: string;
  milestone?: string;
  sequence?: string;
  notes?: string;
};

export type EstimatedUnit = {
  title: string;
  effort: string;
};

export type PlanningArgs = {
  projectDir: string;
  items: PlanningItem[];
};

export type PlanningResult = {
  state: MachineState;
  outputPath: string;
  planned: string[];
  missing: string[];
};

export function planningPath(projectDir: string): string {
  return join(projectDir, "discovery", "planning.md");
}

export function parseEstimatedUnits(markdown: string): Map<string, EstimatedUnit> {
  const units = new Map<string, EstimatedUnit>();
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) {
      continue;
    }
    const cells = trimmed.split("|").slice(1, -1).map((cell) => cell.trim());
    const [title, effort] = cells;
    if (!title || !effort || title === "Unidad") {
      continue;
    }
    units.set(unitSlug(title), { title, effort });
  }
  return units;
}

export async function machine_discovery_planning(args: PlanningArgs): Promise<PlanningResult> {
  const { projectDir, items } = args;
  const state = await readState(projectDir);

  assertGateApproved(state, UPSTREAM_GATE);

  const sourcePath = estimationPath(projectDir);
  let estimationMarkdown: string;
  try {
    estimationMarkdown = await readFile(sourcePath, "utf8");
  } catch {
    throw new Error(
      `No hay estimacion generada en ${sourcePath}. Ejecuta machine-time-estimation antes de planificar.`,
    );
  }

  const units = parseEstimatedUnits(estimationMarkdown);

  const bySlug = new Map<string, PlanningItem>();
  for (const item of items) {
    const slug = unitSlug(item.unit);
    const unit = units.get(slug);
    if (!unit) {
      throw new Error(
        `La unidad "${item.unit}" no aparece en la estimacion. El plan solo puede cubrir unidades estimadas; revisa machine-time-estimation.`,
      );
    }
    if (unit.effort === NEEDS_INPUT) {
      throw new Error(
        `La unidad "${item.unit}" figura en la estimacion sin esfuerzo (${NEEDS_INPUT}). Estimala antes de planificarla.`,
      );
    }
    bySlug.set(slug, item);
  }

  const rows: string[] = [];
  const planned: string[] = [];
  const missing: string[] = [];
  for (const [slug, unit] of units) {
    if (unit.effort === NEEDS_INPUT) {
      continue;
    }
    const item = bySlug.get(slug);
    if (item?.milestone?.trim()) {
      planned.push(slug);
    } else {
      missing.push(slug);
    }
    const milestone = item?.milestone?.trim() ? item.milestone.trim() : NEEDS_INPUT;
    const sequence = item?.sequence?.trim() ? item.sequence.trim() : NEEDS_INPUT;
    const notes = item?.notes?.trim() ? item.notes.trim() : NEEDS_INPUT;
    rows.push(`| ${unit.title} | ${unit.effort} | ${milestone} | ${sequence} | ${notes} |`);
  }

  const markdown = [
    "# Plan de trabajo",
    "",
    "| Unidad | Esfuerzo | Hito | Secuencia | Notas |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");

  const outputPath = planningPath(projectDir);
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, markdown);

  const nextState = setGatePending(state, GATE, [ESTIMATION_GATE]);
  await writeState(projectDir, nextState);

  return { state: nextState, outputPath, planned, missing };
}

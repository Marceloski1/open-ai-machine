import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "machine-core/src/state";
import type { InputRecord, MachineState, Route } from "machine-core/src/types";
import { machine_discovery_time_estimation } from "./estimation";
import { machine_discovery_init } from "./init";
import { machine_discovery_planning, planningPath } from "./planning";
import { machine_discovery_draft_prds } from "./prds";

function input(route: Route, path: string): InputRecord {
  return { path, sha256: "0".repeat(64), processedAt: "2026-09-02T00:00:00.000Z", route, outputPath: path };
}

const UNITS = [
  { title: "Ingesta de insumos", objective: "Enumerar y clasificar." },
  { title: "Exportacion a DOCX", objective: "Entregar el documento." },
];

const APPROVED = { proposal: { status: "approved" as const }, requirements: { status: "approved" as const } };

describe("machine_discovery_planning", () => {
  let projectDir: string;

  async function seed(approvals: MachineState["approvals"]): Promise<void> {
    await machine_discovery_init({ projectDir });
    const current = await readState(projectDir);
    await writeState(projectDir, {
      ...current,
      inputs: [input("discovery", "inputs/acta.md")],
      approvals,
    });
  }

  async function seedEstimated(efforts: { unit: string; effort?: string }[]): Promise<void> {
    await seed(APPROVED);
    await machine_discovery_draft_prds({ projectDir, units: UNITS });
    await machine_discovery_time_estimation({ projectDir, estimates: efforts });
  }

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-plan-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("rechaza mientras el Architecture Gate siga pendiente", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "pending" } });

    await expect(
      machine_discovery_planning({ projectDir, items: [{ unit: "Ingesta de insumos", milestone: "Hito 1" }] }),
    ).rejects.toThrow(/requirements/);
    expect(existsSync(planningPath(projectDir))).toBe(false);
  });

  test("rechaza cuando todavia no hay estimacion generada", async () => {
    await seed(APPROVED);
    await machine_discovery_draft_prds({ projectDir, units: UNITS });

    await expect(
      machine_discovery_planning({ projectDir, items: [{ unit: "Ingesta de insumos", milestone: "Hito 1" }] }),
    ).rejects.toThrow(/estimacion/i);
    expect(existsSync(planningPath(projectDir))).toBe(false);
  });

  test("rechaza planificar una unidad que no aparece aguas arriba", async () => {
    await seedEstimated([{ unit: "Ingesta de insumos", effort: "3d" }, { unit: "Exportacion a DOCX", effort: "2d" }]);

    await expect(
      machine_discovery_planning({
        projectDir,
        items: [{ unit: "Panel de administracion", milestone: "Hito 1" }],
      }),
    ).rejects.toThrow(/Panel de administracion/);
    expect(existsSync(planningPath(projectDir))).toBe(false);
  });

  test("rechaza planificar una unidad cuya estimacion quedo NEEDS INPUT", async () => {
    await seedEstimated([{ unit: "Ingesta de insumos", effort: "3d" }]);

    await expect(
      machine_discovery_planning({
        projectDir,
        items: [{ unit: "Exportacion a DOCX", milestone: "Hito 1" }],
      }),
    ).rejects.toThrow(/Exportacion a DOCX/);
  });

  test("el plan cubre exactamente las unidades estimadas", async () => {
    await seedEstimated([{ unit: "Ingesta de insumos", effort: "3d" }, { unit: "Exportacion a DOCX", effort: "2d" }]);

    const result = await machine_discovery_planning({
      projectDir,
      items: [
        { unit: "Ingesta de insumos", milestone: "Hito 1", sequence: "1" },
        { unit: "Exportacion a DOCX", milestone: "Hito 2", sequence: "2" },
      ],
    });

    expect(result.planned.sort()).toEqual(["exportacion-a-docx", "ingesta-de-insumos"]);
    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Ingesta de insumos");
    expect(markdown).toContain("Hito 1");
    expect(markdown).toContain("Exportacion a DOCX");
    expect(markdown).toContain("Hito 2");
  });

  test("una unidad estimada y sin plan aparece NEEDS INPUT, no se omite", async () => {
    await seedEstimated([{ unit: "Ingesta de insumos", effort: "3d" }, { unit: "Exportacion a DOCX", effort: "2d" }]);

    const result = await machine_discovery_planning({
      projectDir,
      items: [{ unit: "Ingesta de insumos", milestone: "Hito 1" }],
    });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Exportacion a DOCX");
    expect(markdown).toContain("NEEDS INPUT");
    expect(result.missing).toEqual(["exportacion-a-docx"]);
  });

  test("arrastra el esfuerzo estimado de cada unidad al plan", async () => {
    await seedEstimated([{ unit: "Ingesta de insumos", effort: "3d" }]);

    const result = await machine_discovery_planning({
      projectDir,
      items: [{ unit: "Ingesta de insumos", milestone: "Hito 1" }],
    });

    expect(await readFile(result.outputPath, "utf8")).toContain("3d");
  });

  test("deja su puerta pendiente y dependiente de la estimacion", async () => {
    await seedEstimated([{ unit: "Ingesta de insumos", effort: "3d" }]);

    const result = await machine_discovery_planning({
      projectDir,
      items: [{ unit: "Ingesta de insumos", milestone: "Hito 1" }],
    });

    expect(result.state.approvals.planning?.status).toBe("pending");
    expect(result.state.approvals.planning?.dependsOn).toContain("estimation");
    expect((await readState(projectDir)).approvals.planning?.status).toBe("pending");
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "machine-core/src/state";
import type { InputRecord, MachineState, Route } from "machine-core/src/types";
import { estimationPath, machine_discovery_time_estimation } from "./estimation";
import { machine_discovery_init } from "./init";
import { machine_discovery_draft_prds } from "./prds";

function input(route: Route, path: string): InputRecord {
  return { path, sha256: "0".repeat(64), processedAt: "2026-09-02T00:00:00.000Z", route, outputPath: path };
}

const UNITS = [
  { title: "Ingesta de insumos", objective: "Enumerar y clasificar." },
  { title: "Exportacion a DOCX", objective: "Entregar el documento." },
];

const APPROVED = { proposal: { status: "approved" as const }, requirements: { status: "approved" as const } };

describe("machine_discovery_time_estimation", () => {
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

  async function seedWithPrds(): Promise<void> {
    await seed(APPROVED);
    await machine_discovery_draft_prds({ projectDir, units: UNITS });
  }

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-est-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("rechaza mientras el Architecture Gate siga pendiente", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "pending" } });

    await expect(
      machine_discovery_time_estimation({ projectDir, estimates: [{ unit: "Ingesta de insumos", effort: "3d" }] }),
    ).rejects.toThrow(/requirements/);
    expect(existsSync(estimationPath(projectDir))).toBe(false);
  });

  test("rechaza cuando todavia no hay ningun PRD generado", async () => {
    await seed(APPROVED);

    await expect(
      machine_discovery_time_estimation({ projectDir, estimates: [{ unit: "Ingesta de insumos", effort: "3d" }] }),
    ).rejects.toThrow(/PRD/);
    expect(existsSync(estimationPath(projectDir))).toBe(false);
  });

  test("rechaza estimar una unidad que no tiene PRD aguas arriba", async () => {
    await seedWithPrds();

    await expect(
      machine_discovery_time_estimation({
        projectDir,
        estimates: [
          { unit: "Ingesta de insumos", effort: "3d" },
          { unit: "Panel de administracion", effort: "5d" },
        ],
      }),
    ).rejects.toThrow(/Panel de administracion/);
    expect(existsSync(estimationPath(projectDir))).toBe(false);
  });

  test("genera la estimacion de las unidades con PRD", async () => {
    await seedWithPrds();

    const result = await machine_discovery_time_estimation({
      projectDir,
      estimates: [
        { unit: "Ingesta de insumos", effort: "3d", rationale: "Dos formatos de entrada." },
        { unit: "Exportacion a DOCX", effort: "2d" },
      ],
    });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Ingesta de insumos");
    expect(markdown).toContain("3d");
    expect(markdown).toContain("Dos formatos de entrada.");
    expect(result.estimated).toEqual(["exportacion-a-docx", "ingesta-de-insumos"]);
  });

  test("acepta referenciar la unidad por su slug además de por su titulo", async () => {
    await seedWithPrds();

    const result = await machine_discovery_time_estimation({
      projectDir,
      estimates: [{ unit: "ingesta-de-insumos", effort: "3d" }],
    });

    expect(result.estimated).toContain("ingesta-de-insumos");
  });

  test("una unidad con PRD y sin estimacion queda NEEDS INPUT, no se omite", async () => {
    await seedWithPrds();

    const result = await machine_discovery_time_estimation({
      projectDir,
      estimates: [{ unit: "Ingesta de insumos", effort: "3d" }],
    });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Exportacion a DOCX");
    expect(markdown).toContain("NEEDS INPUT");
    expect(result.missing).toEqual(["exportacion-a-docx"]);
  });

  test("deja su puerta pendiente y dependiente de los PRD", async () => {
    await seedWithPrds();

    const result = await machine_discovery_time_estimation({
      projectDir,
      estimates: [{ unit: "Ingesta de insumos", effort: "3d" }],
    });

    expect(result.state.approvals.estimation?.status).toBe("pending");
    expect(result.state.approvals.estimation?.dependsOn).toContain("prds");
    expect((await readState(projectDir)).approvals.estimation?.status).toBe("pending");
  });
});

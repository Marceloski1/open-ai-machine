import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approveGate } from "../../../tools/lib/machine-discovery/approvals";
import { readState, writeState } from "../../../tools/lib/machine-discovery/state";
import type { InputRecord, Route } from "../../../tools/lib/machine-discovery/types";
import { machine_discovery_time_estimation } from "../../../tools/lib/machine-discovery/estimation";
import { machine_discovery_hla } from "../../../tools/lib/machine-discovery/hla";
import { machine_discovery_init } from "../../../tools/lib/machine-discovery/init";
import { machine_discovery_planning } from "../../../tools/lib/machine-discovery/planning";
import { machine_discovery_draft_prds } from "../../../tools/lib/machine-discovery/prds";
import { machine_discovery_requirements } from "../../../tools/lib/machine-discovery/requirements";
import { machine_discovery_project_doc, projectDocPath } from "../../../tools/lib/machine-discovery/project-doc";

function input(route: Route, path: string): InputRecord {
  return { path, sha256: "0".repeat(64), processedAt: "2026-09-02T00:00:00.000Z", route, outputPath: path };
}

describe("machine_discovery_project_doc", () => {
  let projectDir: string;

  async function approve(gate: string): Promise<void> {
    await writeState(projectDir, approveGate(await readState(projectDir), gate));
  }

  async function seedFullPhase(): Promise<void> {
    await machine_discovery_init({ projectDir });
    const current = await readState(projectDir);
    await writeState(projectDir, {
      ...current,
      inputs: [input("discovery", "inputs/acta.md")],
      approvals: { proposal: { status: "approved" } },
    });

    await machine_discovery_requirements({ projectDir, sections: { scope: "Alcance aprobado." } });
    await approve("requirements");

    await machine_discovery_hla({ projectDir, sections: { overview: "Vision de la arquitectura." } });
    await machine_discovery_draft_prds({ projectDir, units: [{ title: "Ingesta de insumos" }] });
    await machine_discovery_time_estimation({ projectDir, estimates: [{ unit: "Ingesta de insumos", effort: "3d" }] });
    await machine_discovery_planning({ projectDir, items: [{ unit: "Ingesta de insumos", milestone: "Hito 1" }] });
  }

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-doc-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("rechaza mientras el Architecture Gate siga pendiente", async () => {
    await machine_discovery_init({ projectDir });
    const current = await readState(projectDir);
    await writeState(projectDir, { ...current, approvals: { requirements: { status: "pending" } } });

    await expect(machine_discovery_project_doc({ projectDir })).rejects.toThrow(/requirements/);
    expect(existsSync(projectDocPath(projectDir))).toBe(false);
  });

  test("incorpora el contenido real del artefacto aprobado", async () => {
    await seedFullPhase();

    const result = await machine_discovery_project_doc({ projectDir });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Alcance aprobado.");
    expect(result.included).toContain("requirements");
  });

  test("no incorpora la planificacion pendiente y señala que falta su aprobacion", async () => {
    await seedFullPhase();

    const result = await machine_discovery_project_doc({ projectDir });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).not.toContain("Hito 1");
    expect(result.pending).toContain("planning");
    expect(markdown).toContain("pendiente de aprobacion");
  });

  test("incorpora la planificacion una vez aprobada su puerta", async () => {
    await seedFullPhase();
    await approve("planning");

    const result = await machine_discovery_project_doc({ projectDir });

    expect(await readFile(result.outputPath, "utf8")).toContain("Hito 1");
    expect(result.included).toContain("planning");
    expect(result.pending).not.toContain("planning");
  });

  test("incorpora los PRD aprobados con su contenido", async () => {
    await seedFullPhase();
    await approve("prds");

    const result = await machine_discovery_project_doc({ projectDir });

    expect(await readFile(result.outputPath, "utf8")).toContain("Ingesta de insumos");
    expect(result.included).toContain("prds");
  });

  test("señala como ausente un artefacto que nunca se genero", async () => {
    await machine_discovery_init({ projectDir });
    const current = await readState(projectDir);
    await writeState(projectDir, { ...current, approvals: { requirements: { status: "approved" } } });

    const result = await machine_discovery_project_doc({ projectDir });

    expect(result.missing).toContain("hla");
    expect(await readFile(result.outputPath, "utf8")).toContain("no generado");
  });

  test("deja su puerta pendiente y dependiente de todo lo que consolida", async () => {
    await seedFullPhase();

    const result = await machine_discovery_project_doc({ projectDir });

    expect(result.state.approvals.project?.status).toBe("pending");
    expect(result.state.approvals.project?.dependsOn).toEqual([
      "requirements",
      "hla",
      "prds",
      "estimation",
      "planning",
    ]);
    expect((await readState(projectDir)).approvals.project?.status).toBe("pending");
  });
});

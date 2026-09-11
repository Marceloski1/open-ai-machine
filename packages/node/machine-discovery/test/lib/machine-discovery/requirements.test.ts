import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "../../../tools/lib/machine-discovery/state";
import type { InputRecord, MachineState, Route } from "../../../tools/lib/machine-discovery/types";
import { machine_discovery_init } from "../../../tools/lib/machine-discovery/init";
import { machine_discovery_requirements, requirementsPath } from "../../../tools/lib/machine-discovery/requirements";

function input(route: Route, path: string): InputRecord {
  return { path, sha256: "0".repeat(64), processedAt: "2026-09-02T00:00:00.000Z", route, outputPath: path };
}

const SECTIONS = {
  scope: "Alcance derivado de los insumos.",
  functional: "El sistema registra insumos.",
  nonFunctional: "Respuesta bajo un segundo.",
  constraints: "Debe integrarse con Opencode.",
};

describe("machine_discovery_requirements", () => {
  let projectDir: string;

  async function seed(state: Partial<MachineState>): Promise<void> {
    await machine_discovery_init({ projectDir });
    const current = await readState(projectDir);
    await writeState(projectDir, { ...current, ...state });
  }

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-req-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("rechaza mientras la propuesta de negocio no este aprobada", async () => {
    await seed({
      inputs: [input("discovery", "inputs/acta.md")],
      approvals: { proposal: { status: "pending" } },
    });

    await expect(machine_discovery_requirements({ projectDir, sections: SECTIONS })).rejects.toThrow(/proposal/);
    expect(existsSync(requirementsPath(projectDir))).toBe(false);
  });

  test("rechaza cuando la puerta de la propuesta ni siquiera esta declarada", async () => {
    await seed({ inputs: [input("discovery", "inputs/acta.md")], approvals: {} });

    await expect(machine_discovery_requirements({ projectDir, sections: SECTIONS })).rejects.toThrow(/proposal/);
    expect(existsSync(requirementsPath(projectDir))).toBe(false);
  });

  test("rechaza sin insumos de descubrimiento aunque la propuesta este aprobada", async () => {
    await seed({
      inputs: [input("business", "inputs/negocio.md")],
      approvals: { proposal: { status: "approved" } },
    });

    await expect(machine_discovery_requirements({ projectDir, sections: SECTIONS })).rejects.toThrow(/discovery/);
    expect(existsSync(requirementsPath(projectDir))).toBe(false);
  });

  test("genera requirements.md y deja el Architecture Gate pendiente", async () => {
    await seed({
      inputs: [input("discovery", "inputs/acta.md")],
      approvals: { proposal: { status: "approved" } },
    });

    const result = await machine_discovery_requirements({ projectDir, sections: SECTIONS });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Alcance derivado de los insumos.");
    expect(markdown).toContain("El sistema registra insumos.");
    expect(result.state.approvals.requirements?.status).toBe("pending");
  });

  test("el Architecture Gate depende de la propuesta, para invalidarse con ella", async () => {
    await seed({
      inputs: [input("discovery", "inputs/acta.md")],
      approvals: { proposal: { status: "approved" } },
    });

    const result = await machine_discovery_requirements({ projectDir, sections: SECTIONS });

    expect(result.state.approvals.requirements?.dependsOn).toContain("proposal");
  });

  test("marca NEEDS INPUT toda seccion sin respaldo", async () => {
    await seed({
      inputs: [input("discovery", "inputs/acta.md")],
      approvals: { proposal: { status: "approved" } },
    });

    const result = await machine_discovery_requirements({
      projectDir,
      sections: { scope: "Solo el alcance.", functional: "   " },
    });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("Solo el alcance.");
    expect(markdown.match(/NEEDS INPUT/g)).toHaveLength(3);
  });

  test("persiste el estado en disco, no solo en memoria", async () => {
    await seed({
      inputs: [input("discovery", "inputs/acta.md")],
      approvals: { proposal: { status: "approved" } },
    });

    await machine_discovery_requirements({ projectDir, sections: SECTIONS });

    expect((await readState(projectDir)).approvals.requirements?.status).toBe("pending");
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "machine-core/src/state";
import type { InputRecord, MachineState, Route } from "machine-core/src/types";
import { machine_discovery_init } from "./init";
import { hlaPath, machine_discovery_hla } from "./hla";

function input(route: Route, path: string): InputRecord {
  return { path, sha256: "0".repeat(64), processedAt: "2026-09-02T00:00:00.000Z", route, outputPath: path };
}

const SECTIONS = {
  overview: "El sistema se despliega como un plugin de Opencode.",
  components: "Un nucleo determinista y dos fases.",
  integrations: "Pandoc para el entregable.",
  decisions: "El estado vive en el filesystem del proyecto.",
};

const DIAGRAMS = [{ title: "Componentes", mermaid: "graph TD;\n  core-->business;" }];

describe("machine_discovery_hla", () => {
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

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-hla-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("rechaza mientras el Architecture Gate siga pendiente", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "pending" } });

    await expect(
      machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: DIAGRAMS }),
    ).rejects.toThrow(/requirements/);
    expect(existsSync(hlaPath(projectDir))).toBe(false);
  });

  test("rechaza cuando el Architecture Gate ni siquiera esta declarado", async () => {
    await seed({ proposal: { status: "approved" } });

    await expect(
      machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: DIAGRAMS }),
    ).rejects.toThrow(/requirements/);
    expect(existsSync(hlaPath(projectDir))).toBe(false);
  });

  test("rechaza un Architecture Gate rechazado", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "rejected" } });

    await expect(
      machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: DIAGRAMS }),
    ).rejects.toThrow(/requirements/);
    expect(existsSync(hlaPath(projectDir))).toBe(false);
  });

  test("genera hla.md con el Architecture Gate aprobado", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "approved" } });

    const result = await machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: DIAGRAMS });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("El sistema se despliega como un plugin de Opencode.");
    expect(markdown).toContain("Un nucleo determinista y dos fases.");
  });

  test("expresa cada diagrama como un bloque mermaid con su titulo", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "approved" } });

    const result = await machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: DIAGRAMS });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).toContain("### Componentes");
    expect(markdown).toContain("```mermaid");
    expect(markdown).toContain("graph TD;");
    expect(markdown).toContain("core-->business;");
  });

  test("sin diagramas marca NEEDS INPUT en vez de inventar uno", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "approved" } });

    const result = await machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: [] });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown).not.toContain("```mermaid");
    expect(markdown).toContain("NEEDS INPUT");
  });

  test("marca NEEDS INPUT toda seccion sin respaldo", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "approved" } });

    const result = await machine_discovery_hla({
      projectDir,
      sections: { overview: "Solo la vision." },
      diagrams: DIAGRAMS,
    });

    const markdown = await readFile(result.outputPath, "utf8");
    expect(markdown.match(/NEEDS INPUT/g)).toHaveLength(3);
  });

  test("deja su puerta pendiente y dependiente del Architecture Gate", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "approved" } });

    const result = await machine_discovery_hla({ projectDir, sections: SECTIONS, diagrams: DIAGRAMS });

    expect(result.state.approvals.hla?.status).toBe("pending");
    expect(result.state.approvals.hla?.dependsOn).toContain("requirements");
    expect((await readState(projectDir)).approvals.hla?.status).toBe("pending");
  });
});

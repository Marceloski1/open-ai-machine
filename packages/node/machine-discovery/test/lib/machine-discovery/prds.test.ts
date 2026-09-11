import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "../../../tools/lib/machine-discovery/state";
import type { InputRecord, MachineState, Route } from "../../../tools/lib/machine-discovery/types";
import { machine_discovery_init } from "../../../tools/lib/machine-discovery/init";
import { machine_discovery_draft_prds, prdsDir, unitSlug } from "../../../tools/lib/machine-discovery/prds";

function input(route: Route, path: string): InputRecord {
  return { path, sha256: "0".repeat(64), processedAt: "2026-09-02T00:00:00.000Z", route, outputPath: path };
}

const UNITS = [
  { title: "Ingesta de insumos", objective: "Enumerar y clasificar archivos.", scope: "Solo lectura." },
  { title: "Registro de estado", objective: "Persistir el avance." },
  { title: "Exportacion a DOCX", objective: "Entregar el documento final." },
];

describe("unitSlug", () => {
  test("normaliza acentos, mayusculas y espacios de forma determinista", () => {
    expect(unitSlug("Exportación a DOCX")).toBe("exportacion-a-docx");
    expect(unitSlug("  Ingesta   de  insumos  ")).toBe("ingesta-de-insumos");
  });

  test("descarta la puntuacion en vez de arrastrarla al nombre de archivo", () => {
    expect(unitSlug("Registro (v2): estado!")).toBe("registro-v2-estado");
  });
});

describe("machine_discovery_draft_prds", () => {
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

  const APPROVED = { proposal: { status: "approved" as const }, requirements: { status: "approved" as const } };

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-prds-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("rechaza mientras el Architecture Gate siga pendiente", async () => {
    await seed({ proposal: { status: "approved" }, requirements: { status: "pending" } });

    await expect(machine_discovery_draft_prds({ projectDir, units: UNITS })).rejects.toThrow(/requirements/);
    expect(existsSync(prdsDir(projectDir))).toBe(false);
  });

  test("rechaza cuando no hay ninguna unidad funcional identificada", async () => {
    await seed(APPROVED);

    await expect(machine_discovery_draft_prds({ projectDir, units: [] })).rejects.toThrow(/unidad/);
    expect(existsSync(prdsDir(projectDir))).toBe(false);
  });

  test("genera un borrador por cada unidad funcional", async () => {
    await seed(APPROVED);

    const result = await machine_discovery_draft_prds({ projectDir, units: UNITS });

    expect(result.outputPaths).toHaveLength(3);
    expect((await readdir(prdsDir(projectDir))).sort()).toEqual([
      "exportacion-a-docx.md",
      "ingesta-de-insumos.md",
      "registro-de-estado.md",
    ]);
  });

  test("cada borrador lleva el titulo de su unidad y lo que la respalda", async () => {
    await seed(APPROVED);

    await machine_discovery_draft_prds({ projectDir, units: UNITS });

    const markdown = await readFile(join(prdsDir(projectDir), "ingesta-de-insumos.md"), "utf8");
    expect(markdown).toContain("# Ingesta de insumos");
    expect(markdown).toContain("Enumerar y clasificar archivos.");
    expect(markdown).toContain("Solo lectura.");
  });

  test("marca NEEDS INPUT las secciones sin respaldo de cada unidad", async () => {
    await seed(APPROVED);

    await machine_discovery_draft_prds({ projectDir, units: [UNITS[1]!] });

    const markdown = await readFile(join(prdsDir(projectDir), "registro-de-estado.md"), "utf8");
    expect(markdown).toContain("Persistir el avance.");
    expect(markdown.match(/NEEDS INPUT/g)).toHaveLength(3);
  });

  test("rechaza dos unidades que colisionan en el mismo archivo", async () => {
    await seed(APPROVED);

    const colliding = [{ title: "Ingesta de insumos" }, { title: "  ingesta de INSUMOS " }];

    await expect(machine_discovery_draft_prds({ projectDir, units: colliding })).rejects.toThrow(
      /ingesta-de-insumos/,
    );
  });

  test("deja su puerta pendiente y dependiente del Architecture Gate", async () => {
    await seed(APPROVED);

    const result = await machine_discovery_draft_prds({ projectDir, units: UNITS });

    expect(result.state.approvals.prds?.status).toBe("pending");
    expect(result.state.approvals.prds?.dependsOn).toContain("requirements");
    expect((await readState(projectDir)).approvals.prds?.status).toBe("pending");
  });

  test("regenerar no duplica ni deja borradores huerfanos de la corrida anterior", async () => {
    await seed(APPROVED);
    await machine_discovery_draft_prds({ projectDir, units: UNITS });

    await machine_discovery_draft_prds({ projectDir, units: [UNITS[0]!] });

    expect(await readdir(prdsDir(projectDir))).toEqual(["ingesta-de-insumos.md"]);
  });
});

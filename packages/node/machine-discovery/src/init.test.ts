import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState } from "machine-core/src/state";
import { machine_discovery_init } from "./init";

describe("machine_discovery_init", () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "machine-discovery-init-"));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  test("crea discovery/ y deja el estado listo", async () => {
    const result = await machine_discovery_init({ projectDir });

    expect(existsSync(join(projectDir, "discovery"))).toBe(true);
    expect(existsSync(join(projectDir, "inputs"))).toBe(true);
    expect(result.created).toBe(true);
    expect(result.state.approvals).toBeDefined();
  });

  test("conserva los insumos ya cargados", async () => {
    await mkdir(join(projectDir, "inputs"), { recursive: true });
    await writeFile(join(projectDir, "inputs", "acta.md"), "contenido del insumo");

    await machine_discovery_init({ projectDir });

    expect(await readFile(join(projectDir, "inputs", "acta.md"), "utf8")).toBe("contenido del insumo");
  });

  test("no sobrescribe artefactos de descubrimiento ya generados", async () => {
    await mkdir(join(projectDir, "discovery"), { recursive: true });
    await writeFile(join(projectDir, "discovery", "requirements.md"), "requisitos previos");

    const result = await machine_discovery_init({ projectDir });

    expect(await readFile(join(projectDir, "discovery", "requirements.md"), "utf8")).toBe("requisitos previos");
    expect(result.created).toBe(false);
  });

  test("es idempotente sobre el estado del proyecto", async () => {
    const first = await machine_discovery_init({ projectDir });
    const second = await machine_discovery_init({ projectDir });

    expect(second.state.inputs).toEqual(first.state.inputs);
    expect(await readState(projectDir)).toEqual(second.state);
  });
});

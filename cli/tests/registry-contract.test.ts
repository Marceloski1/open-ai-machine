import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPackage, loadCatalog } from "../src/core/catalog";
import { computeSha256 } from "../src/core/hash";
import { install } from "../src/commands/install";
import type { CatalogEntry } from "../src/core/types";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const REGISTRY_PATH = join(REPO_ROOT, "registry", "index.json");

async function realCatalog(): Promise<CatalogEntry[]> {
  return loadCatalog(REGISTRY_PATH);
}

describe("registry real: contrato con el instalador", () => {
  test("el registry publicado no esta vacio", async () => {
    expect((await realCatalog()).length).toBeGreaterThan(0);
  });

  test("cada entrada declara un packageDir que existe en el repositorio", async () => {
    for (const entry of await realCatalog()) {
      expect(typeof entry.packageDir).toBe("string");
      expect(entry.packageDir.length).toBeGreaterThan(0);
      expect(existsSync(join(REPO_ROOT, entry.packageDir))).toBe(true);
    }
  });

  test("cada entrada declara files con checksum que coincide con el disco", async () => {
    for (const entry of await realCatalog()) {
      expect(entry.files.length).toBeGreaterThan(0);
      for (const file of entry.files) {
        const absolute = join(REPO_ROOT, entry.packageDir, file.path);
        expect(existsSync(absolute)).toBe(true);
        expect(computeSha256(await readFile(absolute))).toBe(file.sha256);
      }
    }
  });

  test("cada entrada declara un runtime valido", async () => {
    for (const entry of await realCatalog()) {
      expect(["node", "python"]).toContain(entry.runtime);
    }
  });
});

describe("install desde el registry real", () => {
  let destRoot: string;

  beforeEach(async () => {
    destRoot = await mkdtemp(join(tmpdir(), "machine-registry-contract-"));
  });

  afterEach(async () => {
    await rm(destRoot, { recursive: true, force: true });
  });

  test("machine-core se instala copiando sus archivos declarados", async () => {
    const entry = findPackage(await realCatalog(), "machine-core");
    expect(entry).toBeDefined();

    const result = await install({
      entry: entry!,
      sourceRoot: REPO_ROOT,
      target: "project",
      destRoot,
      yes: true,
    });

    expect(result.status).toBe("installed");
    for (const file of entry!.files) {
      expect(existsSync(join(destRoot, file.path))).toBe(true);
    }
  });

  test("reinstalar el mismo paquete es idempotente", async () => {
    const entry = findPackage(await realCatalog(), "machine-core")!;
    const args = { entry, sourceRoot: REPO_ROOT, target: "project" as const, destRoot, yes: true };

    await install(args);
    const second = await install(args);

    expect(second.status).toBe("unchanged");
  });
});

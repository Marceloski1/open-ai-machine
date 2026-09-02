import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildRegistry } from "./index";

const fixturesDir = join(import.meta.dir, "..", "__fixtures__");

function fixture(name: string): string {
  return join(fixturesDir, name);
}

describe("buildRegistry", () => {
  test("dos paquetes con el mismo comando fallan por colision", async () => {
    await expect(
      buildRegistry({ packageDirs: [fixture("collision-a"), fixture("collision-b")] }),
    ).rejects.toThrow(/machine-render-docx/);
  });

  test("tres manifiestos validos generan un catalogo con tres entradas y checksum", async () => {
    const result = await buildRegistry({
      packageDirs: [fixture("valid-a"), fixture("valid-b"), fixture("valid-c")],
    });

    expect(result.packages).toHaveLength(3);
    const ids = result.packages.map((entry) => entry.id).sort();
    expect(ids).toEqual(["machine-alpha", "machine-beta", "machine-gamma"]);
    for (const entry of result.packages) {
      expect(entry.checksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test("un manifiesto invalido en el conjunto hace fallar la generacion", async () => {
    await expect(
      buildRegistry({ packageDirs: [fixture("valid-a"), fixture("invalid-no-version")] }),
    ).rejects.toThrow(/version/);
  });
});

describe("buildRegistry: contrato con el instalador", () => {
  async function buildWithFiles() {
    const result = await buildRegistry({
      packageDirs: [fixture("with-files")],
      repoRoot: fixturesDir,
    });
    return result.packages[0]!;
  }

  test("emite packageDir relativo al repoRoot en formato posix", async () => {
    const entry = await buildWithFiles();

    expect(entry.packageDir).toBe("with-files");
  });

  test("emite files con el contenido instalable y su sha256 real", async () => {
    const entry = await buildWithFiles();

    expect(entry.files.map((file) => file.path).sort()).toEqual([
      "agents/delta.md",
      "commands/machine-delta-run.md",
      "templates/base.md",
    ]);
    for (const file of entry.files) {
      const content = await readFile(join(fixture("with-files"), file.path));
      expect(file.sha256).toBe(createHash("sha256").update(content).digest("hex"));
    }
  });

  test("files excluye el manifiesto, el package.json y el codigo fuente", async () => {
    const entry = await buildWithFiles();

    const paths = entry.files.map((file) => file.path);
    expect(paths).not.toContain("machine.json");
    expect(paths).not.toContain("package.json");
    expect(paths.some((path) => path.startsWith("src/"))).toBe(false);
  });

  test("runtime toma el valor declarado en el manifiesto", async () => {
    const entry = await buildWithFiles();

    expect(entry.runtime).toBe("python");
  });

  test("runtime cae en node cuando el manifiesto no lo declara", async () => {
    const result = await buildRegistry({
      packageDirs: [fixture("valid-a")],
      repoRoot: fixturesDir,
    });

    expect(result.packages[0]!.runtime).toBe("node");
  });
});

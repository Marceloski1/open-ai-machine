import { describe, expect, test } from "bun:test";
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

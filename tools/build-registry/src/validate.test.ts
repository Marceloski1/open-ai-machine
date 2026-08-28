import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateManifest } from "./validate";

const fixturesDir = join(import.meta.dir, "..", "__fixtures__");

async function readManifest(dir: string): Promise<unknown> {
  const raw = await readFile(join(fixturesDir, dir, "machine.json"), "utf8");
  return JSON.parse(raw);
}

describe("validateManifest", () => {
  test("manifiesto valido pasa el schema", async () => {
    const manifest = await readManifest("valid-a");

    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("manifiesto sin version falla e indica el campo infractor", async () => {
    const manifest = await readManifest("invalid-no-version");

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("version"))).toBe(true);
  });

  test("manifiesto con SemVer malformado falla e indica el campo infractor", async () => {
    const manifest = await readManifest("valid-a");
    const malformed = { ...(manifest as Record<string, unknown>), version: "not-a-semver" };

    const result = validateManifest(malformed);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("version"))).toBe(true);
  });

  test("comando sin prefijo machine- falla la validacion", async () => {
    const manifest = await readManifest("invalid-bad-command");

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("commands"))).toBe(true);
  });

  test("manifiesto sin description falla e indica el campo infractor", async () => {
    const manifest = await readManifest("invalid-no-description");

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("description"))).toBe(true);
  });

  test("manifiesto con runtime no soportado falla e indica el campo infractor", async () => {
    const manifest = await readManifest("invalid-bad-runtime");

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("runtime"))).toBe(true);
  });

  test("manifiesto sin runtime sigue siendo valido (compatibilidad hacia atras)", async () => {
    const manifest = await readManifest("valid-a");

    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
  });

  test("manifiesto con runtime python es valido", async () => {
    const manifest = await readManifest("valid-a");
    const withRuntime = { ...(manifest as Record<string, unknown>), runtime: "python" };

    const result = validateManifest(withRuntime);

    expect(result.valid).toBe(true);
  });
});

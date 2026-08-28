import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computePackageChecksum } from "./checksum";

async function makePackageDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "build-registry-checksum-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content);
  }
  return dir;
}

describe("computePackageChecksum", () => {
  test("es determinista para el mismo contenido", async () => {
    const dirA = await makePackageDir({
      "machine.json": '{"id":"machine-alpha"}',
      "commands/machine-alpha-init.md": "# init",
    });
    const dirB = await makePackageDir({
      "machine.json": '{"id":"machine-alpha"}',
      "commands/machine-alpha-init.md": "# init",
    });

    const checksumA = await computePackageChecksum(dirA);
    const checksumB = await computePackageChecksum(dirB);

    expect(checksumA).toBe(checksumB);
    expect(checksumA).toMatch(/^[a-f0-9]{64}$/);
  });

  test("cambia cuando el contenido de un archivo cambia", async () => {
    const dirA = await makePackageDir({
      "machine.json": '{"id":"machine-alpha","version":"0.1.0"}',
    });
    const dirB = await makePackageDir({
      "machine.json": '{"id":"machine-alpha","version":"0.2.0"}',
    });

    const checksumA = await computePackageChecksum(dirA);
    const checksumB = await computePackageChecksum(dirB);

    expect(checksumA).not.toBe(checksumB);
  });
});

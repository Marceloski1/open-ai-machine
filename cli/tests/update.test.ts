import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../src/commands/install";
import { update } from "../src/commands/update";
import { computeSha256 } from "../src/core/hash";
import { readInstalledEntries } from "../src/core/installed-registry";
import type { CatalogEntry } from "../src/core/types";

let destRoot: string;
let sourceRoot: string;

async function writeVersion(files: { path: string; content: string }[]): Promise<CatalogEntry> {
  const entryFiles = [];
  for (const file of files) {
    const abs = join(sourceRoot, "package-b", file.path);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, file.content);
    entryFiles.push({ path: file.path, sha256: computeSha256(file.content) });
  }
  return {
    id: "package-b",
    version: "2.0.0",
    description: "Fixture de update",
    packageDir: "package-b",
    commands: [],
    agents: [],
    skills: [],
    templates: [],
    checksum: "irrelevant",
    permissions: {},
    externalRequirements: [],
    files: entryFiles,
  };
}

beforeEach(async () => {
  destRoot = await mkdtemp(join(tmpdir(), "machine-update-dest-"));
  sourceRoot = await mkdtemp(join(tmpdir(), "machine-update-src-"));

  const v1: CatalogEntry = {
    id: "package-b",
    version: "1.0.0",
    description: "Fixture de update",
    packageDir: "package-b",
    commands: [],
    agents: [],
    skills: [],
    templates: [],
    checksum: "irrelevant",
    permissions: {},
    externalRequirements: [],
    files: [
      { path: "commands/a.md", sha256: computeSha256("contenido v1 a") },
      { path: "commands/b.md", sha256: computeSha256("contenido v1 b") },
    ],
  };
  await mkdir(join(sourceRoot, "package-b", "commands"), { recursive: true });
  await writeFile(join(sourceRoot, "package-b", "commands", "a.md"), "contenido v1 a");
  await writeFile(join(sourceRoot, "package-b", "commands", "b.md"), "contenido v1 b");
  await install({ entry: v1, sourceRoot, target: "project", destRoot, yes: true });
});

afterEach(async () => {
  await rm(destRoot, { recursive: true, force: true });
  await rm(sourceRoot, { recursive: true, force: true });
});

describe("update", () => {
  test("verifies checksum before replacing and rejects a source that does not match", async () => {
    const entry = await writeVersion([
      { path: "commands/a.md", content: "contenido v2 a" },
      { path: "commands/b.md", content: "contenido v2 b" },
    ]);
    entry.files[0]!.sha256 = "0000000000000000000000000000000000000000000000000000000000000000";

    const result = await update({ entry, sourceRoot, target: "project", destRoot });

    expect(result.status).toBe("restored");
    const contentA = await readFile(join(destRoot, "commands", "a.md"), "utf8");
    expect(contentA).toBe("contenido v1 a");
    const entries = await readInstalledEntries(destRoot);
    expect(entries[0]?.version).toBe("1.0.0");
  });

  test("a mid-update failure restores previous files and installed.json; the installed version stays operational", async () => {
    const entry = await writeVersion([
      { path: "commands/a.md", content: "contenido v2 a" },
      { path: "commands/b.md", content: "contenido v2 b" },
    ]);

    let callCount = 0;
    const failingCopyFile = async (src: string, dest: string) => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error("fallo simulado a mitad de la actualizacion");
      }
      const { copyFile } = await import("node:fs/promises");
      await copyFile(src, dest);
    };

    const result = await update({ entry, sourceRoot, target: "project", destRoot, copyFile: failingCopyFile });

    expect(result.status).toBe("restored");

    const contentA = await readFile(join(destRoot, "commands", "a.md"), "utf8");
    expect(contentA).toBe("contenido v1 a");
    const contentB = await readFile(join(destRoot, "commands", "b.md"), "utf8");
    expect(contentB).toBe("contenido v1 b");

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.version).toBe("1.0.0");
  });

  test("a successful update writes the new files and registers the new version", async () => {
    const entry = await writeVersion([
      { path: "commands/a.md", content: "contenido v2 a" },
      { path: "commands/b.md", content: "contenido v2 b" },
    ]);

    const result = await update({ entry, sourceRoot, target: "project", destRoot });

    expect(result.status).toBe("updated");
    const contentA = await readFile(join(destRoot, "commands", "a.md"), "utf8");
    expect(contentA).toBe("contenido v2 a");

    const entries = await readInstalledEntries(destRoot);
    expect(entries[0]?.version).toBe("2.0.0");
  });
});

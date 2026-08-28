import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uninstall } from "./uninstall";
import { readInstalledEntries, writeInstalledEntry } from "./installed-registry";

let destRoot: string;

beforeEach(async () => {
  destRoot = await mkdtemp(join(tmpdir(), "machine-uninstall-"));
});

afterEach(async () => {
  await rm(destRoot, { recursive: true, force: true });
});

describe("uninstall", () => {
  test("removes only the files registered in installed.json for that package and target", async () => {
    await mkdir(join(destRoot, "commands"), { recursive: true });
    await writeFile(join(destRoot, "commands", "registered.md"), "instalado por el paquete");
    await writeFile(join(destRoot, "commands", "user-created.md"), "creado por el usuario");

    await writeInstalledEntry(destRoot, {
      id: "package-a",
      version: "1.0.0",
      target: "project",
      files: [{ path: "commands/registered.md", sha256: "whatever" }],
    });

    const result = await uninstall({ id: "package-a", target: "project", destRoot });

    expect(result.status).toBe("removed");

    await expect(readFile(join(destRoot, "commands", "registered.md"), "utf8")).rejects.toThrow();

    const userFileContent = await readFile(join(destRoot, "commands", "user-created.md"), "utf8");
    expect(userFileContent).toBe("creado por el usuario");

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toEqual([]);
  });

  test("uninstalling an id/target that is not installed reports not-found without touching the filesystem", async () => {
    const result = await uninstall({ id: "does-not-exist", target: "project", destRoot });
    expect(result.status).toBe("not-found");
  });

  test("uninstall never removes a whole directory, only the registered file paths", async () => {
    await mkdir(join(destRoot, "agents"), { recursive: true });
    await writeFile(join(destRoot, "agents", "one.md"), "a");
    await writeFile(join(destRoot, "agents", "two.md"), "b");

    await writeInstalledEntry(destRoot, {
      id: "package-a",
      version: "1.0.0",
      target: "project",
      files: [{ path: "agents/one.md", sha256: "whatever" }],
    });

    await uninstall({ id: "package-a", target: "project", destRoot });

    const remaining = await readFile(join(destRoot, "agents", "two.md"), "utf8");
    expect(remaining).toBe("b");
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getInstalledRegistryPath,
  readInstalledEntries,
  removeInstalledEntry,
  writeInstalledEntry,
} from "../src/core/installed-registry";
import type { InstalledEntry } from "../src/core/types";

let destRoot: string;

beforeEach(async () => {
  destRoot = await mkdtemp(join(tmpdir(), "machine-installed-registry-"));
});

afterEach(async () => {
  await rm(destRoot, { recursive: true, force: true });
});

describe("installed-registry", () => {
  test("readInstalledEntries returns [] when installed.json does not exist, without throwing", async () => {
    const entries = await readInstalledEntries(destRoot);
    expect(entries).toEqual([]);
  });

  test("writeInstalledEntry registers id, version, target and files[] (path + sha256)", async () => {
    const entry: InstalledEntry = {
      id: "machine-core",
      version: "0.1.0",
      target: "project",
      files: [{ path: "agents/machine.md", sha256: "abc123" }],
    };
    await writeInstalledEntry(destRoot, entry);

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toEqual([entry]);

    const raw = await readFile(getInstalledRegistryPath(destRoot), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual([entry]);
  });

  test("writeInstalledEntry upserts an entry with the same id and target", async () => {
    const v1: InstalledEntry = { id: "machine-core", version: "0.1.0", target: "project", files: [] };
    const v2: InstalledEntry = { id: "machine-core", version: "0.2.0", target: "project", files: [] };
    await writeInstalledEntry(destRoot, v1);
    await writeInstalledEntry(destRoot, v2);

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.version).toBe("0.2.0");
  });

  test("writeInstalledEntry keeps distinct entries for the same id on different targets", async () => {
    const project: InstalledEntry = { id: "machine-core", version: "0.1.0", target: "project", files: [] };
    const global: InstalledEntry = { id: "machine-core", version: "0.1.0", target: "global", files: [] };
    await writeInstalledEntry(destRoot, project);
    await writeInstalledEntry(destRoot, global);

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toHaveLength(2);
  });

  test("removeInstalledEntry deletes only the matching id+target entry", async () => {
    const project: InstalledEntry = { id: "machine-core", version: "0.1.0", target: "project", files: [] };
    const global: InstalledEntry = { id: "machine-core", version: "0.1.0", target: "global", files: [] };
    await writeInstalledEntry(destRoot, project);
    await writeInstalledEntry(destRoot, global);

    await removeInstalledEntry(destRoot, "machine-core", "project");

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toEqual([global]);
  });
});

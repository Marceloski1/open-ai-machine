import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../src/commands/install";
import { computeSha256 } from "../src/core/hash";
import { readInstalledEntries } from "../src/core/installed-registry";
import type { CatalogEntry } from "../src/core/types";

const FIXTURE_SOURCE_ROOT = join(import.meta.dir, "fixtures");

async function buildEntry(): Promise<CatalogEntry> {
  const commandPath = join(FIXTURE_SOURCE_ROOT, "package-a", "commands", "hello.md");
  const agentPath = join(FIXTURE_SOURCE_ROOT, "package-a", "agents", "hello-agent.md");
  const commandSha = computeSha256(await readFile(commandPath));
  const agentSha = computeSha256(await readFile(agentPath));
  return {
    id: "package-a",
    version: "1.0.0",
    description: "Paquete de fixture",
    packageDir: "package-a",
    runtime: "node",
    commands: ["hello"],
    agents: ["hello-agent"],
    skills: [],
    templates: [],
    checksum: computeSha256(`${commandSha}${agentSha}`),
    permissions: { bash: "deny" },
    externalRequirements: [],
    files: [
      { path: "commands/hello.md", sha256: commandSha },
      { path: "agents/hello-agent.md", sha256: agentSha },
    ],
  };
}

let destRoot: string;

beforeEach(async () => {
  destRoot = await mkdtemp(join(tmpdir(), "machine-install-"));
});

afterEach(async () => {
  await rm(destRoot, { recursive: true, force: true });
});

describe("install", () => {
  test("non-interactive install without --yes rejects and writes nothing", async () => {
    const entry = await buildEntry();
    const result = await install({
      entry,
      sourceRoot: FIXTURE_SOURCE_ROOT,
      target: "project",
      destRoot,
      interactive: false,
      yes: false,
    });

    expect(result.status).toBe("rejected");
    const entries = await readInstalledEntries(destRoot);
    expect(entries).toEqual([]);
    await expect(stat(join(destRoot, "commands", "hello.md"))).rejects.toThrow();
  });

  test("interactive install rejects without writing when the user declines", async () => {
    const entry = await buildEntry();
    const result = await install({
      entry,
      sourceRoot: FIXTURE_SOURCE_ROOT,
      target: "project",
      destRoot,
      interactive: true,
      confirm: () => false,
    });

    expect(result.status).toBe("rejected");
    const entries = await readInstalledEntries(destRoot);
    expect(entries).toEqual([]);
  });

  test("install to project destination writes under destRoot and registers checksums", async () => {
    const entry = await buildEntry();
    const result = await install({
      entry,
      sourceRoot: FIXTURE_SOURCE_ROOT,
      target: "project",
      destRoot,
      yes: true,
    });

    expect(result.status).toBe("installed");

    const commandContent = await readFile(join(destRoot, "commands", "hello.md"), "utf8");
    expect(commandContent).toContain("package-a");

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("package-a");
    expect(entries[0]?.target).toBe("project");
    expect(entries[0]?.files).toEqual(entry.files);
  });

  test("install does not write opencode.json (machine-core is not published to npm yet)", async () => {
    const entry = await buildEntry();
    await install({ entry, sourceRoot: FIXTURE_SOURCE_ROOT, target: "global", destRoot, yes: true });

    await expect(stat(join(destRoot, "opencode.json"))).rejects.toThrow();
  });

  test("reinstalling the same version does not rewrite files and reports unchanged", async () => {
    const entry = await buildEntry();
    await install({ entry, sourceRoot: FIXTURE_SOURCE_ROOT, target: "project", destRoot, yes: true });
    const firstStat = await stat(join(destRoot, "commands", "hello.md"));

    const result = await install({ entry, sourceRoot: FIXTURE_SOURCE_ROOT, target: "project", destRoot, yes: true });
    const secondStat = await stat(join(destRoot, "commands", "hello.md"));

    expect(result.status).toBe("unchanged");
    expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs);

    const entries = await readInstalledEntries(destRoot);
    expect(entries).toHaveLength(1);
  });
});

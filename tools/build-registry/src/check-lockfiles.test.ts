import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkForbiddenLockfiles } from "./check-lockfiles";

async function makeRepoDir(files: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "build-registry-lockfiles-"));
  for (const file of files) {
    await writeFile(join(dir, file), "");
  }
  return dir;
}

describe("checkForbiddenLockfiles", () => {
  test("falla si existe package-lock.json", async () => {
    const repoDir = await makeRepoDir(["package-lock.json"]);

    const result = await checkForbiddenLockfiles(repoDir);

    expect(result.ok).toBe(false);
    expect(result.found).toContain("package-lock.json");
  });

  test("falla si existe yarn.lock", async () => {
    const repoDir = await makeRepoDir(["yarn.lock"]);

    const result = await checkForbiddenLockfiles(repoDir);

    expect(result.ok).toBe(false);
    expect(result.found).toContain("yarn.lock");
  });

  test("falla si existe bun.lockb", async () => {
    const repoDir = await makeRepoDir(["bun.lockb"]);

    const result = await checkForbiddenLockfiles(repoDir);

    expect(result.ok).toBe(false);
    expect(result.found).toContain("bun.lockb");
  });

  test("pasa si solo existe pnpm-lock.yaml", async () => {
    const repoDir = await makeRepoDir(["pnpm-lock.yaml"]);

    const result = await checkForbiddenLockfiles(repoDir);

    expect(result.ok).toBe(true);
    expect(result.found).toEqual([]);
  });
});

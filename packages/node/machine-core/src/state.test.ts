import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureState, getStatePath, readState } from "./state";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-core-state-"));
}

describe("state", () => {
  test("ensureState crea state.json con inputs y approvals vacios cuando no existe", async () => {
    const projectDir = await makeProjectDir();

    const state = await ensureState(projectDir);

    expect(state.inputs).toEqual([]);
    expect(state.approvals).toEqual({});
    expect(typeof state.phase).toBe("string");

    const onDisk = JSON.parse(await readFile(getStatePath(projectDir), "utf8"));
    expect(onDisk.inputs).toEqual([]);
    expect(onDisk.approvals).toEqual({});
  });

  test("readState crea state.json cuando no existe previamente", async () => {
    const projectDir = await makeProjectDir();

    const state = await readState(projectDir);

    expect(state.inputs).toEqual([]);
    expect(state.approvals).toEqual({});
  });

  test("readState falla con mensaje accionable ante JSON invalido y no sobrescribe el archivo", async () => {
    const projectDir = await makeProjectDir();
    const statePath = getStatePath(projectDir);
    await mkdir(join(projectDir, ".machine"), { recursive: true });
    await writeFile(statePath, "{ esto no es json valido");

    const before = await readFile(statePath, "utf8");
    const beforeMtime = (await stat(statePath)).mtimeMs;

    await expect(readState(projectDir)).rejects.toThrow();

    const after = await readFile(statePath, "utf8");
    const afterMtime = (await stat(statePath)).mtimeMs;

    expect(after).toBe(before);
    expect(afterMtime).toBe(beforeMtime);
  });
});

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indexPath, machine_business_init } from "./init";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-business-init-"));
}

describe("machine_business_init", () => {
  test("proyecto nuevo crea inputs/, business/, .machine/state.json y el indice", async () => {
    const projectDir = await makeProjectDir();

    await machine_business_init({ projectDir });

    const inputsStat = await stat(join(projectDir, "inputs"));
    expect(inputsStat.isDirectory()).toBe(true);

    const businessStat = await stat(join(projectDir, "business"));
    expect(businessStat.isDirectory()).toBe(true);

    const stateStat = await stat(join(projectDir, ".machine", "state.json"));
    expect(stateStat.isFile()).toBe(true);

    const indexStat = await stat(indexPath(projectDir));
    expect(indexStat.isFile()).toBe(true);
  });

  test("proyecto existente con insumos ya cargados no destruye contenido", async () => {
    const projectDir = await makeProjectDir();
    await machine_business_init({ projectDir });

    const customInputPath = join(projectDir, "inputs", "nota.md");
    await writeFile(customInputPath, "contenido original");
    const indexBefore = await readFile(indexPath(projectDir), "utf8");

    await machine_business_init({ projectDir });

    const inputAfter = await readFile(customInputPath, "utf8");
    expect(inputAfter).toBe("contenido original");

    const indexAfter = await readFile(indexPath(projectDir), "utf8");
    expect(indexAfter).toBe(indexBefore);
  });
});

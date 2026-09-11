import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { machine_process_input } from "../../machine-core/tools/lib/machine-core/core";

async function makeSimulatedHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-business-home-"));
}

describe("insumo de negocio procesado aterriza bajo business/ con route: business", () => {
  test("machine-process-input (machine-core) registra el insumo con route business y outputPath bajo business/", async () => {
    const simulatedHome = await makeSimulatedHome();
    const projectDir = join(simulatedHome, "docs", "mi-proyecto");

    const result = await machine_process_input({
      projectDir,
      inputPath: "inputs/reunion-negocio.md",
      content: "Notas de la reunion de negocio: mercado, problema, solucion, estimacion.",
      route: "business",
      outputPath: "business/reunion-negocio.md",
    });

    expect(result.skipped).toBe(false);
    expect(result.needsInput).toBe(false);

    const record = result.state.inputs.find((input) => input.path === "inputs/reunion-negocio.md");
    expect(record).toBeDefined();
    expect(record?.route).toBe("business");
    expect(record?.outputPath).toBe("business/reunion-negocio.md");
    expect(record?.outputPath?.startsWith("business/")).toBe(true);
  });
});

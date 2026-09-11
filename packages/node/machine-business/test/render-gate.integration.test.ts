import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "../../machine-core/tools/lib/machine-core/state";
import { machine_render_docx } from "../../machine-core/tools/lib/machine-core/core";
import type { InputRecord } from "../../machine-core/tools/lib/machine-core/types";
import { machine_business_proposal } from "../tools/lib/machine-business/proposal";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-business-render-gate-"));
}

async function withBusinessInput(projectDir: string): Promise<void> {
  const state = await readState(projectDir);
  const record: InputRecord = {
    path: "inputs/nota.md",
    sha256: "abc123",
    processedAt: new Date().toISOString(),
    route: "business",
    outputPath: "business/nota.md",
  };
  await writeState(projectDir, { ...state, inputs: [...state.inputs, record] });
}

describe("exportacion rechazada con approvals.proposal en pending", () => {
  test("machine-render-docx sobre business/proposal.md rechaza y no crea proposal.docx", async () => {
    const projectDir = await makeProjectDir();
    await withBusinessInput(projectDir);
    await machine_business_proposal({ projectDir, sections: {} });

    const state = await readState(projectDir);
    expect(state.approvals.proposal?.status).toBe("pending");

    const outputPath = join(projectDir, "business", "proposal.docx");

    await expect(
      machine_render_docx({
        projectDir,
        gate: "proposal",
        sourcePath: join(projectDir, "business", "proposal.md"),
        outputPath,
        isAvailable: () => true,
        isTemplateAvailable: () => true,
        render: async () => {
          throw new Error("render no deberia invocarse con la puerta en pending");
        },
      }),
    ).rejects.toThrow(/proposal/);

    expect(await Bun.file(outputPath).exists()).toBe(false);
  });
});

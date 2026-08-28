import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approveGate } from "machine-core/src/approvals";
import { readState, writeState } from "machine-core/src/state";
import type { InputRecord } from "machine-core/src/types";
import { machine_business_proposal, proposalPath } from "./proposal";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-business-proposal-"));
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

describe("machine_business_proposal", () => {
  test("sin insumos route: business falla y no genera proposal.md", async () => {
    const projectDir = await makeProjectDir();

    await expect(
      machine_business_proposal({ projectDir, sections: {} }),
    ).rejects.toThrow(/insumos/i);

    expect(await Bun.file(proposalPath(projectDir)).exists()).toBe(false);
  });

  test("con insumos suficientes genera proposal.md con las cuatro secciones", async () => {
    const projectDir = await makeProjectDir();
    await withBusinessInput(projectDir);

    await machine_business_proposal({
      projectDir,
      sections: {
        market: "Mercado B2B SaaS",
        problem: "Friccion en onboarding",
        solution: "Automatizar el flujo",
        estimate: "3 meses, 2 ingenieros",
      },
    });

    const content = await Bun.file(proposalPath(projectDir)).text();
    expect(content).toContain("Mercado B2B SaaS");
    expect(content).toContain("Friccion en onboarding");
    expect(content).toContain("Automatizar el flujo");
    expect(content).toContain("3 meses, 2 ingenieros");
    expect(content).not.toContain("NEEDS INPUT");
  });

  test("seccion sin respaldo (mercado) se marca NEEDS INPUT y no se inventa contenido", async () => {
    const projectDir = await makeProjectDir();
    await withBusinessInput(projectDir);

    await machine_business_proposal({
      projectDir,
      sections: {
        problem: "Friccion en onboarding",
        solution: "Automatizar el flujo",
        estimate: "3 meses",
      },
    });

    const content = await Bun.file(proposalPath(projectDir)).text();
    expect(content).toContain("NEEDS INPUT");
  });

  test("generar proposal.md fija approvals.proposal en pending", async () => {
    const projectDir = await makeProjectDir();
    await withBusinessInput(projectDir);

    await machine_business_proposal({ projectDir, sections: {} });

    const state = await readState(projectDir);
    expect(state.approvals.proposal?.status).toBe("pending");
  });

  test("regenerar proposal.md tras aprobar vuelve approvals.proposal a pending", async () => {
    const projectDir = await makeProjectDir();
    await withBusinessInput(projectDir);

    await machine_business_proposal({ projectDir, sections: {} });
    let state = await readState(projectDir);
    state = approveGate(state, "proposal");
    await writeState(projectDir, state);

    await machine_business_proposal({ projectDir, sections: {} });

    state = await readState(projectDir);
    expect(state.approvals.proposal?.status).toBe("pending");
  });
});

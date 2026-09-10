import { tool } from "@opencode-ai/plugin/tool";
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState } from "machine-core/src/state";
import type { InputRecord } from "machine-core/src/types";
import {
  draft_prds,
  hla,
  init,
  planning,
  project_doc,
  requirements,
  time_estimation,
} from "./tool";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-discovery-tool-"));
}

async function withDiscoveryInput(projectDir: string): Promise<void> {
  const state = await readState(projectDir);
  const record: InputRecord = {
    path: "inputs/nota.md",
    sha256: "abc123",
    processedAt: new Date().toISOString(),
    route: "discovery",
    outputPath: "discovery/nota.md",
  };
  await writeState(projectDir, { ...state, inputs: [...state.inputs, record] });
}

async function approveGateDirectly(projectDir: string, gate: string): Promise<void> {
  const state = await readState(projectDir);
  await writeState(projectDir, {
    ...state,
    approvals: { ...state.approvals, [gate]: { status: "approved" } },
  });
}

async function approveProposal(projectDir: string): Promise<void> {
  await approveGateDirectly(projectDir, "proposal");
}

async function approveRequirements(projectDir: string): Promise<void> {
  await approveGateDirectly(projectDir, "requirements");
}

const EXPORTS = { init, requirements, hla, draft_prds, time_estimation, planning, project_doc };

describe("contrato tool() de @opencode-ai/plugin", () => {
  for (const [name, definition] of Object.entries(EXPORTS)) {
    test(`${name} cumple {description, args, execute}`, () => {
      expect(typeof definition.description).toBe("string");
      expect(definition.description.length).toBeGreaterThan(0);
      expect(typeof definition.args).toBe("object");
      expect(definition.args).not.toBeNull();
      expect(typeof definition.execute).toBe("function");
      for (const schema of Object.values(definition.args)) {
        expect(typeof (schema as { safeParse?: unknown }).safeParse).toBe("function");
      }
    });
  }
});

describe("args valida payloads reales", () => {
  test("init exige projectDir", () => {
    const schema = tool.schema.object(init.args);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  test("requirements exige projectDir y sections", () => {
    const schema = tool.schema.object(requirements.args);
    expect(
      schema.safeParse({ projectDir: "/tmp/a", sections: { scope: "MVP" } }).success,
    ).toBe(true);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(false);
  });

  test("hla exige projectDir y sections, diagrams es opcional", () => {
    const schema = tool.schema.object(hla.args);
    expect(schema.safeParse({ projectDir: "/tmp/a", sections: {} }).success).toBe(true);
    expect(
      schema.safeParse({
        projectDir: "/tmp/a",
        sections: {},
        diagrams: [{ title: "Componentes", mermaid: "graph TD; A-->B;" }],
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(false);
  });

  test("draft_prds exige projectDir y units", () => {
    const schema = tool.schema.object(draft_prds.args);
    expect(
      schema.safeParse({ projectDir: "/tmp/a", units: [{ title: "Login" }] }).success,
    ).toBe(true);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(false);
  });

  test("time_estimation exige projectDir y estimates", () => {
    const schema = tool.schema.object(time_estimation.args);
    expect(
      schema.safeParse({ projectDir: "/tmp/a", estimates: [{ unit: "Login", effort: "3d" }] })
        .success,
    ).toBe(true);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(false);
  });

  test("planning exige projectDir e items", () => {
    const schema = tool.schema.object(planning.args);
    expect(
      schema.safeParse({ projectDir: "/tmp/a", items: [{ unit: "Login", milestone: "M1" }] })
        .success,
    ).toBe(true);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(false);
  });

  test("project_doc exige projectDir", () => {
    const schema = tool.schema.object(project_doc.args);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("delegacion en las funciones deterministas existentes", () => {
  test("init.execute crea discovery/ y el estado, igual que machine_discovery_init", async () => {
    const projectDir = await makeProjectDir();

    const result = await init.execute({ projectDir }, {} as never);

    const output = typeof result === "string" ? result : result.output;
    const parsed = JSON.parse(output) as { created: boolean; discoveryDir: string };
    expect(parsed.created).toBe(true);
  });

  test("requirements.execute rechaza sin proposal aprobada, igual que machine_discovery_requirements", async () => {
    const projectDir = await makeProjectDir();

    await expect(
      requirements.execute({ projectDir, sections: {} }, {} as never),
    ).rejects.toThrow(/proposal/);
  });

  test("hla.execute rechaza sin requirements aprobada, igual que machine_discovery_hla", async () => {
    const projectDir = await makeProjectDir();
    await approveProposal(projectDir);

    await expect(hla.execute({ projectDir, sections: {} }, {} as never)).rejects.toThrow(
      /requirements/,
    );
  });

  test("draft_prds.execute rechaza sin requirements aprobada, igual que machine_discovery_draft_prds", async () => {
    const projectDir = await makeProjectDir();

    await expect(
      draft_prds.execute({ projectDir, units: [{ title: "Login" }] }, {} as never),
    ).rejects.toThrow(/requirements/);
  });

  test("time_estimation.execute rechaza sin PRD generados, igual que machine_discovery_time_estimation", async () => {
    const projectDir = await makeProjectDir();
    await approveProposal(projectDir);
    await withDiscoveryInput(projectDir);
    await requirements.execute({ projectDir, sections: {} }, {} as never);
    await approveRequirements(projectDir);

    await expect(
      time_estimation.execute(
        { projectDir, estimates: [{ unit: "Login", effort: "3d" }] },
        {} as never,
      ),
    ).rejects.toThrow(/PRD/);
  });

  test("planning.execute rechaza sin estimacion generada, igual que machine_discovery_planning", async () => {
    const projectDir = await makeProjectDir();
    await approveProposal(projectDir);
    await withDiscoveryInput(projectDir);
    await requirements.execute({ projectDir, sections: {} }, {} as never);
    await approveRequirements(projectDir);

    await expect(
      planning.execute(
        { projectDir, items: [{ unit: "Login", milestone: "M1" }] },
        {} as never,
      ),
    ).rejects.toThrow(/estimacion/);
  });

  test("project_doc.execute rechaza sin requirements aprobada, igual que machine_discovery_project_doc", async () => {
    const projectDir = await makeProjectDir();

    await expect(project_doc.execute({ projectDir }, {} as never)).rejects.toThrow(
      /requirements/,
    );
  });
});

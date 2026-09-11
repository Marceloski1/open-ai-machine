import { tool } from "@opencode-ai/plugin/tool";
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approve, process_input, render_docx } from "../tools/machine";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-core-tool-"));
}

const EXPORTS = { approve, process_input, render_docx };

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
  test("approve exige projectDir y gate", () => {
    const schema = tool.schema.object(approve.args);
    expect(schema.safeParse({ projectDir: "/tmp/a", gate: "proposal" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  test("process_input exige projectDir, inputPath, content, route y outputPath", () => {
    const schema = tool.schema.object(process_input.args);
    expect(
      schema.safeParse({
        projectDir: "/tmp/a",
        inputPath: "inputs/a.md",
        content: "hola",
        route: "business",
        outputPath: "business/a.md",
      }).success,
    ).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(
      schema.safeParse({
        projectDir: "/tmp/a",
        inputPath: "inputs/a.md",
        content: "hola",
        route: "no-existe",
        outputPath: "business/a.md",
      }).success,
    ).toBe(false);
  });

  test("render_docx exige projectDir, gate, sourcePath y outputPath", () => {
    const schema = tool.schema.object(render_docx.args);
    expect(
      schema.safeParse({
        projectDir: "/tmp/a",
        gate: "proposal",
        sourcePath: "business/proposal.md",
        outputPath: "business/proposal.docx",
      }).success,
    ).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("delegacion en las funciones deterministas existentes", () => {
  test("approve.execute rechaza una puerta no declarada, igual que machine_approve", async () => {
    const projectDir = await makeProjectDir();

    await expect(
      approve.execute({ projectDir, gate: "no-declarada" }, {} as never),
    ).rejects.toThrow(/no declarada/);
  });

  test("process_input.execute marca NEEDS INPUT un audio sin transcripcion, igual que machine_process_input", async () => {
    const projectDir = await makeProjectDir();

    const result = await process_input.execute(
      {
        projectDir,
        inputPath: "inputs/entrevista.mp3",
        content: "fake-audio-bytes",
        route: "business",
        outputPath: "business/entrevista.md",
      },
      {} as never,
    );

    const output = typeof result === "string" ? result : result.output;
    const parsed = JSON.parse(output) as { needsInput: boolean };
    expect(parsed.needsInput).toBe(true);
  });

  test("render_docx.execute rechaza una puerta pendiente antes de tocar pandoc, igual que machine_render_docx", async () => {
    const projectDir = await makeProjectDir();

    await expect(
      render_docx.execute(
        {
          projectDir,
          gate: "proposal",
          sourcePath: join(projectDir, "business", "proposal.md"),
          outputPath: join(projectDir, "business", "proposal.docx"),
        },
        {} as never,
      ),
    ).rejects.toThrow(/proposal/);
  });
});

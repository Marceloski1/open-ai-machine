import { tool } from "@opencode-ai/plugin/tool";
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { init, proposal } from "./tool";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-business-tool-"));
}

const EXPORTS = { init, proposal };

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

  test("proposal exige projectDir y sections", () => {
    const schema = tool.schema.object(proposal.args);
    expect(
      schema.safeParse({
        projectDir: "/tmp/a",
        sections: { market: "Mercado B2B SaaS" },
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ projectDir: "/tmp/a", sections: {} }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ projectDir: "/tmp/a" }).success).toBe(false);
  });
});

describe("delegacion en las funciones deterministas existentes", () => {
  test("init.execute crea inputs/, business/ y el estado, igual que machine_business_init", async () => {
    const projectDir = await makeProjectDir();

    const result = await init.execute({ projectDir }, {} as never);

    const output = typeof result === "string" ? result : result.output;
    const parsed = JSON.parse(output) as { created: boolean; indexPath: string };
    expect(parsed.created).toBe(true);
    expect(await Bun.file(parsed.indexPath).exists()).toBe(true);
  });

  test("proposal.execute rechaza sin insumos route: business, igual que machine_business_proposal", async () => {
    const projectDir = await makeProjectDir();

    await expect(
      proposal.execute({ projectDir, sections: {} }, {} as never),
    ).rejects.toThrow(/insumos/i);
  });
});

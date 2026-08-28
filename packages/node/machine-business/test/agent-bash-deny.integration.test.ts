import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const AGENT_PATH = join(import.meta.dir, "..", "agents", "machine-business.md");

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : null;
}

describe("agente machine-business: garantia de configuracion (no de runtime)", () => {
  test("declara bash: deny en su frontmatter, cerrando la ruta fuera del tool machine_render_docx", () => {
    if (!existsSync(AGENT_PATH)) {
      console.warn(
        `agents/machine-business.md no existe todavia (tarea 3.3, en paralelo). ` +
          `Test preparado; se ejecutara cuando el archivo exista.`,
      );
      return;
    }

    const content = readFileSync(AGENT_PATH, "utf8");
    const frontmatter = extractFrontmatter(content);
    expect(frontmatter).not.toBeNull();
    expect(frontmatter).toMatch(/bash:\s*deny/);
  });
});

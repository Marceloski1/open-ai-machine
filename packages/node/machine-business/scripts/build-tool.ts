#!/usr/bin/env bun
import { rm } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");
const entrypoint = join(packageRoot, "src", "tool.ts");
const outdir = join(packageRoot, "tools");

export async function buildTool(): Promise<void> {
  await rm(join(outdir, "machine_business.js"), { force: true });

  process.chdir(packageRoot);
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir,
    target: "bun",
    format: "esm",
    external: ["@opencode-ai/plugin", "@opencode-ai/plugin/tool"],
    naming: "machine_business.js",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("bundling de tools/machine_business.js fallo");
  }

  console.log(`tools/machine_business.js generado (${result.outputs.length} artefacto(s)).`);
}

if (import.meta.main) {
  buildTool().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SHARED_FILES = ["approvals.ts", "state.ts", "types.ts"];
const localDir = join(import.meta.dir, "..", "..", "..", "tools", "lib", "machine-discovery");
const canonicalDir = join(import.meta.dir, "..", "..", "..", "..", "machine-core", "tools", "lib", "machine-core");

describe("copia local de machine-core se mantiene sincronizada", () => {
  for (const file of SHARED_FILES) {
    test(`${file} es identico al canonico en machine-core`, async () => {
      const [local, canonical] = await Promise.all([
        readFile(join(localDir, file), "utf8"),
        readFile(join(canonicalDir, file), "utf8"),
      ]);
      expect(local).toBe(canonical);
    });
  }
});

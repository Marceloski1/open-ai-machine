import { describe, expect, test } from "bun:test";
import { computeSha256, isProcessed, upsertInput } from "./hash";
import type { MachineState } from "./types";

function emptyState(): MachineState {
  return { phase: "", inputs: [], approvals: {} };
}

describe("computeSha256", () => {
  test("es determinista para el mismo contenido", () => {
    const a = computeSha256("hola mundo");
    const b = computeSha256("hola mundo");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test("cambia si el contenido cambia", () => {
    const a = computeSha256("hola mundo");
    const b = computeSha256("hola mundo!");
    expect(a).not.toBe(b);
  });
});

describe("isProcessed / upsertInput", () => {
  test("insumo con hash ya registrado no se reprocesa", () => {
    const sha256 = computeSha256("contenido original");
    const state = emptyState();
    const withInput = upsertInput(state, {
      path: "inputs/a.md",
      sha256,
      processedAt: "2026-01-01T00:00:00.000Z",
      route: "business",
      outputPath: "business/a.md",
    });

    expect(isProcessed(withInput, sha256)).toBe(true);

    const before = withInput.inputs.find((i) => i.path === "inputs/a.md");
    const again = upsertInput(withInput, {
      path: "inputs/a.md",
      sha256,
      processedAt: "2026-02-02T00:00:00.000Z",
      route: "business",
      outputPath: "SHOULD_NOT_APPLY",
    });
    const after = again.inputs.find((i) => i.path === "inputs/a.md");

    expect(isProcessed(again, sha256)).toBe(true);
    expect(after?.outputPath).toBe(before?.outputPath);
    expect(after?.processedAt).toBe(before?.processedAt);
  });

  test("insumo modificado se reprocesa: sha256 y processedAt se actualizan", () => {
    const sha256Old = computeSha256("version 1");
    const sha256New = computeSha256("version 2");
    const state = upsertInput(emptyState(), {
      path: "inputs/a.md",
      sha256: sha256Old,
      processedAt: "2026-01-01T00:00:00.000Z",
      route: "business",
      outputPath: "business/a.md",
    });

    expect(isProcessed(state, sha256Old)).toBe(true);
    expect(isProcessed(state, sha256New)).toBe(false);

    const updated = upsertInput(state, {
      path: "inputs/a.md",
      sha256: sha256New,
      processedAt: "2026-03-03T00:00:00.000Z",
      route: "business",
      outputPath: "business/a.md",
    });

    expect(updated.inputs).toHaveLength(1);
    expect(updated.inputs[0]?.sha256).toBe(sha256New);
    expect(updated.inputs[0]?.processedAt).toBe("2026-03-03T00:00:00.000Z");
    expect(isProcessed(updated, sha256Old)).toBe(false);
    expect(isProcessed(updated, sha256New)).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { checkExternalBinary } from "../../../tools/lib/machine-core/deps";

describe("checkExternalBinary", () => {
  test("Pandoc ausente falla con instruccion de instalacion", () => {
    const isAvailable = () => false;

    expect(() =>
      checkExternalBinary("pandoc", "https://pandoc.org/installing.html", isAvailable),
    ).toThrow(/pandoc/i);

    try {
      checkExternalBinary("pandoc", "https://pandoc.org/installing.html", isAvailable);
    } catch (error) {
      expect(String(error)).toMatch(/pandoc\.org\/installing/i);
    }
  });

  test("Pandoc presente no lanza", () => {
    const isAvailable = () => true;

    expect(() =>
      checkExternalBinary("pandoc", "https://pandoc.org/installing.html", isAvailable),
    ).not.toThrow();
  });
});

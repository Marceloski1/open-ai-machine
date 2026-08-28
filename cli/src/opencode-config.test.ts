import { describe, expect, test } from "bun:test";
import { mergeOpencodeConfig } from "./opencode-config";

describe("mergeOpencodeConfig", () => {
  test("preserves foreign keys and adds the plugin entry", () => {
    const existing = { theme: "dark", agent: { build: { permission: { bash: "allow" } } } };
    const merged = mergeOpencodeConfig(existing, ["machine-core"]);
    expect(merged.theme).toBe("dark");
    expect(merged.agent).toEqual({ build: { permission: { bash: "allow" } } });
    expect(merged.plugin).toEqual(["machine-core"]);
  });

  test("appends to an existing plugin array without dropping prior entries", () => {
    const existing = { plugin: ["opencode-wakatime"] };
    const merged = mergeOpencodeConfig(existing, ["machine-core"]);
    expect(merged.plugin).toEqual(["opencode-wakatime", "machine-core"]);
  });

  test("is idempotent: applying the same merge twice yields the same result without duplicates", () => {
    const existing = { theme: "dark" };
    const once = mergeOpencodeConfig(existing, ["machine-core"]);
    const twice = mergeOpencodeConfig(once, ["machine-core"]);
    expect(twice).toEqual(once);
    expect(twice.plugin).toEqual(["machine-core"]);
  });

  test("handles an undefined existing config", () => {
    const merged = mergeOpencodeConfig(undefined, ["machine-core"]);
    expect(merged).toEqual({ plugin: ["machine-core"] });
  });

  test("does not mutate the existing config object", () => {
    const existing = { plugin: ["opencode-wakatime"] };
    mergeOpencodeConfig(existing, ["machine-core"]);
    expect(existing.plugin).toEqual(["opencode-wakatime"]);
  });
});

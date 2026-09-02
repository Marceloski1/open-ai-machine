import { describe, expect, test } from "bun:test";
import { parseArgs, resolveTarget } from "../src/cli";

describe("parseArgs", () => {
  test("routes install|list|search|info|update|uninstall", () => {
    expect(parseArgs(["list"]).command).toBe("list");
    expect(parseArgs(["search", "business"]).command).toBe("search");
    expect(parseArgs(["info", "machine-business"]).command).toBe("info");
    expect(parseArgs(["install", "machine-core"]).command).toBe("install");
    expect(parseArgs(["update", "machine-core"]).command).toBe("update");
    expect(parseArgs(["uninstall", "machine-core"]).command).toBe("uninstall");
  });

  test("rejects an unknown command", () => {
    expect(() => parseArgs(["bogus"])).toThrow();
    expect(() => parseArgs([])).toThrow();
  });

  test("collects positional args and --flag value pairs", () => {
    const parsed = parseArgs(["install", "machine-core", "--target", "project", "--yes"]);
    expect(parsed.positional).toEqual(["machine-core"]);
    expect(parsed.flags.target).toBe("project");
    expect(parsed.flags.yes).toBe(true);
  });
});

describe("resolveTarget", () => {
  test("defaults to project when no --target flag is given", () => {
    expect(resolveTarget({})).toBe("project");
  });

  test("honors an explicit --target flag", () => {
    expect(resolveTarget({ target: "global" })).toBe("global");
    expect(resolveTarget({ target: "claude" })).toBe("claude");
  });

  test("falls back to project for an invalid target value", () => {
    expect(resolveTarget({ target: "bogus" })).toBe("project");
  });
});

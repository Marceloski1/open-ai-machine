import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadCatalog, findPackage } from "../src/core/catalog";
import { listPackages, formatList } from "../src/commands/list";
import { searchPackages } from "../src/commands/search";
import { getPackageInfo, formatInfo } from "../src/commands/info";

const FIXTURE_CATALOG_PATH = join(import.meta.dir, "fixtures", "catalog.json");

describe("discovery: list/search/info", () => {
  test("loadCatalog reads the fixture catalog", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    expect(catalog).toHaveLength(2);
  });

  test("loadCatalog returns [] for a missing file", async () => {
    const catalog = await loadCatalog(join(import.meta.dir, "fixtures", "does-not-exist.json"));
    expect(catalog).toEqual([]);
  });

  test("listPackages returns every catalog entry", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    expect(listPackages(catalog)).toHaveLength(2);
    expect(formatList(catalog)).toContain("machine-core@0.1.0");
  });

  test("searchPackages filters by id substring", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    const results = searchPackages(catalog, "business");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("machine-business");
  });

  test("searchPackages filters by description substring", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    const results = searchPackages(catalog, "nucleo determinista");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("machine-core");
  });

  test("info machine-business muestra version, permisos, checksum y requisitos externos", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    const entry = getPackageInfo(catalog, "machine-business");
    expect(entry).toBeDefined();
    const info = formatInfo(entry!);
    expect(info).toContain("machine-business v0.1.0");
    expect(info).toContain(`checksum: ${entry!.checksum}`);
    expect(info).toContain('permisos: {"bash":"deny","edit":"ask"}');
    expect(info).toContain("requisitos externos: ninguno");
  });

  test("info machine-core muestra requisitos externos declarados", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    const entry = getPackageInfo(catalog, "machine-core")!;
    expect(formatInfo(entry)).toContain("requisitos externos: pandoc");
  });

  test("findPackage devuelve undefined para un id inexistente", async () => {
    const catalog = await loadCatalog(FIXTURE_CATALOG_PATH);
    expect(findPackage(catalog, "no-existe")).toBeUndefined();
  });
});

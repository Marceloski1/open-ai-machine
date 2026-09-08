#!/usr/bin/env bun
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type CatalogFile = {
  path: string;
  sha256: string;
};

type CatalogEntry = {
  id: string;
  packageDir: string;
  files: CatalogFile[];
};

type Catalog = {
  packages: CatalogEntry[];
};

async function readCatalog(registryIndexPath: string): Promise<Catalog> {
  const raw = await readFile(registryIndexPath, "utf8");
  const parsed = JSON.parse(raw) as CatalogEntry[] | Catalog;
  return Array.isArray(parsed) ? { packages: parsed } : parsed;
}

async function copyPackageAssets(repoRoot: string, vendorRoot: string, entry: CatalogEntry): Promise<void> {
  const manifestSrc = join(repoRoot, entry.packageDir, "machine.json");
  const manifestDest = join(vendorRoot, entry.packageDir, "machine.json");
  await mkdir(dirname(manifestDest), { recursive: true });
  await writeFile(manifestDest, await readFile(manifestSrc));

  for (const file of entry.files) {
    const src = join(repoRoot, entry.packageDir, file.path);
    const dest = join(vendorRoot, entry.packageDir, file.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await readFile(src));
  }
}

export async function vendorAssets(repoRoot: string, vendorRoot: string): Promise<void> {
  const registryIndexPath = join(repoRoot, "registry", "index.json");
  const catalog = await readCatalog(registryIndexPath);

  await rm(vendorRoot, { recursive: true, force: true });

  const vendoredRegistryPath = join(vendorRoot, "registry", "index.json");
  await mkdir(dirname(vendoredRegistryPath), { recursive: true });
  await writeFile(vendoredRegistryPath, await readFile(registryIndexPath));

  for (const entry of catalog.packages) {
    await copyPackageAssets(repoRoot, vendorRoot, entry);
  }

  console.log(`vendor/ generado con ${catalog.packages.length} paquete(s) en ${vendorRoot}`);
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..", "..");
  const vendorRoot = join(import.meta.dir, "..", "vendor");
  vendorAssets(repoRoot, vendorRoot).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { computePackageChecksum } from "./checksum";
import { validateManifest } from "./validate";

export type CatalogEntry = {
  id: string;
  version: string;
  description: string;
  commands: string[];
  agents: string[];
  skills: string[];
  templates: string[];
  compatibility: string;
  checksum: string;
  permissions: Record<string, unknown>;
  externalRequirements: string[];
};

export type Catalog = {
  packages: CatalogEntry[];
};

export type BuildRegistryOptions = {
  packageDirs: string[];
  compatibility?: string;
};

type Manifest = {
  id: string;
  version: string;
  description?: string;
  commands: string[];
  agents: string[];
  skills: string[];
  templates: string[];
  dependencies: string[];
  externalRequirements: string[];
  permissions: Record<string, unknown>;
};

async function readManifest(packageDir: string): Promise<Manifest> {
  const manifestPath = join(packageDir, "machine.json");
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const result = validateManifest(parsed);
  if (!result.valid) {
    throw new Error(`${manifestPath}: manifiesto invalido - ${result.errors.join("; ")}`);
  }
  return parsed as Manifest;
}

function detectCommandCollisions(manifests: { packageDir: string; manifest: Manifest }[]): void {
  const owners = new Map<string, string>();
  for (const { packageDir, manifest } of manifests) {
    for (const command of manifest.commands) {
      const existingOwner = owners.get(command);
      if (existingOwner && existingOwner !== manifest.id) {
        throw new Error(
          `Comando "${command}" declarado por mas de un paquete: "${existingOwner}" y "${manifest.id}" (${packageDir})`,
        );
      }
      owners.set(command, manifest.id);
    }
  }
}

export async function buildRegistry(options: BuildRegistryOptions): Promise<Catalog> {
  const compatibility = options.compatibility ?? "opencode-v1";

  const manifests = await Promise.all(
    options.packageDirs.map(async (packageDir) => ({
      packageDir,
      manifest: await readManifest(packageDir),
    })),
  );

  detectCommandCollisions(manifests);

  const packages = await Promise.all(
    manifests.map(async ({ packageDir, manifest }): Promise<CatalogEntry> => ({
      id: manifest.id,
      version: manifest.version,
      description: manifest.description ?? "",
      commands: manifest.commands,
      agents: manifest.agents,
      skills: manifest.skills,
      templates: manifest.templates,
      compatibility,
      checksum: await computePackageChecksum(packageDir),
      permissions: manifest.permissions,
      externalRequirements: manifest.externalRequirements,
    })),
  );

  return { packages };
}

export async function discoverPackageDirs(packagesRoot: string): Promise<string[]> {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packageDir = join(packagesRoot, entry.name);
    const manifestPath = join(packageDir, "machine.json");
    const file = Bun.file(manifestPath);
    if (await file.exists()) {
      dirs.push(packageDir);
    }
  }
  return dirs;
}

export async function writeRegistry(registryIndexPath: string, catalog: Catalog): Promise<void> {
  await writeFile(registryIndexPath, `${JSON.stringify(catalog, null, 2)}\n`);
}

const LANGUAGE_DIRS = ["node", "py"] as const;

async function discoverAllPackageDirs(packagesRoot: string): Promise<string[]> {
  const dirs: string[] = [];
  for (const language of LANGUAGE_DIRS) {
    const languageRoot = join(packagesRoot, language);
    if (!existsSync(languageRoot)) continue;
    dirs.push(...(await discoverPackageDirs(languageRoot)));
  }
  return dirs;
}

async function main(): Promise<void> {
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const packagesRoot = join(repoRoot, "packages");
  const packageDirs = await discoverAllPackageDirs(packagesRoot);
  const catalog = await buildRegistry({ packageDirs });
  const registryIndexPath = join(repoRoot, "registry", "index.json");
  await writeRegistry(registryIndexPath, catalog);
  console.log(`registry/index.json generado con ${catalog.packages.length} paquete(s).`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

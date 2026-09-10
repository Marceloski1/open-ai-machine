import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { computePackageChecksum, hashFile, listPackageFiles } from "./checksum";
import { validateManifest } from "./validate";

export type Runtime = "node" | "python";

export type CatalogFile = {
  path: string;
  sha256: string;
};

export type CatalogEntry = {
  id: string;
  version: string;
  description: string;
  packageDir: string;
  runtime: Runtime;
  commands: string[];
  agents: string[];
  skills: string[];
  templates: string[];
  compatibility: string;
  checksum: string;
  permissions: Record<string, unknown>;
  externalRequirements: string[];
  files: CatalogFile[];
};

export type Catalog = {
  packages: CatalogEntry[];
};

export type BuildRegistryOptions = {
  packageDirs: string[];
  compatibility?: string;
  repoRoot?: string;
};

const INSTALLABLE_DIRS = ["commands", "agents", "skills", "templates", "tools"] as const;

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function isInstallable(relativePath: string): boolean {
  return INSTALLABLE_DIRS.some((dir) => relativePath.startsWith(`${dir}/`));
}

async function collectInstallableFiles(packageDir: string): Promise<CatalogFile[]> {
  const files = (await listPackageFiles(packageDir)).filter(isInstallable);
  return Promise.all(
    files.map(async (path) => ({ path, sha256: await hashFile(join(packageDir, path)) })),
  );
}

type Manifest = {
  id: string;
  version: string;
  description?: string;
  runtime?: Runtime;
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
  const repoRoot = options.repoRoot ?? process.cwd();

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
      packageDir: toPosix(relative(repoRoot, packageDir)),
      runtime: manifest.runtime ?? "node",
      commands: manifest.commands,
      agents: manifest.agents,
      skills: manifest.skills,
      templates: manifest.templates,
      compatibility,
      checksum: await computePackageChecksum(packageDir),
      permissions: manifest.permissions,
      externalRequirements: manifest.externalRequirements,
      files: await collectInstallableFiles(packageDir),
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
  return dirs.sort();
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
  const catalog = await buildRegistry({ packageDirs, repoRoot });
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

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readInstalledEntries, writeInstalledEntry } from "../core/installed-registry";
import type { CatalogEntry, InstalledEntry, InstalledFile, InstalledTarget } from "../core/types";

export type InstallDisclosure = {
  id: string;
  version: string;
  permissions: Record<string, unknown>;
  checksum: string;
  externalRequirements: string[];
};

export type ConfirmFn = (disclosure: InstallDisclosure) => boolean | Promise<boolean>;

export type InstallArgs = {
  entry: CatalogEntry;
  sourceRoot: string;
  target: InstalledTarget;
  destRoot: string;
  interactive?: boolean;
  yes?: boolean;
  confirm?: ConfirmFn;
};

export type InstallResult =
  | { status: "installed"; entry: InstalledEntry }
  | { status: "unchanged"; entry: InstalledEntry }
  | { status: "rejected"; reason: string };

function toDisclosure(entry: CatalogEntry): InstallDisclosure {
  return {
    id: entry.id,
    version: entry.version,
    permissions: entry.permissions,
    checksum: entry.checksum,
    externalRequirements: entry.externalRequirements,
  };
}

function filesMatch(a: InstalledFile[], b: InstalledFile[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortByPath = (list: InstalledFile[]) => [...list].sort((x, y) => x.path.localeCompare(y.path));
  const sortedA = sortByPath(a);
  const sortedB = sortByPath(b);
  return sortedA.every((file, index) => file.path === sortedB[index]?.path && file.sha256 === sortedB[index]?.sha256);
}

export async function install(args: InstallArgs): Promise<InstallResult> {
  const interactive = args.interactive ?? false;

  if (interactive) {
    const confirm = args.confirm ?? (() => false);
    const accepted = await confirm(toDisclosure(args.entry));
    if (!accepted) {
      return { status: "rejected", reason: "El usuario rechazo la instalacion tras la divulgacion previa." };
    }
  } else if (!args.yes) {
    return {
      status: "rejected",
      reason: "Modo no interactivo requiere el flag --yes para aceptar permisos, checksum y requisitos externos.",
    };
  }

  const installedEntries = await readInstalledEntries(args.destRoot);
  const existing = installedEntries.find(
    (installedEntry) => installedEntry.id === args.entry.id && installedEntry.target === args.target,
  );
  if (existing && existing.version === args.entry.version && filesMatch(existing.files, args.entry.files)) {
    return { status: "unchanged", entry: existing };
  }

  const packageRoot = join(args.sourceRoot, args.entry.packageDir);
  for (const file of args.entry.files) {
    const src = join(packageRoot, file.path);
    const dest = join(args.destRoot, file.path);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }

  // TODO(machine-core-npm-publish): once machine-core is published to npm, resolve the
  // config path with resolveConfigPath (../core/paths) and merge args.entry.id into
  // opencode.json's `plugin` key with mergeOpencodeConfig + readOpencodeConfig/writeOpencodeConfig
  // (../core/opencode-config). Until then this would write an npm spec that always 404s.

  const newEntry: InstalledEntry = {
    id: args.entry.id,
    version: args.entry.version,
    target: args.target,
    files: args.entry.files,
  };
  await writeInstalledEntry(args.destRoot, newEntry);

  return { status: "installed", entry: newEntry };
}

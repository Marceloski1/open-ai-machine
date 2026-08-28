import { copyFile as fsCopyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { computeSha256 } from "./hash";
import { readInstalledEntries, writeInstalledEntry } from "./installed-registry";
import type { CatalogEntry, InstalledEntry, InstalledTarget } from "./types";

export type CopyFileFn = (src: string, dest: string) => Promise<void>;

export type UpdateArgs = {
  entry: CatalogEntry;
  sourceRoot: string;
  target: InstalledTarget;
  destRoot: string;
  copyFile?: CopyFileFn;
};

export type UpdateResult =
  | { status: "updated"; entry: InstalledEntry }
  | { status: "restored"; reason: string };

async function defaultCopyFile(src: string, dest: string): Promise<void> {
  await fsCopyFile(src, dest);
}

export async function update(args: UpdateArgs): Promise<UpdateResult> {
  const installedEntries = await readInstalledEntries(args.destRoot);
  const current = installedEntries.find(
    (installedEntry) => installedEntry.id === args.entry.id && installedEntry.target === args.target,
  );
  if (!current) {
    throw new Error(
      `El paquete "${args.entry.id}" no esta instalado en destino "${args.target}"; usa install en su lugar.`,
    );
  }

  const packageRoot = join(args.sourceRoot, args.entry.packageDir);

  for (const file of args.entry.files) {
    const src = join(packageRoot, file.path);
    const actualSha256 = computeSha256(await readFile(src));
    if (actualSha256 !== file.sha256) {
      return {
        status: "restored",
        reason: `Checksum no coincide para "${file.path}"; se aborta la actualizacion sin escribir nada.`,
      };
    }
  }

  const backupDir = await mkdtemp(join(tmpdir(), "machine-update-backup-"));
  const backedUp: { dest: string; backupPath: string }[] = [];
  const copyFile = args.copyFile ?? defaultCopyFile;

  try {
    for (const file of args.entry.files) {
      const dest = join(args.destRoot, file.path);
      if (existsSync(dest)) {
        const backupPath = join(backupDir, `${backedUp.length}-${basename(dest)}`);
        await fsCopyFile(dest, backupPath);
        backedUp.push({ dest, backupPath });
      }
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(join(packageRoot, file.path), dest);
    }
  } catch (error) {
    for (const backup of backedUp) {
      await fsCopyFile(backup.backupPath, backup.dest);
    }
    await rm(backupDir, { recursive: true, force: true });
    return { status: "restored", reason: (error as Error).message };
  }

  await rm(backupDir, { recursive: true, force: true });

  const newEntry: InstalledEntry = {
    id: args.entry.id,
    version: args.entry.version,
    target: args.target,
    files: args.entry.files,
  };
  await writeInstalledEntry(args.destRoot, newEntry);

  return { status: "updated", entry: newEntry };
}


import { rm } from "node:fs/promises";
import { join } from "node:path";
import { readInstalledEntries, writeInstalledEntries } from "../core/installed-registry";
import type { InstalledTarget } from "../core/types";

export type RemoveFileFn = (path: string) => Promise<void>;

export type UninstallArgs = {
  id: string;
  target: InstalledTarget;
  destRoot: string;
  removeFile?: RemoveFileFn;
};

export type UninstallResult = { status: "removed" } | { status: "not-found" };

async function defaultRemoveFile(path: string): Promise<void> {
  await rm(path, { force: true });
}

export async function uninstall(args: UninstallArgs): Promise<UninstallResult> {
  const entries = await readInstalledEntries(args.destRoot);
  const match = entries.find((entry) => entry.id === args.id && entry.target === args.target);
  if (!match) {
    return { status: "not-found" };
  }

  const removeFile = args.removeFile ?? defaultRemoveFile;
  for (const file of match.files) {
    await removeFile(join(args.destRoot, file.path));
  }

  const remaining = entries.filter((entry) => !(entry.id === args.id && entry.target === args.target));
  await writeInstalledEntries(args.destRoot, remaining);

  return { status: "removed" };
}

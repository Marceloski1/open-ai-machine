import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { InstalledEntry, InstalledTarget } from "./types";

export function getInstalledRegistryPath(destRoot: string): string {
  return join(destRoot, "installed.json");
}

export async function readInstalledEntries(destRoot: string): Promise<InstalledEntry[]> {
  const registryPath = getInstalledRegistryPath(destRoot);
  const file = Bun.file(registryPath);
  if (!(await file.exists())) {
    return [];
  }
  const raw = await file.text();
  return JSON.parse(raw) as InstalledEntry[];
}

export async function writeInstalledEntries(destRoot: string, entries: InstalledEntry[]): Promise<void> {
  const registryPath = getInstalledRegistryPath(destRoot);
  await mkdir(dirname(registryPath), { recursive: true });
  await writeFile(registryPath, `${JSON.stringify(entries, null, 2)}\n`);
}

export async function writeInstalledEntry(destRoot: string, entry: InstalledEntry): Promise<void> {
  const entries = await readInstalledEntries(destRoot);
  const others = entries.filter((existing) => !(existing.id === entry.id && existing.target === entry.target));
  await writeInstalledEntries(destRoot, [...others, entry]);
}

export async function removeInstalledEntry(
  destRoot: string,
  id: string,
  target: InstalledTarget,
): Promise<void> {
  const entries = await readInstalledEntries(destRoot);
  const remaining = entries.filter((existing) => !(existing.id === id && existing.target === target));
  await writeInstalledEntries(destRoot, remaining);
}

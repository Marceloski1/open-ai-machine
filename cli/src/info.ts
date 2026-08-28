import { findPackage } from "./catalog";
import type { CatalogEntry } from "./types";

export function getPackageInfo(catalog: CatalogEntry[], id: string): CatalogEntry | undefined {
  return findPackage(catalog, id);
}

export function formatInfo(entry: CatalogEntry): string {
  const requirements = entry.externalRequirements.length > 0 ? entry.externalRequirements.join(", ") : "ninguno";
  return [
    `${entry.id} v${entry.version}`,
    entry.description,
    `checksum: ${entry.checksum}`,
    `permisos: ${JSON.stringify(entry.permissions)}`,
    `requisitos externos: ${requirements}`,
  ].join("\n");
}

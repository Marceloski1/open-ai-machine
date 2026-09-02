import type { CatalogEntry } from "../core/types";

export function listPackages(catalog: CatalogEntry[]): CatalogEntry[] {
  return catalog;
}

export function formatList(catalog: CatalogEntry[]): string {
  return catalog.map((entry) => `${entry.id}@${entry.version} - ${entry.description}`).join("\n");
}

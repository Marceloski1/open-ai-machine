import type { CatalogEntry } from "../core/types";

export function searchPackages(catalog: CatalogEntry[], query: string): CatalogEntry[] {
  const needle = query.toLowerCase();
  return catalog.filter(
    (entry) => entry.id.toLowerCase().includes(needle) || entry.description.toLowerCase().includes(needle),
  );
}

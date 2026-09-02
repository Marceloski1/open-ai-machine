import type { CatalogEntry } from "./types";

export async function loadCatalog(catalogPath: string): Promise<CatalogEntry[]> {
  const file = Bun.file(catalogPath); //Explain Bun here. What's Bun ? 
  if (!(await file.exists())) {
    return [];
  }
  const raw = await file.text();
  const parsed = JSON.parse(raw) as CatalogEntry[] | { packages: CatalogEntry[] };
  return Array.isArray(parsed) ? parsed : parsed.packages;
}

export function findPackage(catalog: CatalogEntry[], id: string): CatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}

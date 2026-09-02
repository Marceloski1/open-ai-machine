export type InstalledTarget = "global" | "project" | "claude";  //Add Opencode and others CLI targets 

export type CatalogFile = {
  path: string;
  sha256: string;
};

export type Runtime = "node" | "python";

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
  compatibility?: string;
  checksum: string;
  permissions: Record<string, unknown>;
  externalRequirements: string[];
  files: CatalogFile[];
};

export type InstalledFile = {
  path: string;
  sha256: string;
};

export type InstalledEntry = {
  id: string;
  version: string;
  target: InstalledTarget;
  files: InstalledFile[];
};

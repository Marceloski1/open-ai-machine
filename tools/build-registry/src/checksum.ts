import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export async function listPackageFiles(packageDir: string): Promise<string[]> {
  return (await listFiles(packageDir, packageDir)).sort();
}

export async function hashFile(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function listFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, baseDir)));
    } else if (entry.isFile()) {
      files.push(relative(baseDir, fullPath).split(sep).join("/"));
    }
  }
  return files;
}

export async function computePackageChecksum(packageDir: string): Promise<string> {
  const files = await listPackageFiles(packageDir);
  const hash = createHash("sha256");
  for (const relativePath of files) {
    const content = await readFile(join(packageDir, relativePath));
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

import { join } from "node:path";

const FORBIDDEN_LOCKFILES = ["package-lock.json", "yarn.lock", "bun.lockb"] as const;

export type LockfileCheckResult = {
  ok: boolean;
  found: string[];
};

export async function checkForbiddenLockfiles(repoRoot: string): Promise<LockfileCheckResult> {
  const found: string[] = [];
  for (const lockfile of FORBIDDEN_LOCKFILES) {
    const file = Bun.file(join(repoRoot, lockfile));
    if (await file.exists()) {
      found.push(lockfile);
    }
  }
  return { ok: found.length === 0, found };
}

async function main(): Promise<void> {
  const repoRoot = process.argv[2] ?? process.cwd();
  const result = await checkForbiddenLockfiles(repoRoot);
  if (!result.ok) {
    console.error(
      `Lockfiles prohibidos encontrados: ${result.found.join(", ")}. Usa pnpm (pnpm-lock.yaml) exclusivamente.`,
    );
    process.exit(1);
  }
  console.log("Sin lockfiles prohibidos.");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

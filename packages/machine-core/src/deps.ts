import { spawnSync } from "node:child_process";

export type BinaryChecker = (binary: string) => boolean;

export function defaultIsAvailable(binary: string): boolean {
  try {
    const finder = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(finder, [binary], { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function checkExternalBinary(
  binary: string,
  installInstructions: string,
  isAvailable: BinaryChecker = defaultIsAvailable,
): void {
  if (!isAvailable(binary)) {
    throw new Error(
      `Dependencia externa faltante: "${binary}". Instalala antes de continuar: ${installInstructions}`,
    );
  }
}

#!/usr/bin/env bun
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { findPackage, loadCatalog } from "./core/catalog";
import { formatInfo, getPackageInfo } from "./commands/info";
import { install, type InstallDisclosure } from "./commands/install";
import { formatList } from "./commands/list";
import { resolveDestRoot } from "./core/paths";
import { searchPackages } from "./commands/search";
import { uninstall } from "./commands/uninstall";
import { update } from "./commands/update";
import type { InstalledTarget } from "./core/types";

export type Command = "install" | "list" | "search" | "info" | "update" | "uninstall";

export type ParsedArgs = {
  command: Command;
  positional: string[];
  flags: Record<string, string | boolean>;
};

const COMMANDS: Command[] = ["install", "list", "search", "info", "update", "uninstall"];

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!command || !COMMANDS.includes(command as Command)) {
    throw new Error(
      `Comando desconocido: "${command ?? ""}". Comandos disponibles: ${COMMANDS.join(", ")}`,
    );
  }

  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token);
    }
  }

  return { command: command as Command, positional, flags };
}

export function resolveTarget(flags: Record<string, string | boolean>): InstalledTarget {
  const target = flags.target;
  if (target === "global" || target === "project" || target === "claude") {
    return target;
  }
  return "project";
}

function defaultCatalogPath(): string {
  return join(import.meta.dir, "..", "..", "registry", "index.json");
}

function defaultSourceRoot(): string {
  return join(import.meta.dir, "..", "..");
}

async function promptConfirm(disclosure: InstallDisclosure): Promise<boolean> {
  console.log(`Paquete: ${disclosure.id}@${disclosure.version}`);
  console.log(`Permisos: ${JSON.stringify(disclosure.permissions)}`);
  console.log(`Checksum: ${disclosure.checksum}`);
  console.log(
    `Requisitos externos: ${disclosure.externalRequirements.length > 0 ? disclosure.externalRequirements.join(", ") : "ninguno"}`,
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("Continuar con la instalacion? [y/N] ");
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

export async function main(argv: string[]): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const catalog = await loadCatalog(defaultCatalogPath());

  if (parsed.command === "list") {
    console.log(formatList(catalog));
    return 0;
  }

  if (parsed.command === "search") {
    console.log(formatList(searchPackages(catalog, parsed.positional[0] ?? "")));
    return 0;
  }

  if (parsed.command === "info") {
    const id = parsed.positional[0];
    const entry = id ? getPackageInfo(catalog, id) : undefined;
    if (!entry) {
      console.error(`Paquete no encontrado: "${id ?? ""}"`);
      return 1;
    }
    console.log(formatInfo(entry));
    return 0;
  }

  if (parsed.command === "install") {
    const id = parsed.positional[0];
    const entry = id ? findPackage(catalog, id) : undefined;
    if (!entry) {
      console.error(`Paquete no encontrado: "${id ?? ""}"`);
      return 1;
    }
    const target = resolveTarget(parsed.flags);
    const destRoot = resolveDestRoot(target, process.cwd(), homedir());
    const yes = parsed.flags.yes === true || parsed.flags.yes === "true";
    const interactive = process.stdin.isTTY === true && !yes;
    const result = await install({
      entry,
      sourceRoot: defaultSourceRoot(),
      target,
      destRoot,
      interactive,
      yes,
      confirm: promptConfirm,
    });
    console.log(result.status);
    return result.status === "rejected" ? 1 : 0;
  }

  if (parsed.command === "update") {
    const id = parsed.positional[0];
    const entry = id ? findPackage(catalog, id) : undefined;
    if (!entry) {
      console.error(`Paquete no encontrado: "${id ?? ""}"`);
      return 1;
    }
    const target = resolveTarget(parsed.flags);
    const destRoot = resolveDestRoot(target, process.cwd(), homedir());
    const result = await update({ entry, sourceRoot: defaultSourceRoot(), target, destRoot });
    console.log(result.status);
    return result.status === "restored" ? 1 : 0;
  }

  if (parsed.command === "uninstall") {
    const id = parsed.positional[0];
    if (!id) {
      console.error("Falta el id del paquete a desinstalar");
      return 1;
    }
    const target = resolveTarget(parsed.flags);
    const destRoot = resolveDestRoot(target, process.cwd(), homedir());
    const result = await uninstall({ id, target, destRoot });
    console.log(result.status);
    return result.status === "not-found" ? 1 : 0;
  }

  return 1;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

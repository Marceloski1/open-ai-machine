import { existsSync, readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { approveGate, assertGateApproved, setGatePending } from "./approvals";
import { checkExternalBinary, defaultIsAvailable, type BinaryChecker } from "./deps";
import { computeSha256, isProcessed, upsertInput } from "./hash";
import { readState, writeState } from "./state";
import type { MachineState, Route } from "./types";

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|m4a|ogg|flac|aac)$/i;

export type ProcessInputArgs = {
  projectDir: string;
  inputPath: string;
  content: string | Buffer;
  route: Route;
  outputPath: string;
  transcription?: string;
  transcriptionProvider?: string;
};

export type ProcessInputResult = {
  state: MachineState;
  skipped: boolean;
  needsInput: boolean;
};

export async function machine_process_input(args: ProcessInputArgs): Promise<ProcessInputResult> {
  const state = await readState(args.projectDir);
  const sha256 = computeSha256(args.content);

  if (isProcessed(state, sha256)) {
    return { state, skipped: true, needsInput: false };
  }

  const isAudio = AUDIO_EXTENSION_PATTERN.test(args.inputPath);
  const needsInput = isAudio && !args.transcription && !args.transcriptionProvider;

  const nextState = upsertInput(state, {
    path: args.inputPath,
    sha256,
    processedAt: new Date().toISOString(),
    route: args.route,
    outputPath: needsInput ? "NEEDS INPUT" : args.outputPath,
  });

  await writeState(args.projectDir, nextState);
  return { state: nextState, skipped: false, needsInput };
}

export type WriteArtifactArgs = {
  projectDir: string;
  gate: string;
  dependsOn?: string[];
};

export async function machine_write_artifact(args: WriteArtifactArgs): Promise<MachineState> {
  const state = await readState(args.projectDir);
  const nextState = setGatePending(state, args.gate, args.dependsOn);
  await writeState(args.projectDir, nextState);
  return nextState;
}

export type ApproveArgs = {
  projectDir: string;
  gate: string;
};

export async function machine_approve(args: ApproveArgs): Promise<MachineState> {
  const state = await readState(args.projectDir);
  const nextState = approveGate(state, args.gate);
  await writeState(args.projectDir, nextState);
  return nextState;
}

export type CheckDepsArgs = {
  binary: string;
  installInstructions: string;
  isAvailable?: BinaryChecker;
};

export function machine_check_deps(args: CheckDepsArgs): void {
  checkExternalBinary(args.binary, args.installInstructions, args.isAvailable ?? defaultIsAvailable);
}

export type TemplateChecker = (templatePath: string) => boolean;

export type TemplateSource = "override" | "project" | "user" | "package";

export type TemplateResolution = {
  templatePath: string;
  source: TemplateSource;
};

export type RenderDocxArgs = {
  projectDir: string;
  gate: string;
  sourcePath: string;
  outputPath: string;
  isAvailable?: BinaryChecker;
  templatePath?: string;
  isTemplateAvailable?: TemplateChecker;
  projectTemplatePath?: string;
  userTemplatePath?: string;
  packageTemplatePath?: string;
  render?: (sourcePath: string, outputPath: string, templatePath: string) => Promise<void>;
};

export type RenderDocxResult = {
  outputPath: string;
  templatePath: string;
  templateSource: TemplateSource;
};

const PANDOC_INSTALL_INSTRUCTIONS =
  'ejecuta "uv sync" en la raiz del repositorio (instala el pandoc empaquetado via pypandoc-binary en .venv/). Referencia: https://pandoc.org/installing.html';

export function defaultTemplatePath(): string {
  return join(import.meta.dir, "..", "templates", "reference.docx");
}

export function defaultTemplateExists(templatePath: string): boolean {
  return existsSync(templatePath);
}

export function defaultProjectTemplatePath(projectDir: string): string {
  return join(projectDir, ".machine", "template.docx");
}

export function defaultUserTemplatePath(home: string = homedir()): string {
  return join(home, ".config", "opencode", "templates", "reference.docx");
}

export function resolveTemplate(args: {
  projectDir: string;
  templatePath?: string;
  templateExists?: TemplateChecker;
  projectTemplatePath?: string;
  userTemplatePath?: string;
  packageTemplatePath?: string;
}): TemplateResolution {
  const exists = args.templateExists ?? defaultTemplateExists;

  if (args.templatePath) {
    return { templatePath: args.templatePath, source: "override" };
  }

  const projectTemplatePath = args.projectTemplatePath ?? defaultProjectTemplatePath(args.projectDir);
  if (exists(projectTemplatePath)) {
    return { templatePath: projectTemplatePath, source: "project" };
  }

  const userTemplatePath = args.userTemplatePath ?? defaultUserTemplatePath();
  if (exists(userTemplatePath)) {
    return { templatePath: userTemplatePath, source: "user" };
  }

  const packageTemplatePath = args.packageTemplatePath ?? defaultTemplatePath();
  return { templatePath: packageTemplatePath, source: "package" };
}

function repoRoot(): string {
  return join(import.meta.dir, "..", "..", "..", "..");
}

function findVenvSitePackages(root: string): string | undefined {
  const windowsSitePackages = join(root, ".venv", "Lib", "site-packages");
  if (existsSync(windowsSitePackages)) {
    return windowsSitePackages;
  }
  const libDir = join(root, ".venv", "lib");
  if (!existsSync(libDir)) {
    return undefined;
  }
  for (const entry of readdirSync(libDir)) {
    const candidate = join(libDir, entry, "site-packages");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function resolveRepoPandocPath(): string | undefined {
  const sitePackages = findVenvSitePackages(repoRoot());
  if (!sitePackages) {
    return undefined;
  }
  const binaryName = process.platform === "win32" ? "pandoc.exe" : "pandoc";
  const candidate = join(sitePackages, "pypandoc", "files", binaryName);
  return existsSync(candidate) ? candidate : undefined;
}

export function defaultPandocIsAvailable(): boolean {
  return resolveRepoPandocPath() !== undefined;
}

async function defaultPandocRender(
  sourcePath: string,
  outputPath: string,
  templatePath: string,
): Promise<void> {
  const pandocPath = resolveRepoPandocPath();
  if (!pandocPath) {
    throw new Error(
      `Dependencia externa faltante: "pandoc". Instalala antes de continuar: ${PANDOC_INSTALL_INSTRUCTIONS}`,
    );
  }
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    pandocPath,
    [sourcePath, "-o", outputPath, `--reference-doc=${templatePath}`],
    { stdio: "ignore" },
  );
  if (result.status !== 0) {
    throw new Error(`pandoc fallo al renderizar ${sourcePath} -> ${outputPath}`);
  }
}

export async function machine_render_docx(args: RenderDocxArgs): Promise<RenderDocxResult> {
  const state = await readState(args.projectDir);
  assertGateApproved(state, args.gate);
  checkExternalBinary(
    "pandoc",
    PANDOC_INSTALL_INSTRUCTIONS,
    args.isAvailable ?? defaultPandocIsAvailable,
  );

  const templateExists = args.isTemplateAvailable ?? defaultTemplateExists;
  const resolution = resolveTemplate({
    projectDir: args.projectDir,
    templatePath: args.templatePath,
    templateExists,
    projectTemplatePath: args.projectTemplatePath,
    userTemplatePath: args.userTemplatePath,
    packageTemplatePath: args.packageTemplatePath,
  });

  if (!templateExists(resolution.templatePath)) {
    throw new Error(
      `Plantilla corporativa faltante: "${resolution.templatePath}". Coloca el .docx corporativo en esa ruta antes de renderizar (ver packages/node/machine-core/templates/README.md). No se entrega un .docx sin estilos corporativos.`,
    );
  }

  await mkdir(dirname(args.outputPath), { recursive: true });
  const render = args.render ?? defaultPandocRender;
  await render(args.sourcePath, args.outputPath, resolution.templatePath);

  return { outputPath: args.outputPath, templatePath: resolution.templatePath, templateSource: resolution.source };
}

export default async function machineCorePlugin() {
  return {
    tool: {
      machine_process_input,
      machine_write_artifact,
      machine_approve,
      machine_check_deps,
      machine_render_docx,
    },
  };
}

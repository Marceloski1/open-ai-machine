// @bun
var __require = import.meta.require;

// src/tool.ts
import { tool } from "@opencode-ai/plugin/tool";

// src/index.ts
import { existsSync, readdirSync } from "fs";
import { mkdir as mkdir2 } from "fs/promises";
import { homedir } from "os";
import { dirname as dirname2, join as join2 } from "path";

// src/approvals.ts
function assertGateApproved(state, gate) {
  const approval = state.approvals[gate];
  if (!approval || approval.status !== "approved") {
    const status = approval?.status ?? "no declarada";
    throw new Error(`Puerta "${gate}" no aprobada (estado: ${status}). Operacion rechazada; usa "machine-approve <proyecto> ${gate}".`);
  }
}
function approveGate(state, gate) {
  if (!(gate in state.approvals)) {
    throw new Error(`Puerta no declarada: "${gate}". Ningun paquete instalado la declara.`);
  }
  return {
    ...state,
    approvals: {
      ...state.approvals,
      [gate]: {
        ...state.approvals[gate],
        status: "approved",
        at: new Date().toISOString()
      }
    }
  };
}

// src/deps.ts
import { spawnSync } from "child_process";
function defaultIsAvailable(binary) {
  try {
    const finder = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(finder, [binary], { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}
function checkExternalBinary(binary, installInstructions, isAvailable = defaultIsAvailable) {
  if (!isAvailable(binary)) {
    throw new Error(`Dependencia externa faltante: "${binary}". Instalala antes de continuar: ${installInstructions}`);
  }
}

// src/hash.ts
import { createHash } from "crypto";
function computeSha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
function isProcessed(state, sha256) {
  return state.inputs.some((input) => input.sha256 === sha256);
}
function upsertInput(state, record) {
  const existingIndex = state.inputs.findIndex((input) => input.path === record.path);
  const inputs = [...state.inputs];
  if (existingIndex === -1) {
    inputs.push(record);
  } else if (inputs[existingIndex]?.sha256 === record.sha256) {
    return state;
  } else {
    inputs[existingIndex] = record;
  }
  return { ...state, inputs };
}

// src/state.ts
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
function getStatePath(projectDir) {
  return join(projectDir, ".machine", "state.json");
}
function defaultState() {
  return { phase: "", inputs: [], approvals: {} };
}
async function writeState(projectDir, state) {
  const statePath = getStatePath(projectDir);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
async function readState(projectDir) {
  const statePath = getStatePath(projectDir);
  const file = Bun.file(statePath);
  if (!await file.exists()) {
    return ensureState(projectDir);
  }
  const raw = await readFile(statePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`state.json corrupto en ${statePath}: JSON invalido. Corrige o restaura el archivo manualmente; no fue sobrescrito.`);
  }
}
async function ensureState(projectDir) {
  const statePath = getStatePath(projectDir);
  const file = Bun.file(statePath);
  if (await file.exists()) {
    return readState(projectDir);
  }
  const initial = defaultState();
  await writeState(projectDir, initial);
  return initial;
}

// src/index.ts
var AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|m4a|ogg|flac|aac)$/i;
async function machine_process_input(args) {
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
    outputPath: needsInput ? "NEEDS INPUT" : args.outputPath
  });
  await writeState(args.projectDir, nextState);
  return { state: nextState, skipped: false, needsInput };
}
async function machine_approve(args) {
  const state = await readState(args.projectDir);
  const nextState = approveGate(state, args.gate);
  await writeState(args.projectDir, nextState);
  return nextState;
}
var PANDOC_INSTALL_INSTRUCTIONS = 'ejecuta "uv sync" en la raiz del repositorio (instala el pandoc empaquetado via pypandoc-binary en .venv/). Referencia: https://pandoc.org/installing.html';
function defaultTemplatePath() {
  return join2(import.meta.dir, "..", "templates", "reference.docx");
}
function defaultTemplateExists(templatePath) {
  return existsSync(templatePath);
}
function defaultProjectTemplatePath(projectDir) {
  return join2(projectDir, ".machine", "template.docx");
}
function defaultUserTemplatePath(home = homedir()) {
  return join2(home, ".config", "opencode", "templates", "reference.docx");
}
function resolveTemplate(args) {
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
function repoRoot() {
  return join2(import.meta.dir, "..", "..", "..", "..");
}
function findVenvSitePackages(root) {
  const windowsSitePackages = join2(root, ".venv", "Lib", "site-packages");
  if (existsSync(windowsSitePackages)) {
    return windowsSitePackages;
  }
  const libDir = join2(root, ".venv", "lib");
  if (!existsSync(libDir)) {
    return;
  }
  for (const entry of readdirSync(libDir)) {
    const candidate = join2(libDir, entry, "site-packages");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return;
}
function resolveRepoPandocPath() {
  const sitePackages = findVenvSitePackages(repoRoot());
  if (!sitePackages) {
    return;
  }
  const binaryName = process.platform === "win32" ? "pandoc.exe" : "pandoc";
  const candidate = join2(sitePackages, "pypandoc", "files", binaryName);
  return existsSync(candidate) ? candidate : undefined;
}
function defaultPandocIsAvailable() {
  return resolveRepoPandocPath() !== undefined;
}
async function defaultPandocRender(sourcePath, outputPath, templatePath) {
  const pandocPath = resolveRepoPandocPath();
  if (!pandocPath) {
    throw new Error(`Dependencia externa faltante: "pandoc". Instalala antes de continuar: ${PANDOC_INSTALL_INSTRUCTIONS}`);
  }
  const { spawnSync: spawnSync2 } = await import("child_process");
  const result = spawnSync2(pandocPath, [sourcePath, "-o", outputPath, `--reference-doc=${templatePath}`], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(`pandoc fallo al renderizar ${sourcePath} -> ${outputPath}`);
  }
}
async function machine_render_docx(args) {
  const state = await readState(args.projectDir);
  assertGateApproved(state, args.gate);
  checkExternalBinary("pandoc", PANDOC_INSTALL_INSTRUCTIONS, args.isAvailable ?? defaultPandocIsAvailable);
  const templateExists = args.isTemplateAvailable ?? defaultTemplateExists;
  const resolution = resolveTemplate({
    projectDir: args.projectDir,
    templatePath: args.templatePath,
    templateExists,
    projectTemplatePath: args.projectTemplatePath,
    userTemplatePath: args.userTemplatePath,
    packageTemplatePath: args.packageTemplatePath
  });
  if (!templateExists(resolution.templatePath)) {
    throw new Error(`Plantilla corporativa faltante: "${resolution.templatePath}". Coloca el .docx corporativo en esa ruta antes de renderizar (ver packages/node/machine-core/templates/README.md). No se entrega un .docx sin estilos corporativos.`);
  }
  await mkdir2(dirname2(args.outputPath), { recursive: true });
  const render = args.render ?? defaultPandocRender;
  await render(args.sourcePath, args.outputPath, resolution.templatePath);
  return { outputPath: args.outputPath, templatePath: resolution.templatePath, templateSource: resolution.source };
}

// src/tool.ts
var { schema } = tool;
var approve = tool({
  description: "Aprueba una puerta (gate) declarada del pipeline machine para un proyecto.",
  args: {
    projectDir: schema.string(),
    gate: schema.string()
  },
  async execute(args) {
    const state = await machine_approve(args);
    return { title: `machine_approve:${args.gate}`, output: JSON.stringify(state, null, 2) };
  }
});
var process_input = tool({
  description: "Procesa un insumo del pipeline machine: calcula su sha256, decide si ya fue procesado y actualiza el estado del proyecto.",
  args: {
    projectDir: schema.string(),
    inputPath: schema.string(),
    content: schema.string(),
    route: schema.enum(["business", "discovery"]),
    outputPath: schema.string(),
    transcription: schema.string().optional(),
    transcriptionProvider: schema.string().optional()
  },
  async execute(args) {
    const result = await machine_process_input(args);
    return { title: `machine_process_input:${args.inputPath}`, output: JSON.stringify(result, null, 2) };
  }
});
var render_docx = tool({
  description: "Renderiza un artefacto Markdown aprobado a .docx via Pandoc, aplicando la plantilla corporativa en cascada (proyecto, usuario, paquete).",
  args: {
    projectDir: schema.string(),
    gate: schema.string(),
    sourcePath: schema.string(),
    outputPath: schema.string(),
    templatePath: schema.string().optional()
  },
  async execute(args) {
    const result = await machine_render_docx(args);
    return { title: `machine_render_docx:${args.gate}`, output: JSON.stringify(result, null, 2) };
  }
});
export {
  render_docx,
  process_input,
  approve
};

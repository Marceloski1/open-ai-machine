// @bun
// src/tool.ts
import { tool } from "@opencode-ai/plugin/tool";

// src/init.ts
import { mkdir as mkdir2 } from "fs/promises";
import { join as join2 } from "path";

// ../machine-core/src/state.ts
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

// src/init.ts
var INDEX_FILENAME = "INDEX.md";
function indexPath(projectDir) {
  return join2(projectDir, INDEX_FILENAME);
}
function indexContent() {
  return [
    "# Indice del proyecto",
    "",
    "- `inputs/` - insumos originales",
    "- `business/` - artefactos de la fase de negocio",
    "- `.machine/state.json` - estado del pipeline",
    ""
  ].join(`
`);
}
async function machine_business_init(args) {
  const { projectDir } = args;
  await mkdir2(join2(projectDir, "inputs"), { recursive: true });
  await mkdir2(join2(projectDir, "business"), { recursive: true });
  const state = await ensureState(projectDir);
  const idxPath = indexPath(projectDir);
  const idxFile = Bun.file(idxPath);
  const existed = await idxFile.exists();
  if (!existed) {
    await Bun.write(idxFile, indexContent());
  }
  return { state, indexPath: idxPath, created: !existed };
}

// src/proposal.ts
import { mkdir as mkdir3 } from "fs/promises";
import { dirname as dirname2, join as join3 } from "path";

// ../machine-core/src/approvals.ts
function invalidateDownstream(state, gate) {
  const approvals = { ...state.approvals };
  for (const [key, approval] of Object.entries(approvals)) {
    if (key !== gate && approval.dependsOn?.includes(gate) && approval.status === "approved") {
      approvals[key] = { ...approval, status: "pending" };
    }
  }
  return { ...state, approvals };
}
function setGatePending(state, gate, dependsOn) {
  const existing = state.approvals[gate];
  const next = {
    ...state,
    approvals: {
      ...state.approvals,
      [gate]: {
        status: "pending",
        dependsOn: dependsOn ?? existing?.dependsOn
      }
    }
  };
  return invalidateDownstream(next, gate);
}

// src/proposal.ts
var NEEDS_INPUT = "NEEDS INPUT";
var GATE = "proposal";
var SECTION_TITLES = {
  market: "Mercado",
  problem: "Problema",
  solution: "Solucion",
  estimate: "Estimacion"
};
var SECTION_ORDER = ["market", "problem", "solution", "estimate"];
function proposalPath(projectDir) {
  return join3(projectDir, "business", "proposal.md");
}
function renderSection(title, content) {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT;
  return `## ${title}

${body}
`;
}
function renderProposal(sections) {
  const body = SECTION_ORDER.map((key) => renderSection(SECTION_TITLES[key], sections[key])).join(`
`);
  return `# Propuesta de negocio

${body}`;
}
async function machine_business_proposal(args) {
  const { projectDir, sections } = args;
  const state = await readState(projectDir);
  const hasBusinessInputs = state.inputs.some((input) => input.route === "business");
  if (!hasBusinessInputs) {
    throw new Error(`No hay insumos con route: "business" registrados en ${projectDir}. Ejecuta machine-process-input antes de generar la propuesta.`);
  }
  const outputPath = proposalPath(projectDir);
  await mkdir3(dirname2(outputPath), { recursive: true });
  await Bun.write(outputPath, renderProposal(sections));
  const nextState = setGatePending(state, GATE);
  await writeState(projectDir, nextState);
  return { state: nextState, outputPath };
}
// src/tool.ts
var { schema } = tool;
var init = tool({
  description: "Inicializa la estructura estandar de un proyecto de negocio: crea inputs/, business/ y el estado del pipeline.",
  args: {
    projectDir: schema.string()
  },
  async execute(args) {
    const result = await machine_business_init(args);
    return { title: `machine_business_init:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  }
});
var proposal = tool({
  description: "Sintetiza la propuesta de negocio (business/proposal.md) a partir de los insumos route: business ya registrados, marcando como NEEDS INPUT lo que no tenga respaldo.",
  args: {
    projectDir: schema.string(),
    sections: schema.object({
      market: schema.string().optional(),
      problem: schema.string().optional(),
      solution: schema.string().optional(),
      estimate: schema.string().optional()
    })
  },
  async execute(args) {
    const result = await machine_business_proposal(args);
    return { title: `machine_business_proposal:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  }
});
export {
  proposal,
  init
};

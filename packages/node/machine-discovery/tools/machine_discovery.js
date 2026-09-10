// @bun
// src/tool.ts
import { tool } from "@opencode-ai/plugin/tool";

// src/init.ts
import { existsSync } from "fs";
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
function discoveryDir(projectDir) {
  return join2(projectDir, "discovery");
}
async function machine_discovery_init(args) {
  const { projectDir } = args;
  const dir = discoveryDir(projectDir);
  const existed = existsSync(dir);
  await mkdir2(join2(projectDir, "inputs"), { recursive: true });
  await mkdir2(dir, { recursive: true });
  const state = await ensureState(projectDir);
  return { state, discoveryDir: dir, created: !existed };
}

// src/hla.ts
import { mkdir as mkdir3 } from "fs/promises";
import { dirname as dirname2, join as join3 } from "path";

// ../machine-core/src/approvals.ts
function assertGateApproved(state, gate) {
  const approval = state.approvals[gate];
  if (!approval || approval.status !== "approved") {
    const status = approval?.status ?? "no declarada";
    throw new Error(`Puerta "${gate}" no aprobada (estado: ${status}). Operacion rechazada; usa "machine-approve <proyecto> ${gate}".`);
  }
}
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

// src/hla.ts
var NEEDS_INPUT = "NEEDS INPUT";
var GATE = "hla";
var UPSTREAM_GATE = "requirements";
var FENCE = "```";
var SECTION_TITLES = {
  overview: "Vision general",
  components: "Componentes",
  integrations: "Integraciones",
  decisions: "Decisiones tecnicas"
};
var SECTION_ORDER = ["overview", "components", "integrations", "decisions"];
function hlaPath(projectDir) {
  return join3(projectDir, "discovery", "hla.md");
}
function renderSection(title, content) {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT;
  return `## ${title}

${body}
`;
}
function renderDiagram(diagram) {
  return `### ${diagram.title}

${FENCE}mermaid
${diagram.mermaid.trim()}
${FENCE}
`;
}
function renderDiagrams(diagrams) {
  const usable = diagrams.filter((diagram) => diagram.mermaid.trim());
  if (usable.length === 0) {
    return `## Diagramas

${NEEDS_INPUT}
`;
  }
  return `## Diagramas

${usable.map(renderDiagram).join(`
`)}`;
}
function renderHla(sections, diagrams) {
  const body = SECTION_ORDER.map((key) => renderSection(SECTION_TITLES[key], sections[key])).join(`
`);
  return `# Arquitectura de alto nivel

${body}
${renderDiagrams(diagrams)}`;
}
async function machine_discovery_hla(args) {
  const { projectDir, sections } = args;
  const diagrams = args.diagrams ?? [];
  const state = await readState(projectDir);
  assertGateApproved(state, UPSTREAM_GATE);
  const outputPath = hlaPath(projectDir);
  await mkdir3(dirname2(outputPath), { recursive: true });
  await Bun.write(outputPath, renderHla(sections, diagrams));
  const nextState = setGatePending(state, GATE, [UPSTREAM_GATE]);
  await writeState(projectDir, nextState);
  return { state: nextState, outputPath };
}

// src/estimation.ts
import { mkdir as mkdir5, readFile as readFile2, readdir as readdir2 } from "fs/promises";
import { dirname as dirname3, join as join5 } from "path";

// src/prds.ts
import { mkdir as mkdir4, readdir, rm } from "fs/promises";
import { join as join4 } from "path";
var NEEDS_INPUT2 = "NEEDS INPUT";
var GATE2 = "prds";
var UPSTREAM_GATE2 = "requirements";
var SECTION_TITLES2 = {
  objective: "Objetivo",
  scope: "Alcance",
  acceptanceCriteria: "Criterios de aceptacion",
  outOfScope: "Fuera de alcance"
};
var SECTION_ORDER2 = [
  "objective",
  "scope",
  "acceptanceCriteria",
  "outOfScope"
];
function prdsDir(projectDir) {
  return join4(projectDir, "discovery", "prds");
}
function unitSlug(title) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, "-");
}
function renderSection2(title, content) {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT2;
  return `## ${title}

${body}
`;
}
function renderPrd(unit) {
  const body = SECTION_ORDER2.map((key) => renderSection2(SECTION_TITLES2[key], unit[key])).join(`
`);
  return `# ${unit.title.trim()}

${body}`;
}
function assertNoSlugCollisions(units) {
  const bySlug = new Map;
  for (const unit of units) {
    const slug = unitSlug(unit.title);
    if (!slug) {
      throw new Error(`Unidad funcional sin titulo utilizable: "${unit.title}".`);
    }
    const existing = bySlug.get(slug);
    if (existing) {
      throw new Error(`Dos unidades funcionales colisionan en el archivo "${slug}.md": "${existing.title}" y "${unit.title}". Renombra una para distinguirlas.`);
    }
    bySlug.set(slug, unit);
  }
  return bySlug;
}
async function clearPreviousDrafts(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.endsWith(".md")) {
      await rm(join4(dir, entry), { force: true });
    }
  }
}
async function machine_discovery_draft_prds(args) {
  const { projectDir, units } = args;
  const state = await readState(projectDir);
  assertGateApproved(state, UPSTREAM_GATE2);
  if (units.length === 0) {
    throw new Error(`No hay ninguna unidad funcional identificada en los requisitos aprobados de ${projectDir}. Revisa requirements.md antes de generar los PRD.`);
  }
  const bySlug = assertNoSlugCollisions(units);
  const dir = prdsDir(projectDir);
  await mkdir4(dir, { recursive: true });
  await clearPreviousDrafts(dir);
  const outputPaths = [];
  for (const [slug, unit] of bySlug) {
    const outputPath = join4(dir, `${slug}.md`);
    await Bun.write(outputPath, renderPrd(unit));
    outputPaths.push(outputPath);
  }
  const nextState = setGatePending(state, GATE2, [UPSTREAM_GATE2]);
  await writeState(projectDir, nextState);
  return { state: nextState, outputPaths };
}

// src/estimation.ts
var NEEDS_INPUT3 = "NEEDS INPUT";
var GATE3 = "estimation";
var UPSTREAM_GATE3 = "requirements";
var PRDS_GATE = "prds";
function estimationPath(projectDir) {
  return join5(projectDir, "discovery", "estimation.md");
}
async function readPrdTitles(projectDir) {
  const dir = prdsDir(projectDir);
  let entries;
  try {
    entries = await readdir2(dir);
  } catch {
    return new Map;
  }
  const titles = new Map;
  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    const slug = entry.slice(0, -3);
    const content = await readFile2(join5(dir, entry), "utf8");
    const heading = content.split(`
`).find((line) => line.startsWith("# "));
    titles.set(slug, heading ? heading.slice(2).trim() : slug);
  }
  return titles;
}
function renderRow(title, effort, rationale) {
  const effortCell = effort?.trim() ? effort.trim() : NEEDS_INPUT3;
  const rationaleCell = rationale?.trim() ? rationale.trim() : NEEDS_INPUT3;
  return `| ${title} | ${effortCell} | ${rationaleCell} |`;
}
async function machine_discovery_time_estimation(args) {
  const { projectDir, estimates } = args;
  const state = await readState(projectDir);
  assertGateApproved(state, UPSTREAM_GATE3);
  const titles = await readPrdTitles(projectDir);
  if (titles.size === 0) {
    throw new Error(`No hay ningun PRD generado en ${prdsDir(projectDir)}. Ejecuta machine-draft-prds antes de estimar.`);
  }
  const bySlug = new Map;
  for (const estimate of estimates) {
    const slug = unitSlug(estimate.unit);
    if (!titles.has(slug)) {
      throw new Error(`La unidad "${estimate.unit}" no tiene PRD aguas arriba. Solo pueden estimarse unidades con un PRD generado; revisa machine-draft-prds.`);
    }
    bySlug.set(slug, estimate);
  }
  const rows = [];
  const estimated = [];
  const missing = [];
  for (const [slug, title] of titles) {
    const estimate = bySlug.get(slug);
    if (estimate?.effort?.trim()) {
      estimated.push(slug);
    } else {
      missing.push(slug);
    }
    rows.push(renderRow(title, estimate?.effort, estimate?.rationale));
  }
  const markdown = [
    "# Estimacion",
    "",
    "| Unidad | Esfuerzo | Justificacion |",
    "| --- | --- | --- |",
    ...rows,
    ""
  ].join(`
`);
  const outputPath = estimationPath(projectDir);
  await mkdir5(dirname3(outputPath), { recursive: true });
  await Bun.write(outputPath, markdown);
  const nextState = setGatePending(state, GATE3, [PRDS_GATE]);
  await writeState(projectDir, nextState);
  return { state: nextState, outputPath, estimated, missing };
}

// src/planning.ts
import { mkdir as mkdir6, readFile as readFile3 } from "fs/promises";
import { dirname as dirname4, join as join6 } from "path";
var NEEDS_INPUT4 = "NEEDS INPUT";
var GATE4 = "planning";
var UPSTREAM_GATE4 = "requirements";
var ESTIMATION_GATE = "estimation";
function planningPath(projectDir) {
  return join6(projectDir, "discovery", "planning.md");
}
function parseEstimatedUnits(markdown) {
  const units = new Map;
  for (const line of markdown.split(`
`)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) {
      continue;
    }
    const cells = trimmed.split("|").slice(1, -1).map((cell) => cell.trim());
    const [title, effort] = cells;
    if (!title || !effort || title === "Unidad") {
      continue;
    }
    units.set(unitSlug(title), { title, effort });
  }
  return units;
}
async function machine_discovery_planning(args) {
  const { projectDir, items } = args;
  const state = await readState(projectDir);
  assertGateApproved(state, UPSTREAM_GATE4);
  const sourcePath = estimationPath(projectDir);
  let estimationMarkdown;
  try {
    estimationMarkdown = await readFile3(sourcePath, "utf8");
  } catch {
    throw new Error(`No hay estimacion generada en ${sourcePath}. Ejecuta machine-time-estimation antes de planificar.`);
  }
  const units = parseEstimatedUnits(estimationMarkdown);
  const bySlug = new Map;
  for (const item of items) {
    const slug = unitSlug(item.unit);
    const unit = units.get(slug);
    if (!unit) {
      throw new Error(`La unidad "${item.unit}" no aparece en la estimacion. El plan solo puede cubrir unidades estimadas; revisa machine-time-estimation.`);
    }
    if (unit.effort === NEEDS_INPUT4) {
      throw new Error(`La unidad "${item.unit}" figura en la estimacion sin esfuerzo (${NEEDS_INPUT4}). Estimala antes de planificarla.`);
    }
    bySlug.set(slug, item);
  }
  const rows = [];
  const planned = [];
  const missing = [];
  for (const [slug, unit] of units) {
    if (unit.effort === NEEDS_INPUT4) {
      continue;
    }
    const item = bySlug.get(slug);
    if (item?.milestone?.trim()) {
      planned.push(slug);
    } else {
      missing.push(slug);
    }
    const milestone = item?.milestone?.trim() ? item.milestone.trim() : NEEDS_INPUT4;
    const sequence = item?.sequence?.trim() ? item.sequence.trim() : NEEDS_INPUT4;
    const notes = item?.notes?.trim() ? item.notes.trim() : NEEDS_INPUT4;
    rows.push(`| ${unit.title} | ${unit.effort} | ${milestone} | ${sequence} | ${notes} |`);
  }
  const markdown = [
    "# Plan de trabajo",
    "",
    "| Unidad | Esfuerzo | Hito | Secuencia | Notas |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    ""
  ].join(`
`);
  const outputPath = planningPath(projectDir);
  await mkdir6(dirname4(outputPath), { recursive: true });
  await Bun.write(outputPath, markdown);
  const nextState = setGatePending(state, GATE4, [ESTIMATION_GATE]);
  await writeState(projectDir, nextState);
  return { state: nextState, outputPath, planned, missing };
}

// src/project-doc.ts
import { mkdir as mkdir8, readFile as readFile4, readdir as readdir3 } from "fs/promises";
import { dirname as dirname6, join as join8 } from "path";

// src/requirements.ts
import { mkdir as mkdir7 } from "fs/promises";
import { dirname as dirname5, join as join7 } from "path";
var NEEDS_INPUT5 = "NEEDS INPUT";
var GATE5 = "requirements";
var UPSTREAM_GATE5 = "proposal";
var SECTION_TITLES3 = {
  scope: "Alcance",
  functional: "Requisitos funcionales",
  nonFunctional: "Requisitos no funcionales",
  constraints: "Restricciones"
};
var SECTION_ORDER3 = [
  "scope",
  "functional",
  "nonFunctional",
  "constraints"
];
function requirementsPath(projectDir) {
  return join7(projectDir, "discovery", "requirements.md");
}
function renderSection3(title, content) {
  const body = content?.trim() ? content.trim() : NEEDS_INPUT5;
  return `## ${title}

${body}
`;
}
function renderRequirements(sections) {
  const body = SECTION_ORDER3.map((key) => renderSection3(SECTION_TITLES3[key], sections[key])).join(`
`);
  return `# Requisitos

${body}`;
}
async function machine_discovery_requirements(args) {
  const { projectDir, sections } = args;
  const state = await readState(projectDir);
  assertGateApproved(state, UPSTREAM_GATE5);
  const hasDiscoveryInputs = state.inputs.some((input) => input.route === "discovery");
  if (!hasDiscoveryInputs) {
    throw new Error(`No hay insumos con route: "discovery" registrados en ${projectDir}. Ejecuta machine-process-input antes de generar los requisitos.`);
  }
  const outputPath = requirementsPath(projectDir);
  await mkdir7(dirname5(outputPath), { recursive: true });
  await Bun.write(outputPath, renderRequirements(sections));
  const nextState = setGatePending(state, GATE5, [UPSTREAM_GATE5]);
  await writeState(projectDir, nextState);
  return { state: nextState, outputPath };
}

// src/project-doc.ts
var GATE6 = "project";
var UPSTREAM_GATE6 = "requirements";
var ARTIFACTS = [
  { gate: "requirements", title: "Requisitos", kind: "file", resolve: requirementsPath },
  { gate: "hla", title: "Arquitectura de alto nivel", kind: "file", resolve: hlaPath },
  { gate: "prds", title: "PRD por unidad funcional", kind: "directory", resolve: prdsDir },
  { gate: "estimation", title: "Estimacion", kind: "file", resolve: estimationPath },
  { gate: "planning", title: "Plan de trabajo", kind: "file", resolve: planningPath }
];
function projectDocPath(projectDir) {
  return join8(projectDir, "discovery", "project.md");
}
function isApproved(state, gate) {
  return state.approvals[gate]?.status === "approved";
}
async function readArtifact(artifact, projectDir) {
  const path = artifact.resolve(projectDir);
  if (artifact.kind === "file") {
    try {
      return await readFile4(path, "utf8");
    } catch {
      return;
    }
  }
  let entries;
  try {
    entries = (await readdir3(path)).filter((entry) => entry.endsWith(".md")).sort();
  } catch {
    return;
  }
  if (entries.length === 0) {
    return;
  }
  const parts = [];
  for (const entry of entries) {
    parts.push(await readFile4(join8(path, entry), "utf8"));
  }
  return parts.join(`
`);
}
async function machine_discovery_project_doc(args) {
  const { projectDir } = args;
  const state = await readState(projectDir);
  assertGateApproved(state, UPSTREAM_GATE6);
  const sections = ["# Documento de proyecto", ""];
  const included = [];
  const pending = [];
  const missing = [];
  for (const artifact of ARTIFACTS) {
    const content = await readArtifact(artifact, projectDir);
    sections.push(`## ${artifact.title}`, "");
    if (content === undefined) {
      missing.push(artifact.gate);
      sections.push(`Artefacto no generado: falta ejecutar la fase que produce "${artifact.gate}".`, "");
      continue;
    }
    if (!isApproved(state, artifact.gate)) {
      pending.push(artifact.gate);
      sections.push(`Artefacto pendiente de aprobacion: la puerta "${artifact.gate}" no esta en approved, asi que su contenido no se incorpora. Ejecuta machine-approve sobre esa puerta.`, "");
      continue;
    }
    included.push(artifact.gate);
    sections.push(content.trim(), "");
  }
  const outputPath = projectDocPath(projectDir);
  await mkdir8(dirname6(outputPath), { recursive: true });
  await Bun.write(outputPath, `${sections.join(`
`).trimEnd()}
`);
  const nextState = setGatePending(state, GATE6, ARTIFACTS.map((artifact) => artifact.gate));
  await writeState(projectDir, nextState);
  return { state: nextState, outputPath, included, pending, missing };
}
// src/tool.ts
var { schema } = tool;
var init = tool({
  description: "Prepara la estructura de la fase de descubrimiento de un proyecto: crea discovery/, asegura inputs/ y el estado del pipeline.",
  args: {
    projectDir: schema.string()
  },
  async execute(args) {
    const result = await machine_discovery_init(args);
    return { title: `machine_discovery_init:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  }
});
var requirements = tool({
  description: "Genera los requisitos (discovery/requirements.md) a partir de los insumos route: discovery ya aprobados y abre el Architecture Gate.",
  args: {
    projectDir: schema.string(),
    sections: schema.object({
      scope: schema.string().optional(),
      functional: schema.string().optional(),
      nonFunctional: schema.string().optional(),
      constraints: schema.string().optional()
    })
  },
  async execute(args) {
    const result = await machine_discovery_requirements(args);
    return {
      title: `machine_discovery_requirements:${args.projectDir}`,
      output: JSON.stringify(result, null, 2)
    };
  }
});
var hla = tool({
  description: "Genera la arquitectura de alto nivel (discovery/hla.md) a partir de los requisitos aprobados, con diagramas Mermaid opcionales.",
  args: {
    projectDir: schema.string(),
    sections: schema.object({
      overview: schema.string().optional(),
      components: schema.string().optional(),
      integrations: schema.string().optional(),
      decisions: schema.string().optional()
    }),
    diagrams: schema.array(schema.object({
      title: schema.string(),
      mermaid: schema.string()
    })).optional()
  },
  async execute(args) {
    const result = await machine_discovery_hla(args);
    return { title: `machine_discovery_hla:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  }
});
var draft_prds = tool({
  description: "Genera un borrador de PRD por unidad funcional (discovery/prds/) a partir de los requisitos aprobados.",
  args: {
    projectDir: schema.string(),
    units: schema.array(schema.object({
      title: schema.string(),
      objective: schema.string().optional(),
      scope: schema.string().optional(),
      acceptanceCriteria: schema.string().optional(),
      outOfScope: schema.string().optional()
    }))
  },
  async execute(args) {
    const result = await machine_discovery_draft_prds(args);
    return {
      title: `machine_discovery_draft_prds:${args.projectDir}`,
      output: JSON.stringify(result, null, 2)
    };
  }
});
var time_estimation = tool({
  description: "Estima el esfuerzo por unidad funcional (discovery/estimation.md) a partir de los PRD ya generados.",
  args: {
    projectDir: schema.string(),
    estimates: schema.array(schema.object({
      unit: schema.string(),
      effort: schema.string().optional(),
      rationale: schema.string().optional()
    }))
  },
  async execute(args) {
    const result = await machine_discovery_time_estimation(args);
    return {
      title: `machine_discovery_time_estimation:${args.projectDir}`,
      output: JSON.stringify(result, null, 2)
    };
  }
});
var planning = tool({
  description: "Genera el plan de trabajo (discovery/planning.md) a partir de las unidades ya estimadas.",
  args: {
    projectDir: schema.string(),
    items: schema.array(schema.object({
      unit: schema.string(),
      milestone: schema.string().optional(),
      sequence: schema.string().optional(),
      notes: schema.string().optional()
    }))
  },
  async execute(args) {
    const result = await machine_discovery_planning(args);
    return { title: `machine_discovery_planning:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  }
});
var project_doc = tool({
  description: "Consolida los artefactos aprobados de descubrimiento (discovery/project.md) del proyecto.",
  args: {
    projectDir: schema.string()
  },
  async execute(args) {
    const result = await machine_discovery_project_doc(args);
    return {
      title: `machine_discovery_project_doc:${args.projectDir}`,
      output: JSON.stringify(result, null, 2)
    };
  }
});
export {
  time_estimation,
  requirements,
  project_doc,
  planning,
  init,
  hla,
  draft_prds
};

import { tool } from "@opencode-ai/plugin/tool";
import { machine_discovery_init } from "./lib/machine-discovery/init";
import { machine_discovery_requirements } from "./lib/machine-discovery/requirements";
import { machine_discovery_hla } from "./lib/machine-discovery/hla";
import { machine_discovery_draft_prds } from "./lib/machine-discovery/prds";
import { machine_discovery_time_estimation } from "./lib/machine-discovery/estimation";
import { machine_discovery_planning } from "./lib/machine-discovery/planning";
import { machine_discovery_project_doc } from "./lib/machine-discovery/project-doc";

const { schema } = tool;

export const init = tool({
  description:
    "Prepara la estructura de la fase de descubrimiento de un proyecto: crea discovery/, asegura inputs/ y el estado del pipeline.",
  args: {
    projectDir: schema.string(),
  },
  async execute(args) {
    const result = await machine_discovery_init(args);
    return { title: `machine_discovery_init:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  },
});

export const requirements = tool({
  description:
    "Genera los requisitos (discovery/requirements.md) a partir de los insumos route: discovery ya aprobados y abre el Architecture Gate.",
  args: {
    projectDir: schema.string(),
    sections: schema.object({
      scope: schema.string().optional(),
      functional: schema.string().optional(),
      nonFunctional: schema.string().optional(),
      constraints: schema.string().optional(),
    }),
  },
  async execute(args) {
    const result = await machine_discovery_requirements(args);
    return {
      title: `machine_discovery_requirements:${args.projectDir}`,
      output: JSON.stringify(result, null, 2),
    };
  },
});

export const hla = tool({
  description:
    "Genera la arquitectura de alto nivel (discovery/hla.md) a partir de los requisitos aprobados, con diagramas Mermaid opcionales.",
  args: {
    projectDir: schema.string(),
    sections: schema.object({
      overview: schema.string().optional(),
      components: schema.string().optional(),
      integrations: schema.string().optional(),
      decisions: schema.string().optional(),
    }),
    diagrams: schema
      .array(
        schema.object({
          title: schema.string(),
          mermaid: schema.string(),
        }),
      )
      .optional(),
  },
  async execute(args) {
    const result = await machine_discovery_hla(args);
    return { title: `machine_discovery_hla:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  },
});

export const draft_prds = tool({
  description:
    "Genera un borrador de PRD por unidad funcional (discovery/prds/) a partir de los requisitos aprobados.",
  args: {
    projectDir: schema.string(),
    units: schema.array(
      schema.object({
        title: schema.string(),
        objective: schema.string().optional(),
        scope: schema.string().optional(),
        acceptanceCriteria: schema.string().optional(),
        outOfScope: schema.string().optional(),
      }),
    ),
  },
  async execute(args) {
    const result = await machine_discovery_draft_prds(args);
    return {
      title: `machine_discovery_draft_prds:${args.projectDir}`,
      output: JSON.stringify(result, null, 2),
    };
  },
});

export const time_estimation = tool({
  description:
    "Estima el esfuerzo por unidad funcional (discovery/estimation.md) a partir de los PRD ya generados.",
  args: {
    projectDir: schema.string(),
    estimates: schema.array(
      schema.object({
        unit: schema.string(),
        effort: schema.string().optional(),
        rationale: schema.string().optional(),
      }),
    ),
  },
  async execute(args) {
    const result = await machine_discovery_time_estimation(args);
    return {
      title: `machine_discovery_time_estimation:${args.projectDir}`,
      output: JSON.stringify(result, null, 2),
    };
  },
});

export const planning = tool({
  description:
    "Genera el plan de trabajo (discovery/planning.md) a partir de las unidades ya estimadas.",
  args: {
    projectDir: schema.string(),
    items: schema.array(
      schema.object({
        unit: schema.string(),
        milestone: schema.string().optional(),
        sequence: schema.string().optional(),
        notes: schema.string().optional(),
      }),
    ),
  },
  async execute(args) {
    const result = await machine_discovery_planning(args);
    return { title: `machine_discovery_planning:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  },
});

export const project_doc = tool({
  description:
    "Consolida los artefactos aprobados de descubrimiento (discovery/project.md) del proyecto.",
  args: {
    projectDir: schema.string(),
  },
  async execute(args) {
    const result = await machine_discovery_project_doc(args);
    return {
      title: `machine_discovery_project_doc:${args.projectDir}`,
      output: JSON.stringify(result, null, 2),
    };
  },
});

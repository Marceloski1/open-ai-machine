import { tool } from "@opencode-ai/plugin/tool";
import { machine_business_init, machine_business_proposal } from "./index";

const { schema } = tool;

export const init = tool({
  description:
    "Inicializa la estructura estandar de un proyecto de negocio: crea inputs/, business/ y el estado del pipeline.",
  args: {
    projectDir: schema.string(),
  },
  async execute(args) {
    const result = await machine_business_init(args);
    return { title: `machine_business_init:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  },
});

export const proposal = tool({
  description:
    "Sintetiza la propuesta de negocio (business/proposal.md) a partir de los insumos route: business ya registrados, marcando como NEEDS INPUT lo que no tenga respaldo.",
  args: {
    projectDir: schema.string(),
    sections: schema.object({
      market: schema.string().optional(),
      problem: schema.string().optional(),
      solution: schema.string().optional(),
      estimate: schema.string().optional(),
    }),
  },
  async execute(args) {
    const result = await machine_business_proposal(args);
    return { title: `machine_business_proposal:${args.projectDir}`, output: JSON.stringify(result, null, 2) };
  },
});

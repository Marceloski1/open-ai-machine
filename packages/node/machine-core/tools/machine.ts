import { tool } from "@opencode-ai/plugin/tool";
import { machine_approve, machine_process_input, machine_render_docx } from "./lib/machine-core/core";

const { schema } = tool;

export const approve = tool({
  description: "Aprueba una puerta (gate) declarada del pipeline machine para un proyecto.",
  args: {
    projectDir: schema.string(),
    gate: schema.string(),
  },
  async execute(args) {
    const state = await machine_approve(args);
    return { title: `machine_approve:${args.gate}`, output: JSON.stringify(state, null, 2) };
  },
});

export const process_input = tool({
  description:
    "Procesa un insumo del pipeline machine: calcula su sha256, decide si ya fue procesado y actualiza el estado del proyecto.",
  args: {
    projectDir: schema.string(),
    inputPath: schema.string(),
    content: schema.string(),
    route: schema.enum(["business", "discovery"]),
    outputPath: schema.string(),
    transcription: schema.string().optional(),
    transcriptionProvider: schema.string().optional(),
  },
  async execute(args) {
    const result = await machine_process_input(args);
    return { title: `machine_process_input:${args.inputPath}`, output: JSON.stringify(result, null, 2) };
  },
});

export const render_docx = tool({
  description:
    "Renderiza un artefacto Markdown aprobado a .docx via Pandoc, aplicando la plantilla corporativa en cascada (proyecto, usuario, paquete).",
  args: {
    projectDir: schema.string(),
    gate: schema.string(),
    sourcePath: schema.string(),
    outputPath: schema.string(),
    templatePath: schema.string().optional(),
  },
  async execute(args) {
    const result = await machine_render_docx(args);
    return { title: `machine_render_docx:${args.gate}`, output: JSON.stringify(result, null, 2) };
  },
});

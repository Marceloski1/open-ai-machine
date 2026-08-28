import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
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

export type RenderDocxArgs = {
  projectDir: string;
  gate: string;
  sourcePath: string;
  outputPath: string;
  isAvailable?: BinaryChecker;
  render?: (sourcePath: string, outputPath: string) => Promise<void>;
};

export type RenderDocxResult = {
  outputPath: string;
};

const PANDOC_INSTALL_INSTRUCTIONS = "https://pandoc.org/installing.html";

async function defaultPandocRender(sourcePath: string, outputPath: string): Promise<void> {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("pandoc", [sourcePath, "-o", outputPath], { stdio: "ignore" });
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
    args.isAvailable ?? defaultIsAvailable,
  );

  await mkdir(dirname(args.outputPath), { recursive: true });
  const render = args.render ?? defaultPandocRender;
  await render(args.sourcePath, args.outputPath);

  return { outputPath: args.outputPath };
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

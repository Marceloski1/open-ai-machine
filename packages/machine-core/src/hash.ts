import { createHash } from "node:crypto";
import type { InputRecord, MachineState } from "./types";

export function computeSha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function isProcessed(state: MachineState, sha256: string): boolean {
  return state.inputs.some((input) => input.sha256 === sha256);
}

export function upsertInput(state: MachineState, record: InputRecord): MachineState {
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

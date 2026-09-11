import type { MachineState } from "./types";

export function assertGateApproved(state: MachineState, gate: string): void {
  const approval = state.approvals[gate];
  if (!approval || approval.status !== "approved") {
    const status = approval?.status ?? "no declarada";
    throw new Error(
      `Puerta "${gate}" no aprobada (estado: ${status}). Operacion rechazada; usa "machine-approve <proyecto> ${gate}".`,
    );
  }
}

export function approveGate(state: MachineState, gate: string): MachineState {
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
        at: new Date().toISOString(),
      },
    },
  };
}

export function invalidateDownstream(state: MachineState, gate: string): MachineState {
  const approvals = { ...state.approvals };
  for (const [key, approval] of Object.entries(approvals)) {
    if (key !== gate && approval.dependsOn?.includes(gate) && approval.status === "approved") {
      approvals[key] = { ...approval, status: "pending" };
    }
  }
  return { ...state, approvals };
}

export function setGatePending(state: MachineState, gate: string, dependsOn?: string[]): MachineState {
  const existing = state.approvals[gate];
  const next: MachineState = {
    ...state,
    approvals: {
      ...state.approvals,
      [gate]: {
        status: "pending",
        dependsOn: dependsOn ?? existing?.dependsOn,
      },
    },
  };
  return invalidateDownstream(next, gate);
}

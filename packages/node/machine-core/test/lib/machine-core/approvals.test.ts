import { describe, expect, test } from "bun:test";
import { approveGate, assertGateApproved, setGatePending } from "../../../tools/lib/machine-core/approvals";
import type { MachineState } from "../../../tools/lib/machine-core/types";

function stateWith(approvals: MachineState["approvals"]): MachineState {
  return { phase: "", inputs: [], approvals };
}

describe("assertGateApproved", () => {
  test("rechaza operacion protegida cuando la puerta esta en pending", () => {
    const state = stateWith({ proposal: { status: "pending" } });

    expect(() => assertGateApproved(state, "proposal")).toThrow(/proposal/);
  });

  test("rechaza igual bajo opencode run --auto (sin bypass por entorno)", () => {
    const state = stateWith({ proposal: { status: "pending" } });
    process.env.OPENCODE_AUTO = "true";

    try {
      expect(() => assertGateApproved(state, "proposal")).toThrow();
    } finally {
      delete process.env.OPENCODE_AUTO;
    }
  });

  test("permite la operacion cuando la puerta esta aprobada", () => {
    const state = stateWith({ proposal: { status: "approved", at: "2026-01-01T00:00:00.000Z" } });

    expect(() => assertGateApproved(state, "proposal")).not.toThrow();
  });
});

describe("approveGate", () => {
  test("puerta declarada en pending pasa a approved con timestamp", () => {
    const state = stateWith({ requirements: { status: "pending" } });

    const next = approveGate(state, "requirements");

    expect(next.approvals.requirements?.status).toBe("approved");
    expect(typeof next.approvals.requirements?.at).toBe("string");
  });

  test("puerta no declarada falla sin modificar el estado", () => {
    const state = stateWith({});

    expect(() => approveGate(state, "unknown-gate")).toThrow();
  });
});

describe("invalidacion aguas abajo", () => {
  test("regenerar un artefacto aprobado devuelve a pending las aprobaciones dependientes", () => {
    const state = stateWith({
      requirements: { status: "approved", at: "2026-01-01T00:00:00.000Z" },
      proposal: { status: "approved", at: "2026-01-02T00:00:00.000Z", dependsOn: ["requirements"] },
    });

    const next = setGatePending(state, "requirements");

    expect(next.approvals.requirements?.status).toBe("pending");
    expect(next.approvals.proposal?.status).toBe("pending");
  });
});

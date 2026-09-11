export type Gate = "pending" | "approved" | "rejected";

export type Route = "business" | "discovery";

export type InputRecord = {
  path: string;
  sha256: string;
  processedAt: string;
  route: Route;
  outputPath: string;
};

export type Approval = {
  status: Gate;
  at?: string;
  dependsOn?: string[];
};

export type MachineState = {
  phase: string;
  inputs: InputRecord[];
  approvals: Record<string, Approval>;
};

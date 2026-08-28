import { machine_business_init } from "./init";
import { machine_business_proposal } from "./proposal";

export { machine_business_init } from "./init";
export type { InitArgs, InitResult } from "./init";
export { machine_business_proposal } from "./proposal";
export type { ProposalArgs, ProposalResult, ProposalSections } from "./proposal";

export default async function machineBusinessPlugin() {
  return {
    tool: {
      machine_business_init,
      machine_business_proposal,
    },
  };
}

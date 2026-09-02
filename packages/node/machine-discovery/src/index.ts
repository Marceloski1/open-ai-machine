import { machine_discovery_init } from "./init";
import { machine_discovery_hla } from "./hla";
import { machine_discovery_time_estimation } from "./estimation";
import { machine_discovery_draft_prds } from "./prds";
import { machine_discovery_requirements } from "./requirements";

export { machine_discovery_init, discoveryDir } from "./init";
export type { InitArgs, InitResult } from "./init";
export { machine_discovery_hla, hlaPath } from "./hla";
export type { HlaArgs, HlaDiagram, HlaResult, HlaSections } from "./hla";
export { machine_discovery_time_estimation, estimationPath } from "./estimation";
export type { EstimationArgs, EstimationResult, UnitEstimate } from "./estimation";
export { machine_discovery_draft_prds, prdsDir, unitSlug } from "./prds";
export type { DraftPrdsArgs, DraftPrdsResult, PrdUnit } from "./prds";
export { machine_discovery_requirements, requirementsPath } from "./requirements";
export type { RequirementsArgs, RequirementsResult, RequirementsSections } from "./requirements";

export default async function machineDiscoveryPlugin() {
  return {
    tool: {
      machine_discovery_init,
      machine_discovery_requirements,
      machine_discovery_hla,
      machine_discovery_draft_prds,
      machine_discovery_time_estimation,
    },
  };
}

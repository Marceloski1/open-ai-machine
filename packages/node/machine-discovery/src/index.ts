import { machine_discovery_init } from "./init";
import { machine_discovery_requirements } from "./requirements";

export { machine_discovery_init, discoveryDir } from "./init";
export type { InitArgs, InitResult } from "./init";
export { machine_discovery_requirements, requirementsPath } from "./requirements";
export type { RequirementsArgs, RequirementsResult, RequirementsSections } from "./requirements";

export default async function machineDiscoveryPlugin() {
  return {
    tool: {
      machine_discovery_init,
      machine_discovery_requirements,
    },
  };
}

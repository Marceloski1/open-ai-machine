import { machine_discovery_init } from "./init";

export { machine_discovery_init, discoveryDir } from "./init";
export type { InitArgs, InitResult } from "./init";

export default async function machineDiscoveryPlugin() {
  return {
    tool: {
      machine_discovery_init,
    },
  };
}

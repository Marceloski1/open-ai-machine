import { writeFile } from "node:fs/promises";

export type OpencodeConfig = Record<string, unknown> & {
  plugin?: string[];
};

export async function readOpencodeConfig(configPath: string): Promise<OpencodeConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    return {};
  }
  const raw = await file.text();
  return JSON.parse(raw) as OpencodeConfig;
}

export async function writeOpencodeConfig(configPath: string, config: OpencodeConfig): Promise<void> {
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

export function mergeOpencodeConfig(
  existing: OpencodeConfig | undefined,
  pluginEntries: string[],
): OpencodeConfig {
  const base = existing ?? {};
  const currentPlugins = Array.isArray(base.plugin) ? base.plugin : [];
  const merged = Array.from(new Set([...currentPlugins, ...pluginEntries]));
  return { ...base, plugin: merged };
}

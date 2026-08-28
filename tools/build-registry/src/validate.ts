const ID_PATTERN = /^machine-[a-z0-9-]+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;
const COMMAND_PATTERN = /^machine-[a-z0-9-]+$/;

const REQUIRED_FIELDS = [
  "id",
  "version",
  "commands",
  "agents",
  "skills",
  "templates",
  "dependencies",
  "externalRequirements",
  "permissions",
] as const;

const ARRAY_OF_STRING_FIELDS = ["commands", "agents", "skills", "templates", "dependencies", "externalRequirements"] as const;

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(manifest)) {
    return { valid: false, errors: ["manifest: debe ser un objeto"] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in manifest)) {
      errors.push(`${field}: campo requerido ausente`);
    }
  }

  if (typeof manifest.id !== "string") {
    errors.push("id: debe ser un string");
  } else if (!ID_PATTERN.test(manifest.id)) {
    errors.push(`id: "${manifest.id}" debe empezar por "machine-"`);
  }

  if (typeof manifest.version !== "string") {
    errors.push("version: debe ser un string");
  } else if (!SEMVER_PATTERN.test(manifest.version)) {
    errors.push(`version: "${manifest.version}" no es SemVer valido`);
  }

  for (const field of ARRAY_OF_STRING_FIELDS) {
    const value = manifest[field];
    if (value === undefined) continue;
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      errors.push(`${field}: debe ser un array de strings`);
    }
  }

  if (Array.isArray(manifest.commands)) {
    for (const command of manifest.commands) {
      if (typeof command === "string" && !COMMAND_PATTERN.test(command)) {
        errors.push(`commands: "${command}" debe empezar por "machine-"`);
      }
    }
  }

  if (manifest.permissions !== undefined && !isRecord(manifest.permissions)) {
    errors.push("permissions: debe ser un objeto");
  }

  return { valid: errors.length === 0, errors };
}

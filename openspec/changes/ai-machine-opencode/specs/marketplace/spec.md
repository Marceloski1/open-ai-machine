# Marketplace Specification

## Purpose

Catálogo público, manifiestos de paquete e instalador para distribuir paquetes de The AI Machine sobre Opencode v1.

## Requirements

### Requirement: Manifiesto de paquete

Cada paquete MUST incluir `machine.json` en su raíz declarando `id`, `version` (SemVer), `commands[]`, `agents[]`, `skills[]`, `templates[]`, `dependencies[]`, `externalRequirements[]` y `permissions`. Un paquete sin manifiesto válido MUST NOT publicarse ni instalarse.

#### Scenario: Manifiesto válido

- GIVEN un paquete con `machine.json` conforme al schema
- WHEN se ejecuta la validación
- THEN la validación pasa y el paquete es publicable

#### Scenario: Manifiesto inválido

- GIVEN un `machine.json` sin `version` o con SemVer malformado
- WHEN se ejecuta la validación
- THEN falla indicando el campo infractor
- AND el paquete MUST NOT entrar en el catálogo

### Requirement: Prefijo de comandos

Todo comando declarado en `commands[]` MUST empezar por `machine-`. Un comando compartido MUST declararse en un único paquete.

#### Scenario: Comando sin prefijo

- GIVEN un manifiesto que declara `process-input`
- WHEN se valida el paquete
- THEN la validación falla por prefijo ausente

#### Scenario: Comando duplicado entre paquetes

- GIVEN dos paquetes del catálogo que declaran `machine-render-docx`
- WHEN se genera el catálogo
- THEN la generación falla por colisión

### Requirement: Catálogo público generado

`registry/index.json` MUST generarse desde los `machine.json` y exponer por paquete: `id`, `version`, `description`, artefactos aportados, `compatibility`, `checksum`, `permissions` y `externalRequirements`. MUST NOT editarse a mano.

#### Scenario: Generación del catálogo

- GIVEN tres paquetes con manifiestos válidos
- WHEN se ejecuta `build-registry`
- THEN `registry/index.json` contiene las tres entradas con checksum calculado

### Requirement: Descubrimiento

El instalador MUST ofrecer `list`, `search` e `info` resolviendo contra el catálogo, sin instalar nada.

#### Scenario: Consulta de un paquete

- GIVEN un catálogo con `machine-business`
- WHEN se ejecuta `info machine-business`
- THEN se muestran versión, permisos, checksum y requisitos externos

### Requirement: Instalación con destino explícito

`install` MUST permitir destino global (`~/.config/opencode/`) o de proyecto (`.opencode/`), MAY ofrecer `.claude/skills/` como destino adicional para skills, y MUST registrar en `installed.json` cada archivo escrito con su ruta, destino y checksum. La instalación MUST ser idempotente.

#### Scenario: Instalación en proyecto

- GIVEN un paquete válido y destino de proyecto
- WHEN se ejecuta `install`
- THEN los artefactos se escriben bajo `.opencode/`
- AND `installed.json` registra cada archivo con su checksum

#### Scenario: Reinstalación sin cambios

- GIVEN un paquete ya instalado en la misma versión
- WHEN se ejecuta `install` de nuevo
- THEN no se reescribe ningún archivo y se informa "sin cambios"

### Requirement: Divulgación previa

`install` MUST mostrar permisos solicitados, checksum y requisitos externos, y MUST requerir confirmación antes de escribir. En modo no interactivo MUST exigir un flag explícito de aceptación.

#### Scenario: Instalación no interactiva sin aceptación

- GIVEN modo no interactivo sin flag de aceptación
- WHEN se ejecuta `install`
- THEN la operación se rechaza sin escribir archivos

### Requirement: Actualización reversible

`update` MUST verificar checksum antes de reemplazar y, ante fallo, MUST restaurar la versión y el `installed.json` previos.

#### Scenario: Fallo a mitad de actualización

- GIVEN una actualización que falla tras escribir parte de los archivos
- WHEN el instalador detecta el error
- THEN restaura los archivos y el registro anteriores
- AND la versión instalada permanece operativa

### Requirement: Desinstalación acotada

`uninstall` MUST eliminar únicamente los archivos registrados en `installed.json` para ese paquete y destino, y MUST NOT tocar artefactos no registrados.

#### Scenario: Archivo ajeno presente

- GIVEN un archivo creado por el usuario en el mismo directorio
- WHEN se ejecuta `uninstall`
- THEN ese archivo permanece intacto

### Requirement: Gestión de paquetes del repositorio

El monorepo MUST usar pnpm workspaces con `pnpm-workspace.yaml` y `pnpm-lock.yaml`, y MUST NOT contener `package-lock.json`, `yarn.lock` ni `bun.lockb`. Los paquetes publicados MUST ser instalables tanto por pnpm como por Bun.

#### Scenario: Lockfile ajeno en el repositorio

- GIVEN un `package-lock.json` presente
- WHEN se ejecuta la validación de CI
- THEN la validación falla

# The AI Machine — marketplace para Opencode

Catálogo de paquetes que instalan comandos y agentes de The AI Machine en
[Opencode](https://opencode.ai). Cada paquete declara qué comandos aporta, qué permisos pide y
el checksum de todo lo que instala, y el CLI copia únicamente los archivos que el catálogo
declara.

## Requisitos

| Herramienta | Para qué | Nota |
|---|---|---|
| [Bun](https://bun.sh) | Ejecutar el CLI y los tests de TypeScript | El CLI lee con `Bun.file`; **no** funciona con Node |
| [pnpm](https://pnpm.io) | Dependencias del workspace | Prohibido `package-lock.json`, `yarn.lock` y `bun.lockb` |
| [uv](https://docs.astral.sh/uv/) | Entorno Python del repositorio | Pandoc y MarkItDown viven en el `.venv`, no en el sistema |

```bash
pnpm install --frozen-lockfile
uv sync
```

## Instalar un paquete

```bash
bun cli/src/cli.ts list                        # ver el catálogo
bun cli/src/cli.ts search propuesta            # buscar por id o descripción
bun cli/src/cli.ts info machine-core           # permisos, checksum y requisitos externos
bun cli/src/cli.ts install machine-core        # instalar (pide confirmación)
```

Antes de copiar nada, `install` muestra la **divulgación previa** —permisos, checksum y
requisitos externos— y espera confirmación. En un entorno no interactivo hay que aceptarla con
`--yes`; sin ese flag la instalación se rechaza en vez de asumir consentimiento.

### Dónde se instala

`--target` decide el destino, y `project` es el valor por defecto:

| `--target` | Destino |
|---|---|
| `project` | `.opencode/` del directorio actual |
| `global` | `~/.config/opencode/` |
| `claude` | `.claude/` del directorio actual |

El CLI no escribe `opencode.json`: los agentes, comandos y tools de Opencode se detectan solo por
convención de archivos en `.opencode/` (`commands/`, `agents/`, `tools/`, ...), y la clave `plugin`
de ese archivo hoy apuntaría a un paquete (`machine-core`) que todavía no está publicado en npm.

Los tools que invocan esos comandos se instalan como código ejecutable autocontenido: cada
paquete (`machine-core`, `machine-business`, `machine-discovery`) genera su propio bundle con
`bun run packages/node/<paquete>/scripts/build-tool.ts` a partir de `src/tool.ts`, y lo instala en
`.opencode/tools/`, sin más dependencia externa que `@opencode-ai/plugin` (que Opencode ya provee
en `.opencode/node_modules/`).

| Paquete | Bundle | Tools que expone |
|---|---|---|
| `machine-core` | `.opencode/tools/machine.js` | `machine_approve`, `machine_process_input`, `machine_render_docx` |
| `machine-business` | `.opencode/tools/machine_business.js` | `machine_business_init`, `machine_business_proposal` |
| `machine-discovery` | `.opencode/tools/machine_discovery.js` | `machine_discovery_init`, `machine_discovery_requirements`, `machine_discovery_hla`, `machine_discovery_draft_prds`, `machine_discovery_time_estimation`, `machine_discovery_planning`, `machine_discovery_project_doc` |

`machine-business` y `machine-discovery` importan de `machine-core/src/*` (estado, puertas de
aprobacion); el bundler inlinea esas importaciones al compilar, asi que el artefacto instalado no
depende de que `machine-core` tambien este instalado.

### Mantenimiento

```bash
bun cli/src/cli.ts update machine-core         # verifica checksums antes de escribir
bun cli/src/cli.ts uninstall machine-core      # borra solo lo que el registro declara
```

`update` comprueba el checksum de cada archivo **antes** de tocar el disco y aborta sin escribir
si alguno no coincide. Si falla a mitad de camino, restaura desde una copia de respaldo. Lo
instalado se registra en `installed.json` dentro del destino, y `uninstall` borra exactamente
esos archivos.

## Estructura

```
packages/node/     paquetes TypeScript ejecutados por Bun
packages/py/       paquetes Python (ver packages/py/README.md)
registry/          index.json generado y schema.json del catálogo
cli/               instalador (src/commands, src/core, tests)
tools/             build-registry, build-template, convert-inputs
docs/              proyectos: insumos y artefactos generados
openspec/          artefactos del flujo SDD
```

## Desarrollo

```bash
pnpm test                                       # tests de TypeScript (Bun)
pnpm typecheck                                  # comprobación de tipos (tsc)
uv run pytest                                   # tests de las herramientas Python
bun packages/node/machine-core/scripts/build-tool.ts       # regenerar tools/machine.js
bun packages/node/machine-business/scripts/build-tool.ts   # regenerar tools/machine_business.js
bun packages/node/machine-discovery/scripts/build-tool.ts  # regenerar tools/machine_discovery.js
bun tools/build-registry/src/index.ts           # regenerar registry/index.json
uv run python tools/convert-inputs/convert_inputs.py docs/inputs
```

**Bun ejecuta TypeScript sin comprobar tipos**, así que `pnpm test` puede pasar con errores de
tipo. `pnpm typecheck` es lo que los detecta, y el CI lo ejecuta antes de los tests.

**Los `tools/*.js` de cada paquete se generan, nunca se editan a mano.** Cada uno es el bundle
autocontenido de su `src/tool.ts` (sin las importaciones relativas, incluidas las que cruzan a
`machine-core/src/*`, que el bundler inlinea y que no viajan como archivos sueltos con el paquete
instalado). El CI regenera los tres y falla si algún archivo commiteado quedó desfasado.

**`registry/index.json` se genera, nunca se edita a mano.** El CI regenera el catálogo y falla si
el archivo commiteado quedó desfasado, e instala un paquete de verdad para comprobar que el
catálogo sirve al instalador.

## Límite actual

El CLI resuelve los paquetes desde **este clon del repositorio**: `install` copia desde
`packages/`, no descarga nada. Todavía no hay resolución remota ni publicación versionada, así
que hoy la instalación exige tener el repositorio en disco.

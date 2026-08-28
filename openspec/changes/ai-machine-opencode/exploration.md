# Exploration: The AI Machine para Opencode (marketplace)

Change: `ai-machine-opencode`
Fecha: 2026-08-27
Backend de artefactos: openspec

---

## 0. Fuentes consultadas (verificación real, no memoria)

| Fuente | URL | Qué aportó |
|---|---|---|
| Opencode Docs — Plugins (v1) | https://opencode.ai/docs/plugins/ | Ubicaciones de plugins, carga npm, hooks, custom tools, dependencias |
| Opencode Docs — Agents (v1) | https://opencode.ai/docs/agents/ | Formato markdown + frontmatter, `mode: primary\|subagent`, `permission` |
| Opencode Docs — Commands (v1) | https://opencode.ai/docs/commands/ | Formato markdown, `$ARGUMENTS`/`$1`, `` !`cmd` ``, `@file`, frontmatter `agent`/`model`/`subtask` |
| Opencode Docs — Skills (v1) | https://opencode.ai/docs/skills/ | `SKILL.md`, rutas `.opencode/skills`, `.claude/skills`, `.agents/skills`; tool nativo `skill` |
| Opencode Docs — Config (v1) | https://opencode.ai/docs/config/ | Claves de `opencode.json`, precedencia y merge, `{env:}`/`{file:}` |
| Opencode Docs — CLI | https://opencode.ai/docs/cli/ | `opencode run`, `--agent`, `--command`, `--auto`, `--attach`, `opencode serve` |
| Opencode Docs — Ecosystem | https://opencode.ai/docs/ecosystem/ | **No existe registry/marketplace oficial**; alta por PR |
| Opencode Docs v2 (beta) — Plugins | https://opencode.ai/v2/docs/build/plugins | API v2: `ctx.agent/skill/command/mcp.transform()`, packaging npm |
| Opencode Docs v2 — índice | https://opencode.ai/v2/docs | v2 en **beta**; "APIs, configuration, and plugin APIs may change" |
| context7 `/websites/opencode_ai` y `/websites/opencode_ai_plugins` | — | Ejemplos verbatim de `opencode.json` (`plugin: [...]`, `agent: {...}`) y de hooks |
| Prior art: CLI marketplace comunitario | https://github.com/NikiforovAll/opencode-marketplace | Instalación desde GitHub/local, registro `installed.json`, descubrimiento por convención |
| Prior art: registry comunitario | https://awesomeopencode.com/ , awesome-opencode | Capa de descubrimiento de facto (índice curado) |

Nota de versión: coexisten **Opencode v1 (estable)** y **Opencode 2.0 beta** con APIs de plugin distintas. Esta exploración distingue ambas donde importa.

---

## 1. Estado actual

### 1.1 Del repositorio
El repo `opencode-market-place` está **vacío salvo documentación**:

- `docs/inputs/posted.md` — único archivo (insumo de la presentación). Privado, no versionado.
- No hay `openspec/`, `package.json`, `opencode.json`, ni código previo.

Es decir: proyecto greenfield. No hay que migrar código, hay que **portar un diseño** que hoy vive como plugins de Claude Code.

### 1.2 Del diseño origen (Claude Code)
Dos plugins encadenados con puertas humanas:

- `machine-business` (Fase 0): `business-init`, `process-input`, `business-proposal`, `render-docx` → `proposal.docx`
- `machine-discovery` (Fase 1): `discovery-init`, `process-input`, `requirements`, `hla`, `draft-prds`, `time-estimation`, `planning`, `project-doc`, `render-docx` → `project.docx`

Principios: puertas humanas (Aprobar/Refinar/Reiniciar), idempotencia de `process-input`, encadenamiento sugerido, `NEEDS INPUT` para lo que falta, estructura `docs/<proyecto>/{inputs,business,discovery}`, entregables Word con plantilla, no recálculo aguas abajo.

---

## 2. Plataforma Opencode — hallazgos verificados

### 2.1 Comandos personalizados (equivalente directo a slash commands)
Markdown en `~/.config/opencode/commands/` (global) o `.opencode/commands/` (proyecto). El nombre de archivo es el comando: `test.md` → `/test`.

Frontmatter verificado: `description`, `agent`, `model`, `subtask` (boolean, fuerza subagente).
Cuerpo = plantilla de prompt. Soporta:
- `$1`, `$2`, … posicionales y `$ARGUMENTS` colectivo.
- Inyección de shell: `` !`npm test` `` (salida del comando embebida en el prompt).
- Referencia de archivos: `@src/components/Button.tsx`.
- Pueden sobrescribir built-ins (`/init`, `/undo`, `/share`, `/help`).

También declarables en `opencode.json` bajo la clave `command`.

**Conclusión: los 12 comandos de The AI Machine tienen equivalente 1:1.**

### 2.2 Agents
Markdown en `~/.config/opencode/agents/` o `.opencode/agents/`; el filename es el id.

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash: deny
---
You are in code review mode. ...
```

`mode`: `primary` (se cicla con Tab) o `subagent` (invocado automáticamente o vía `@mention`).
`permission` acepta claves `read, edit, glob, grep, list, bash, task, external_directory, lsp, skill` con valores `allow|ask|deny`.
También declarables en `opencode.json` bajo `agent`, con `prompt: "{file:./prompts/build.txt}"`.

### 2.3 Skills
`SKILL.md` bajo `<dir>/skills/<name>/SKILL.md`. Rutas soportadas, **incluida compatibilidad Claude**:
- `.opencode/skills/<name>/SKILL.md` y `~/.config/opencode/skills/...`
- `.claude/skills/<name>/SKILL.md` (proyecto y global)
- `.agents/skills/<name>/SKILL.md`

Frontmatter: `name` (requerido, `^[a-z0-9]+(-[a-z0-9]+)*$`, 1–64), `description` (requerido, 1–1024), `license`, `compatibility`, `metadata` (map string→string) opcionales.
Descubrimiento: sube desde el cwd hasta el git worktree.
Invocación: tool nativo `skill`, p.ej. `skill({ name: "git-release" })`.
Permisos por patrón:
```json
"permission": { "skill": { "*": "allow", "internal-*": "deny" } }
```

**Hallazgo alto valor: las skills de Claude Code (`.claude/skills/`) son leídas por Opencode tal cual.** Reduce mucho el coste de portado y habilita un marketplace *dual-target*.

### 2.4 Plugins
**v1 (estable)**: módulos JS/TS en `.opencode/plugins/` o `~/.config/opencode/plugins/`; o paquetes npm declarados en config:

```json
{ "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "opencode-wakatime", "@my-org/custom-plugin"] }
```

npm se instala con Bun al arrancar, cacheado en `~/.cache/opencode/node_modules/`. Dependencias locales: `package.json` en el config dir → `bun install` al inicio.

Firma:
```ts
import type { Plugin } from "@opencode-ai/plugin"
export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => ({ /* hooks */ })
```

Hooks v1 verificados: `session.created|updated|idle|compacted`, `tool.execute.before|after`, `file.edited`, `file.watcher.updated`, `message.updated|removed`, `shell.env`, `tui.prompt.append`, `tui.command.execute`, `experimental.chat.system.transform`, `experimental.session.compacting`, `event`, `stop`, `dispose`. Tools custom vía `tool: { mytool: tool({ description, args, execute }) }`. El loader interno expone `config()` ("notify plugins of current config") y `experimental_workspace.register`.

**v2 (beta) — cambio de modelo importante**: los plugins registran *transforms*:
```ts
await ctx.agent.transform((draft) => { draft.update("build", a => { a.description = "..." }); draft.default("build") })
await ctx.skill.transform((draft) => { draft.add({ id, name, description, location, content }) })
await ctx.command.transform((draft) => { draft.add({ name, description, execute: async ({ sessionID, prompt, delivery }) => {...} }) })
await ctx.mcp.transform((draft) => { draft.set("docs", { type: "remote", url: "https://mcp.example.com" }) })
```
Hooks v2 documentados: `prompt`, `context`, `model.request`, `http.request|response`, `permission.evaluate`, `shell.create.before`, `tool.execute.before|after`.
Packaging v2 (verbatim):
```json
{ "name": "opencode-acme-plugin", "version": "1.0.0", "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@opencode-ai/plugin": "beta" } }
```

**Implicación clave**: en **v2 un plugin npm SÍ puede aportar agents, commands, skills y MCP servers programáticamente**. En **v1 NO existe ese mecanismo documentado** — un "plugin" npm aporta hooks y tools, pero los commands/agents/skills se distribuyen como **archivos** que deben aterrizar en `.opencode/` o `~/.config/opencode/`.

### 2.5 MCP
Clave `mcp` en `opencode.json` (v1); en v2 sólo vía `ctx.mcp.transform`. Tipos `local`/`remote`.

### 2.6 Configuración y precedencia
`opencode.json` / `opencode.jsonc`. Los orígenes se **mergean** (no reemplazan), en orden creciente de prioridad:
1. Remote config `.well-known/opencode` (defaults organizacionales)
2. Global `~/.config/opencode/opencode.json`
3. `OPENCODE_CONFIG` (path custom)
4. `opencode.json` del proyecto
5. Directorios `.opencode/` (agents/, commands/, plugins/)
6. `OPENCODE_CONFIG_CONTENT` (inline env)
7. Managed system config
8. MDM macOS (no sobrescribible)

Sustitución: `{env:VAR}` y `{file:path}`.

### 2.7 CLI y modo no interactivo
```
opencode run [message..]
  -m/--model, --agent, --command, -c/--continue, -s/--session, --fork, --share, --auto, --attach
opencode serve            # servidor; permite --attach y evitar cold boot de MCP
opencode github install|run
```
`--auto` = "auto-approve permissions that are not explicitly denied". Es decir: **en no interactivo las puertas humanas se degradan a auto-aprobación o a bloqueo**, no hay UI de Aprobar/Refinar/Reiniciar.

### 2.8 Marketplace oficial: NO existe
La página Ecosystem lo dice de forma explícita: no hay registry ni marketplace oficial; el alta es **"Submit a PR"**. Los agregadores comunitarios (awesome-opencode, awesomeopencode.com, opencode.cafe, opencode.im/plugins) son la capa de descubrimiento de facto. Existe además prior art de un CLI de marketplace (`NikiforovAll/opencode-marketplace`) que instala desde GitHub/local por **convención de directorios** (`command/`, `agent/`, `skill/`, con fallback a `.opencode/*` y `.claude/*`) y lleva registro en `installed.json` (user: `~/.config/opencode/plugins/installed.json`, proyecto: `.opencode/plugins/installed.json`), con detección de cambios por content-hash.

**Conclusión: el marketplace hay que construirlo. No hay estándar que respetar, sólo convenciones que conviene imitar.**

---

## 3. Mapeo de conceptos: Claude Code → Opencode

| Pieza en Claude Code | Equivalente Opencode | Fidelidad | Notas |
|---|---|---|---|
| Slash command (`/business-init`) | `commands/business-init.md` (o clave `command` en config) | **Alta** | `$ARGUMENTS`/`$1`, `` !`cmd` ``, `@file` cubren todo lo necesario |
| Skill (`SKILL.md`) | `skills/<name>/SKILL.md` | **Total** | Opencode lee además `.claude/skills/` sin cambios |
| Subagente / Task | Agent `mode: subagent`, `@mention`, `subtask: true` en command | **Alta** | `subagent_depth` limita anidación |
| Plugin (bundle de commands+skills+agents) | **v1: no existe** como paquete instalable. **v2: `ctx.*.transform()`** | **Media/Baja** | Es *el* gap estructural del port |
| `plugin marketplace add` / `/plugin install` de Claude Code | **No existe** | **Nula** | Hay que construir instalador propio (ver §4) |
| Puerta humana interactiva (Aprobar/Refinar/Reiniciar) | `permission: ask` + parada del turno + comando de continuación | **Media** | No hay widget de opciones; se emula con prompt + comandos `*-approve` / `*-refine` |
| Hooks de plugin (PreToolUse etc.) | Hooks v1/v2 (`tool.execute.before`, `permission.evaluate`) | **Alta** | v2 añade `permission.evaluate`, muy útil para las puertas |
| Herramienta de render `.docx` | Bash + pandoc/docxtemplater vía `$` del plugin o `!`cmd`` del command | **Media** | Externo al runtime; ver §5 |
| MCP servers | Clave `mcp` (v1) / `ctx.mcp.transform` (v2) | **Alta** | — |
| Ingesta de audio | **Sin equivalente**. `attachment.image` es la única config de adjuntos documentada | **Nula** | Requiere transcripción externa; ver §5 |
| `CLAUDE.md` | `instructions: ["CONTRIBUTING.md", ...]` + `AGENTS.md` | **Alta** | — |

### Sin equivalente directo (resumen)
1. Concepto de "plugin instalable con commands+skills+agents" en v1.
2. Marketplace/registry oficial y comando de instalación.
3. UI de puerta humana con opciones enumeradas.
4. Adjuntos de audio / transcripción nativa.
5. Render `.docx` nativo.

---

## 4. Qué implica ser un *marketplace* y no dos plugins

Un marketplace añade cinco responsabilidades sobre "dos carpetas de comandos":

| Dimensión | Qué hace falta |
|---|---|
| **Catálogo** | Un índice legible por máquina (`registry.json` / `index.json`) con: id, nombre, descripción, versión, tipo(s) aportados, tags, autor, licencia, URL de origen, compatibilidad (`opencode >=x`), checksum |
| **Manifiesto por paquete** | `machine.json` (o `opencode-plugin.json`) en la raíz de cada paquete: id, versión, qué aporta (`commands[]`, `agents[]`, `skills[]`, `templates[]`), dependencias entre paquetes (`machine-discovery` depende de `machine-business`), requisitos externos (pandoc, ffmpeg) |
| **Versionado** | SemVer + rango de compatibilidad con el runtime; el catálogo debe permitir instalar versión fija. Vía npm sale gratis; vía git requiere tags |
| **Instalación** | Copiar/enlazar los artefactos a `~/.config/opencode/{commands,agents,skills}/` o `.opencode/*`, y/o añadir entradas a `opencode.json`. Registro de lo instalado (`installed.json`) para `update`/`uninstall` idempotentes |
| **Descubrimiento** | `list`/`search`/`info` sobre el catálogo; en TUI, un command `/machine-marketplace` que consulte el índice |
| **Publicación** | Flujo de alta: PR al repo del registry con validación de esquema en CI, o `npm publish` + entrada en el índice |

### Opciones de distribución

| Opción | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. Repo git como registry + CLI instalador** (patrón `opencode-marketplace`) | Sin dependencia de npm ni infra; funciona hoy en v1; instala commands/agents/skills que son *archivos*; control total del esquema | Hay que escribir y mantener el instalador; update = re-fetch + hash; no hay resolución de dependencias gratis | **Media** |
| **B. npm packages + clave `plugin` de `opencode.json`** | Versionado y distribución resueltos; Bun instala solo; ruta oficial | **En v1 un paquete npm no puede aportar commands/agents/skills** — sólo hooks/tools. Sólo funciona bien con **v2 transforms**, que es beta y puede romper | Baja (v2) / No viable (v1) |
| **C. JSON index estático servido por HTTP/Pages + instalador** | Catálogo desacoplado del contenido; permite mezclar fuentes npm y git; fácil de cachear | Infra mínima extra; sigue necesitando instalador | Media |
| **E. Sólo directorio curado (README + links)** | Coste cero | No es un marketplace; instalación manual | Nulo |

### Recomendación de arquitectura
**Híbrido A + C, con puerta abierta a B cuando v2 estabilice.**

1. **Monorepo `opencode-market-place`** con `packages/machine-business/`, `packages/machine-discovery/`, `packages/machine-core/` (skills y plantillas compartidas). Cada paquete con `machine.json` + `commands/`, `agents/`, `skills/`, `templates/`.
2. **Catálogo generado** `registry/index.json` desde los `machine.json` (script `build-registry`), publicado en la rama principal y opcionalmente en Pages (opción C).
3. **Instalador** distribuido como plugin+tool de Opencode (`machine-marketplace`) con comandos `/machine-install`, `/machine-list`, `/machine-update`, `/machine-uninstall`, respaldados por un tool custom en TS que hace fetch del índice, descarga, valida checksum y escribe en `~/.config/opencode/` o `.opencode/`, registrando en `installed.json`. Adicionalmente un CLI `npx machine` para bootstrap (problema del huevo y la gallina: el instalador no puede instalarse a sí mismo desde dentro).
4. **Compatibilidad dual Claude/Opencode**: publicar las skills bajo `skills/<name>/SKILL.md` y permitir el destino `.claude/skills/` — el mismo paquete sirve a ambos runtimes.

---

## 5. Gaps y riesgos técnicos

### 5.1 Render a `.docx` — GAP REAL
Opencode no tiene capacidad de render documental. Opciones:
- **Pandoc + `--reference-doc=plantilla.docx`**: el estándar de facto para "Markdown + plantilla corporativa". Cubre estilos, tablas, encabezados. **Recomendado.**
- **docx (npm) / docxtemplater**: control fino, mucho más código.
- **LibreOffice headless**: pesado.

Ejecución: desde un tool custom del plugin usando `$` (Bun shell) o, en v1 sin plugin, desde el command con `` !`pandoc ...` ``.
Riesgos: dependencia externa no gestionada (hay que verificar pandoc en tiempo de ejecución y fallar con mensaje claro); diagramas **Mermaid** del HLA deben pre-renderizarse a PNG/SVG (`mmdc`, mermaid-cli) antes de embeber — segunda dependencia externa; el `--reference-doc` no soporta portadas complejas ni cabeceras/pies variables sin post-proceso.

### 5.2 Audio / transcripción — GAP REAL
No hay soporte de adjuntos de audio documentado (`attachment.image` es lo único configurado). `process-input` con audios exige transcripción **fuera** del modelo:
- `whisper.cpp` local, o `faster-whisper`, o API de transcripción de un proveedor.
- Requiere `ffmpeg` para normalizar formatos.
Riesgo: cadena de dependencias binarias (ffmpeg + modelo whisper) que un instalador de marketplace no puede resolver de forma portable en Windows/macOS/Linux. **Debe ser un requisito declarado con verificación previa y degradación explícita a `NEEDS INPUT`.**

### 5.3 Idempotencia de `process-input` — RIESGO MEDIO
No hay estado gestionado por el runtime. Solución: estado en el **filesystem** del proyecto, que es también el entregable:
- `docs/<proyecto>/inputs/index.md` (humano) + `docs/<proyecto>/.machine/state.json` (máquina) con `{ inputs: [{ path, sha256, processedAt, route: business|discovery, outputPath }] }`.
- Idempotencia por **content-hash**, igual que hace el marketplace comunitario. Si el hash coincide, no reprocesar.
Riesgo: el LLM puede "decidir" reescribir igualmente. Mitigación: el chequeo de hash debe vivir en un **tool determinista** (TS), no en el prompt. Esto empuja hacia tener un plugin real, no sólo comandos markdown.

### 5.4 Persistencia de estado entre comandos — RIESGO MEDIO
Cada `opencode run` puede ser una sesión nueva. `--continue`/`--session` permite encadenar, pero no es fiable como mecanismo de estado.
Solución: **el filesystem es el estado** (coherente con el diseño original: `docs/<proyecto>/...`). Añadir `.machine/state.json` con la fase actual, artefactos aprobados y horas aprobadas (para el principio "no recalcular"). El `experimental.session.compacting` hook puede reinyectar ese estado tras compactación.

### 5.5 Puertas humanas en runtime no interactivo — RIESGO ALTO
- En TUI: viable con `permission: ask` sobre `edit`/`bash`, y con el patrón "el comando termina proponiendo el siguiente" (que es exactamente el principio 3 de The AI Machine).
- En `opencode run --auto`: las puertas **se saltan**. Riesgo de generar `project.docx` sin aprobación humana.
Mitigación propuesta: la puerta no es una pregunta del LLM sino un **artefacto de estado**. `business-proposal` escribe `proposal.md` + marca `state.approvals.proposal = "pending"`. `render-docx` (tool determinista) **rechaza** ejecutarse si el approval no está en `approved`. La aprobación se otorga con un comando explícito (`/machine-approve <proyecto> proposal`). Así la puerta sobrevive a `--auto` y a la no interactividad.
En v2, `permission.evaluate` permite además interceptar y denegar programáticamente.

### 5.6 Riesgo de plataforma — v1 vs v2
La API de plugins v2 (transforms) es **exactamente** lo que un marketplace necesita, pero está en beta y la propia doc advierte que puede romper. Construir sobre v2 hoy = retrabajo probable. Construir sobre v1 = el instalador debe copiar archivos, más artesanal pero estable.
Mitigación: **capa de abstracción** — el contenido (commands/agents/skills en markdown) es idéntico en ambos; sólo cambia el *instalador*. Diseñar el paquete como archivos y el instalador como componente reemplazable.

### 5.7 Otros
- **Windows**: `shell: "pwsh"` es configurable, pero los comandos con `` !`...` `` deben ser portables o el paquete declarar shell. El entorno actual del usuario es Windows 11.
- **Colisión de nombres**: los commands globales pueden sobrescribir built-ins. Prefijar (`machine-*`) para evitar choques con otros paquetes del marketplace.
- **Seguridad**: instalar paquetes de terceros que aportan agents con `permission: { bash: allow }` es un vector real. El instalador debe mostrar los permisos solicitados antes de instalar y validar checksum.

---

## 6. Preguntas abiertas (requieren decisión del usuario)

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| 1 | ¿Target Opencode **v1 estable** o **v2 beta**? | v1 / v2 / dual | **v1 ahora**, con contenido portable y un instalador desacoplado; añadir adaptador v2 cuando salga de beta |
| 2 | ¿Distribución **git registry + instalador propio** o **npm**? | A / B / C / D | **A + C** (repo git como fuente + `index.json` generado). npm sólo para el CLI instalador |
| 3 | ¿El marketplace es público? | público | **Sí** — repositorio, registry e instalador se diseñan para distribución abierta y verificable |
| 4 | ¿Cómo se resuelve el **render .docx**? | pandoc / docx npm / servicio | **pandoc + `--reference-doc`**, con verificación de dependencia y fallo explícito |
| 5 | ¿Cómo se resuelve la **transcripción de audio**? | whisper local / API proveedor / transcripción manual fuera de la máquina | **API de proveedor** por portabilidad (whisper local rompe en Windows sin toolchain); permitir override local |
| 6 | ¿Las **puertas humanas** deben bloquear duro o sólo advertir? | bloqueo por state / advertencia | **Bloqueo por estado en `.machine/state.json`**, verificado por tool determinista |
| 7 | ¿Se mantiene **compatibilidad con Claude Code** (mismo paquete, dos runtimes)? | sí / no | **Sí** — Opencode lee `.claude/skills/`; el coste marginal es bajo y duplica el mercado |
| 8 | ¿Alcance del primer entregable: **portar las 2 fases** o **portar el mecanismo de marketplace** primero? | contenido primero / plataforma primero | **Plataforma mínima + `machine-business` completo** como primer paquete de validación; `machine-discovery` después |
| 9 | ¿Idioma de los entregables y de los prompts? | ES / EN / configurable | **ES por defecto, configurable** en `machine.json` del proyecto |
| 10 | ¿Qué hace `render-docx` si falta pandoc/mermaid-cli? | fallar / degradar a .md | **Fallar con instrucción de instalación**; nunca entregar un `.docx` degradado silenciosamente |

`NEEDS INPUT`: no se ha podido verificar si Opencode soporta adjuntos no-imagen (audio/PDF) en algún flujo no documentado. Asumido **no soportado**.
`NEEDS INPUT`: no se ha verificado el contenido exacto de los plugins actuales `machine-business` / `machine-discovery` de Claude Code — no están en este repositorio. El mapeo se basa en la presentación. Para el porte fiel hará falta el código fuente de esos plugins.

---

## 7. Approaches evaluados

1. **"Dos plugins v1 como archivos + instalador CLI propio"** — repo monorepo, `machine.json` por paquete, `index.json` generado, instalador que copia a `~/.config/opencode/`.
   - Pros: funciona hoy; estable; compatible Claude; control total; sin infra.
   - Cons: hay que escribir instalador, update y uninstall; sin resolución de dependencias gratis.
   - Esfuerzo: **Medio**.

2. **"Plugin npm único v2 con transforms"** — un paquete que registra commands/agents/skills programáticamente.
   - Pros: instalación de una línea en `opencode.json`; versionado npm; es el futuro de la plataforma.
   - Cons: **v2 en beta**, API declarada inestable; no es marketplace (es un plugin), habría que multiplicar paquetes; pierde compatibilidad Claude.
   - Esfuerzo: **Bajo** para el porte, **Alto** en riesgo de retrabajo.

3. **"Sólo directorio curado + instalación manual"**.
   - Pros: coste casi nulo.
   - Cons: no cumple el objetivo "marketplace"; fricción alta para el usuario.
   - Esfuerzo: **Bajo**.

---

## 8. Recomendación

**Approach 1 (monorepo + registry JSON + instalador propio), con una capa de abstracción que permita migrar a Approach 2 cuando Opencode v2 estabilice.**

Razones:
- Es la **única** opción que hoy, sobre la versión estable de Opencode, distribuye commands + agents + skills como una unidad instalable y versionada.
- Reutiliza el prior art comunitario (`opencode-marketplace`) en convenciones de descubrimiento y `installed.json`, en vez de inventar.
- La compatibilidad `.claude/skills/` es gratis y multiplica el alcance.
- La lógica crítica (idempotencia por hash, puertas humanas, render docx) queda en **tools deterministas TS**, no en prompts — que es lo que hace la diferencia entre una demo y una máquina.

Estructura propuesta (a validar en `sdd-design`):
```
opencode-market-place/
├── registry/index.json            # catálogo generado
├── packages/
│   ├── machine-core/              # skills + templates compartidos, tools TS
│   ├── machine-business/          # commands fase 0
│   └── machine-discovery/         # commands fase 1
├── tools/build-registry/          # genera index.json desde machine.json
└── cli/                           # npx machine install|list|update|uninstall
```

---

## 9. Riesgos (resumen priorizado)

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | API de plugins de Opencode cambia (v1→v2) | Alto | Contenido en markdown portable; instalador desacoplado |
| R2 | Puertas humanas se saltan con `--auto` / no interactivo | Alto | Puerta como estado en disco verificado por tool determinista |
| R3 | Dependencias externas (pandoc, mermaid-cli, ffmpeg, whisper) no portables | Alto | Declararlas en `machine.json`, verificar al instalar y al ejecutar, fallar con instrucciones |
| R4 | Sin marketplace oficial → hay que mantener infra propia | Medio | Registry estático en git/Pages, sin backend |
| R5 | `process-input` no idempotente en la práctica | Medio | Hash de contenido en tool TS, no en prompt |
| R6 | Paquetes de terceros con permisos peligrosos | Medio | Mostrar permisos y checksum antes de instalar |
| R7 | No se dispone del código de los plugins Claude Code originales | Medio | Solicitarlo antes de `sdd-spec`; hoy el mapeo se basa sólo en la presentación |
| R8 | Colisión de nombres de comandos globales | Bajo | Prefijo `machine-*` |

---

## 10. ¿Listo para propuesta?

**Sí, con una condición**: conviene cerrar las preguntas 1, 2, 3 y 8 de §6 antes de `sdd-propose`, porque determinan el alcance del primer entregable. Las demás pueden resolverse en `sdd-design`.

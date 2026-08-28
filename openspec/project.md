# Contexto de Proyecto — opencode-market-place

> Artefacto SDD generado por `sdd-init` (modo `openspec`). Idioma: español.
> Los términos técnicos e identificadores (`plugin`, `hooks`, `machine-business`, `process-input`, ...)
> se mantienen en su forma original.

## 1. Qué es este proyecto

`opencode-market-place` es el marketplace de plugins/agentes de **The AI Machine** portado a
**Opencode** (https://opencode.ai).

The AI Machine es un marketplace de plugins que convierte inputs crudos —audios, notas y documentos
de una reunión— en entregables profesionales (`proposal.docx`, `project.docx`). Hoy está
implementado como **plugins de Claude Code**; el objetivo de este repositorio es llevarlo a
Opencode como marketplace de plugins/agentes.

Principio rector del producto: *"la máquina no reemplaza el criterio; lo acelera. El humano aprueba
en cada puerta."*

Insumo primario: `docs/inputs/the-ai-machine-presentacion.md`.

## 2. Estado actual del repositorio

**Greenfield.** El repositorio contiene únicamente:

```
docs/inputs/the-ai-machine-presentacion.md
```

No existe: `package.json`, `opencode.json`, código fuente, tests, linters, CI, ni control de
versiones inicializado. **No hay stack detectado.** Todo lo que aparece en la sección 5 es
*propuesto*, no observado.

## 3. Dominio funcional (heredado de The AI Machine)

Pipeline de dos fases más una fase futura. Cada fase es un plugin.

### FASE 0 · BUSINESS — plugin `machine-business`

| Comando | Función |
|---|---|
| `business-init <proyecto>` | Crea `docs/<proyecto>/` con `inputs/`, `business/` e índice de archivos |
| `process-input <proyecto>` | Convierte cada input (audio o nota) en un registro Markdown; clasifica y enruta (business / discovery); actualiza el índice |
| `business-proposal <proyecto>` | Sintetiza mercado, problema, solución y estimación. Puerta humana |
| `render-docx <path>/business/proposal.md` | Renderiza a Word con plantilla corporativa |

Entregable: `proposal.docx`.

### FASE 1 · DISCOVERY — plugin `machine-discovery`

| Comando | Función |
|---|---|
| `discovery-init <proyecto>` | Puente entre fases; reutiliza inputs ya enrutados y encadena la cadena completa |
| `process-input <proyecto>` | Idempotente: verifica y actualiza el índice sin reescribir lo ya procesado |
| `requirements <proyecto>` | SRS: User Stories, RNF, reglas de negocio, criterios en Gherkin. **Architecture Gate** |
| `hla <proyecto>` | Arquitectura de alto nivel: componentes y despliegue en Mermaid, stack e infraestructura |
| `draft-prds <proyecto>` | Borradores de PRDs por componente/módulo |
| `time-estimation <proyecto>` | Fórmula de 6 componentes (roles, QA, testing, overhead, buffer); horas por rol y por PRD |
| `planning <proyecto>` | Fases y milestones desde el camino crítico; semanas/sprints con UAT por hito |
| `project-doc <proyecto>` | Documento de proyecto de 11 secciones; marca `NEEDS INPUT` donde falta dato |
| `render-docx <path>/project-doc/project.md` | Renderiza a Word (plantilla F1) con diagrama embebido |

Entregable: `project.docx`.

### FASE 2 (futura)

"De un plan a la implementación." No detallada en el insumo. **Fuera de alcance** hasta que exista
insumo adicional.

## 4. Principios transversales del producto (invariantes de diseño)

1. **Puertas humanas** en cada fase: Aprobar · Refinar · Reiniciar.
2. **Reutilización de insumos** entre fases; `process-input` es idempotente.
3. **Encadenamiento sugerido**: al terminar un comando, la máquina propone el siguiente.
4. **Nada inventado**: lo que falta del cliente se marca `NEEDS INPUT`.
5. **Estructura de carpetas estándar**: `docs/<proyecto>/{inputs,business,discovery,...}`.
6. **Entregables en Word** con plantilla corporativa.
7. Estimación y planificación **no recalculan**: consumen lo ya aprobado aguas arriba.

Estos siete principios deben sobrevivir al port a Opencode; cualquier spec o design que los
contradiga requiere justificación explícita.

## 5. Stack PROPUESTO (supuesto explícito, no verificado)

> **Ninguna de estas decisiones está tomada ni detectada en el repositorio.** Son la hipótesis de
> partida para `sdd-explore` / `sdd-propose`. Deben confirmarse (o descartarse) antes de `sdd-apply`.

### 5.1 Grounding real de la plataforma Opencode

Lo siguiente sí está verificado contra la documentación pública de Opencode:

- Un **plugin de Opencode** es un módulo **JavaScript/TypeScript** que corre sobre **Bun**, exporta
  una o más funciones plugin; cada una recibe un contexto (info de proyecto, cliente del SDK de
  Opencode, shell API de Bun, rutas de directorio/worktree) y devuelve un objeto de `hooks`.
- Carga de plugins por precedencia: config global `~/.config/opencode/opencode.json`, config de
  proyecto `opencode.json`, directorio global `~/.config/opencode/plugins/`, directorio de proyecto
  `.opencode/plugins/`.
- Distribución vía **paquetes npm** declarados en la clave `plugin` del config (soporta paquetes
  scoped); instalación automática con Bun y caché en `~/.cache/opencode/node_modules/`.
- Los `hooks` cubren eventos de command, file, installation, LSP, messaging, permissions, server,
  sessions, todos, shell, tools y TUI.
- Los **custom commands** se definen como Markdown con frontmatter YAML en `.opencode/commands/`
  (proyecto) o `~/.config/opencode/commands/` (global), o en la clave `command` de `opencode.jsonc`.
  El nombre del archivo es el nombre del comando. Frontmatter: `template` (requerido), `description`,
  `agent`, `model`, `subtask`. Placeholders: `$ARGUMENTS`, `$1..$N`, sintaxis de shell con backtick
  para inyectar salida de comandos, y `@archivo` para referencias a ficheros.
- La documentación de Opencode **no describe un marketplace/registro formal** más allá de npm y una
  sección de "ecosystem" con plugins de la comunidad.

**Consecuencia para este proyecto**: "marketplace" no es una primitiva de Opencode. Habrá que
decidir si se construye (a) sobre npm + convención de naming, (b) como catálogo propio con
instalador, o (c) híbrido. Esa decisión es materia de `sdd-explore`.

### 5.2 Hipótesis de stack

| Área | Propuesta | Estado |
|---|---|---|
| Runtime | Bun | SUPUESTO — impuesto de facto por el modelo de plugins de Opencode |
| Lenguaje | TypeScript (ESM) | SUPUESTO |
| Gestor de paquetes JS/TS | **pnpm** (workspaces, `pnpm-lock.yaml`) | **DECIDIDO** |
| Registry de publicación | npm / npmjs.com, paquetes scoped `@the-ai-machine/*` | **DECIDIDO** — pnpm es el cliente, npm el registry |
| Gestor de paquetes Python | **uv** (`pyproject.toml` + `uv.lock`, `uv run`) | **DECIDIDO** — aplica cuando exista código Python |
| Estructura del repo | monorepo con pnpm workspaces (un paquete por plugin + core compartido) | **DECIDIDO** |
| Comandos | Markdown con frontmatter en `.opencode/commands/` por plugin | SUPUESTO |
| Testing | `bun test` | SUPUESTO |
| Lint/format | Biome o ESLint + Prettier | SUPUESTO — sin decidir |
| Render a Word | pipeline Markdown → DOCX con plantilla corporativa (herramienta por decidir) | SUPUESTO |
| Diagramas | Mermaid (ya usado en `hla`) | SUPUESTO |
| CI | GitHub Actions | SUPUESTO |

### 5.3 Preguntas abiertas para `sdd-explore`

1. ¿Qué significa exactamente "marketplace" aquí: catálogo + instalador, o solo convención sobre npm?
2. ~~¿Se portan los plugins existentes de Claude Code, o se reescriben desde cero?~~ **RESUELTA (2026-08-28): se reescriben desde cero.** El código original no está disponible. Única fuente funcional: `docs/inputs/the-ai-machine-presentacion.md`.
3. ¿Cómo se traduce una "puerta humana" (Aprobar · Refinar · Reiniciar) a las primitivas de Opencode
   (`hooks` de permissions, `subtask`, agentes)?
4. ¿Dónde vive la plantilla corporativa `.docx` y cómo se versiona?
5. ¿El marketplace requiere soporte multi-tenant o basta con una configuración pública única?
6. ¿Qué garantiza la idempotencia de `process-input` (hash de contenido, índice, ambos)?

## 6. Convenciones del proyecto

### Código
- **Sin comentarios en código**, salvo marcadores `TODO(...)` para trabajo pendiente. Sin
  comentarios explicativos, de reformulación ni de "por qué".
- Identificadores, nombres de comandos y de plugins en su forma original (inglés): `machine-business`,
  `process-input`, `render-docx`.

### Artefactos SDD
- Redactados en **español**. Términos técnicos e identificadores en su forma original.
- Specs con `Given/When/Then` y palabras clave RFC 2119 (MUST, SHALL, SHOULD, MAY).
- Todo lo no verificado se marca explícitamente como **SUPUESTO**; lo que falta del cliente, como
  `NEEDS INPUT` (coherente con el principio 4 del producto).

### Persistencia SDD
- Backend: **openspec** (archivos). No hay engram en este entorno.
- Estructura: `openspec/config.yaml`, `openspec/project.md`, `openspec/specs/`,
  `openspec/changes/`, `openspec/changes/archive/`.

## 7. Riesgos identificados en la inicialización

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Todo el stack es supuesto | Alto | Confirmar en `sdd-explore` antes de cualquier `sdd-apply` |
| Opencode no ofrece marketplace nativo | Alto | Decidir modelo de distribución como primer cambio SDD |
| Insumo único y de nivel presentación; el código original NO está disponible y se reescribe desde cero | Alto | Marcar `NEEDS INPUT` en las specs para todo detalle que la presentación no determine; los 7 principios de §4 son el contrato de diseño sustituto |
| Plantilla corporativa `.docx` no disponible | Medio | Marcar `NEEDS INPUT`; bloquea `render-docx` |
| Fase 2 sin definir | Bajo | Explícitamente fuera de alcance |

# Tareas: The AI Machine público para Opencode

**Change:** `ai-machine-opencode`
**Alcance:** fases 1-3 (marketplace mínimo, `machine-core`, `machine-business`).
**Total:** 87 tareas - 34 marketplace, 30 machine-core, 23 machine-business.
**TDD:** 34 tareas `(RED)` y 31 `(GREEN)`; el resto es contenido declarativo o infraestructura.

## Cómo se ejecutan

Las secciones 1 y 2 son **independientes entre sí** y MAY ejecutarse en paralelo.
La sección 3 depende de la 2: `machine-business` consume `state.ts`, `hash.ts` y
`approvals.ts` de `machine-core`, no los reimplementa.

```
1. marketplace  --+
                  |  (independientes)
2. machine-core --+--> 3. machine-business
```

Excepción de coordinación: `1.1.1` crea `pnpm-workspace.yaml` y `3.1.2` añade una entrada
a ese mismo archivo. Si 1 y 3 se ejecutan en sesiones distintas, la segunda MUST leer el
archivo antes de escribirlo.

## TDD

`rules.apply.tdd` está en `true`. Las tareas marcadas `(RED)` escriben un test y lo ven
fallar; las `(GREEN)` lo hacen pasar. El orden RED -> GREEN MUST respetarse: implementar
antes del test invalida la garantía.

El contenido declarativo -`commands/*.md`, `agents/*.md`, plantillas- está **exento**.
No se escriben tests de prompts.

Comandos: `pnpm test` para tests, `pnpm build` para build. Nunca npm, yarn ni bun para lockfiles.

## Bloqueos conocidos

- **Plantilla corporativa DOCX**: resuelto parcialmente. Existe `templates/reference.docx`,
  una plantilla **base neutra** generada por `tools/build-template/build-template.py`, sin marca.
  Sustituirla por la identidad corporativa real sigue siendo `NEEDS INPUT`.
  **Validada con Pandoc 3.10.2**: render real en exit 0 y herencia de estilos comprobada
  (colores, tipografías y `pStyle` de la plantilla presentes en el `.docx` de salida).
  Los scripts Python se gestionan con `uv` (`tools/build-template/pyproject.toml` + `uv.lock`).
- **Estructura fina de `business/proposal.md`** (`NEEDS INPUT`): las tareas `3.2.6` y `3.2.11`
  se quedan en el nivel de detalle que la spec sostiene.
- **Heurística de clasificación** business/discovery: es responsabilidad de `machine-core`
  (`2.2`), no de `machine-business`.

---

## 1. Marketplace: catálogo, manifiestos e instalador

### 1.1 Infraestructura

- [x] 1.1.1 Crear `pnpm-workspace.yaml` (packages/*, cli, tools/build-registry, registry)
- [x] 1.1.2 Crear `registry/schema.json`: schema de `machine.json` (id, version SemVer, commands/agents/skills/templates/dependencies/externalRequirements, permissions) y del catálogo
- [x] 1.1.3 `package.json`/`tsconfig.json` de `cli` y `tools/build-registry`; fixtures `machine.json` en `tools/build-registry/__fixtures__/`

### 1.2 Validación de manifiestos

- [x] 1.2.1 (RED) `machine.json` válido pasa el schema
- [x] 1.2.2 (GREEN) `tools/build-registry/src/validate.ts` (`validateManifest`) vs `registry/schema.json`
- [x] 1.2.3 (RED) Sin `version`/SemVer malformado falla e indica el campo
- [x] 1.2.4 (GREEN) Reportar campo infractor
- [x] 1.2.5 (RED) Comando sin prefijo `machine-` falla
- [x] 1.2.6 (GREEN) Chequeo de prefijo

### 1.3 `build-registry`

- [x] 1.3.1 (RED) Checksum de un paquete: determinista, cambia con el contenido
- [x] 1.3.2 (GREEN) `tools/build-registry/src/checksum.ts` (sha256 sobre archivos del paquete)
- [x] 1.3.3 (RED) Dos paquetes con mismo comando (`machine-render-docx`) fallan `build-registry`
- [x] 1.3.4 (GREEN) Detección de colisión de comandos en `tools/build-registry/src/index.ts`
- [x] 1.3.5 (RED) 3 manifiestos válidos generan `registry/index.json` con 3 entradas y checksum
- [x] 1.3.6 (GREEN) Escanear `packages/*/machine.json`, validar, checksum, escribir `registry/index.json`

### 1.4 CLI: descubrimiento

- [x] 1.4.1 `cli/src/list.ts`, `search.ts`, `info.ts`: contra `registry/index.json`, sin instalar; test `info machine-business` muestra versión/permisos/checksum/requisitos

### 1.5 Merge no destructivo de `opencode.json`

- [x] 1.5.1 (RED) Merge preserva claves ajenas, añade/actualiza `plugin`; aplicado dos veces da resultado idéntico sin duplicar
- [x] 1.5.2 (GREEN) `cli/src/opencode-config.ts` (`mergeOpencodeConfig`, deduplica entradas de `plugin`)

### 1.6 `installed.json`

- [x] 1.6.1 (RED) Registra `id`, `version`, `target`, `files[]` (`path`+`sha256`); leer archivo inexistente devuelve lista vacía sin lanzar
- [x] 1.6.2 (GREEN) `cli/src/installed-registry.ts` (`readInstalledEntries`/`writeInstalledEntry`, maneja ausencia de archivo)

### 1.7 CLI: `install`

- [x] 1.7.1 `cli/src/install.ts`: resuelve paquete/checksum, muestra permisos/checksum/requisitos, pide confirmación
- [x] 1.7.2 (RED) No interactivo sin flag de aceptación: rechaza sin escribir
- [x] 1.7.3 (GREEN) Chequeo de `--yes` antes de escribir
- [x] 1.7.4 (RED) Destino proyecto escribe bajo `.opencode/`; `installed.json` registra cada archivo con checksum
- [x] 1.7.5 (GREEN) Copiar archivos + merge `opencode.json` + escribir `installed.json` por `target`
- [x] 1.7.6 (RED) Reinstalar misma versión: no reescribe, informa "sin cambios"
- [x] 1.7.7 (GREEN) Comparar checksum instalado vs catálogo (idempotencia)

### 1.8 CLI: `update` reversible

- [x] 1.8.1 (RED) Verifica checksum antes de reemplazar; fallo a mitad restaura archivos e `installed.json` previos, versión sigue operativa
- [x] 1.8.2 (GREEN) `cli/src/update.ts`: verificación de checksum previa + backup-then-swap (tmp, aplicar, restaurar ante error)

### 1.9 CLI: `uninstall` acotado

- [x] 1.9.1 (RED) Elimina solo archivos listados en `installed.json` para ese paquete/destino; archivo ajeno del usuario permanece intacto
- [x] 1.9.2 (GREEN) `cli/src/uninstall.ts`: borra solo rutas registradas (nunca directorios completos), remueve entrada

### 1.10 CLI: bootstrap y empaquetado

- [x] 1.10.1 `cli/package.json` (paquete npm `open-ai-machine`, `bin: machine`, vía `pnpm dlx open-ai-machine install <paquete>`); `cli/src/cli.ts` enruta `install|list|search|info|update|uninstall`

### 1.11 CI y validación de repositorio

- [x] 1.11.1 (RED) Falla si existe `package-lock.json`, `yarn.lock` o `bun.lockb`
- [x] 1.11.2 (GREEN) `tools/build-registry/src/check-lockfiles.ts`, invocado en workflow CI junto a `pnpm test`, `build-registry` y validación de instalación con pnpm y Bun

---

## 2. machine-core: núcleo determinista

### 2.1 Infraestructura

- [x] 2.1.1 Crear `packages/machine-core/package.json` y `packages/machine-core/machine.json` (manifiesto: comandos `machine-process-input`, `machine-render-docx`, `machine-approve`, target `plugin`).
- [x] 2.1.2 Crear `packages/machine-core/src/types.ts` con `Gate`, `MachineState`, `InputRecord` (path, sha256, processedAt, route, outputPath) según contratos del design.
- [x] 2.1.3 Configurar script `test` en `packages/machine-core/package.json` invocable vía `pnpm test` (raíz del monorepo).

### 2.2 Estado persistente y hash (RED → GREEN)

- [x] 2.2.1 (RED) Escribir test en `packages/machine-core/src/state.test.ts`: sin `state.json` previo, `readState`/`ensureState` crea `docs/<proyecto>/.machine/state.json` con `inputs: []`, `approvals: {}`, `phase`. Verlo fallar.
- [x] 2.2.2 (GREEN) Implementar `readState`/`ensureState`/`writeState` en `packages/machine-core/src/state.ts`.
- [x] 2.2.3 (RED) Test: `state.json` con JSON inválido → `readState` lanza error accionable y MUST NOT escribir el archivo (comparar mtime/contenido antes/después).
- [x] 2.2.4 (GREEN) Implementar manejo de parseo corrupto en `state.ts` sin sobrescritura.
- [x] 2.2.5 (RED) Test en `packages/machine-core/src/hash.test.ts`: mismo `sha256` ya en `inputs[]` → insumo se omite, `outputPath` no se modifica.
- [x] 2.2.6 (RED) Test: contenido de insumo cambia → hash difiere, se reprocesa, `sha256`/`processedAt` se actualizan.
- [x] 2.2.7 (GREEN) Implementar `computeSha256` e `isProcessed`/`upsertInput` en `packages/machine-core/src/hash.ts`, consumidos desde `state.ts`.
- [x] 2.2.8 (RED) Test: insumo de audio sin transcripción ni proveedor configurado → registro marcado `NEEDS INPUT`, sin contenido inventado.
- [x] 2.2.9 (GREEN) Implementar la rama de audio sin transcripción en el tool `machine_process_input` (`packages/machine-core/src/index.ts`).

### 2.3 Puertas de aprobación (RED → GREEN)

- [x] 2.3.1 (RED) Test en `packages/machine-core/src/approvals.test.ts`: `approvals.proposal = "pending"` → operación protegida (p.ej. render) se rechaza indicando la puerta pendiente, sin generar artefacto.
- [x] 2.3.2 (RED) Test: mismo rechazo simulando `opencode run --auto` (sin bypass por flag de entorno/contexto).
- [x] 2.3.3 (GREEN) Implementar `assertGateApproved(state, gate)` en `packages/machine-core/src/approvals.ts`, invocado por toda operación protegida.
- [x] 2.3.4 (RED) Test: `machine-approve <proyecto> <gate>` sobre puerta `pending` declarada → pasa a `approved` con `at` (timestamp).
- [x] 2.3.5 (RED) Test: `machine-approve` sobre puerta no declarada por ningún paquete instalado → falla, estado sin modificar.
- [x] 2.3.6 (GREEN) Implementar `approveGate` en `approvals.ts` y el tool `machine_approve` en `index.ts`.
- [x] 2.3.7 (RED) Test: `approvals.requirements = "approved"` con aprobaciones aguas abajo generadas → al regenerar el artefacto de requirements, las dependientes vuelven a `pending`.
- [x] 2.3.8 (GREEN) Implementar invalidación aguas abajo vía `dependsOn` en `approvals.ts` (recorrer y resetear gates dependientes).
- [x] 2.3.9 (RED) Test: comando posterior que consume una estimación ya aprobada la lee del estado sin recalcularla (mock del cálculo no invocado).
- [x] 2.3.10 (GREEN) Implementar lectura directa desde `state.approvals`/`inputs` en los tools consumidores, sin recómputo.

### 2.4 Dependencias externas y plugin (RED → GREEN)

- [x] 2.4.1 (RED) Test en `packages/machine-core/src/deps.test.ts`: Pandoc ausente (mock de `which`/spawn) → `machine-render-docx` falla con instrucción de instalación, sin `.docx` generado.
- [x] 2.4.2 (GREEN) Implementar `checkExternalBinary` en `packages/machine-core/src/deps.ts` y su uso en el tool `machine_render_docx`.
- [x] 2.4.3 Implementar `packages/machine-core/src/index.ts`: plugin v1 que exporta `tool: { machine_process_input, machine_approve, machine_render_docx, machine_write_artifact, machine_check_deps }`, todos `machine_*` snake_case.
- [x] 2.4.4 Test de integración `packages/machine-core/src/index.test.ts`: flujo write→pending→approve→render con directorio temporal como `docs/<proyecto>`.

### 2.5 Comandos compartidos (declarativo, sin TDD)

- [x] 2.5.1 Crear `packages/machine-core/commands/machine-process-input.md` invocando `machine_process_input`.
- [x] 2.5.2 Crear `packages/machine-core/commands/machine-render-docx.md` invocando `machine_render_docx`.
- [x] 2.5.3 Crear `packages/machine-core/commands/machine-approve.md` invocando `machine_approve`.
- [x] 2.5.4 Crear `packages/machine-core/templates/README.md` documentando la plantilla DOCX pendiente (**NEEDS INPUT**: archivo `.docx` corporativo no disponible; no crear plantilla inventada).

### 2.6 Correcciones detectadas en verificación

Huecos hallados al verificar 2.1–2.5. No son fallos de ejecución: las tareas originales no
los cubrían porque el design no los listaba.

- [x] 2.6.1 (RED) Test: con la puerta aprobada y Pandoc presente pero SIN `templates/reference.docx`, `machine_render_docx` falla indicando que falta la plantilla y no genera `.docx`
- [x] 2.6.2 (GREEN) Verificar la plantilla en `machine_render_docx` antes de renderizar (`packages/machine-core/src/index.ts`)
- [x] 2.6.3 (RED) Test: `defaultPandocRender` invoca pandoc con `--reference-doc=<plantilla>`
- [x] 2.6.4 (GREEN) Pasar `--reference-doc` en `defaultPandocRender`; la ruta resuelta MUST coincidir con la documentada en `templates/README.md`
- [x] 2.6.5 Crear `packages/machine-core/agents/machine.md` (`mode: subagent`, `permission: { bash: deny }`) y apuntar los tres commands de 2.5 a ese agente en lugar de `build`, cerrando el rodeo de D6

---

## 3. machine-business: pipeline de propuesta de negocio

### 3.1 Infraestructura

- [x] 3.1.1 Crear `packages/machine-business/machine.json` (id, version, commands, agent, `dependsOn: machine-core`)
- [x] 3.1.2 Crear esqueleto: `packages/machine-business/{src,commands,agents}/` y entrada de workspace en `pnpm-workspace.yaml`

### 3.2 Implementación determinista (TDD)

- [x] 3.2.1 (RED) Test: `machine-business-init` crea `inputs/`, `business/`, `.machine/state.json` e índice sobre proyecto inexistente — `packages/machine-business/src/init.test.ts`
- [x] 3.2.2 (GREEN) Implementar `packages/machine-business/src/init.ts` (`machine_business_init`), reutilizando `state.ts` de `machine-core`
- [x] 3.2.3 (RED) Test: `machine-business-init` sobre proyecto con insumos ya cargados no destruye contenido
- [x] 3.2.4 (GREEN) Implementar rama idempotente en `init.ts` (skip si la estructura ya existe)
- [x] 3.2.5 (RED) Test: `machine-business-proposal` falla y no genera `proposal.md` si no hay insumos `route: business` — `packages/machine-business/src/proposal.test.ts`
- [x] 3.2.6 (GREEN) Implementar `packages/machine-business/src/proposal.ts`: valida insumos `route: business` antes de sintetizar
- [x] 3.2.7 (RED) Test: al generar `proposal.md` se fija `approvals.proposal = "pending"` (usa `approvals.ts` de `machine-core`)
- [x] 3.2.8 (GREEN) Implementar fijado de `approvals.proposal = "pending"` al escribir `proposal.md`
- [x] 3.2.9 (RED) Test: regenerar `proposal.md` con `approvals.proposal = "approved"` lo devuelve a `"pending"`
- [x] 3.2.10 (GREEN) Implementar invalidación de la puerta al regenerar, delegando en la invalidación aguas abajo de `machine-core`
- [x] 3.2.11 (RED) Test: sección sin insumos de respaldo (p.ej. mercado) se marca `NEEDS INPUT` en vez de inventar contenido
- [x] 3.2.12 (GREEN) Implementar marcado `NEEDS INPUT` por sección en `proposal.ts`
- [x] 3.2.13 Crear `packages/machine-business/src/index.ts`: registra `machine_business_init` y `machine_business_proposal` en la clave `plugin`

### 3.3 Contenido declarativo (exento de TDD)

- [x] 3.3.1 Escribir `packages/machine-business/commands/machine-business-init.md`
- [x] 3.3.2 Escribir `packages/machine-business/commands/machine-business-proposal.md`, sugiriendo `machine-approve <proyecto> proposal` al finalizar
- [x] 3.3.3 Escribir `packages/machine-business/agents/machine-business.md` con `mode: subagent` y `permission: { bash: deny }`

### 3.4 Testing de integración

- [x] 3.4.1 (RED) Test integración: `machine-render-docx` sobre `business/proposal.md` con `approvals.proposal = "pending"` rechaza y no crea archivo — `packages/machine-business/test/render-gate.integration.test.ts`
- [x] 3.4.2 (GREEN) Verificar que `machine-business` no reimplementa ni bypassea el rechazo de `machine-core`; solo lo consume
- [x] 3.4.3 Test integración: insumo de negocio procesado por `machine-process-input` (de `machine-core`) aterriza bajo `business/` con `route: business` — fixture con HOME simulado en tmp
- [x] 3.4.4 Test integración: el agente `machine-business` con `bash: deny` no puede alcanzar el render fuera del tool `machine_render_docx`
- [x] 3.4.5 Ejecutar `pnpm test` en `packages/machine-business` y verificar cobertura de todos los escenarios de `specs/machine-business/spec.md`

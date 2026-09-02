# Continuar aquí

Estado al cerrar la sesión del **2026-09-02**. Para retomar basta con decir «continúa».

---

## Dónde está el proyecto

Marketplace público de The AI Machine para Opencode v1. Flujo SDD con backend `openspec`.

**Fases 1–3 implementadas y verdes**: plataforma del marketplace, `machine-core` y `machine-business`.
Las 92 tareas de `openspec/changes/ai-machine-opencode/tasks.md` están marcadas.

Todo lo de esta sesión está en `main`, con el árbol limpio.

```
ci: validate a real installation and keep the registry honest
fix(registry): emit the fields the installer needs and propagate runtime
feat(tools): convert inputs to markdown with markitdown
refactor(cli): split flat src into commands, core and tests
fc77e0e refactor: split packages by language into node and py
```

## Entorno

- **Node/TS**: pnpm + Bun. Tests con `pnpm test` desde la raíz.
- **Python**: uv. `pyproject.toml` y `uv.lock` en la raíz. Ejecutar siempre con `uv run`.
- **Pandoc**: vive en el `.venv` del repo (`pypandoc-binary`, versión 3.9). NO está instalado en el
  sistema y no debe estarlo. Si falta: `uv sync`.
- **MarkItDown**: también en el `.venv` (`markitdown[all]`). Es el camino inverso de Pandoc —
  convierte insumos (PDF, Word, PPT, Excel, HTML, CSV) a Markdown vía
  `tools/convert-inputs/convert_inputs.py`. Tests Python con `uv run pytest`.
- Prohibido `package-lock.json`, `yarn.lock`, `bun.lockb`, `pip`, `poetry`, `conda`.

## Convenciones que no se negocian

- **Sin comentarios en el código**, salvo marcadores `TODO(...)`.
- Artefactos SDD en español; identificadores y nombres de comandos/tools en su forma original.
- **TDD obligatorio** en lógica determinista: test primero, verlo fallar, implementar. El contenido
  declarativo (commands, agents, plantillas) está exento.
- Todo archivo que empiece por `posted` es **material privado**: no se versiona ni se publica.
  El insumo del dominio es `docs/inputs/posted.md`, fuera de git.
- **`registry/index.json` se genera, nunca se edita a mano.**

---

## Hecho en esta sesión

### 1. El instalador estaba roto en producción — CORREGIDO

El hallazgo más importante. `build-registry` no emitía `packageDir` ni `files`, y `install` lee
ambos: instalar desde el registry real reventaba con `ERR_INVALID_ARG_TYPE`. **Los 90 tests
pasaban** porque cada lado corría contra sus propios fixtures, que nunca se cruzaban.

Corregido de punta a punta y protegido con `cli/tests/registry-contract.test.ts`, que instala
`machine-core` desde el registry **real** y verifica que cada archivo declarado existe y su
checksum coincide con el disco.

**Lección que conviene no olvidar: las 92 tareas marcadas no garantizaban un contrato
funcionando.** Los fixtures aislados dieron verde sobre un camino que en producción fallaba.
Cuando dos módulos se pasan datos, hace falta un test que cruce la frontera real.

### 2. `runtime` propagado

Cerrados los 5 pasos que quedaban pendientes: schema del manifiesto, entrada del catálogo, ambos
`machine.json` reales y los tipos del CLI, con default `node`.

### 3. `files` del catálogo: criterio

Solo `commands/`, `agents/`, `skills/` y `templates/`. Quedan fuera `machine.json`,
`package.json` y `src/`: son parte del paquete, no del contenido que se copia a `.opencode/`.
El `checksum` sigue cubriendo el paquete entero, que es lo correcto para integridad.

### 4. CI que ya no miente

Instala un paquete de verdad y verifica el ciclo `installed` → `unchanged` → `removed`. Además
falla si `registry/index.json` quedó desfasado; antes el CI lo regeneraba y tiraba el resultado.

Eso exigió ordenar `discoverPackageDirs`: `readdir` es alfabético en NTFS pero por hash en el
ext4 donde corre el CI, así que sin ordenar el check habría fallado de forma intermitente.

**El CLI se ejecuta con Bun, no con Node** (usa `Bun.file`). pnpm queda para las dependencias del
workspace. Por eso la validación del CI es solo con Bun.

### 5. Extracción de documentos — LISTA

`tools/convert-inputs/` convierte insumos a Markdown. Verificado con binarios reales: PDF, DOCX,
XLSX, PPTX, HTML y CSV. Es idempotente por contenido.

**Las imágenes devuelven `empty`**: sin `llm_client`, MarkItDown solo lee metadatos, así que una
foto sin EXIF no aporta nada. Un PDF escaneado cae en lo mismo. La herramienta lo reporta y no
escribe un `.md` vacío.

### 6. Estructura del CLI

`src/commands/` (uno por comando), `src/core/` (infraestructura compartida) y `tests/`.
Dependencias en una sola dirección: `cli.ts` → `commands/` → `core/`.

### 7. README raíz y spec de Discovery

Creado el README raíz con instalación, targets y límites. Escrita
`openspec/changes/ai-machine-opencode/specs/machine-discovery/spec.md`, el artefacto SDD que
faltaba para poder implementar la fase.

---

## Lo que falta de verdad (inventario verificado)

Ordenado por lo que bloquea a lo demás.

### 1. La ingesta de insumos no existe — el hueco más grave

`machine_process_input` recibe `{ content, route, outputPath }` **ya resueltos**
(`packages/node/machine-core/src/index.ts:29`). No lee `docs/<proyecto>/inputs/`, no enumera
archivos, no clasifica `business`/`discovery`, no escribe el `inputs/index.md`.

`tools/convert-inputs` **no cierra esto**: vive en `tools/`, no es un paquete instalable ni lo
invoca el pipeline. Es la pieza de extracción esperando a que exista quien enumere y clasifique.

**Consecuencia**: un usuario todavía no puede soltar archivos en `inputs/` y ejecutar el comando.

### 2. Transcripción de audio

Sin proveedor y sin FFmpeg. El código detecta la extensión y marca `NEEDS INPUT`, así que el
hueco está señalizado pero vacío. Decisión ya tomada en la propuesta: API de proveedor
configurable con override local. **Falta decidir el proveedor y si FFmpeg se vendoriza** como se
hizo con Pandoc.

### 3. La fase Discovery: seis de siete comandos

Ya existe la delta spec, y `packages/node/machine-discovery` tiene implementados con TDD
`machine-discovery-init`, `machine-requirements`, `machine-hla`, `machine-draft-prds`,
`machine-time-estimation` y `machine-planning`, más su agente y su entrada en el catálogo.
Se instala end-to-end.

La cadena de puertas ya está encadenada de punta a punta:
`proposal → requirements → prds → estimation → planning`. Cada artefacto se deriva leyendo el
artefacto de aguas arriba **en disco**, no una lista que pase el agente en paralelo: los PRD se
leen de `discovery/prds/`, y la estimación y el plan parsean la tabla del artefacto anterior.

**Límite conocido del formato**: la estimación y el plan son tablas Markdown, así que un título
de unidad que contenga `|` rompería la fila. Hoy ningún título lo hace y `unitSlug` no lo
permite en el nombre de archivo, pero el título se escribe tal cual.

**El Architecture Gate ya está puesto**: `machine-requirements` exige `approvals.proposal` en
`approved`, y deja `approvals.requirements` en `pending` con `dependsOn: ["proposal"]`, de modo
que re-aprobar la propuesta invalida los requisitos automáticamente vía
`invalidateDownstream` de `machine-core`.

Falta **uno**: `project-doc`. Debe rechazar su ejecución mientras el Architecture Gate no esté
en `approved`; `assertGateApproved(state, "requirements")` de `machine-core` es la pieza a usar,
sin reimplementarla. `machine-hla` ya sirve de plantilla para ese patrón.

`machine-project-doc` es el distinto: en vez de exigir una puerta, consolida y **debe excluir**
los artefactos cuya puerta siga pendiente, así que lee varias en vez de una.

`machine-draft-prds` deriva el nombre de archivo de cada PRD del título de la unidad
(`unitSlug`) y **rechaza dos unidades que colisionen en el mismo archivo** en vez de que una
pise a la otra en silencio. Regenerar borra los borradores de la corrida anterior para no dejar
huérfanos de unidades que ya no existen.

**Deuda abierta en `machine-hla`**: los diagramas se escriben como bloques Mermaid en el
Markdown, que es su fuente de verdad, pero **el pre-render a imagen no existe**. Pandoc no
interpreta Mermaid, así que el `.docx` de un artefacto con diagramas todavía no es correcto. Hay
un `TODO(mermaid)` en `src/hla.ts` y el comando lo advierte al usuario. Cuando se resuelva el
motor, hay que declararlo en `externalRequirements` del manifiesto. Por eso hoy ese campo sigue
vacío: el manifiesto no declara requisitos que el paquete todavía no usa.

`machine.json` declara solo los comandos que existen de verdad. Al añadir cada uno hay que
declararlo ahí y regenerar el catálogo — así el registry nunca promete comandos que no están.

Ojo con el tamaño real: cada comando es un `.md` declarativo **más** un tool determinista en
`src/` con TDD, como en `machine-business`. No son siete archivos, son siete tools con sus tests.

Además arrastra el pre-render de Mermaid a imagen: Pandoc no interpreta Mermaid, así que hace
falta un motor declarado como requisito externo del paquete. Sin resolver.

### 4. Distribución real

`defaultSourceRoot` solo instala desde el clon local: no hay resolución remota con verificación
de checksum ni publicación versionada. El README ya documenta este límite. **Falta decidir dónde
se publica** (GitHub Releases, npm, otro) antes de implementarlo.

### 5. `packages/py` sigue vacío

Solo tiene el README de convención. Es coherente: sus primeros habitantes naturales son la
extracción y la transcripción, o sea los puntos 1 y 2.

### 6. Identidad corporativa del `.docx`

Sigue en `NEEDS INPUT`. La plantilla es neutra y el mecanismo de marca en cascada ya está
documentado en `packages/node/machine-core/templates/README.md`. Depende de que se aporte la marca.

---

## Recomendación para retomar

1. **`machine-ingest`**: abrir el change SDD para ingesta + extracción + transcripción (puntos 1,
   2 y 5, que son el mismo problema desde tres ángulos). Requiere decidir proveedor de
   transcripción y qué hacer con FFmpeg.
2. **Discovery**: implementar contra la spec ya escrita, incremento a incremento, empezando por
   `discovery-init` y el Architecture Gate, que es el requisito distintivo de la fase.
3. **Distribución**: cuando esté decidido dónde se publica.

---

## Límites conocidos ya documentados

Están en `openspec/changes/ai-machine-opencode/design.md` y conviene no redescubrirlos:

- **La puerta humana protege el pipeline, no al usuario.** Nada impide que alguien invoque Pandoc
  desde su propio agente primario con bash. Es garantía de producto, no control de seguridad.
- **La síntesis no es determinista.** El tool recibe las secciones ya redactadas; no puede verificar
  que deriven de los insumos. «No inventar» es mitigación por prompt, no garantía de código. La
  puerta humana es lo que cubre ese hueco, y por eso no es opcional.

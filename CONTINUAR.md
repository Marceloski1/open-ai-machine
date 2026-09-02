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

### 8. Fase Discovery completa

`packages/node/machine-discovery` implementa los **siete** comandos con TDD:
`machine-discovery-init`, `machine-requirements`, `machine-hla`, `machine-draft-prds`,
`machine-time-estimation`, `machine-planning` y `machine-project-doc`. Se instala end-to-end.

**La cadena de puertas está cerrada**: `proposal → requirements → prds → estimation → planning`,
y `project` depende de las cinco. Re-aprobar cualquier eslabón invalida lo que cuelga debajo vía
`invalidateDownstream` de `machine-core`; Discovery no duplica ni una regla de cascada.

**Cada artefacto se deriva del artefacto de aguas arriba leído en disco**, no de una lista que el
agente pase en paralelo: los PRD se leen de `discovery/prds/`, y la estimación y el plan parsean
la tabla del anterior. Referenciar algo que no existe aguas arriba rechaza la operación completa
nombrándolo, en vez de descartar la fila en silencio.

`machine-project-doc` es el único que lee **varias** puertas: consolida solo lo aprobado y deja
constancia de qué aprobación falta, sin incorporar el contenido pendiente.

---

## Lo que falta de verdad (inventario verificado)

Ordenado por lo que bloquea a lo demás.

### 1. La ingesta de insumos no existe — el hueco más grave (change abierto)

**Change `machine-ingest` en `openspec/changes/machine-ingest/`**, con exploración, propuesta y
la delta spec de `machine-core` ya escritas. **Próximo artefacto: `sdd-design`.**

La delta spec (`specs/machine-core/spec.md`) fija ocho requisitos: enumeración recursiva con orden
estable, idempotencia **sobre el insumo original**, conversión reutilizando la extracción
existente, `NEEDS INPUT` para lo no extraíble y para el audio, rechazo de una `route` no
reconocida, índice reproducible desde el estado, y compatibilidad de la firma actual de
`machine_process_input`. No redefine lo que la spec de `machine-core` ya cubre: se apoya en ello.

Hallazgo de la exploración que no estaba en este inventario: **el código ejecutable de un paquete
no se distribuye**. `INSTALLABLE_DIRS` es `["commands", "agents", "skills", "templates"]`, así que
el `src/` no entra en el catálogo, y el instalador **no lee `runtime`**. No se nota porque los
paquetes Node funcionan dentro de este clon, pero significa que un paquete Python no tiene forma
de llegar al usuario. Por eso la propuesta deja la ingesta en `machine-core` y no crea nada en
`packages/py`.


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

### 3. El pre-render de Mermaid sigue sin resolver

`machine-hla` escribe los diagramas como bloques Mermaid en el Markdown, que es su fuente de
verdad, pero **el pre-render a imagen no existe**. Pandoc no interpreta Mermaid, así que el
`.docx` de un artefacto con diagramas todavía no sale correcto. Hay un `TODO(mermaid)` en
`src/hla.ts` y el comando lo advierte al usuario.

Cuando se elija el motor hay que declararlo en `externalRequirements` del manifiesto. Hoy ese
campo sigue vacío a propósito: el manifiesto no declara requisitos que el paquete todavía no usa.

**Límite del formato de tablas**: la estimación y el plan son tablas Markdown, así que un título
de unidad que contuviera `|` rompería la fila. Hoy ninguno lo hace, pero el título se escribe tal
cual.

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

1. **`machine-ingest`**: continuar el change por `sdd-design` y luego `sdd-tasks`. Las cuatro
   primeras fases de la propuesta (enumeración, conversión, clasificación, comando) **no dependen
   de ninguna decisión abierta** y ya se pueden implementar. La transcripción y `packages/py`
   esperan a que se decidan proveedor, FFmpeg y distribución del código ejecutable.
2. **Distribución**: cuando esté decidido dónde se publica.
3. **Mermaid**: elegir el motor de pre-render para que el `.docx` de `hla.md` sea correcto.

---

## Límites conocidos ya documentados

Están en `openspec/changes/ai-machine-opencode/design.md` y conviene no redescubrirlos:

- **La puerta humana protege el pipeline, no al usuario.** Nada impide que alguien invoque Pandoc
  desde su propio agente primario con bash. Es garantía de producto, no control de seguridad.
- **La síntesis no es determinista.** El tool recibe las secciones ya redactadas; no puede verificar
  que deriven de los insumos. «No inventar» es mitigación por prompt, no garantía de código. La
  puerta humana es lo que cubre ese hueco, y por eso no es opcional.

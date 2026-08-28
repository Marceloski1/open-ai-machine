# Continuar aquí

Estado al cerrar la sesión del **2026-08-28**. Para retomar basta con decir «continúa».

---

## Dónde está el proyecto

Marketplace público de The AI Machine para Opencode v1. Flujo SDD con backend `openspec`.

**Fases 1–3 implementadas y verdes**: plataforma del marketplace, `machine-core` y `machine-business`.
Las 92 tareas de `openspec/changes/ai-machine-opencode/tasks.md` están marcadas.

Último commit estable: `ea15dfb`.

```
ea15dfb feat: fill catalog descriptions and let users supply their own branding
2272753 refactor: vendor pandoc into the repo venv instead of the system
b3fcaac feat(marketplace): add registry, build-registry and cli installer
92bf065 feat(machine-business): implement phase 0 pipeline with tdd
e1129ea feat(machine-core): add neutral base docx template with generator
a55d404 fix(machine-core): enforce corporate template and deny bash on commands
73aaf30 feat(machine-core): implement deterministic core with tdd
```

## Entorno

- **Node/TS**: pnpm + Bun. Tests con `pnpm test` desde la raíz.
- **Python**: uv. `pyproject.toml` y `uv.lock` en la raíz. Ejecutar siempre con `uv run`.
- **Pandoc**: vive en el `.venv` del repo (`pypandoc-binary`, versión 3.9). NO está instalado en el
  sistema y no debe estarlo. Si falta: `uv sync`.
- Prohibido `package-lock.json`, `yarn.lock`, `bun.lockb`, `pip`, `poetry`, `conda`.

## Convenciones que no se negocian

- **Sin comentarios en el código**, salvo marcadores `TODO(...)`.
- Artefactos SDD en español; identificadores y nombres de comandos/tools en su forma original.
- **TDD obligatorio** en lógica determinista: test primero, verlo fallar, implementar. El contenido
  declarativo (commands, agents, plantillas) está exento.
- Todo archivo que empiece por `posted` es **material privado**: no se versiona ni se publica.
  El insumo del dominio es `docs/inputs/posted.md`, fuera de git.

---

## Trabajo en vuelo al cerrar

**Todo lo de abajo está commiteado. El árbol queda limpio y `pnpm test` da 90 pasando, 0 fallos.**

### 1. Reestructuración `packages/node` + `packages/py` — CASI COMPLETA

Hecho: `machine-core` y `machine-business` movidos a `packages/node/` con `git mv` (historial
preservado). Rutas actualizadas en `pnpm-workspace.yaml`, `discoverAllPackageDirs` del
build-registry (ya escanea `node/` y `py/`), `repoRoot()` de machine-core, los README y los
artefactos SDD. Creado `packages/py/README.md` con la convención.

Campo `runtime` decidido: **opcional**, `"node" | "python"`, con default implícito `"node"`.
Validador implementado con RED→GREEN (3 tests nuevos, de ahí 87 → 90).

**Falta solo propagarlo por la cadena. Esto es lo primero que hay que hacer al retomar:**

1. Añadir `runtime` a `registry/schema.json` (manifest y catalogEntry, enum opcional).
2. Propagarlo en `tools/build-registry/src/index.ts`: `runtime: manifest.runtime ?? "node"`.
3. Poner `runtime: "node"` explícito en los dos `machine.json` reales.
4. Añadir el campo a `cli/src/types.ts` — el instalador necesita saber el runtime antes de instalar.
5. Regenerar `registry/index.json` con el build-registry real, **nunca a mano**. Ahora mismo está
   desactualizado respecto al código: no rompe los tests, pero no refleja la estructura nueva.

### 2. Determinismo del generador DOCX — COMPLETO

`build-template.py` usa `ZipInfo` con `date_time` fijo. Dos builds dan sha256 idénticos
(`2c41a337...`), y la comprobación quedó como check `[6]` de `verify-template.py`, para que no
pueda perderse en silencio.

Los dos cabos que dejó la paralelización quedaron resueltos: las rutas de ambos scripts apuntan ya
a `packages/node/machine-core/templates/`, y la nota obsoleta sobre Pandoc está corregida.

Ojo con lo que pasó aquí, por si se repite el patrón: el `.docx` regenerado quedó huérfano en la
ruta vieja mientras la migración movía la carpeta, así que durante un rato **el archivo bueno era
el que git veía como no rastreado** y el movido era el viejo. Se resolvió copiando el determinista
a la ubicación nueva.

---

## Lo que falta de verdad (inventario verificado)

Ordenado por lo que bloquea a lo demás.

### 1. La ingesta de insumos no existe — el hueco más grave

`machine_process_input` recibe `{ content, route, outputPath }` **ya resueltos**. No lee
`docs/<proyecto>/inputs/`, no enumera archivos, no clasifica `business`/`discovery`, no escribe el
registro Markdown ni el `inputs/index.md` que la spec menciona.

Lo implementado es el guardián: hashea, decide si ya se procesó y actualiza el estado. Funciona y
está probado. Falta quien enumere y clasifique — y no puede vivir en el prompt si queremos
idempotencia real.

**Consecuencia**: el pipeline es demostrable con argumentos inyectados, pero un usuario no puede
soltar archivos en `inputs/` y ejecutar el comando.

### 2. Extracción de texto de documentos

Un `.docx` o `.pdf` en `inputs/` hoy no se puede leer. Pandoc cubre la salida Markdown→DOCX, no la
entrada. Un PDF escaneado necesitaría además OCR, que es un problema aparte y más caro.

### 3. Transcripción de audio

Hoy solo se detecta la extensión y se marca `NEEDS INPUT`. No hay proveedor, ni motor local, ni
FFmpeg. El audio es el insumo principal de una reunión.

Decisión ya tomada en la propuesta: API de proveedor configurable con override local.

### 4. La fase Discovery entera

Es la otra mitad del producto y no se ha empezado. Nueve comandos: `discovery-init`, `requirements`
con su Architecture Gate, `hla`, `draft-prds`, `time-estimation`, `planning`, `project-doc`. Más el
pre-render de diagramas Mermaid a imagen, otra dependencia externa sin resolver.

### 5. Distribución real

`defaultSourceRoot` solo instala desde el monorepo local. Falta resolución remota con verificación
de checksum, publicación versionada y documentación de instalación. El repo no tiene README raíz.

### 6. Menores

- El workflow de CI tiene un `TODO(cli)` en el paso de validación de instalación. Ya se puede cerrar.
- La identidad corporativa real del `.docx` sigue siendo `NEEDS INPUT`; hoy la plantilla es neutra.

---

## Recomendación para retomar

Los puntos 2 y 3 son **exactamente los paquetes Python** que justifican la reestructuración en
curso: extracción de documentos y transcripción encajan mucho mejor en Python que en Node.

Esas capacidades **no estaban en las specs de las fases 1–3**. No son tareas pendientes, son
funcionalidad nueva. Lo correcto es abrir un change SDD propio —algo como `machine-ingest`— con su
exploración y sus specs, en vez de colgarlo del change actual.

**Orden sugerido:**
1. Cerrar la reestructuración y sus dos cabos sueltos, y commitear.
2. Abrir el change `machine-ingest` para ingesta + extracción + transcripción.
3. Después, Discovery.

---

## Límites conocidos ya documentados

Están en `openspec/changes/ai-machine-opencode/design.md` y conviene no redescubrirlos:

- **La puerta humana protege el pipeline, no al usuario.** Nada impide que alguien invoque Pandoc
  desde su propio agente primario con bash. Es garantía de producto, no control de seguridad.
- **La síntesis no es determinista.** El tool recibe las secciones ya redactadas; no puede verificar
  que deriven de los insumos. «No inventar» es mitigación por prompt, no garantía de código. La
  puerta humana es lo que cubre ese hueco, y por eso no es opcional.

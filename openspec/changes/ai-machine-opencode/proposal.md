# Propuesta: The AI Machine público para Opencode

**Change:** `ai-machine-opencode`  
**Estado:** Propuesta inicial  
**Fecha:** 2026-08-28

## Resumen

Construir un marketplace público para Opencode que distribuya paquetes de The AI Machine. Los paquetes transformarán insumos de reuniones —notas, documentos y, cuando exista una transcripción disponible, audio— en entregables de negocio y de descubrimiento técnico.

El marketplace se diseñará para Opencode v1 estable. Su contenido permanecerá portable para permitir un adaptador futuro a Opencode v2 cuando su API de plugins deje de estar en beta.

## Motivación

Opencode no ofrece un registry ni una unidad instalable que agrupe commands, agents y skills en su versión estable. El hecho verificado que determina toda la arquitectura es este: **en Opencode v1 un paquete npm declarado en la clave `plugin` sólo puede aportar hooks y tools; no puede aportar commands, agents ni skills**. Esos artefactos son archivos que deben aterrizar en `~/.config/opencode/{commands,agents,skills}/` o en `.opencode/*`. La API de transforms que sí permitiría registrarlos programáticamente (`ctx.agent.transform`, `ctx.command.transform`, `ctx.skill.transform`) existe únicamente en Opencode v2, que está en beta y cuya documentación advierte que puede romper.

De ahí que el proyecto deba proporcionar catálogo público, manifiestos de paquete e instalador propio, sin delegar las reglas críticas en prompts no deterministas.

## Alcance

Esta propuesta incluye:

- Un monorepo con paquetes versionados, manifiestos `machine.json` y un registry público generado.
- Un instalador para descubrir, instalar, actualizar y desinstalar paquetes de forma idempotente, con destino seleccionable global o de proyecto.
- Un CLI de bootstrap publicado en el registry npm y ejecutable con `pnpm dlx`, porque el instalador no puede instalarse a sí mismo desde dentro de Opencode.
- Estado persistente por proyecto en `docs/<proyecto>/.machine/state.json`.
- Puertas humanas obligatorias mediante estado de aprobación verificable, en ambas fases.
- La fase `machine-business` completa como primer paquete funcional.
- La fase `machine-discovery` como segundo paquete funcional.
- Renderizado DOCX con dependencias verificadas explícitamente y plantilla corporativa versionada.
- Publicación abierta con validación de paquetes, documentación y versionado SemVer.

Queda fuera de alcance:

- La Fase 2, de implementación automática desde un plan.
- Compatibilidad basada en la API beta de Opencode v2 durante el primer entregable.
- Resolver automáticamente la instalación de binarios externos, como Pandoc, Mermaid CLI, FFmpeg o motores de transcripción.

## Precondición: resuelta

El código fuente de los plugins `machine-business` y `machine-discovery` de Claude Code **no está disponible**. La decisión tomada es **reescribir ambas fases desde cero**.

Consecuencias que las specs MUST asumir:

- La única fuente de verdad funcional es `docs/inputs/the-ai-machine-presentacion.md`, material de presentación, no de implementación.
- No existe paridad verificable con el original. El criterio de aceptación de las fases 3 y 4 es el **cumplimiento de la spec escrita**, no la equivalencia de comportamiento con los plugins de Claude Code.
- Todo detalle no cubierto por la presentación —formato exacto de los artefactos intermedios, umbrales de la fórmula de estimación de 6 componentes, redacción de las 11 secciones del documento de proyecto— se MUST marcar `NEEDS INPUT` en la spec y resolver con el usuario antes de `sdd-apply`. No se MUST inventar.
- Los siete principios transversales de `openspec/project.md` §4 son los invariantes que sustituyen al código original como contrato de diseño.

## Convención de nombres de comandos

Todos los comandos que el marketplace instale en el espacio global MUST llevar el prefijo `machine-`. Los commands globales de Opencode pueden sobrescribir built-ins y colisionan entre paquetes, y el catálogo es público, de modo que un nombre sin prefijo es un defecto de diseño, no una preferencia estética.

Los comandos compartidos por más de una fase —`process-input` y `render-docx`— MUST declararse una sola vez en `machine-core` y ser consumidos por `machine-business` y `machine-discovery`. No se MUST duplicar su definición por paquete.

| Fase | Comandos instalados |
|---|---|
| `machine-core` | `machine-process-input`, `machine-render-docx`, `machine-approve` |
| `machine-business` | `machine-business-init`, `machine-business-proposal` |
| `machine-discovery` | `machine-discovery-init`, `machine-requirements`, `machine-hla`, `machine-draft-prds`, `machine-time-estimation`, `machine-planning`, `machine-project-doc` |

## Fases de entrega

### 1. Plataforma del marketplace

Crear el monorepo, los manifiestos `machine.json`, el schema del registry y el catálogo público `registry/index.json`. Implementar el instalador con los comandos `install`, `list`, `search`, `info`, `update` y `uninstall`.

El instalador MUST permitir elegir destino global (`~/.config/opencode/`) o de proyecto (`.opencode/`), y MUST registrar el destino elegido en `installed.json` para que `update` y `uninstall` operen sobre la misma ubicación. El CLI de bootstrap resuelve el arranque en frío y se invoca con `pnpm dlx machine install <paquete>`.

El monorepo se gestiona con **pnpm workspaces**. El repositorio MUST contener `pnpm-workspace.yaml` y `pnpm-lock.yaml`, y MUST NOT contener `package-lock.json`, `yarn.lock` ni `bun.lockb`.

### 2. Núcleo determinista

Implementar `machine-core` para manejar hashes de insumos, el estado en disco, aprobaciones y comprobaciones de dependencias. Las operaciones críticas MUST ser deterministas y no depender exclusivamente del modelo. `machine-core` alberga además los comandos compartidos, las skills y las plantillas.

### 3. Fase Business

Publicar `machine-business` con `machine-business-init`, `machine-business-proposal` y las puertas de `machine-core`. El paquete MUST crear la estructura estándar, conservar la idempotencia de los insumos y bloquear la exportación DOCX hasta contar con aprobación explícita registrada en `state.approvals.proposal = "approved"`.

### 4. Fase Discovery

Publicar `machine-discovery` con `machine-discovery-init`, `machine-requirements`, `machine-hla`, `machine-draft-prds`, `machine-time-estimation`, `machine-planning` y `machine-project-doc`. Los comandos MUST consumir únicamente los artefactos aprobados aguas arriba y señalar datos faltantes como `NEEDS INPUT`.

Discovery tiene más de una puerta humana. `machine-requirements` MUST cerrar con el **Architecture Gate**: `machine-hla` y todo lo que dependa de él MUST rechazar su ejecución mientras `state.approvals.requirements` no esté en `approved`. `machine-approve` opera sobre cualquier puerta declarada, no sólo sobre la propuesta de negocio.

### 5. Integraciones externas

Incorporar soporte para Pandoc y Mermaid CLI mediante validaciones previas. El render DOCX usará Pandoc con `--reference-doc` sobre la plantilla corporativa. Los diagramas Mermaid del HLA MUST pre-renderizarse a imagen antes de embeberse.

Para audio, el flujo MUST requerir una transcripción disponible o un proveedor configurado; en ausencia de ella, el resultado MUST indicar `NEEDS INPUT`.

### 6. Publicación y calidad

Añadir pruebas, validación de manifiestos y registry, CI, documentación de instalación y publicación versionada. El catálogo público MUST mostrar compatibilidad, checksum, permisos y requisitos externos de cada paquete.

La CI MUST ejecutarse con pnpm, verificar que `pnpm-lock.yaml` está actualizado y validar que los paquetes publicados se instalan correctamente tanto con pnpm como con Bun. Si existe código Python, la CI MUST verificar `uv.lock` del mismo modo.

### 7. Evolución de plataforma

Evaluar un adaptador de Opencode v2 una vez que su API de plugins sea estable. El adaptador MAY registrar los mismos comandos, agents y skills sin modificar el contenido de los paquetes.

## Paquetes y módulos afectados

| Módulo | Responsabilidad |
|---|---|
| `packages/machine-core` | Estado, hashes, aprobaciones, validación de dependencias, comandos compartidos, skills y plantillas |
| `packages/machine-business` | Pipeline de propuesta de negocio |
| `packages/machine-discovery` | Pipeline de descubrimiento y proyecto |
| `registry` | Schema y catálogo público generado |
| `tools/build-registry` | Generación y validación del catálogo |
| `cli` | Instalación, gestión de paquetes y bootstrap vía `pnpm dlx` |

## Decisiones y supuestos

- **SUPUESTO:** Bun y TypeScript ESM serán el runtime y lenguaje de implementación.
- **Gestor de paquetes JS/TS: pnpm.** El monorepo usa pnpm workspaces para instalación, enlaces internos y publicación. El registry de publicación sigue siendo npm (npmjs.com) porque es el que Opencode y el ecosistema resuelven; pnpm es el cliente, no el registry.
  - **Tensión declarada:** Opencode instala los paquetes de su clave `plugin` con **Bun**, cacheados en `~/.cache/opencode/node_modules/`. Eso ocurre en la máquina del usuario final y no es controlable desde este repositorio. La decisión de pnpm aplica al desarrollo, la construcción y la publicación del monorepo; el consumo por parte de Opencode queda como está. Los paquetes publicados MUST ser instalables por cualquiera de los dos clientes, sin depender de features exclusivas de pnpm en tiempo de instalación del consumidor.
- **Gestor de paquetes Python: uv.** Todo componente Python del repositorio —scripts auxiliares, herramientas de transcripción, utilidades de build— MUST declarar dependencias en `pyproject.toml` con `uv.lock`, y ejecutarse con `uv run`. MUST NOT usarse `pip`, `poetry`, `conda` ni `requirements.txt` sueltos. Hoy no existe componente Python; la regla queda fijada para cuando aparezca, previsiblemente en el override local de transcripción.
- **SUPUESTO:** el instalador se distribuirá como CLI y el contenido se instalará como archivos compatibles con Opencode v1.
- El marketplace será público desde su primera versión.
- **Compatibilidad con Claude Code: sí.** Opencode lee `.claude/skills/<name>/SKILL.md` sin modificación alguna, de modo que el mismo paquete sirve a los dos runtimes con coste marginal cercano a cero. El instalador MUST ofrecer `.claude/skills/` como destino adicional.
- Las puertas humanas se implementarán como estado persistente, no como una confirmación conversacional. Así sobreviven a `opencode run --auto`, que auto-aprueba todo permiso no denegado explícitamente.
- **Transcripción de audio:** API de proveedor configurable por portabilidad, con override a motor local. Un motor local exige toolchain que no es portable en Windows. Si el override local se implementa en Python (`faster-whisper` u otro), MUST empaquetarse con `uv` y declararse como requisito externo en `machine.json`.
- **Idioma:** español por defecto, configurable en el `machine.json` del proyecto.
- **Plantilla corporativa DOCX:** vive versionada en `packages/machine-core/templates/`, se distribuye con el paquete y se declara en su `machine.json`. **NEEDS INPUT:** el archivo `.docx` corporativo aún no está disponible en el repositorio; sin él `machine-render-docx` queda bloqueado.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Reescritura desde cero sobre un insumo de nivel presentación: comportamiento inventado donde la fuente calla | Marcar `NEEDS INPUT` en la spec para cada detalle no cubierto y resolverlo con el usuario antes de `sdd-apply`; los siete principios de `project.md` §4 actúan como contrato de diseño |
| Divergencia entre el cliente de desarrollo (pnpm) y el que usa Opencode en el consumidor (Bun) | Publicar paquetes instalables por ambos; no depender de features exclusivas de pnpm en tiempo de instalación del consumidor; validar la instalación con los dos clientes en CI |
| Plantilla corporativa `.docx` no disponible | Marcar `NEEDS INPUT`; `machine-render-docx` falla con instrucción accionable, nunca entrega un DOCX degradado |
| API de plugins v2 inestable | Mantener el instalador desacoplado del contenido portable |
| Aprobaciones omitidas en modo no interactivo | Rechazar operaciones protegidas sin aprobación persistida |
| Dependencias externas ausentes | Verificar antes de ejecutar y mostrar una instrucción accionable |
| Insumos reprocesados | Comparar hashes de contenido en una herramienta determinista |
| Colisión de nombres de comandos globales | Prefijo `machine-` obligatorio y definición única de comandos compartidos en `machine-core` |
| Paquetes inseguros | Mostrar permisos, checksum y requisitos antes de instalar |

## Alternativas descartadas

| Alternativa | Motivo del descarte |
|---|---|
| Paquete npm único sobre Opencode v2 con transforms | La API está en beta y declarada inestable; además un plugin no es un marketplace y se perdería la compatibilidad con Claude Code |
| Directorio curado con instalación manual | No cumple el objetivo de marketplace: sin catálogo legible por máquina, sin versionado ni desinstalación |

## Plan de reversión

Cada instalación MUST registrar los archivos creados, su destino y su checksum en `installed.json`. `uninstall` deberá eliminar únicamente esos archivos registrados, sin modificar artefactos ajenos. Si una actualización falla, el instalador deberá restaurar la versión y el registro previamente instalados.

## Criterio de salida de esta propuesta

La precondición está resuelta: reescritura desde cero. La siguiente etapa debe producir especificaciones y diseño técnico para las fases 1 a 3, priorizando el marketplace mínimo, `machine-core` y `machine-business`.

Al escribir las specs de las fases 3 y 4, cada comportamiento que la presentación no determine MUST quedar como `NEEDS INPUT` explícito en lugar de resolverse por criterio propio.

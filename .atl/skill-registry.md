# Skill Registry — opencode-market-place

Generado por `sdd-init`. El orquestador resuelve rutas desde aquí y las pasa a los sub-agentes como
`SKILL: Load \`{ruta}\` before starting.` Los sub-agentes NO buscan este registro por su cuenta.

Deduplicado por nombre (project-level gana; no hay skills a nivel de proyecto en este repo, así que
todas son user-level de `~/.claude/skills/`). Se omiten `sdd-*`, `_shared` y `skill-registry`.

## Convenciones del proyecto

| Archivo | Ruta | Notas |
|---|---|---|
| CLAUDE.md (global de usuario) | `C:\Users\pendr\.claude\CLAUDE.md` | Orquestación de agentes, workflow SDD, política de "sin comentarios en código", trigger `/graphify` |
| Contexto de proyecto SDD | `C:\1\Visual Code\opencode-market-place\openspec\project.md` | Contexto, stack propuesto y convenciones |
| Config SDD | `C:\1\Visual Code\opencode-market-place\openspec\config.yaml` | Reglas por fase |
| Insumo de producto | `C:\1\Visual Code\opencode-market-place\docs\inputs\the-ai-machine-presentacion.md` | Fuente única del dominio funcional |

**No existen** `AGENTS.md`, `.cursorrules`, `GEMINI.md` ni `copilot-instructions.md` a nivel de proyecto.

## Skills relevantes para este proyecto

| Skill | Ruta | Cuándo usarla |
|---|---|---|
| graphify | `C:\Users\pendr\.claude\skills\graphify\SKILL.md` | Cualquier pregunta sobre el codebase, arquitectura o relaciones entre archivos; trigger `/graphify` |
| ce-commit | `C:\Users\pendr\.claude\skills\ce-commit\SKILL.md` | Crear commits siguiendo conventional commits (lowercase, sin punto final, inglés) |
| react-doctor | `C:\Users\pendr\.claude\skills\react-doctor\SKILL.md` | Solo si el marketplace acaba incluyendo una UI en React (hoy SUPUESTO, no decidido) |
| find-skills | `C:\Users\pendr\.claude\skills\find-skills\SKILL.md` | Descubrir/instalar skills cuando falte capacidad |
| redmine-sync | `C:\Users\pendr\.claude\skills\redmine-sync\SKILL.md` | Registro de horas en Redmine desde ramas git |

## Otras skills disponibles (no relacionadas con el dominio)

Ninguna de las siguientes aplica a `opencode-market-place`; se listan solo para completitud del
registro. Todas viven bajo `C:\Users\pendr\.claude\skills\{nombre}\SKILL.md`.

| Skill | Dominio |
|---|---|
| apify | Ejecutar actors de Apify vía REST API |
| build-tam | Construir listas TAM (Crustdata, Dropleads, PDL) |
| clay-to-deepline | Convertir configuración de tablas Clay a scripts Deepline |
| deepline-ads-audiences | Audiencias de ads B2B (Google/Meta/LinkedIn) |
| deepline-analytics | Analítica de negocio / RevOps sobre semantic layer |
| deepline-engine | Publicar un Deepline Play como máquina de estados |
| deepline-feedback | Enviar feedback/bugs al equipo Deepline |
| deepline-gtm | Prospección, enriquecimiento y outreach GTM |
| deepline-monitors | Feeds de eventos de proveedores (acceso restringido) |
| deepline-plays | Workflows GTM: buscar, enriquecer, puntuar, automatizar |
| deepline-plays-review | Revisión humana de resultados de Plays |
| deepline-pre-research | Descubrimiento de fuentes de datos previo a un job |
| deepline-quickstart | Demo rápida de Deepline |
| find-qualified-titles | Descubrir cargos reales en dominios de empresas del ICP |
| linkedin-profile-optimizer | Optimizar perfil de LinkedIn |
| linkedin-url-lookup | Resolver URLs de perfil de LinkedIn con validación de identidad |
| niche-signal-discovery | Señales first-party Closed Won vs Closed Lost |
| portfolio-prospecting | Empresas de un portafolio de inversor/aceleradora |

## Duplicados detectados (resueltos)

Se prefiere la copia de `~/.claude/skills/`; existen copias equivalentes en otros directorios de
skills del usuario:

- `find-skills`: también en `~/.config/opencode/skills/`, `~/.cursor/skills/`, `~/.copilot/skills/`, `~/.gemini/skills/`
- `react-doctor`: también en `~/.config/opencode/skills/`, `~/.cursor/skills/`, `~/.gemini/skills/`

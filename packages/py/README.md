# packages/py

Convencion de paquetes Python del marketplace. Espejo de `packages/node/`, hoy vacio:
los primeros paquetes Python (transcripcion de audio, conversion de documentos) se
agregaran aqui mas adelante.

## Que va en `node/`

Paquetes TypeScript/Node ejecutados por Bun, instalados como plugins de Opencode
(`packages/node/machine-core`, `packages/node/machine-business`, etc). Cada uno
declara su propio `package.json` y participa del workspace de pnpm.

## Que va en `py/`

Paquetes Python distribuidos por el mismo catalogo (transcripcion de audio, conversion
de documentos y demas). Cada paquete Python vive en su propio directorio
(`packages/py/<nombre>/`) con su `machine.json`, tal como los paquetes Node.

## Requisito para el catalogo y el build-registry

`tools/build-registry` MUST poder descubrir y listar paquetes tanto de `packages/node/*`
como de `packages/py/*` — ningun paquete deja de aparecer en `registry/index.json` por
estar en un lenguaje distinto de Node. El manifiesto `machine.json` de cada paquete
declara su `runtime` (`"node"` o `"python"`) para que el catalogo, y eventualmente el
instalador, sepan que entorno necesita cada paquete antes de instalarlo.

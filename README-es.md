# dsh-plugin-doctor

> Release stamp: `0.4.6` (2026-10-04).

> **Nombre del paquete.** Este proyecto se publica en npm como **`@perrylink/dsh-plugin-doctor`**. El nombre simple `dsh-plugin-doctor` pertenece a otro proyecto no relacionado: no ejecutes `npx dsh-plugin-doctor`; instalarlo no instala este plugin.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-plugin-doctor?metric=downloads&lang=es)](https://dshfind.com/es/plugins/PerryLink/dsh-plugin-doctor?ref=badge)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add @perrylink/dsh-plugin-doctor
```


Un comprobador todo-en-uno de «integridad + salud en tiempo de ejecución» para plugins de dsh. Cero dependencias (usa
solo lo que trae Node ≥22), y una sola ejecución cubre cuatro capas a la vez:
**comprobaciones estáticas de la estructura del paquete (R) → escaneo del contrato Cordis (K) → smoke dinámico en sandbox (D) → validación de los listados de directorio del ecosistema (CC)**.
Cada criterio se remonta a tres líneas de investigación de primera mano fechadas el 2026-09-07: la documentación
y el código fuente de deepseek-harness, los contratos de código de cordiverse/cordis, y un inventario de cada canal
de distribución del espacio de trabajo (texto completo en `SURVEY.md`).


**📖 Base de conocimiento del ecosistema** — datos medidos, no marketing: [guía de desarrollo · datos de selección · criterios de mantenimiento](https://perrylink.github.io/dsh-plugin-guide/).

<!-- star-cta -->
## Instalación (bundle de DSH)

```sh
dsh plugin --profile web add github:PerryLink/dsh-plugin-doctor
```

`dsh-plugin-doctor` declara `dsh.bundle.patch` → `cordis.patch.yml` en package.json, así que también puede instalarse como bundle de DeepSeek Harness:

```powershell
# git channel (latest main)
dsh plugin --profile web add github:PerryLink/dsh-plugin-doctor

# npm channel (released version; always use the scoped full name -- the bare name dsh-plugin-doctor is a different project)
dsh plugin --profile web add @perrylink/dsh-plugin-doctor
```

La línea insertada carga este paquete bajo el contrato estándar de plugins de Cordis: la mitad de host es un módulo ESM normal que exporta `apply(ctx)` (y declara `inject` para los servicios que necesita). El paquete no incluye interfaz de navegador, así que no hay declaración `dsh.client`.

```js
// bundle entry (host half) -- the export contract the patch line loads
export function apply(ctx) {
  // registers the /doctor command and the plugin_doctor read-only check tool
}
```

Desinstalación: `dsh plugin --profile web remove @perrylink/dsh-plugin-doctor` (o borra esa línea del patch del perfil). El uso de la CLI que aparece más abajo no se ve afectado.

## ⭐ 如果它帮到了你

Este plugin forma parte de la [familia de plugins DSH](https://github.com/PerryLink) (más de 40, todos Apache-2.0). Si te resulta útil, **dale una estrella**: no desbloquea nada, pero ayuda a que la siguiente persona lo encuentre antes.

*English:* part of a 95 plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-plugin-doctor?

Un comprobador todo-en-uno de «integridad + salud en tiempo de ejecución» para plugins de dsh. Cero dependencias (usa solo lo que trae Node ≥22), y una sola ejecución cubre cuatro capas a la vez:

![Demostración de terminal de dsh-plugin-doctor: dsh-plugin-doctor — static R+K gate on a sibling plugin repo](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-hero.png)

![Animated terminal demo of dsh-plugin-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-demo.gif)

*La misma ejecución, animada.*

## Comparison

![Gráfico comparativo medido de dsh-plugin-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-evidence.png)

60 candidates → 20 qualifying plugins · scan dated 2026-09-10 (data/rk-scans.json)

## Compatibilidad

| Superficie | Estado |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1` (cero dependencias y deliberadamente agnóstico respecto al host: `package.json` no declara ninguna dependencia `@deepseek-ai/dsh-*` ni ningún rango de peers, así que las comprobaciones `R5`/`R8` de este repositorio se omiten a propósito en vez de pasar — véase `SELF-CHECK.md`; el registro de esta línea está en `CHANGELOG.md` §0.4.6, «host pins move to `0.2.1-alpha.1`», y el smoke de sandbox del grupo D toma su host de `--dsh`, por defecto el suelo de peers `0.1.2-rc.1`) |
| Node | `^22.19.0 \|\| >=24.0.0` |

## Uso

```powershell
node doctor.mjs --repo <plugin-repo-path>       # full run (includes dynamic smoke; needs network + pnpm)
node doctor.mjs --repo <path> --no-smoke        # static + listings only
node doctor.mjs --repo <path> --dsh 0.1.2-rc.1  # smoke host version (defaults to the npm latest released line)
node doctor.mjs --repo <path> --only R,K        # only the two static layers (ASCII aliases recommended)
node doctor.mjs --repo <path> --json report.json
node doctor.mjs --repo <path> --json -          # JSON to stdout (suppresses the human-readable report)
node doctor.mjs --repo <path> --workspace <workspace-root>   # workspace holding the sibling repos (used by the CC group)
node doctor.mjs --repo <path> --allow-degraded  # explicitly accept "the whole group never really ran" (default exit 6)
node doctor.mjs --purge <quarantine-dir>        # clean up quarantine dirs this tool created (doctor-quarantine-* only)
### Mitad anfitriona: `plugin_doctor` / `/doctor` (nuevo en 0.7.1)

Instalado como bundle, el plugin registra las mismas comprobaciones R/K/X como
herramienta de solo lectura y como comando. Dos cosas difieren de la CLI, y
ambas se declaran en la respuesta porque **la mitad anfitriona no tiene código de
salida**: el informe devuelto es todo el mensaje.

| Parámetro | Por defecto | Significado |
|---|---|---|
| `repo` (obligatorio) | — | ruta del repositorio del plugin (necesita `package.json`) |
| `smoke` | `false` | ejecutar además el smoke de sandbox del grupo D (requiere red + pnpm) |
| `host` | `true` | ejecutar el grupo X (contrato del anfitrión); degrada si no se puede leer una instalación de dsh |
| `workspace` | automático | workspace familiar con los repos `dsh-*` hermanos, para CC1–CC5 y K14 |

- **Las ejecuciones degradadas lo dicen.** Cuando un grupo solicitado no llegó a
  ejecutarse de verdad, la respuesta lleva la misma línea `[降级] …` que imprime
  la CLI, nombrando los grupos. Antes de 0.7.1 el renderizador descartaba ese
  hecho, así que una respuesta degradada era indistinguible de una ejecución sin
  nada que hacer.
- **`workspace` se resuelve desde el repositorio, no desde la instalación.** La
  herramienta sube desde el repositorio inspeccionado hasta el directorio más
  cercano con dos o más repos de plugins DSH (`DSH_WORKSPACE` y el parámetro
  explícito tienen prioridad). Resolverlo como `import.meta.dirname/..` —como
  hacía 0.7.0— da `<profile>/node_modules` (o `…/@perrylink`) cuando el paquete
  está instalado como bundle, que no es un workspace: CC1–CC4 informan entonces
  de registros "ausentes en local" que sí existen, y K14 nunca encuentra un
  hermano. Cuando no se localiza ningún workspace, la respuesta lo dice, en vez
  de dejar que esos skips se lean como registros inexistentes.
```

### Formas objetivo y cobertura (nuevo en 0.2.0)

`--repo` puede ser un **árbol de código fuente** o un **directorio de paquete instalado / artefacto tarball descomprimido** (esto último es habitual en `node_modules/<pkg>`). Los criterios cambian según la forma:

| Shape | K group (Cordis contract) | Notes |
|---|---|---|
| Source tree with `src/` | scans `src/**` plus root-level JS (`mode: src`) | complete |
| **No `src/`, `main` points at `lib/`** | **fallback scan of `lib/**` (`mode: lib-fallback`)** | fixed in 0.2.0: the old implementation keyed on "no build script", but published packages **keep** their build script → the fallback never fired, all nine K checks were skipped, and it still exited 0 (false green) |
| Neither `src/` nor `lib/` | all nine skipped (`mode: none`) | **the whole group never really ran → exit code 6**, no more false green |

La cobertura se escribe en `coverage.K` dentro del JSON (`{filesInspected, mode}`) y se resume en `groups.K`.

### Grupos de `--only` y alias ASCII

| Alias | Full group name | Contents |
|---|---|---|
| `R` | static · package structure | R0–R8 |
| `K` | static · Cordis contract scan | K1–K9 |
| `D` | dynamic · sandbox smoke | D0–D3, D9 |
| `CC` | ecosystem · directory listings | CC1–CC5 |

Los alias no distinguen mayúsculas de minúsculas, y los nombres completos en chino siguen funcionando. **Usa los alias en los flujos de trabajo**: si un editor o un script reescribe un nombre de grupo en chino con la codificación equivocada, `--only` no coincide con ningún grupo.

### Contrato de códigos de salida

| Code | Meaning | Introduced |
|---|---|---|
| `0` | no fail/error (warn/skip allowed), and every requested group really ran | 0.1.x |
| `1` | fail/error present (a plugin defect) | 0.1.x |
| `2` | usage error, unknown group, **unknown option** | 0.1.x |
| `3` | infrastructure error (missing npm/pnpm and the like) | **0.2.0** |
| `4` | unsupported host version (the host itself failed to install; **not** a plugin verdict) | **0.2.0** |
| `5` | unstable result (a step timed out or was killed by a signal) | **0.2.0** |
| `6` | **degraded**: a requested group never really ran (e.g. no source files to scan) | **0.2.0** |

**Protección contra los aprobados silenciosos** (dos capas):

1. Si aunque sea un nombre de grupo en `--only` no coincide → inmediatamente `2`. Las versiones 0.1.4 y anteriores «no comprobaban nada + salían con 0» cuando un nombre de grupo venía mal formado, lo que una vez convirtió las puertas de CI de 35 repos en falsos verdes (medido el 2026-09-09: `checks_run=0`, `exit=0`).
2. Desde 0.2.0: **un grupo solicitado cuyas comprobaciones se saltaron todas → `6`**. La implementación antigua solo cubría «no se ejecutó ni una sola comprobación», no «se ejecutó pero se saltó todo» — esto último dejaba que «grupo K con cobertura cero» contara como aprobado. Para aceptarlo explícitamente, usa `--allow-degraded` (el código de salida baja a 0, pero `degraded` sigue sin estar vacío en el JSON).

> ⚠️ Las puertas existentes en 37 repos de la familia **no leen el código de salida** (sus workflows usan `set +e` / `out="$(…)"` / `set -e`) y solo interpretan los prefijos `R0 ` / `K1 ` de stdout y `results[].name` en el JSON. Así que los nuevos códigos de salida de 0.2.0 **no cambian nada para esas canalizaciones**; están pensados para el uso interactivo y para futuros integradores.

- La ejecución de smoke mantiene su `DSH_HOME`/`DSH_AGENTS_HOME` temporales dentro de un sandbox `%TEMP%` creado por ella misma (prefijo `doctor-`, que **no se solapa** con la plantilla `%TEMP%\dsh-*` protegida por el host) y nunca toca el `~/.dsh` real (línea roja 3).
- A `dsh plugin add` se le pasa siempre `--ignore-scripts`: los scripts install/prepare del paquete probado nunca se ejecutan en el host. Un bloqueo de ignored-builds de pnpm se clasifica como `environment` (no cuenta ni como aprobado ni como defecto del plugin).
- El stdout/stderr del subproceso de cada paso se escribe en `%TEMP%\doctor-run-*\logs\`; al final la ejecución **pone en cuarentena en lugar de borrar** (renombra a `%TEMP%\doctor-quarantine-*`), imprime esa ruta al final del informe, y deja la eliminación a `--purge` después de que una persona lo confirme (línea roja 4, la regla de tres etapas).
- Las rutas absolutas que se ven en tiempo de ejecución se convierten en el marcador `<path>` antes de llegar al JSON o al texto renderizado, así que un informe puede commitearse en el repo de otra persona sin activar su puerta de fuga de rutas.

## Colisiones de nombre (importante)

Este repositorio es **`@perrylink/dsh-plugin-doctor`**, y **no es el mismo proyecto** que otras herramientas del ecosistema con el mismo nombre:

- El nombre npm sin ámbito `dsh-plugin-doctor` pertenece a **Xrainsmile/DSH-Plugin-Doctor** (un proyecto distinto, 0.1.1). Así que **nunca ejecutes `npx dsh-plugin-doctor`** — eso ejecuta el paquete de otra persona; usa siempre el nombre completo con ámbito `@perrylink/dsh-plugin-doctor@<exact version>`.
- Diez repos de GitHub llevan `dsh-plugin-doctor` en su nombre (ocho de ellos **exactamente** ese nombre), incluido `zoahdev/dsh-plugin-doctor` (solo en GitHub, nunca publicado en npm).
- El README de `dsh-testkit` enlaza `dsh-plugin-doctor` con el repo de zoahdev; eso no tiene nada que ver con este.

En una línea: **cero dependencias, apto para uso sin conexión (`--only R,K`), y convierte los contratos de Cordis v4 (K1–K9) y cinco listados de directorio del ecosistema (CC1–CC5) en una puerta de CI cuyo veredicto se lee en el código de salida.** (Ninguna afirmación del estilo «el único» — solo que no apareció nada comparable dentro del conjunto de herramientas que realmente se inspeccionó.)

## Catálogo de comprobaciones

| Group | Checks | What the criteria cover |
|---|---|---|
| static · package structure | R0–R8 | base fields; **the activation gate `dsh.bundle.patch` (critical)**; `npm pack --dry-run` tarball contains the entry and the patch; cordis.patch.yml structure; entry `name`/`apply` exports; rescoped dependency policy (bare `cordis` forbidden); engines aligned to `^22.19.0 \|\| >=24.0.0`; prebuild + files allowlist; leftover old-rc peers (the 2026-09-05 dual-baseline lesson) |
| static · Cordis contract | K1–K9 | service access vs `inject` declaration; the ctx live-data serialization red line; timers/listeners not wrapped in `ctx.effect`; Schema containing a function; `apply` return shape (the v4 Effect contract); `inject` service-name seam; **v3 legacy APIs (the 3.x→4.x removal list)**; Config must be a Standard Schema; the `name==='apply'` special case |
| dynamic · sandbox smoke | D0–D3, D9 | `npm pack` → `dsh plugin --profile headless add <tarball>` → assert `dsh.profile.bundles` contains the package name → `--dump-config` layer marker → keyless headless run expected to **exit 1 + `dsh: MISSING_CREDENTIAL`** (= the composition booted as far as a model request; NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError are excluded) → sandbox cleanup |
| ecosystem · directory listings | CC1–CC5 | the certification registry spec v1 five-dimension evidence; adp-list yml fields/enums/descriptions; dsh-catalog entry constraints (install commands forbidden, truncation heuristics); the omdsh `dshWorkshop` activation five values; the dsh-plugin-kit three gates (license / five-language README / the three seam roles, preferring the kit's official CLI) |

## Verified 徽章

Llevar esta insignia significa exactamente una cosa auditable: **el repo ejecuta la puerta estática R+K de dsh-plugin-doctor (16 comprobaciones: R0/R1/R3/R5/R6/R7/R8 + K1–K9) en su propia CI, y esa puerta está en verde en el HEAD actual de la rama por defecto.** **No** es una insignia de certificación: ni Scorecard, ni procedencia, ni smoke de instalación. R2 (integridad del tarball) y R4 (contrato de entrada) leen el `lib/` compilado, y compilar la mayoría de los repos de la familia necesita que `HARNESS_COMMIT` + `gen-aliases` pasen — esas dos están cubiertas por el propio `ci.yml` de cada repo (puerta de desvío de build + smoke de pack) y quedan deliberadamente fuera de esta puerta.

```markdown
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
```

- El registro `data/verified.json` es la única fuente de verdad, y lo actualiza `.github/workflows/verified.yml` a diario y en cada push relevante. Una actualización solo lee la API de GitHub: analiza la configuración de puerta `plugin-doctor.yml` del HEAD de cada repo (que debe fijar `@perrylink/dsh-plugin-doctor@<version>`, usar un argumento `--only` que funcione, y autoverificar que R0/K1 se ejecutaron de verdad), y luego consulta la conclusión de la ejecución del workflow `plugin-doctor` de ese HEAD. **La CI de este repo nunca clona, instala ni ejecuta código de terceros.**
- Aspecto de la insignia: el lenguaje visual sigue las dos insignias más recientes del ecosistema (las mayúsculas monoespaciadas + letter-spacing + marca + degradado de `dsh.directory`, y el bloque de sello de `awesome-dsh-plugin`) — **un segmento izquierdo metálico plata/platino, una marca de verificación de escudo, y mayúsculas monoespaciadas en azul tinta**, con el segmento derecho en un **color de estado sólido según la convención de GitHub** (verde/naranja/rojo/gris) que lleva una palabra de estado en mayúsculas monoespaciadas, y el estado expresado además por un **icono dibujado con trazados** (✓ / ! / ✕ / –) para que siga siendo legible con deficiencia en la visión del color. Radio de esquina de 5px + trazo de 1px; **el trazo es obligatorio** — sin él el segmento izquierdo plateado desaparece sobre un fondo blanco de README.
- Cuatro estados (el texto del valor usa las palabras convencionales de shields / GitHub Actions): `passing` (verde: la ejecución del HEAD tuvo éxito) / `warning` (naranja: el HEAD aún no se ha ejecutado, hay una ejecución todavía en cola, o falta una precondición de la puerta) / `failing` (rojo: la ejecución del HEAD falló, o la configuración de la puerta no se sostiene — incluida una «puerta falsa» cuyo argumento `--only` está doblemente mal codificado) / `no data` (gris: la consulta a la API falló). La insignia es **dinámica**: en cuanto deja de estar en verde se vuelve roja. El alcance preciso de R+K vive en esta sección y en el campo `meaning` del registro, no en el texto de la insignia (la insignia enlaza de vuelta aquí).
- Para unirte: abre un PR contra `data/verified-repos.json` añadiendo `{ "repo": "<owner>/<name>", "package": "<npm package name>" }`, y añade `plugin-doctor.yml` a tu propio repo como se indica abajo; la entrada debe pasar la auditoría anterior.
- El paso de la puerta (el workflow completo vive en el `.github/workflows/plugin-doctor.yml` de cualquier repo de la familia; los nombres de grupo usan los **alias ASCII `R,K`** — admitidos desde 0.1.5, manteniendo el archivo y la línea de comandos en ASCII puro; la cola autoverifica que R0/K1 se ejecutaron de verdad. **Los 37 repos de la familia fijan actualmente `0.1.6`**):

```yaml
      - name: Run dsh-plugin-doctor (static R/K on the committed tree)
        run: |
          set +e
          out="$(npx --yes @perrylink/dsh-plugin-doctor@0.1.6 --repo . --no-smoke --only "R,K" --json /tmp/doctor.json 2>&1)"
          set -e
          printf '%s\n' "$out"
          echo "$out" | grep -q 'R0 ' || { echo "::error::doctor ran no R checks"; exit 1; }
          echo "$out" | grep -q 'K1 ' || { echo "::error::doctor ran no K checks"; exit 1; }
          if [ ! -f /tmp/doctor.json ]; then echo "::error::doctor produced no JSON report"; exit 1; fi
          node -e '
            const r = JSON.parse(require("fs").readFileSync("/tmp/doctor.json", "utf8")).results
            const buildDep = r.filter((x) => /^R[24] /.test(x.name))
            const gated = r.filter((x) => !/^R[24] /.test(x.name))
            const bad = gated.filter((x) => x.status === "fail" || x.status === "error")
            console.log("gated " + gated.length + " checks; build-dependent (reported, not gated): " + (buildDep.map((x) => x.name.split(" ")[0] + "=" + x.status).join(" ") || "none"))
            if (bad.length) { console.error("::error::failing: " + bad.map((x) => x.name).join(" | ")); process.exit(1) }
          '
```

> Por qué la puerta no instala ni compila nada, y por qué este repo no ejecuta la insignia él mismo: las comprobaciones estáticas R/K leen solo el árbol commiteado (no hacen falta dependencias), mientras que `npm run build` falla en un entorno sin los alias del harness, y su prebuild borra el `lib/` commiteado, fabricando un falso rojo. Concentrar las instalaciones de dependencias de terceros en la CI de este repo, por otro lado, sería un riesgo de cadena de suministro. Así que la puerta se ejecuta dentro de la CI de cada repo contra el árbol commiteado, y este repo solo audita y emite la insignia.

## De dónde vienen los criterios (texto completo y URL en SURVEY.md)

- **lado harness**: `docs/user/develop/basic/publish.md`, `apps/cli/src/plugin.ts` (la puerta de activación es el único interruptor),
  `packages/bundle/headless/README.md` (el criterio MISSING_CREDENTIAL), Releases (los cambios de 0.1.2-rc.1 / 0.1.3-alpha.1),
  `@deepseek-ai/dsh-loader-smoke` (el patrón oficial de «DSH_HOME temporal + código de salida esperado»).
- **lado Cordis**: el código fuente de cordiverse/cordis v4 (registry/fiber/reflect/events.ts) + los documentos cordis-primer/tutorial de DSH +
  el diff de los d.ts de v3 `@cordisjs/core@3.10.2` (la lista negra 3.x→4.x).
- **lado ecosistema**: la especificación dsh-plugin-certification spec v1, `entries.mjs`/`check-submission.mjs` de adp-list,
  el smoke en vivo de `validate.mjs`/`deploy.yml` de dsh-catalog, omdsh build-submission, `verify/*` de dsh-plugin-kit.

## Límites conocidos (declarados con honestidad)

- El grupo K es un **escaneo estático heurístico**: K1/K3/K4 se pierden los envoltorios complejos y también pueden dar falsas alarmas — cada hallazgo de nivel warn necesita una mirada humana y nunca condena un plugin automáticamente.
- D3 solo demuestra que «la composición arranca hasta llegar a una petición al modelo»; **no demuestra que los esquemas de las herramientas sean válidos ni que la lógica de negocio sea correcta** (eso requiere una ejecución e2e con clave o un LLM simulado).
- Un bloqueo de `ignored-builds` de pnpm es un problema de receta del entorno: cuando D1 se topa con él, la comprobación degrada a warn e imprime la receta allowBuilds de compat.yml, en línea con el apartado de entorno bloqueado de la especificación de certificación v1, y nunca cuenta como defecto del plugin.
- Los hosts de la línea npm (0.1.2-rc.1) no tienen aplicación de engines/peerDependencies en su packument, así que R6 allí es orientativo.
- Una trampa medida en este entorno: un ancla `$` (sin el flag `m`) no coincide con la posición antes de un `\r` final solitario, así que al analizar texto CRLF hay que dividir por `/\r?\n/` (ya está resuelto internamente — no lo rompas).

## Estructura del repositorio

```
doctor.mjs               CLI entry (group orchestration, exit codes, JSON report)
lib/framework.mjs        check registration/run/verdict/rendering (zero dependencies)
lib/util.mjs             temporary sandbox + subprocess execution (stdout/stderr to disk, avoiding pipe-capture limits)
lib/checks-package.mjs   static · package structure R0–R8
lib/checks-cordis.mjs    static · Cordis contract K1–K9
lib/checks-smoke.mjs     dynamic · sandbox smoke D0–D3, D9
lib/checks-collections.mjs  ecosystem · directory listings CC1–CC5
tests/selftest.mjs       14 real-CLI self-tests (the 7 existing exit-code-contract cases byte-identical, plus 7 new degraded/usage-guard cases)
tests/contract.mjs       31 contract tests (freezing the 5 observables the existing 37-repo CI depends on)
scripts/verify.mjs       verified registry and badge refresh (reads the GitHub API to audit each repo's gate)
scripts/badge.mjs        verified SVG rendering
data/verified-repos.json verified declaring repos
data/verified.json       verified registry (CI-generated)
badges/                  verified badges (CI-generated)
THIRD-PARTY-RK-SCAN.md   third-party plugin static R+K scan result set (public report)
data/rk-scans.json       machine-readable form of that scan
SURVEY.md                the full-channel detection methodology plus every criterion's source
```

## Salud de la publicación

```sh
# one repository, offline (the mode a downstream repo should use in its own CI)
node scripts/check-release-health.mjs --repo . --no-registry

# the whole declared family, from the registry, without checking any of it out
node scripts/check-release-health.mjs --roster data/verified-repos.json
```

Exit codes: `0` healthy, `1` at least one problem, `2` usage error. `--json <path>` writes the
machine-readable report, `--quiet` prints only failures. `.github/workflows/release-health.yml`
runs both modes weekly and uploads the report.

| Pass | Question | Needs network |
|---|---|---|
| LOCKSTEP | does every version carrier in the repo agree with `package.json`? | no |
| PUBLISHED | is the local version the one on the registry? | yes |
| PROVENANCE | which workflow file published it, and is that a current publish file? | yes |
| FILES | does the published tarball still carry `src/`, `lib/` or `dist/`? | yes |

Only two carrier shapes fail the check, because only two are asserted family-wide:
`src/version.ts`'s exported `VERSION`, and a `VERSION` file where one exists. A `SKILL.md`
version difference is reported as a note — most skills version independently.

## Estado

Repositorio oficial: GitHub `PerryLink/dsh-plugin-doctor` (Apache-2.0), npm `@perrylink/dsh-plugin-doctor`.
**Versión actual 0.2.0** (la más reciente en npm antes de 0.2.0 era la 0.1.7); consulta `CHANGELOG.md`. Uso en CI (**usa por favor los alias ASCII**):

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.2.0 --repo . --no-smoke --only "R,K"
```

**37 repos de plugins** ya incluyen `.github/workflows/plugin-doctor.yml` (una puerta estática de solo lectura sobre el árbol commiteado → `--only "R,K"` más la autoverificación de R0/K1, fijada a `@0.1.6`).
La fijación se queda deliberadamente en 0.1.6: 0.2.0 **no cambia en absoluto** los criterios ni la forma de la salida de R/K (`tests/contract.mjs` lo congela como aserción), así que subir la fijación es una oleada aparte y no una precondición de esta versión.

> Todos los cambios de 0.2.0 son **aditivos** (campos nuevos / opciones nuevas / códigos de salida nuevos); los criterios para los 37 repos existentes no cambian, verificado contra la línea base de 37 repos con **diffs = 0**.

### Conjuntos de resultados públicos

- [`THIRD-PARTY-RK-SCAN.md`](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/THIRD-PARTY-RK-SCAN.md) — el primer escaneo estático R+K de plugins dsh **de terceros** (ajenos a PerryLink): 60 candidatos → 20 plugins que realmente declaran `dsh.bundle.patch` → bajo la puerta de 16 comprobaciones, **10 aprobados / 10 suspensos**. Método: clones de solo lectura, **cero ejecución** de código de terceros, R2/R4 listados aparte y no sujetos a la puerta; incluye los comandos de reproducción, una corrección a la metodología de este mismo escaneo, y un **canal de corrección para cualquier repo mencionado en él**. Forma legible por máquina: `data/rk-scans.json`.
  **No es una certificación, ni una calificación, y no dice nada sobre la seguridad de un plugin**: un aprobado solo significa que «las 16 comprobaciones estáticas no reportaron ningún fallo en ese commit».

## PerryLink DSH Plugin Family

Este proyecto es uno de los **87 plugins activamente mantenidos** de DeepSeek Harness de [PerryLink](https://github.com/PerryLink). El registro familiar tiene **95** plugins — **5 congelados**, **3 retirados** — y permanece plegado abajo para que cada README conserve una primera pantalla corta. Expándelo para ver cada fila, con el motivo en la columna Estado.

<details>
<summary>Expandir los 95 plugins</summary>

| Plugin | Una línea | Estado |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRADO — ver el README del repositorio |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 CONGELADO — ver el README del repositorio |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRADO — ver el README del repositorio |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRADO — ver el README del repositorio |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>
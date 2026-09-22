# dsh-plugin-doctor

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

Un comprobador todo-en-uno de «integridad + salud en tiempo de ejecución» para plugins de dsh. Cero dependencias (usa
solo lo que trae Node ≥22), y una sola ejecución cubre cuatro capas a la vez:
**comprobaciones estáticas de la estructura del paquete (R) → escaneo del contrato Cordis (K) → smoke dinámico en sandbox (D) → validación de los listados de directorio del ecosistema (CC)**.
Cada criterio se remonta a tres líneas de investigación de primera mano fechadas el 2026-09-07: la documentación
y el código fuente de deepseek-harness, los contratos de código de cordiverse/cordis, y un inventario de cada canal
de distribución del espacio de trabajo (texto completo en `SURVEY.md`).

## Instalación (bundle de DSH)

`dsh-plugin-doctor` declara `dsh.bundle.patch` → `cordis.patch.yml` en package.json, así que también puede instalarse como bundle de DeepSeek Harness:

```powershell
# git channel (latest main)
dsh plugin --profile web add "github:PerryLink/dsh-plugin-doctor#main"

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

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Unified session + workspace + config checkpoints with one-shot `/rewind` | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code, Codex, OpenCode and Hermes sessions, memories and skills into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Deterministic dataset profiling, cleaning and citation verification | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics: load, spill, compaction and cache hit rate | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Chinese mutual-fund research with sealed, traceable source snapshots | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issue/CI integration with every write approval-gated | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry and company research pack: chain map, policy timeline, company cards | |
| **[dsh-kit](https://github.com/PerryLink/dsh-kit)** | One-command starter pack that installs the core family | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base with hybrid search and citation-aware injection | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local Ollama model discovery and task-based routing with cloud fallback | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions, symbols and rename | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking at the model boundary with a host-side restore table | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | MCP management console: `/mcp` command, Settings tab and trial calls | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory protocol (`ctx.memory` + SQLite) | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse telemetry export from the session event stream | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Runtime-switchable model output styles | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Declarative allow/deny/ask rules plus a process-level network policy | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-dev knowledge base, agent skill and the `dsh-plugin-dev` CLI toolchain | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-portal](https://github.com/PerryLink/dsh-plugin-portal)** | Zero-dependency static portal rendering the whole plugin family as one page | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat, Telegram, Feishu + a session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research reports: evidence ledger, manifest seal, per-claim verdicts | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional plugin quality scoring with an evidence-backed leaderboard | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions and workspaces in the Web sidebar with per-pin colors | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Git-backed cross-device session synchronization with keep-both merges | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack plus the `plugin_vet` supply-chain gate | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop: speech-to-text input and text-to-speech replies | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives with a pass/fail matrix | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel plus eleven agent tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |

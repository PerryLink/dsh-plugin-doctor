# dsh-plugin-doctor

> Release stamp: `0.4.6` (2026-10-04).

> **Nome do pacote.** Este projeto é publicado no npm como **`@perrylink/dsh-plugin-doctor`**. O nome simples `dsh-plugin-doctor` pertence a outro projeto não relacionado — nunca execute `npx dsh-plugin-doctor`; instalá-lo não instala este plugin.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-plugin-doctor?metric=downloads&lang=pt)](https://dshfind.com/pt/plugins/PerryLink/dsh-plugin-doctor?ref=badge)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add @perrylink/dsh-plugin-doctor
```


Um verificador tudo-em-um de "integridade + saúde em tempo de execução" para plugins dsh. Zero dependências (usa
apenas o que o Node ≥22 traz) e uma execução cobre quatro camadas de uma vez:
**verificações estáticas da estrutura do pacote (R) → varredura do contrato Cordis (K) → smoke dinâmico em sandbox (D) → validação das listagens de diretório do ecossistema (CC)**.
Todo critério remonta a três trilhas de pesquisa de primeira mão datadas de 2026-09-07: a documentação e o
código-fonte do deepseek-harness, os contratos de código do cordiverse/cordis, e um inventário de todo
canal de distribuição no workspace (texto completo em `SURVEY.md`).


**📖 Base de conhecimento do ecossistema** — dados medidos, não marketing: [guia de desenvolvimento · dados de seleção · critérios de manutenção](https://perrylink.github.io/dsh-plugin-guide/).

<!-- star-cta -->
## Instalação (bundle do DSH)

```sh
dsh plugin --profile web add github:PerryLink/dsh-plugin-doctor
```

`dsh-plugin-doctor` declara `dsh.bundle.patch` → `cordis.patch.yml` no package.json, então ele também pode ser instalado como um bundle do DeepSeek Harness:

```powershell
# canal git (main mais recente)
dsh plugin --profile web add github:PerryLink/dsh-plugin-doctor

# canal npm (versão publicada; use sempre o nome completo com escopo -- o nome puro dsh-plugin-doctor é outro projeto)
dsh plugin --profile web add @perrylink/dsh-plugin-doctor
```

A linha inserida carrega este pacote sob o contrato padrão de plugin Cordis: a metade host é um módulo ESM simples que exporta `apply(ctx)` (declarando `inject` para os serviços de que precisa). O pacote não traz nenhuma UI de navegador, portanto não há declaração `dsh.client`.

```js
// bundle entry (host half) -- the export contract the patch line loads
export function apply(ctx) {
  // registers the /doctor command and the plugin_doctor read-only check tool
}
```

Desinstalação: `dsh plugin --profile web remove @perrylink/dsh-plugin-doctor` (ou apague essa linha do patch do profile). O uso da CLI abaixo não é afetado.

## ⭐ 如果它帮到了你

Este plugin faz parte da [família de plugins DSH](https://github.com/PerryLink) (mais de 40, todos Apache-2.0). Se for útil, **deixe uma estrela**: não desbloqueia nada, mas ajuda a próxima pessoa a encontrá-lo.

*English:* part of a 95 plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-plugin-doctor?

Um verificador tudo-em-um de "integridade + saúde em tempo de execução" para plugins dsh. Zero dependências (usa apenas o que o Node ≥22 traz) e uma execução cobre quatro camadas de uma vez:

![Demonstração de terminal do dsh-plugin-doctor: dsh-plugin-doctor — static R+K gate on a sibling plugin repo](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-hero.png)

![Animated terminal demo of dsh-plugin-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-demo.gif)

*A mesma execução, animada.*

## Comparison

![Gráfico comparativo medido do dsh-plugin-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-evidence.png)

60 candidates → 20 qualifying plugins · scan dated 2026-09-10 (data/rk-scans.json)

## Compatibilidade

| Aspeto | Estado |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1` (zero dependências e deliberadamente agnóstico em relação ao host: o `package.json` não declara nenhuma dependência `@deepseek-ai/dsh-*` nem qualquer faixa de peers, então as verificações `R5`/`R8` deste repositório são skip por decisão, e não pass — ver `SELF-CHECK.md`; o registro desta linha está em `CHANGELOG.md` §0.4.6, "host pins move to `0.2.1-alpha.1`", e o smoke de sandbox do grupo D escolhe o host com `--dsh`, por padrão o piso de peers `0.1.2-rc.1`) |
| Node | `^22.19.0 \|\| >=24.0.0` |

## Uso

```powershell
node doctor.mjs --repo <plugin-repo-path>       # execução completa (inclui o smoke dinâmico; precisa de rede + pnpm)
node doctor.mjs --repo <path> --no-smoke        # somente estático + listagens
node doctor.mjs --repo <path> --dsh 0.1.2-rc.1  # versão do host para o smoke (padrão: a linha publicada mais recente no npm)
node doctor.mjs --repo <path> --only R,K        # somente as duas camadas estáticas (aliases ASCII recomendados)
node doctor.mjs --repo <path> --json report.json
node doctor.mjs --repo <path> --json -          # JSON para stdout (suprime o relatório legível por humanos)
node doctor.mjs --repo <path> --workspace <workspace-root>   # workspace que contém os repositórios irmãos (usado pelo grupo CC)
node doctor.mjs --repo <path> --allow-degraded  # aceita explicitamente "o grupo inteiro nunca chegou a rodar" (saída padrão 6)
node doctor.mjs --purge <quarantine-dir>        # limpa os diretórios de quarentena criados por esta ferramenta (somente doctor-quarantine-*)
### Metade anfitriã: `plugin_doctor` / `/doctor` (novo em 0.7.1)

Instalado como bundle, o plugin registra as mesmas verificações R/K/X como
ferramenta somente leitura e como comando. Duas coisas diferem da CLI, e ambas
são declaradas na resposta porque **a metade anfitriã não tem código de saída**:
o relatório devolvido é toda a mensagem.

| Parâmetro | Padrão | Significado |
|---|---|---|
| `repo` (obrigatório) | — | caminho do repositório do plugin (precisa de `package.json`) |
| `smoke` | `false` | executar também o smoke de sandbox do grupo D (requer rede + pnpm) |
| `host` | `true` | executar o grupo X (contrato do anfitrião); degrada quando não há instalação dsh legível |
| `workspace` | automático | workspace da família com os repositórios `dsh-*` irmãos, para CC1–CC5 e K14 |

- **Execuções degradadas dizem isso.** Quando um grupo solicitado não chegou a
  rodar de verdade, a resposta traz a mesma linha `[降级] …` que a CLI imprime,
  nomeando os grupos. Antes de 0.7.1 o renderizador descartava esse fato, então
  uma resposta degradada era indistinguível de uma execução sem nada a fazer.
- **`workspace` é resolvido a partir do repositório, não da instalação.** A
  ferramenta sobe do repositório inspecionado até o diretório mais próximo com
  dois ou mais repositórios de plugin DSH (`DSH_WORKSPACE` e o parâmetro
  explícito têm prioridade). Resolvê-lo como `import.meta.dirname/..` — como a
  0.7.0 fazia — resulta em `<profile>/node_modules` (ou `…/@perrylink`) quando o
  pacote está instalado como bundle, o que não é um workspace: CC1–CC4 passam a
  informar registros "ausentes localmente" que existem, e o K14 nunca encontra um
  irmão. Quando nenhum workspace é localizado, a resposta diz isso, em vez de
  deixar esses skips soarem como registros inexistentes.
```

### Formatos de alvo e cobertura (novo na 0.2.0)

`--repo` pode ser uma **árvore de código-fonte** ou um **diretório de pacote instalado / artefato de tarball descompactado** (este último é comum em `node_modules/<pkg>`). Os critérios mudam conforme o formato:

| Formato | Grupo K (contrato Cordis) | Observações |
|---|---|---|
| Árvore de código-fonte com `src/` | varre `src/**` mais o JS na raiz (`mode: src`) | completa |
| **Sem `src/`, com `main` apontando para `lib/`** | **varredura de fallback de `lib/**` (`mode: lib-fallback`)** | corrigido na 0.2.0: a implementação antiga se baseava em "não há script de build", mas os pacotes publicados **mantêm** seu script de build → o fallback nunca disparava, as nove verificações K eram puladas, e ainda assim a execução saía com 0 (falso verde) |
| Nem `src/` nem `lib/` | todas as nove puladas (`mode: none`) | **o grupo inteiro nunca chegou a rodar → código de saída 6**, chega de falso verde |

A cobertura é gravada em `coverage.K` no JSON (`{filesInspected, mode}`) e resumida em `groups.K`.

### Grupos de `--only` e aliases ASCII

| Alias | Nome completo do grupo | Conteúdo |
|---|---|---|
| `R` | estático · estrutura do pacote | R0–R8 |
| `K` | estático · varredura do contrato Cordis | K1–K9 |
| `D` | dinâmico · smoke em sandbox | D0–D3, D9 |
| `CC` | ecossistema · listagens de diretório | CC1–CC5 |

Os aliases não diferenciam maiúsculas de minúsculas, e os nomes completos em chinês ainda funcionam. **Use os aliases nos workflows**: se um editor ou script fizer ida e volta de um nome de grupo em chinês com a codificação errada, `--only` não casa com grupo nenhum.

### Contrato de códigos de saída

| Código | Significado | Introduzido em |
|---|---|---|
| `0` | sem fail/error (warn/skip permitidos), e todo grupo solicitado realmente rodou | 0.1.x |
| `1` | há fail/error (um defeito do plugin) | 0.1.x |
| `2` | erro de uso, grupo desconhecido, **opção desconhecida** | 0.1.x |
| `3` | erro de infraestrutura (npm/pnpm ausente e afins) | **0.2.0** |
| `4` | versão de host não suportada (o próprio host falhou ao instalar; **não** é um veredito sobre o plugin) | **0.2.0** |
| `5` | resultado instável (uma etapa expirou ou foi morta por um sinal) | **0.2.0** |
| `6` | **degradado**: um grupo solicitado nunca chegou a rodar de fato (ex.: nenhum arquivo-fonte para varrer) | **0.2.0** |

**Proteção contra aprovações silenciosas** (duas camadas):

1. Se ao menos um nome de grupo em `--only` não casar → imediatamente `2`. As versões 0.1.4 e anteriores faziam "não verificar nada + sair com 0" quando um nome de grupo era corrompido, o que uma vez transformou os gates de CI de 35 repositórios em falso verde (medido em 2026-09-09: `checks_run=0`, `exit=0`).
2. A partir da 0.2.0: **um grupo solicitado cujas verificações foram todas puladas → `6`**. A implementação antiga cobria apenas "nenhuma verificação rodou", não "rodou mas tudo foi pulado" — este último deixava "grupo K com cobertura zero" contar como aprovação. Para aceitar isso explicitamente, use `--allow-degraded` (o código de saída cai para 0, mas `degraded` continua não vazio no JSON).

> ⚠️ Os gates existentes em 37 repositórios da família **não leem o código de saída** (seus workflows usam `set +e` / `out="$(…)"` / `set -e`) e apenas interpretam os prefixos `R0 ` / `K1 ` no stdout e `results[].name` no JSON. Então os novos códigos de saída da 0.2.0 **não mudam nada para esses pipelines**; eles servem ao uso interativo e a integradores futuros.

- A execução de smoke mantém seus `DSH_HOME`/`DSH_AGENTS_HOME` temporários dentro de um sandbox `%TEMP%` criado por ela mesma (prefixo `doctor-`, que **não se sobrepõe** ao template `%TEMP%\dsh-*` protegido pelo host) e nunca toca o `~/.dsh` real (linha vermelha 3).
- `dsh plugin add` sempre recebe `--ignore-scripts`: os scripts install/prepare do pacote testado nunca são executados no host. Um bloqueio ignored-builds do pnpm é classificado como `environment` (não conta nem como aprovação nem como defeito do plugin).
- O stdout/stderr do subprocesso de cada etapa é gravado em `%TEMP%\doctor-run-*\logs\`; no final a execução **coloca em quarentena em vez de apagar** (renomeia para `%TEMP%\doctor-quarantine-*`), imprime esse caminho no fim do relatório, e deixa a remoção para o `--purge` depois que um humano confirma (linha vermelha 4, a regra de três estágios).
- Caminhos absolutos vistos em tempo de execução viram o placeholder `<path>` antes de chegarem ao JSON ou ao texto renderizado, então um relatório pode ser commitado no repositório de outra pessoa sem disparar o gate de vazamento de caminhos dela.

## Colisões de nome (importante)

Este repositório é **`@perrylink/dsh-plugin-doctor`**, e **não é o mesmo projeto** que outras ferramentas de mesmo nome no ecossistema:

- O nome npm puro `dsh-plugin-doctor` pertence a **Xrainsmile/DSH-Plugin-Doctor** (um projeto diferente, 0.1.1). Então **nunca rode `npx dsh-plugin-doctor`** — isso executa o pacote de outra pessoa; use sempre o nome completo com escopo `@perrylink/dsh-plugin-doctor@<exact version>`.
- Dez repositórios do GitHub carregam `dsh-plugin-doctor` no nome (oito deles **exatamente** esse nome), incluindo `zoahdev/dsh-plugin-doctor` (só no GitHub, nunca publicado no npm).
- O README do `dsh-testkit` aponta `dsh-plugin-doctor` para o repositório zoahdev; isso não tem nada a ver com este aqui.

Em uma linha: **zero dependências, funciona offline (`--only R,K`), e transforma os contratos do Cordis v4 (K1–K9) e cinco listagens de diretório do ecossistema (CC1–CC5) em um gate de CI cujo veredito se lê pelo código de saída.** (Nada de alegação no estilo "o único" — apenas que nada comparável apareceu no conjunto de ferramentas efetivamente pesquisado.)

## Catálogo de verificações

| Grupo | Verificações | O que os critérios cobrem |
|---|---|---|
| estático · estrutura do pacote | R0–R8 | campos base; **o gate de ativação `dsh.bundle.patch` (crítico)**; o tarball de `npm pack --dry-run` contém a entrada e o patch; estrutura do cordis.patch.yml; exports `name`/`apply` da entrada; política de dependências com escopo redefinido (`cordis` puro proibido); engines alinhados a `^22.19.0 \|\| >=24.0.0`; prebuild + allowlist de files; peers antigos de rc deixados para trás (a lição da dupla linha de base de 2026-09-05) |
| estático · contrato Cordis | K1–K9 | acesso a serviço vs declaração de `inject`; a linha vermelha da serialização de dados vivos do ctx; timers/listeners não envolvidos em `ctx.effect`; Schema contendo uma função; formato de retorno de `apply` (o contrato Effect do v4); costura de nome de serviço do `inject`; **APIs legadas v3 (a lista de remoção 3.x→4.x)**; Config precisa ser um Standard Schema; o caso especial `name==='apply'` |
| dinâmico · smoke em sandbox | D0–D3, D9 | `npm pack` → `dsh plugin --profile headless add <tarball>` → assegurar que `dsh.profile.bundles` contém o nome do pacote → marcador de camada do `--dump-config` → execução headless sem chave que deve **sair com 1 + `dsh: MISSING_CREDENTIAL`** (= a composição subiu até uma requisição de modelo; NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError são excluídos) → limpeza do sandbox |
| ecossistema · listagens de diretório | CC1–CC5 | as evidências de cinco dimensões da spec v1 do registro de certificação; campos/enums/descrições do yml do adp-list; restrições de entrada do dsh-catalog (comandos de instalação proibidos, heurísticas de truncamento); os cinco valores de ativação do `dshWorkshop` do omdsh; os três gates do dsh-plugin-kit (licença / README em cinco idiomas / os três papéis de costura, preferindo a CLI oficial do kit) |

## Verified 徽章

Usar este selo significa exatamente uma coisa auditável: **o repositório roda o gate estático R+K do dsh-plugin-doctor (16 verificações: R0/R1/R3/R5/R6/R7/R8 + K1–K9) na própria CI, e esse gate está verde no HEAD atual do branch padrão.** Ele **não** é um selo de certificação: sem Scorecard, sem proveniência, sem smoke de instalação. R2 (integridade do tarball) e R4 (contrato de entrada) leem o `lib/` compilado, e compilar a maioria dos repositórios da família exige que `HARNESS_COMMIT` + `gen-aliases` passem — esses dois são cobertos pelo `ci.yml` de cada repositório (gate de build-drift + pack smoke) e ficam deliberadamente fora deste gate.

```markdown
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
```

- O registro `data/verified.json` é a única fonte de verdade, atualizado por `.github/workflows/verified.yml` diariamente e a cada push relevante. Uma atualização apenas lê a API do GitHub: ela interpreta a configuração do gate `plugin-doctor.yml` no HEAD de cada repositório (que deve fixar `@perrylink/dsh-plugin-doctor@<version>`, usar um argumento `--only` que funcione, e auto-verificar que R0/K1 realmente rodaram), depois confere a conclusão da execução do workflow `plugin-doctor` daquele HEAD. **A CI deste repositório nunca clona, instala ou executa código de terceiros.**
- Aparência do selo: a linguagem visual segue os dois selos mais novos do ecossistema (o monoespaçado em maiúsculas + letter-spacing + marca + gradiente do `dsh.directory`, e o bloco de selo do `awesome-dsh-plugin`) — **um segmento esquerdo metálico prata/platina, uma marca de check em escudo, e maiúsculas monoespaçadas em azul-tinta**, com o segmento direito numa **cor de status sólida da convenção do GitHub** (verde/laranja/vermelho/cinza) trazendo uma palavra de status em monoespaçado maiúsculo, e o status ainda expresso por um **ícone desenhado em path** (✓ / ! / ✕ / –) para continuar legível com deficiência de visão de cores. Raio de canto de 5px + traço de 1px; **o traço é obrigatório** — sem ele o segmento esquerdo prata some contra um fundo de README branco.
- Quatro estados (o texto do valor usa as palavras convencionais do shields / GitHub Actions): `passing` (verde: a execução do HEAD teve sucesso) / `warning` (laranja: o HEAD ainda não rodou, uma execução ainda está na fila, ou falta uma precondição do gate) / `failing` (vermelho: a execução do HEAD falhou, ou a configuração do gate não se sustenta — incluindo um "gate falso" cujo argumento `--only` está duplamente mal codificado) / `no data` (cinza: a consulta à API falhou). O selo é **dinâmico**: assim que deixa de passar ele fica vermelho. O escopo exato de R+K vive nesta seção e no campo `meaning` do registro, não no texto do selo (o selo aponta de volta para cá).
- Para entrar: abra um PR contra `data/verified-repos.json` adicionando `{ "repo": "<owner>/<name>", "package": "<npm package name>" }`, e adicione `plugin-doctor.yml` ao seu próprio repositório como abaixo; a entrada precisa passar pela auditoria acima.
- A etapa do gate (o workflow completo vive no `.github/workflows/plugin-doctor.yml` de qualquer repositório da família; os nomes de grupo usam os **aliases ASCII `R,K`** — suportados desde a 0.1.5, mantendo arquivo e linha de comando em ASCII puro; o final auto-verifica que R0/K1 realmente rodaram. **Os 37 repositórios da família hoje fixam `0.1.6`**):

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

> Por que o gate não instala nem compila nada, e por que este repositório não roda o próprio selo: as verificações estáticas R/K leem apenas a árvore commitada (nenhuma dependência necessária), enquanto `npm run build` falha em um ambiente sem os aliases do harness, e seu prebuild apaga o `lib/` commitado, fabricando um vermelho falso. Concentrar instalações de dependências de terceiros na CI deste repositório, por outro lado, seria um risco de cadeia de suprimentos. Então o gate roda dentro da CI de cada repositório contra a árvore commitada, e este repositório apenas audita e emite o selo.

## De onde vêm os critérios (texto completo e URLs em SURVEY.md)

- **lado do harness**: `docs/user/develop/basic/publish.md`, `apps/cli/src/plugin.ts` (o gate de ativação é o único interruptor),
  `packages/bundle/headless/README.md` (o critério MISSING_CREDENTIAL), Releases (as mudanças da 0.1.2-rc.1 / 0.1.3-alpha.1),
  `@deepseek-ai/dsh-loader-smoke` (o padrão oficial de "DSH_HOME temporário + código de saída esperado").
- **lado do Cordis**: o código-fonte do cordiverse/cordis v4 (registry/fiber/reflect/events.ts) + os docs cordis-primer/tutorial do DSH +
  o diff de d.ts do v3 `@cordisjs/core@3.10.2` (a lista de bloqueio 3.x→4.x).
- **lado do ecossistema**: a spec v1 do dsh-plugin-certification, `entries.mjs`/`check-submission.mjs` do adp-list,
  o smoke ao vivo de `validate.mjs`/`deploy.yml` do dsh-catalog, o build-submission do omdsh, `verify/*` do dsh-plugin-kit.

## Limites conhecidos (declarados com honestidade)

- O grupo K é uma **varredura estática heurística**: K1/K3/K4 deixam passar wrappers complexos e também podem gerar falsos alarmes — toda constatação em nível warn precisa de olhar humano e nunca condena um plugin automaticamente.
- O D3 só prova que "a composição sobe até uma requisição de modelo"; ele **não prova que os schemas das ferramentas são válidos nem que a lógica de negócio está correta** (isso exige uma execução e2e com chave ou um LLM simulado).
- Um bloqueio `ignored-builds` do pnpm é um problema de receita de ambiente: quando o D1 o encontra, a verificação degrada para warn e imprime a receita allowBuilds do compat.yml, alinhada com a linha environment-blocked da spec v1 de certificação, e nunca conta como defeito do plugin.
- Hosts da linha npm (0.1.2-rc.1) não têm imposição de engines/peerDependencies em seu packument, então o R6 ali é apenas consultivo.
- Uma armadilha medida neste ambiente: uma âncora `$` (sem a flag `m`) não casa com a posição antes de um `\r` final solitário, então analisar texto CRLF exige dividir em `/\r?\n/` (já tratado internamente — não regrida isso).

## Estrutura do repositório

```
doctor.mjs               entrada da CLI (orquestração de grupos, códigos de saída, relatório JSON)
lib/framework.mjs        registro/execução/veredito/renderização de verificações (zero dependências)
lib/util.mjs             sandbox temporário + execução de subprocessos (stdout/stderr em disco, evitando limites de captura por pipe)
lib/checks-package.mjs   estático · estrutura do pacote R0–R8
lib/checks-cordis.mjs    estático · contrato Cordis K1–K9
lib/checks-smoke.mjs     dinâmico · smoke em sandbox D0–D3, D9
lib/checks-collections.mjs  ecossistema · listagens de diretório CC1–CC5
tests/selftest.mjs       14 autotestes com CLI real (os 7 casos existentes do contrato de códigos de saída byte a byte, mais 7 novos casos de degradado/proteção de uso)
tests/contract.mjs       31 testes de contrato (congelando os 5 observáveis dos quais a CI dos 37 repositórios existentes depende)
scripts/verify.mjs       registro de verificados e atualização do selo (lê a API do GitHub para auditar o gate de cada repositório)
scripts/badge.mjs        renderização do SVG de verificado
data/verified-repos.json repositórios declarantes verificados
data/verified.json       registro de verificados (gerado pela CI)
badges/                  selos verificados (gerados pela CI)
THIRD-PARTY-RK-SCAN.md   conjunto de resultados da varredura estática R+K de plugins de terceiros (relatório público)
data/rk-scans.json       forma legível por máquina dessa varredura
SURVEY.md                a metodologia completa de detecção por canal e a fonte de cada critério
```

## Saúde da publicação

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

## Status

Repositório oficial: GitHub `PerryLink/dsh-plugin-doctor` (Apache-2.0), npm `@perrylink/dsh-plugin-doctor`.
**Versão atual 0.2.0** (a mais nova no npm antes da 0.2.0 era a 0.1.7); veja `CHANGELOG.md`. Uso em CI (**por favor, use os aliases ASCII**):

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.2.0 --repo . --no-smoke --only "R,K"
```

**37 repositórios de plugins** já trazem `.github/workflows/plugin-doctor.yml` (um gate estático somente leitura sobre a árvore commitada → `--only "R,K"` mais a auto-verificação de R0/K1, fixado em `@0.1.6`).
O pin permanece deliberadamente na 0.1.6: a 0.2.0 **não muda em nada** os critérios R/K nem o formato da saída (`tests/contract.mjs` congela isso como uma asserção), então subir o pin é uma onda separada, e não uma precondição desta release.

> Toda mudança da 0.2.0 é **aditiva** (novos campos / novas opções / novos códigos de saída); os critérios dos 37 repositórios existentes não mudam, verificado contra a linha de base de 37 repositórios com **diffs = 0**.

### Conjuntos de resultados públicos

- [`THIRD-PARTY-RK-SCAN.md`](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/THIRD-PARTY-RK-SCAN.md) — a primeira varredura estática R+K de plugins dsh de **terceiros** (não PerryLink): 60 candidatos → 20 plugins que realmente declaram `dsh.bundle.patch` → sob o gate de 16 verificações, **10 passaram / 10 falharam**. Método: clones somente leitura, **zero execução** de código de terceiros, R2/R4 listados à parte e fora do gate; ela inclui os comandos de reprodução, uma correção à metodologia da própria varredura, e um **canal de correção para qualquer repositório citado nela**. Forma legível por máquina: `data/rk-scans.json`.
  **Não é uma certificação, não é uma nota, e não diz nada sobre a segurança de um plugin**: uma aprovação significa apenas que "as 16 verificações estáticas não reportaram nenhuma falha naquele commit".

## PerryLink DSH Plugin Family

Este projeto é um dos **87 plugins ativamente mantidos** do DeepSeek Harness da [PerryLink](https://github.com/PerryLink). O registro da família tem **95** plugins — **5 congelados**, **3 retirados** — e fica recolhido abaixo para que cada README mantenha uma primeira tela curta. Expanda para ver cada linha, com o motivo na coluna Status.

<details>
<summary>Expandir os 95 plugins</summary>

| Plugin | Uma linha | Status |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 CONGELADO — ver o README do repositório |
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
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 CONGELADO — ver o README do repositório |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 RETIRADO — ver o README do repositório |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>
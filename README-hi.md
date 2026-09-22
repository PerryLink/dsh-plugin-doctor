# dsh-plugin-doctor

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

dsh plugins के लिए "integrity + runtime health" का ऑल-इन-वन चेकर। शून्य निर्भरताएँ (यह
सिर्फ़ वही इस्तेमाल करता है जो Node ≥22 के साथ आता है), और एक ही रन में चारों परतें एक साथ:
**static package-structure checks (R) → Cordis contract scan (K) → dynamic sandbox smoke (D) → ecosystem directory-listing validation (CC)**।
हर मानदंड 2026-09-07 को दर्ज तीन प्रथम-हस्त शोध दिशाओं से निकला है: deepseek-harness
docs और सोर्स, cordiverse/cordis के सोर्स अनुबंध, और कार्यक्षेत्र के हर वितरण
चैनल की सूची (पूरा पाठ `SURVEY.md` में)।

## इंस्टॉलेशन (DSH bundle)

`dsh-plugin-doctor` package.json में `dsh.bundle.patch` → `cordis.patch.yml` घोषित करता है, इसलिए इसे DeepSeek Harness bundle के रूप में भी इंस्टॉल किया जा सकता है:

```powershell
# git चैनल (नवीनतम main)
dsh plugin --profile web add "github:PerryLink/dsh-plugin-doctor#main"

# npm चैनल (रिलीज़ किया गया संस्करण; हमेशा scoped पूरा नाम इस्तेमाल करें -- बिना scope वाला नाम dsh-plugin-doctor एक अलग प्रोजेक्ट है)
dsh plugin --profile web add @perrylink/dsh-plugin-doctor
```

जोड़ी गई लाइन इस पैकेज को मानक Cordis plugin अनुबंध के तहत लोड करती है: host half एक सादा ESM मॉड्यूल है जो `apply(ctx)` export करता है (अपनी ज़रूरत की सेवाओं के लिए `inject` घोषित करता हुआ)। पैकेज कोई browser UI नहीं भेजता, इसलिए `dsh.client` घोषणा नहीं है।

```js
// bundle entry (host half) -- patch लाइन जिस export अनुबंध को लोड करती है
export function apply(ctx) {
  // /doctor कमांड और plugin_doctor read-only जाँच टूल रजिस्टर करता है
}
```

अनइंस्टॉल: `dsh plugin --profile web remove @perrylink/dsh-plugin-doctor` (या profile patch से वह लाइन हटा दें)। नीचे दिया CLI उपयोग इससे अप्रभावित रहता है।

## उपयोग

```powershell
node doctor.mjs --repo <plugin-repo-path>       # पूरा रन (dynamic smoke सहित; network + pnpm चाहिए)
node doctor.mjs --repo <path> --no-smoke        # केवल static + listings
node doctor.mjs --repo <path> --dsh 0.1.2-rc.1  # smoke host संस्करण (डिफ़ॉल्ट npm की नवीनतम रिलीज़ लाइन)
node doctor.mjs --repo <path> --only R,K        # केवल दो static परतें (ASCII aliases की सलाह)
node doctor.mjs --repo <path> --json report.json
node doctor.mjs --repo <path> --json -          # JSON stdout पर (मानव-पठनीय रिपोर्ट दबा देता है)
node doctor.mjs --repo <path> --workspace <workspace-root>   # sibling repos रखने वाला workspace (CC समूह इसका उपयोग करता है)
node doctor.mjs --repo <path> --allow-degraded  # स्पष्ट रूप से स्वीकारें कि "पूरा समूह वाकई नहीं चला" (डिफ़ॉल्ट exit 6)
node doctor.mjs --purge <quarantine-dir>        # इस टूल द्वारा बनाए quarantine dirs साफ़ करें (केवल doctor-quarantine-*)
```

### लक्ष्य आकृतियाँ और कवरेज (0.2.0 में नया)

`--repo` एक **source tree** हो सकता है या एक **इंस्टॉल किया गया पैकेज डिरेक्टरी / खोला गया tarball artifact** (बाद वाला `node_modules/<pkg>` पर आम है)। मानदंड आकृति के साथ बदलते हैं:

| आकृति | K समूह (Cordis contract) | नोट्स |
|---|---|---|
| `src/` वाला source tree | `src/**` के साथ root-level JS स्कैन करता है (`mode: src`) | पूर्ण |
| **`src/` नहीं, `main` `lib/` की ओर इशारा करता है** | **`lib/**` का fallback scan (`mode: lib-fallback`)** | 0.2.0 में ठीक किया गया: पुराना implementation "कोई build script नहीं" पर टिका था, पर प्रकाशित पैकेज अपनी build script **रखते** हैं → fallback कभी चला ही नहीं, K की सभी नौ जाँचें skip हो गईं, और फिर भी exit 0 (झूठा हरा) |
| न `src/` न `lib/` | सभी नौ skip (`mode: none`) | **पूरा समूह वाकई नहीं चला → exit code 6**, अब झूठा हरा नहीं |

कवरेज JSON के `coverage.K` में लिखी जाती है (`{filesInspected, mode}`) और `groups.K` में सारांशित होती है।

### `--only` समूह और ASCII उपनाम

| उपनाम | समूह का पूरा नाम | सामग्री |
|---|---|---|
| `R` | static · पैकेज संरचना | R0–R8 |
| `K` | static · Cordis contract स्कैन | K1–K9 |
| `D` | dynamic · sandbox smoke | D0–D3, D9 |
| `CC` | ecosystem · directory listings | CC1–CC5 |

Aliases case-insensitive हैं, और समूहों के चीनी पूरे नाम भी अब तक काम करते हैं। **workflows में aliases ही इस्तेमाल करें**: अगर कोई editor या script किसी चीनी समूह नाम को ग़लत encoding से round-trip कर दे, तो `--only` किसी भी समूह से मेल नहीं खाता।

### एक्ज़िट कोड अनुबंध

| कोड | अर्थ | कब से |
|---|---|---|
| `0` | कोई fail/error नहीं (warn/skip की छूट), और हर अनुरोधित समूह वाकई चला | 0.1.x |
| `1` | fail/error मौजूद (प्लगइन दोष) | 0.1.x |
| `2` | उपयोग त्रुटि, अज्ञात समूह, **अज्ञात option** | 0.1.x |
| `3` | infrastructure त्रुटि (npm/pnpm ग़ायब होना वग़ैरह) | **0.2.0** |
| `4` | असमर्थित host संस्करण (host ख़ुद इंस्टॉल नहीं हो सका; **प्लगइन पर फ़ैसला नहीं**) | **0.2.0** |
| `5` | अस्थिर परिणाम (कोई चरण timeout हुआ या signal से मारा गया) | **0.2.0** |
| `6` | **degraded**: कोई अनुरोधित समूह वाकई नहीं चला (जैसे स्कैन करने के लिए कोई source फ़ाइल नहीं) | **0.2.0** |

**चुपचाप पास होने से बचाव** (दो परतें):

1. अगर `--only` में एक भी समूह नाम मेल न खाए → तुरंत `2`। 0.1.4 और उससे पुराने संस्करण समूह नाम के बिगड़ने पर "कुछ भी जाँचो नहीं + exit 0" करते थे, जिसने एक बार 35 repos के CI गेट को झूठा हरा बना दिया (2026-09-09 को मापा गया: `checks_run=0`, `exit=0`)।
2. 0.2.0 से: **अनुरोधित समूह की सारी जाँचें skip हुईं → `6`**। पुराना implementation सिर्फ़ "एक भी जाँच नहीं चली" को कवर करता था, "चली पर सब skip हो गया" को नहीं — बाद वाले से "शून्य कवरेज वाला K समूह" पास गिना जाता था। इसे स्पष्ट रूप से स्वीकार करने के लिए `--allow-degraded` इस्तेमाल करें (exit code 0 पर आ जाता है, पर JSON में `degraded` ख़ाली नहीं रहता)।

> ⚠️ परिवार के 37 repos के मौजूदा गेट **exit code नहीं पढ़ते** (उनके workflows `set +e` / `out="$(…)"` / `set -e` इस्तेमाल करते हैं) और केवल stdout पर `R0 ` / `K1 ` prefixes तथा JSON में `results[].name` पढ़ते हैं। इसलिए 0.2.0 के नए exit codes **उन pipelines के लिए कुछ नहीं बदलते**; वे इंटरैक्टिव उपयोग और भावी integrators के लिए हैं।

- smoke रन अपने अस्थायी `DSH_HOME`/`DSH_AGENTS_HOME` को स्वयं बनाए `%TEMP%` sandbox (prefix `doctor-`, जो host-संरक्षित `%TEMP%\dsh-*` template से **ओवरलैप नहीं करता**) में रखता है और असली `~/.dsh` को कभी नहीं छूता (red line 3)।
- `dsh plugin add` को हमेशा `--ignore-scripts` दिया जाता है: परीक्षण किए जा रहे पैकेज की install/prepare scripts host पर कभी नहीं चलतीं। pnpm का ignored-builds अवरोध `environment` के रूप में वर्गीकृत होता है (यह न pass गिना जाता है, न प्लगइन दोष)।
- हर चरण का subprocess stdout/stderr `%TEMP%\doctor-run-*\logs\` में लिखा जाता है; अंत में रन **मिटाने के बजाय quarantine करता है** (`%TEMP%\doctor-quarantine-*` पर rename), रिपोर्ट के अंत में वह path छापता है, और हटाना इंसानी पुष्टि के बाद `--purge` पर छोड़ देता है (red line 4, तीन-चरणीय नियम)।
- रनटाइम पर दिखे absolute paths JSON या रेंडर किए गए पाठ तक पहुँचने से पहले `<path>` में बदल दिए जाते हैं, ताकि कोई रिपोर्ट किसी और के repo में commit की जा सके और उसका path-leak गेट ट्रिगर न हो।

## नाम की टकराहट (महत्वपूर्ण)

यह रिपॉज़िटरी **`@perrylink/dsh-plugin-doctor`** है, और पारिस्थितिकी के अन्य समान-नाम वाले टूलों से **एक ही प्रोजेक्ट नहीं** है:

- npm का बिना-scope नाम `dsh-plugin-doctor` **Xrainsmile/DSH-Plugin-Doctor** का है (एक अलग प्रोजेक्ट, 0.1.1)। इसलिए **`npx dsh-plugin-doctor` कभी न चलाएँ** — वह किसी और का पैकेज चलाता है; हमेशा scoped पूरा नाम `@perrylink/dsh-plugin-doctor@<exact version>` इस्तेमाल करें।
- दस GitHub repos के नाम में `dsh-plugin-doctor` है (उनमें आठ का नाम **बिल्कुल** यही है), जिनमें `zoahdev/dsh-plugin-doctor` भी है (केवल GitHub पर, npm पर कभी प्रकाशित नहीं)।
- `dsh-testkit` का README `dsh-plugin-doctor` को zoahdev repo से लिंक करता है; उसका इससे कोई लेना-देना नहीं।

एक पंक्ति में: **शून्य-निर्भरता, offline-capable (`--only R,K`), और यह Cordis v4 contracts (K1–K9) तथा पाँच ecosystem directory listings (CC1–CC5) को ऐसा CI गेट बना देता है जिसका फ़ैसला exit code से पढ़ा जा सकता है।** ("अकेला" जैसा दावा नहीं — बस इतना कि जिन टूलों की असल में समीक्षा हुई, उनमें ऐसा कुछ तुलनीय नहीं मिला।)

## जाँच सूची

| समूह | जाँचें | मानदंड क्या कवर करते हैं |
|---|---|---|
| static · पैकेज संरचना | R0–R8 | आधार fields; **activation gate `dsh.bundle.patch` (महत्वपूर्ण)**; `npm pack --dry-run` tarball में entry और patch मौजूद; cordis.patch.yml संरचना; entry के `name`/`apply` exports; rescope की गई dependency नीति (बिना-scope `cordis` वर्जित); engines `^22.19.0 \|\| >=24.0.0` पर संरेखित; prebuild + files allowlist; बचे हुए पुराने-rc peers (2026-09-05 की dual-baseline सीख) |
| static · Cordis contract | K1–K9 | service access बनाम `inject` घोषणा; ctx live-data serialization की red line; `ctx.effect` में न लिपटे timers/listeners; function रखने वाला Schema; `apply` का return आकार (v4 Effect अनुबंध); `inject` service-name seam; **v3 legacy APIs (3.x→4.x की हटाने की सूची)**; Config का Standard Schema होना ज़रूरी; `name==='apply'` का विशेष केस |
| dynamic · sandbox smoke | D0–D3, D9 | `npm pack` → `dsh plugin --profile headless add <tarball>` → जाँचें कि `dsh.profile.bundles` में पैकेज का नाम है → `--dump-config` layer marker → keyless headless रन से अपेक्षा **exit 1 + `dsh: MISSING_CREDENTIAL`** (= composition model request तक boot हुआ; NO_ADAPTER/ERR_MODULE_NOT_FOUND/SyntaxError/TypeError शामिल नहीं) → sandbox सफ़ाई |
| ecosystem · directory listings | CC1–CC5 | certification registry spec v1 के पाँच-आयामी evidence; adp-list yml fields/enums/descriptions; dsh-catalog entry की बाध्यताएँ (install commands वर्जित, truncation heuristics); omdsh `dshWorkshop` activation के पाँच मान; dsh-plugin-kit के तीन गेट (license / पाँच-भाषा README / तीन seam भूमिकाएँ, kit के आधिकारिक CLI को प्राथमिकता) |

## Verified 徽章

यह बैज पहनने का ठीक एक, और ऑडिट-योग्य, अर्थ है: **repo अपने ही CI में dsh-plugin-doctor का static R+K गेट (16 जाँचें: R0/R1/R3/R5/R6/R7/R8 + K1–K9) चलाता है, और वह गेट डिफ़ॉल्ट branch के मौजूदा HEAD पर हरा है।** यह **प्रमाणन** बैज नहीं है: इसमें न Scorecard, न provenance, न install smoke। R2 (tarball integrity) और R4 (entry contract) बने हुए `lib/` को पढ़ते हैं, और परिवार के ज़्यादातर repos के build को पास होने के लिए `HARNESS_COMMIT` + `gen-aliases` चाहिए — ये दोनों हर repo के अपने `ci.yml` (build-drift gate + pack smoke) से कवर होते हैं और जानबूझकर इस गेट से बाहर हैं।

```markdown
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-github.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg)](https://dsh.market/)
```

- रजिस्ट्री `data/verified.json` ही एकमात्र सत्य-स्रोत है, जिसे `.github/workflows/verified.yml` रोज़ और हर संबंधित push पर ताज़ा करता है। Refresh केवल GitHub API पढ़ता है: यह हर repo के HEAD की `plugin-doctor.yml` गेट कॉन्फ़िगरेशन पढ़ता है (जिसमें `@perrylink/dsh-plugin-doctor@<version>` pin होना, काम करता `--only` argument होना, और R0/K1 के वाकई चलने का स्व-सत्यापन होना ज़रूरी है), फिर उस HEAD के `plugin-doctor` workflow run का नतीजा जाँचता है। **इस repo का CI कभी कोई third-party कोड clone, install या execute नहीं करता।**
- बैज का रूप: दृश्य-भाषा पारिस्थितिकी के दो नए बैजों का अनुसरण करती है (`dsh.directory` का monospace-uppercase + letter-spacing + mark + gradient, और `awesome-dsh-plugin` का seal block) — **चाँदी/प्लैटिनम धात्विक बायाँ खंड, एक shield tick mark, और स्याही-नीला monospace uppercase**, जिसमें दायाँ खंड **GitHub-परंपरा का ठोस status रंग** (हरा/नारंगी/लाल/स्लेटी) है और monospace uppercase status शब्द रखता है, तथा status अलग से **path से बनाए icon** (✓ / ! / ✕ / –) से भी व्यक्त होता है, ताकि रंग-दृष्टि दोष में भी पढ़ा जा सके। 5px corner radius + 1px stroke; **stroke ज़रूरी है** — इसके बिना चाँदी वाला बायाँ खंड सफ़ेद README पृष्ठभूमि पर ग़ायब हो जाता है।
- चार अवस्थाएँ (मान-पाठ shields / GitHub Actions के पारंपरिक शब्द इस्तेमाल करता है): `passing` (हरा: HEAD का run सफल) / `warning` (नारंगी: HEAD अभी चला नहीं, कोई run अब भी queue में है, या गेट की कोई पूर्व-शर्त ग़ायब है) / `failing` (लाल: HEAD का run विफल, या गेट कॉन्फ़िगरेशन टिकता नहीं — जिसमें वह "नक़ली गेट" भी शामिल है जिसका `--only` argument दोहरे encoding में बिगड़ा है) / `no data` (स्लेटी: API क्वेरी विफल)। बैज **dynamic** है: पास होना बंद होते ही लाल हो जाता है। R+K का सटीक दायरा इसी अनुभाग और रजिस्ट्री के `meaning` field में है, बैज के पाठ में नहीं (बैज यहीं वापस लिंक करता है)।
- शामिल होने के लिए: `data/verified-repos.json` पर PR खोलें और `{ "repo": "<owner>/<name>", "package": "<npm package name>" }` जोड़ें, तथा नीचे दिए अनुसार अपने ही repo में `plugin-doctor.yml` जोड़ें; entry को ऊपर दिया ऑडिट पास करना होगा।
- गेट चरण (पूरा workflow किसी भी परिवार repo के `.github/workflows/plugin-doctor.yml` में है; समूह नाम **ASCII aliases `R,K`** इस्तेमाल करते हैं — 0.1.5 से समर्थित, जिससे फ़ाइल और command line शुद्ध ASCII रहती हैं; अंत में स्व-सत्यापन होता है कि R0/K1 वाकई चले। **परिवार के 37 repos इस समय `0.1.6` पर pin हैं**):

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

> गेट कुछ install या build क्यों नहीं करता, और यह repo बैज ख़ुद क्यों नहीं चलाता: static R/K जाँचें केवल committed tree पढ़ती हैं (किसी निर्भरता की ज़रूरत नहीं), जबकि `npm run build` बिना harness aliases वाले वातावरण में विफल हो जाता है और उसका prebuild committed `lib/` मिटा देता है, जिससे झूठा लाल बनता है। दूसरी ओर, third-party निर्भरताओं के install इस repo के CI में केंद्रित करना supply-chain जोखिम होता। इसलिए गेट हर repo के अपने CI में committed tree पर चलता है, और यह repo केवल ऑडिट करके बैज जारी करता है।

## मानदंड कहाँ से आते हैं (पूरा पाठ और URL SURVEY.md में)

- **harness पक्ष**: `docs/user/develop/basic/publish.md`, `apps/cli/src/plugin.ts` (activation gate ही एकमात्र स्विच है),
  `packages/bundle/headless/README.md` (MISSING_CREDENTIAL मानदंड), Releases (0.1.2-rc.1 / 0.1.3-alpha.1 के बदलाव),
  `@deepseek-ai/dsh-loader-smoke` (आधिकारिक "अस्थायी DSH_HOME + अपेक्षित exit code" पैटर्न)।
- **Cordis पक्ष**: cordiverse/cordis v4 सोर्स (registry/fiber/reflect/events.ts) + DSH cordis-primer/tutorial docs +
  v3 `@cordisjs/core@3.10.2` d.ts का diff (3.x→4.x blacklist)।
- **Ecosystem पक्ष**: dsh-plugin-certification spec v1, adp-list `entries.mjs`/`check-submission.mjs`,
  dsh-catalog `validate.mjs`/`deploy.yml` live smoke, omdsh build-submission, dsh-plugin-kit `verify/*`।

## ज्ञात सीमाएँ (ईमानदारी से घोषित)

- K समूह एक **heuristic static scan** है: K1/K3/K4 जटिल wrappers चूक जाते हैं और झूठे alarm भी उठा सकते हैं — warn-स्तर की हर खोज पर इंसानी नज़र ज़रूरी है और वह किसी plugin को अपने-आप ख़ारिज नहीं करती।
- D3 केवल यह सिद्ध करता है कि "composition model request तक boot होता है"; यह **नहीं सिद्ध करता कि tool schemas वैध हैं या business logic सही है** (उसके लिए keyed e2e रन या mock LLM चाहिए)।
- pnpm का `ignored-builds` अवरोध environment-recipe की समस्या है: D1 पर वह टकराता है तो जाँच warn तक degrade होती है और compat.yml का allowBuilds recipe छापती है, जो certification spec v1 की environment-blocked लाइन से मेल खाता है, और इसे कभी plugin दोष नहीं गिना जाता।
- npm-लाइन hosts (0.1.2-rc.1) के packument में engines/peerDependencies की कोई enforcement नहीं है, इसलिए वहाँ R6 advisory है।
- इस वातावरण का एक मापा हुआ जाल: `$` anchor (`m` flag के बिना) अकेले अंतिम `\r` से पहले की स्थिति से मेल नहीं खाता, इसलिए CRLF पाठ पार्स करते समय `/\r?\n/` पर split करना ज़रूरी है (अंदर से पहले ही संभाला गया है — इसे रिग्रेस मत करो)।

## रिपॉज़िटरी संरचना

```
doctor.mjs               CLI entry (समूह ऑर्केस्ट्रेशन, exit codes, JSON रिपोर्ट)
lib/framework.mjs        check रजिस्ट्रेशन/रन/निर्णय/रेंडरिंग (शून्य निर्भरताएँ)
lib/util.mjs             अस्थायी sandbox + subprocess निष्पादन (stdout/stderr डिस्क पर, pipe-capture सीमाओं से बचाव)
lib/checks-package.mjs   static · पैकेज संरचना R0–R8
lib/checks-cordis.mjs    static · Cordis contract K1–K9
lib/checks-smoke.mjs     dynamic · sandbox smoke D0–D3, D9
lib/checks-collections.mjs  ecosystem · directory listings CC1–CC5
tests/selftest.mjs       14 असली-CLI self-tests (मौजूदा 7 exit-code-contract केस byte-identical, और 7 नए degraded/usage-guard केस)
tests/contract.mjs       31 contract tests (मौजूदा 37-repo CI जिन 5 observables पर निर्भर है, उन्हें freeze करते हुए)
scripts/verify.mjs       verified रजिस्ट्री और बैज refresh (हर repo के गेट के ऑडिट के लिए GitHub API पढ़ता है)
scripts/badge.mjs        verified SVG रेंडरिंग
data/verified-repos.json verified घोषणा करने वाले repos
data/verified.json       verified रजिस्ट्री (CI-generated)
badges/                  verified बैज (CI-generated)
THIRD-PARTY-RK-SCAN.md   third-party plugin static R+K स्कैन परिणाम-समुच्चय (सार्वजनिक रिपोर्ट)
data/rk-scans.json       उस स्कैन का machine-readable रूप
SURVEY.md                पूर्ण-चैनल detection methodology तथा हर मानदंड का स्रोत
```

## स्थिति

आधिकारिक रिपॉज़िटरी: GitHub `PerryLink/dsh-plugin-doctor` (Apache-2.0), npm `@perrylink/dsh-plugin-doctor`।
**मौजूदा संस्करण 0.2.0** (npm पर 0.2.0 से पहले का नवीनतम 0.1.7 था); `CHANGELOG.md` देखें। CI उपयोग (**कृपया ASCII aliases ही इस्तेमाल करें**):

```powershell
npx --yes @perrylink/dsh-plugin-doctor@0.2.0 --repo . --no-smoke --only "R,K"
```

**37 plugin repos** में पहले से `.github/workflows/plugin-doctor.yml` मौजूद है (committed tree पर read-only static गेट → `--only "R,K"` तथा R0/K1 का स्व-सत्यापन, `@0.1.6` पर pinned)।
pin जानबूझकर 0.1.6 पर टिका है: 0.2.0 R/K मानदंडों और output आकार को **बिल्कुल नहीं** बदलता (`tests/contract.mjs` इसे assertion के रूप में freeze करता है), इसलिए pin बढ़ाना इस रिलीज़ की पूर्व-शर्त नहीं, एक अलग wave है।

> 0.2.0 का हर बदलाव **additive** है (नए fields / नए options / नए exit codes); मौजूदा 37 repos के मानदंड अपरिवर्तित हैं, जिन्हें 37-repo baseline के विरुद्ध **diffs = 0** से सत्यापित किया गया।

### सार्वजनिक परिणाम सेट

- [`THIRD-PARTY-RK-SCAN.md`](https://github.com/PerryLink/dsh-plugin-doctor/blob/main/THIRD-PARTY-RK-SCAN.md) — **third-party** (ग़ैर-PerryLink) dsh plugins का पहला static R+K स्कैन: 60 उम्मीदवार → 20 ऐसे plugins जो वाकई `dsh.bundle.patch` घोषित करते हैं → 16-जाँच के गेट में **10 पास / 10 विफल**। तरीक़ा: read-only clones, third-party कोड का **शून्य execution**, R2/R4 अलग सूचीबद्ध और गेट से बाहर; इसमें reproduction commands, इसी स्कैन की methodology का एक सुधार, और **इसमें नाम आए किसी भी repo के लिए सुधार चैनल** शामिल है। Machine-readable रूप: `data/rk-scans.json`।
  **यह न प्रमाणन है, न रेटिंग, और किसी plugin की सुरक्षा के बारे में कुछ नहीं कहता**: pass का अर्थ बस इतना है कि "उस commit पर 16 static जाँचों ने कोई विफलता नहीं बताई"।

## PerryLink DSH Plugin Family

यह प्रोजेक्ट [PerryLink](https://github.com/PerryLink) द्वारा अनुरक्षित [42 DeepSeek Harness प्लगइनों](https://github.com/PerryLink) में से एक है। अगर यह आपकी मदद करता है, तो बाकी भी करेंगे:

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

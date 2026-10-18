# dsh-plugin-doctor

> Release stamp: `0.4.6` (2026-10-04).

> **पैकेज नाम।** यह प्रोजेक्ट npm पर **`@perrylink/dsh-plugin-doctor`** के रूप में प्रकाशित होता है। सादा नाम `dsh-plugin-doctor` किसी असंबंधित प्रोजेक्ट का है — कभी `npx dsh-plugin-doctor` न चलाएँ; उसे इंस्टॉल करने से यह प्लगइन इंस्टॉल नहीं होता।

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![npm downloads](https://img.shields.io/npm/dm/%40perrylink%2Fdsh-plugin-doctor)](https://www.npmjs.com/package/@perrylink/dsh-plugin-doctor)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-plugin-doctor/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-plugin-doctor/actions)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-plugin-doctor?metric=downloads&lang=hi)](https://dshfind.com/hi/plugins/PerryLink/dsh-plugin-doctor?ref=badge)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor/badge)](https://api.securityscorecards.dev/projects/github.com/PerryLink/dsh-plugin-doctor)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add @perrylink/dsh-plugin-doctor
```


dsh plugins के लिए "integrity + runtime health" का ऑल-इन-वन चेकर। शून्य निर्भरताएँ (यह
सिर्फ़ वही इस्तेमाल करता है जो Node ≥22 के साथ आता है), और एक ही रन में चारों परतें एक साथ:
**static package-structure checks (R) → Cordis contract scan (K) → dynamic sandbox smoke (D) → ecosystem directory-listing validation (CC)**।
हर मानदंड 2026-09-07 को दर्ज तीन प्रथम-हस्त शोध दिशाओं से निकला है: deepseek-harness
docs और सोर्स, cordiverse/cordis के सोर्स अनुबंध, और कार्यक्षेत्र के हर वितरण
चैनल की सूची (पूरा पाठ `SURVEY.md` में)।


**📖 इकोसिस्टम नॉलेज बेस** — मापे गए आँकड़े, मार्केटिंग नहीं: [डेवलपमेंट गाइड · चयन डेटा · रखरखाव मानदंड](https://perrylink.github.io/dsh-plugin-guide/)।

<!-- star-cta -->

## इंस्टॉलेशन (DSH bundle)

`dsh-plugin-doctor` package.json में `dsh.bundle.patch` → `cordis.patch.yml` घोषित करता है, इसलिए इसे DeepSeek Harness bundle के रूप में भी इंस्टॉल किया जा सकता है:

```powershell
# git चैनल (नवीनतम main)
dsh plugin --profile web add github:PerryLink/dsh-plugin-doctor

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

## What is dsh-plugin-doctor?

dsh plugins के लिए "integrity + runtime health" का ऑल-इन-वन चेकर। शून्य निर्भरताएँ (यह सिर्फ़ वही इस्तेमाल करता है जो Node ≥22 के साथ आता है), और एक ही रन में चारों परतें एक साथ:

![dsh-plugin-doctor का टर्मिनल डेमो: dsh-plugin-doctor — static R+K gate on a sibling plugin repo](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-hero.png)

![Animated terminal demo of dsh-plugin-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-demo.gif)

*वही रन, एनिमेटेड।*

## रिलीज़ स्वास्थ्य

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

## Comparison

![dsh-plugin-doctor का मापा गया तुलना चार्ट](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/docs/assets/dsh-plugin-doctor-evidence.png)

60 candidates → 20 qualifying plugins · scan dated 2026-09-10 (data/rk-scans.json)

## ⭐ 如果它帮到了你

यह प्लगइन [DSH प्लगइन परिवार](https://github.com/PerryLink) का हिस्सा है (40+ प्लगइन, सभी Apache-2.0)। अगर यह उपयोगी लगे, तो **एक स्टार दें** — इससे कोई सुविधा अनलॉक नहीं होती, पर अगला व्यक्ति इसे खोज में आसानी से पा लेता है।

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.
## संगतता

```sh
dsh plugin --profile web add github:PerryLink/dsh-plugin-doctor
```

| पहलू | स्थिति |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1` (शून्य-निर्भरता और जानबूझकर host-agnostic: `package.json` में कोई `@deepseek-ai/dsh-*` dependency और कोई peer range घोषित नहीं है, इसलिए इस रिपॉज़िटरी के `R5`/`R8` pass नहीं बल्कि जानबूझकर skip होते हैं — देखें `SELF-CHECK.md`; इस लाइन का रिकॉर्ड `CHANGELOG.md` §0.4.6 में है — "host pins move to `0.2.1-alpha.1`", और D समूह का sandbox smoke अपना host `--dsh` से लेता है, डिफ़ॉल्ट peer floor `0.1.2-rc.1`) |
| Node | `^22.19.0 \|\| >=24.0.0` |

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
### होस्ट आधा: `plugin_doctor` / `/doctor` (0.7.1 में नया)

bundle के रूप में इंस्टॉल होने पर यह प्लगइन वही R/K/X जाँचें read-only टूल और
कमांड के रूप में देता है। CLI से दो बातें अलग हैं, और दोनों उत्तर में लिखी जाती हैं
क्योंकि **होस्ट आधे के पास exit code नहीं होता** — लौटाई गई रिपोर्ट ही पूरा संदेश है।

| पैरामीटर | डिफ़ॉल्ट | अर्थ |
|---|---|---|
| `repo` (अनिवार्य) | — | जाँचे जाने वाले प्लगइन रिपॉज़िटरी का path (`package.json` आवश्यक) |
| `smoke` | `false` | D समूह का sandbox smoke भी चलाएँ (नेटवर्क + pnpm चाहिए) |
| `host` | `true` | X समूह (होस्ट अनुबंध) चलाएँ; dsh इंस्टॉल न पढ़ी जा सके तो डिग्रेड |
| `workspace` | स्वतः | सहोदर `dsh-*` रिपॉज़ वाला family workspace, CC1–CC5 और K14 के लिए |

- **डिग्रेडेड रन यह बताते हैं।** जब अनुरोधित समूह वाकई नहीं चला, उत्तर में CLI
  जैसी ही `[降级] …` पंक्ति आती है जो समूहों के नाम बताती है। 0.7.1 से पहले
  renderer यह तथ्य गिरा देता था, इसलिए डिग्रेडेड उत्तर "कुछ करने को नहीं था" वाले
  रन से अलग पहचाना नहीं जाता था।
- **`workspace` रिपॉज़िटरी से तय होता है, इंस्टॉल की जगह से नहीं।** टूल जाँची जा
  रही रिपॉज़िटरी से ऊपर जाकर निकटतम ऐसी निर्देशिका ढूँढता है जिसमें दो या अधिक
  DSH प्लगइन रिपॉज़ हों (`DSH_WORKSPACE` और स्पष्ट पैरामीटर को प्राथमिकता)।
  0.7.0 की तरह `import.meta.dirname/..` से तय करने पर bundle इंस्टॉल में वह
  `<profile>/node_modules` (या `…/@perrylink`) बनता है, जो workspace ही नहीं है:
  तब CC1–CC4 उन रजिस्ट्रियों को "स्थानीय रूप से अनुपस्थित" बताते हैं जो मौजूद हैं,
  और K14 को कभी सहोदर नहीं मिलता। workspace न मिलने पर उत्तर यह स्पष्ट कहता है,
  ताकि वे skips "रजिस्ट्री मौजूद नहीं" जैसे न पढ़े जाएँ।
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

## PerryLink DSH प्लगइन परिवार

यह प्रोजेक्ट [PerryLink](https://github.com/PerryLink) के **87 सक्रिय रूप से अनुरक्षित** DeepSeek Harness प्लगइन में से एक है। पूरा परिवार **95** प्लगइन है — **5 फ़्रोज़न**, **3 सेवानिवृत्त** — और नीचे संक्षिप्त रखा गया है ताकि हर README की पहली स्क्रीन छोटी रहे। हर पंक्ति देखने के लिए इसे खोलें; कारण स्थिति कॉलम में है।

<details>
<summary>सभी 95 प्लगइन खोलें</summary>

| प्लगइन | एक पंक्ति | स्थिति |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 सेवानिवृत्त — रिपॉज़िटरी README देखें |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
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
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 फ़्रोज़न — रिपॉज़िटरी README देखें |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 सेवानिवृत्त — रिपॉज़िटरी README देखें |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 सेवानिवृत्त — रिपॉज़िटरी README देखें |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>
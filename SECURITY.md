# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** through GitHub's private
vulnerability reporting:

**Security → Report a vulnerability** at
https://github.com/PerryLink/dsh-plugin-doctor/security/advisories/new

Do **not** open a public issue for security findings.

Before reporting, **sanitize everything you paste**: remove tokens, API keys,
credentials, authorization headers, session contents, and personal data. Logs
without secrets only.

## Scope

`@perrylink/dsh-plugin-doctor` is a zero-dependency CLI. It reads a plugin
repository (package.json, cordis.patch.yml, sources, and `npm pack --dry-run`
metadata) and, in the smoke group, installs a plugin into a throwaway
`%TEMP%` profile. Reports are most useful for:

- sandbox escapes from the smoke group (any write outside the throwaway
  `DSH_HOME`/`DSH_AGENTS_HOME`)
- command execution beyond the documented `npm pack`/`dsh plugin` steps
- the verified-badge workflow reading or writing anything beyond the declared
  repository metadata

## What to include

- affected version (`node doctor.mjs --help` prints the package version via
  `package.json`)
- a minimal reproduction
- the exact command line and the log directory printed at the end of the run
  (`%TEMP%\dsh-doctor-logs-*`)

## Response

Reports are acknowledged as soon as possible; fixes are released as a patch
version with the reason recorded in `CHANGELOG.md`. This project is maintained
by one person — please allow a reasonable window before public disclosure.

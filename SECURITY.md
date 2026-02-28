# Security policy

## Reporting

Report security issues through GitHub Security Advisories for this repository.

## Handling model

- CLI input is treated as untrusted.
- Parser validation failures use typed issue codes and deterministic output.
- Security triage inventory is maintained in `docs/security-triage.md`.

## Disclosure workflow

1. Reproduce and classify impact.
2. Patch with tests.
3. Publish release notes and remediation guidance.

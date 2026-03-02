# Security policy

## Threat model

- Command-line input is untrusted and may be malformed or adversarial.
- Unknown flags, missing values, and invalid values are expected failure paths.
- Consumers may rely on machine handling of `issues.code`; message text is informational only.

## Safe usage guidance

- Check `result.ok` before reading parsed values.
- Treat all `issues` as contract output and handle `severity` + `code` explicitly.
- Use `toJsonResult()` when serializing parse output for schema validation.

## Reporting vulnerabilities

Report security issues through GitHub Security Advisories for this repository.

## Disclosure workflow

1. Reproduce and classify impact.
2. Patch with tests.
3. Publish release notes and remediation guidance.

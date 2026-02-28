# Changelog

## Unreleased

- Add `prepare` build step so GitHub installs from `main` include generated runtime artifacts for downstream compatibility gates.

## 1.0.3 - 2026-02-28

- Enforce workflow hardening gates (immutable action pinning, least-privilege permissions, and dependency review checks).
- Add runtime policy controls (floor/pinned + non-blocking latest staleness checks) and wire CI to one-command truth.
- Add docs policy and ESM-only guard checks to keep API docs/channel quality deterministic for npm/JSR consumers.
- Add security triage policy documentation and CodeQL dual-lane configuration (`security-extended` + non-blocking quality lane).

## 1.0.2 - 2026-01-30

- Enforce schema boolean fields and allowNo/allowEmpty validation.
- Export the JSON Schema subpath and verify it in tests.
- Add fixture-driven contract tests plus additional claim falsification cases.
- Document array default append behavior.

## 1.0.1 - 2026-01-30

- Publish a formal JSON Schema for ParseResult and add JSON-safe conversion helper.
- Add schema validation tests and expanded real-world parsing tests.

## 1.0.0 - 2026-01-30

- Adopt ESM-only packaging and require Node.js >=24.
- Replace ad-hoc flag parsing with a schema-driven API.
- Return structured parse results (`values`, `present`, `issues`, `rest`, `unknown`) instead of sentinel `false`.
- Add explicit issue codes for machine-handling.
- Document deterministic parsing rules and migration steps.

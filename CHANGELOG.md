# Changelog

## 4.0.0 - 2026-08-01

- Replaced module-instance value-parser identity with a stable structural
  protocol that interoperates across duplicate installations and npm/JSR
  package copies.
- Added `parser.scan()` for immutable, indexed option-span and argument
  classification without decoding values.
- Retained unknown-long-flag suggestions in collected unknown records.
- Included documentation and TypeScript sources in published archives so README
  links and source/declaration maps resolve.

## 3.1.0 - 2026-08-01

- Added `createParserFromMap()` and `OptionDefinitionMap` for libraries that
  assemble already typed option definitions dynamically. Literal callers keep
  the stricter inference and exactness checks of `createParser()`.
- Exposed the option-definition types used by composition libraries so an
  adapter can add metadata without duplicating argv grammar types.

## 3.0.0 - 2026-08-01

- Added typed value parsers for configured strings, bounded decimal numbers,
  safe integers, literal choices, and synchronous custom values.
- Added optional-inline values, attached short values, value-taking cluster
  members, count options, scalar repetition policies, and multiple values for
  every scalar parser.
- Replaced boolean `negatedFlag` with explicit `falseFlags` arrays.
- Replaced parse settings with `argv`, `unknownFlagPolicy`, and
  `flagPlacement`.
- Renamed result location fields around argv terminology and added deterministic
  suggestions for unknown long flags and rejected literal choices.
- Closed value factories, custom protocols, parse settings, option definitions,
  and diagnostic unions at the TypeScript and runtime boundaries.
- Strengthened definition snapshots, custom-value ownership, immutable results,
  and independently discoverable definition diagnostics.
- Removed the version 2 grammar, names, diagnostics, and compatibility surface.

## 2.0.0 - 2026-07-30

- Replaced the public API with a compiled `createParser()` facade and a
  discriminated parse result.
- Reworked option definitions so TypeScript rejects invalid defaults,
  contradictory presence rules, and unsupported properties.
- Made boolean negation explicit and multiple string options consume one
  argument per occurrence.
- Defined boolean-only short clusters, exact value consumption, scalar
  duplicate errors, and separate post-`--` arguments.
- Made successful results the only results that expose values; failed results
  expose structured diagnostics without partial values or defaults.
- Added structured `DefinitionError` diagnostics and immutable compiled lookup
  snapshots.
- Preserved unknown flags with their raw argument, parsed flag, and original
  index.
- Added offline installed-package tests for Node, Deno, and Bun.
- Removed the public normalization and JSON Schema surfaces.
- Standardized argument, flag, option, value, and positional terminology.
- See `BREAKING_CHANGES.md` for migration guidance.

## 1.0.5 - 2026-05-31

- Added non-throwing schema normalization with structured issue reporting via `normalizeSchema`.
- Added stricter flag grammar rejecting malformed tokens (`--`, whitespace, inline `=`, and explicit `--no-*` entries).
- Added effective boolean negation metadata for boolean long flags and derived `--no-*` parser support.

## 1.0.4 - 2026-03-03

- Rework README and docs map for faster first-use onboarding (tutorial/how-to/reference/explanation).
- Add runnable `examples/` scripts with deterministic JSON output and `npm run examples:run`.
- Add example doc blocks (goal, prereqs, run command, expected output, safety notes) for all shipped examples.
- Keep parser behavior and public API contracts unchanged.

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

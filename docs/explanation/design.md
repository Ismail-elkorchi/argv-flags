# Design notes

## Goals

- Deterministic parsing across Node, Deno, and Bun.
- Stable issue codes for automation.
- One schema model with explicit types.

## Non-goals

- Command/subcommand routing or interactive UX.
- Legacy CommonJS support.
- Automatic environment/argv discovery outside `parseArgs` defaults.

## Determinism choices

- Tokens are processed in a fixed order with explicit stop conditions.
- Arrays append values instead of replacing, removing ambiguity.
- `--no-<flag>` is handled at parse time, not by post-processing.

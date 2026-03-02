# Contributing

## Setup

```sh
npm ci
npm run check:fast
npm run check
```

## Verification commands

- `npm run check:fast`: build + lint + unit tests (`node --test`) for rapid local iteration.
- `npm run check`: full gate including runtime/version policy checks and docs/ESM guards.

## Change expectations

- Keep ESM-only and deterministic parser behavior.
- Maintain stable issue codes and parse-result contract.
- Add/update tests for any parser rule change.
- Update README and changelog for user-visible behavior changes.

## Pull request checklist

- [ ] `npm run check` passes
- [ ] docs/changelog updated when required
- [ ] schema contract remains backward-compatible unless intentionally versioned

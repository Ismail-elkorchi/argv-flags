# Contributing

## Setup

```sh
npm ci
npm run check
```

## Change expectations

- Keep ESM-only and deterministic parser behavior.
- Maintain stable issue codes and parse-result contract.
- Add/update tests for any parser rule change.
- Update README and changelog for user-visible behavior changes.

## Pull request checklist

- [ ] `npm run check` passes
- [ ] docs/changelog updated when required
- [ ] schema contract remains backward-compatible unless intentionally versioned

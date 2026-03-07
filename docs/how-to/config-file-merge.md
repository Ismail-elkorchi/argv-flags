# How-to: merge config file values with CLI overrides

## Goal
Apply defaults first, then config-file values, then CLI flags as the
highest-priority overrides.

## Prerequisites
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste runnable code
```sh
node examples/config-file-merge.mjs --mode strict --retries 7 --verbose
```

## Expected output
JSON output with:
- `"ok": true`
- `"merged.mode": "strict"`
- `"merged.retries": 7`
- `"merged.verbose": true`

## Common failure modes
- Config values overwrite explicit CLI flags because the merge order is reversed.
- Callers use `values.<key>` alone and cannot tell whether a CLI flag was
  explicitly present or only inherited from config/defaults.
- Type conversion is deferred until after merge, which produces inconsistent
  error reporting.

## Related reference
- [Options reference](../reference/options.md)
- [Parse result reference](../reference/parse-result.md)

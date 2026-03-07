# How-to: stop parsing after `--`

## Goal
Use `--` as a delimiter so remaining tokens are forwarded unchanged.

## Prerequisites
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste runnable code
```sh
node examples/stop-parsing.mjs --mode safe -- --literal value
```

## Expected output
- `result.rest` equals `["--literal", "value"]`.
- Tokens after `--` are not interpreted as flags.

## Common failure modes
- `stopAtDoubleDash` is disabled, so tokens after `--` are parsed as local
  flags instead of being forwarded.
- The wrapper mixes `rest` with `unknown` tokens even though they have
  different semantics.
- Downstream consumers assume `argv-flags` assigns exit codes. Exit-code policy
  still belongs to the wrapper CLI.

## Related reference
- [Options reference](../reference/options.md)
- [Parse result reference](../reference/parse-result.md)

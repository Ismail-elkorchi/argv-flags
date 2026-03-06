# How-to: capture unknown flags without failing

## Goal
Capture additional flags for inspection while still parsing known schema keys.

## Prerequisites
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste runnable code
```sh
node examples/handle-unknown-flags.mjs --mode safe --extra=1 file.txt
```

## Expected output
- `result.unknown` contains unknown flag tokens.
- `result.rest` still contains free positional tokens such as `file.txt`.
- `result.ok` stays `true` when there are no schema validation errors.

## Common failure modes
- Unknown flags are silently discarded, so wrapper CLIs cannot compose with
  downstream tools.
- `allowUnknown: true` is enabled without validating or forwarding the collected
  tokens explicitly.
- Callers confuse `unknown` with `rest`; `unknown` contains flagged tokens,
  while `rest` contains free positional tokens.
- Callers expect `unknown` to preserve exact downstream argv ordering. It does
  not. If you need exact pass-through ordering, use `--` and forward
  [pass-through after `--`](./pass-through-double-dash.md) via `result.rest`.

## Related reference
- [Options reference](../reference/options.md)
- [Parse result reference](../reference/parse-result.md)

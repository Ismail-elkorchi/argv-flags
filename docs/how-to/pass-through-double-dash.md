# How-to: pass through arguments after `--`

## Goal
Parse your own flags while forwarding remaining tokens to a child command.

## Prerequisites
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste runnable code
```sh
node examples/pass-through-double-dash.mjs --profile agent -- --trace --limit=2
```

## Expected output
JSON output with:
- `"ok": true`
- `"profile": "agent"`
- `"rest": ["--trace", "--limit=2"]`

## Common failure modes
- `stopAtDoubleDash` is disabled, so forwarded flags are accidentally parsed as
  local schema options.
- The wrapper CLI forwards `unknown` tokens instead of `rest`, which breaks
  child command expectations.
- Exit-code handling treats a child-command failure as if flag parsing failed.

## Related reference
- [Options reference](../reference/options.md)
- [Parse result reference](../reference/parse-result.md)

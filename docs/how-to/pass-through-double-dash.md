# How-to: pass through arguments after `--`

## Goal
Parse your own flags while forwarding remaining tokens to a child command.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
node examples/pass-through-double-dash.mjs --profile agent -- --trace --limit=2
```

## What you should see
JSON output with:
- `"ok": true`
- `"profile": "agent"`
- `"rest": ["--trace", "--limit=2"]`

## Safety notes
> [!NOTE]
> Keep `stopAtDoubleDash: true` when forwarding arguments. This prevents
> forwarded tokens from being parsed as local flags.

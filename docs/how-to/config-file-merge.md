# How-to: merge config file values with CLI overrides

## Goal
Apply defaults, then config-file values, then CLI flags as highest-priority
overrides.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
node examples/config-file-merge.mjs --mode strict --retries 7 --verbose
```

## What you should see
JSON output with:
- `"ok": true`
- `"merged.mode": "strict"`
- `"merged.retries": 7`
- `"merged.verbose": true`

## Safety notes
> [!NOTE]
> Use `parsed.present.<key>` to determine whether a CLI value is explicitly
> provided before overriding config-file values.

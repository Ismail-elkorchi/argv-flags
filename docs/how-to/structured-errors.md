# How-to: use structured error codes in automation

## Goal
Return predictable exit codes and machine-readable issue codes for CI or agent
workflows.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```sh
node examples/structured-errors.mjs --retries not-a-number
echo $?
```

## What you should see
- stderr JSON with `"ok": false`
- first issue code is `"INVALID_VALUE"`
- command exits with status code `1`

## Safety notes
> [!WARNING]
> Write structured diagnostics to stderr and keep stdout reserved for success
> payloads. This avoids mixed-output parsing failures in scripts.

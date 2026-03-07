# How-to: use structured error codes in automation

## Goal
Return predictable exit codes and machine-readable issue codes for CI or agent
workflows.

## Prerequisites
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste runnable code
```sh
node examples/structured-errors.mjs --retries not-a-number
echo $?
```

## Expected output
- stderr JSON with `"ok": false`
- first issue code is `"INVALID_VALUE"`
- command exits with status code `1`

## Common failure modes
- Success payloads and failure diagnostics are both written to stdout, which
  breaks automation consumers.
- Callers branch on human-readable messages instead of stable `issue.code`
  values.
- Exit code `1` is reused for usage, validation, and downstream failures
  without a documented contract around each case.
- Callers assume `argv-flags` defines exit codes. It does not; your wrapper
  decides whether parse failures map to `1`, `2`, or another contract.

## Related reference
- [Parse result reference](../reference/parse-result.md)
- [Options reference](../reference/options.md)

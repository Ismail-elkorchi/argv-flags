# How-to: use structured error codes in automation

Applications can map parse issues to their own exit-code contract:

```sh
node examples/structured-errors.mjs --retries not-a-number
echo $?
```

The example writes an `INVALID_VALUE` issue to stderr and exits with status
`1`. `argv-flags` provides stable issue codes but does not choose exit codes;
that policy belongs to the application.

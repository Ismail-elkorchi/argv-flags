# Handle structured issues

Applications can map parse issues to their own exit-code contract:

```sh
node examples/structured-errors.mjs --retries not-a-number
echo $?
```

The example writes an `INVALID_FLAG_VALUE` issue to stderr and exits with
status `1`.

Use `issue.code` for automation. The `message` field can change to improve
human-readable output.

# Collect unknown flag arguments

Set `allowUnknownFlags: true` when another parser or command will handle
unrecognized flags:

```sh
node examples/handle-unknown-flags.mjs --mode safe --extra=1 file.txt
```

`unknownArguments` contains:

```json
[
  {
    "argument": "--extra=1",
    "flag": "--extra",
    "index": 2
  }
]
```

`positionals` contains `file.txt`.

Without this setting, the issue contains `flag: "--extra"` and
`argument: "--extra=1"`. The distinction preserves both the parsed flag name
and the original argument.

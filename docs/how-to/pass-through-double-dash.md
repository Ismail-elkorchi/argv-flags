# Pass arguments through after `--`

`--` always ends flag parsing:

```sh
node examples/pass-through-double-dash.mjs \
  --profile strict \
  -- \
  --trace \
  --limit=2
```

The result contains:

```json
{
  "profile": "strict",
  "argumentsAfterDoubleDash": ["--trace", "--limit=2"]
}
```

Forward `argumentsAfterDoubleDash` when exact child-command ordering matters.

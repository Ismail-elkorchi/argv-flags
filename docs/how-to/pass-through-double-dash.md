# Pass argv elements through after `--`

The exact argv element `--` always ends option parsing:

```sh
node examples/pass-through-double-dash.mjs \
  --profile strict \
  -- \
  --trace \
  --limit=2
```

The successful result contains:

```json
{
  "profile": "strict",
  "afterDoubleDash": ["--trace", "--limit=2"]
}
```

`--` itself is omitted. Forward `afterDoubleDash` when exact child-command
ordering matters.

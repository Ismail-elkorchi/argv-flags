# How-to: pass through arguments after `--`

Use `--` to stop local parsing and preserve every following token in `rest`:

```sh
node examples/pass-through-double-dash.mjs --profile strict -- --trace --limit=2
```

The result contains `profile: "strict"` and
`rest: ["--trace", "--limit=2"]`. Forward `rest`, not `unknown`, when exact
child-command argument order matters.

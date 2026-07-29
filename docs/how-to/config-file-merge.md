# How-to: merge config file values with CLI overrides

Apply defaults first, config-file values second, and explicitly present CLI
flags last:

```sh
node examples/config-file-merge.mjs --mode strict --retries 7 --verbose
```

The result has `ok: true`, `mode: "strict"`, `retries: 7`, and
`verbose: true`.

Use `present.<key>` to distinguish a CLI override from a schema default. Keep
the merge order explicit so configuration cannot overwrite values supplied by
the user.

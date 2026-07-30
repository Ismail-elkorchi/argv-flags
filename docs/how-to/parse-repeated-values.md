# Parse repeated values

Set `multiple: true` on a string option:

```ts
const parser = createParser({
  include: {
    type: "string",
    flags: ["--include"],
    multiple: true,
  },
});
```

Supply the flag once for each value:

```sh
node examples/parse-repeated-values.mjs \
  --include src \
  --include test \
  --include docs
```

The result is `["src", "test", "docs"]`. Each occurrence consumes exactly one
value. Any additional argument remains positional unless another
`--include` occurrence consumes it.

If the option has a default, explicit values replace it. They do not append to
the fallback.

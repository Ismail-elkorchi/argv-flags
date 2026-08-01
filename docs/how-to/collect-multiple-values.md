# Collect multiple values

Set `multiple: true` on any value-taking option:

```ts
const parser = createParser({
  include: {
    type: "string",
    flags: ["-I", "--include"],
    multiple: true,
  },
});
```

Each occurrence contributes one value:

```sh
node examples/collect-multiple-values.mjs -Isrc -Itest --include=docs
```

The result is `["src", "test", "docs"]`. An explicit sequence replaces a
configured default rather than appending to it. Scalar option occurrences use
the separate `repeat` policy; they do not produce multiple-value arrays.

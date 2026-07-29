# How-to: parse repeated array values

An `array` flag appends values across occurrences while preserving order:

```sh
node examples/parse-arrays.mjs --include src test --include docs
```

The result is `["src", "test", "docs"]`. Array defaults are cloned for each
parse, and new values append to that default. A required array still reports a
missing value when no values follow the flag unless `allowEmpty` is enabled.

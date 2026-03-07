# How-to: parse repeated array values

## Goal
Collect repeated values for one flag key into a single ordered array.

## Prerequisites
- `argv-flags` installed
- `npm run build`
- Schema includes an `array` field

## Copy/paste runnable code
```sh
node examples/parse-arrays.mjs --include src test --include docs
```

## Expected output
- Output array preserves encounter order: `["src", "test", "docs"]`.

## Common failure modes
- Callers expect later array occurrences to replace earlier ones. `argv-flags`
  appends instead of replacing.
- Mutable array defaults are reused outside the parser. `argv-flags` clones the
  default per parse call, but your surrounding application state may still
  mutate shared data.
- A required array flag is declared without handling the empty-array case when
  no values follow the flag.

## Related reference
- [Schema reference](../reference/schema.md)
- [Parse result reference](../reference/parse-result.md)

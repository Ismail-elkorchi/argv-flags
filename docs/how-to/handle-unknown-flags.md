# How-to: capture unknown flags without failing

Set `allowUnknown: true` to collect unrecognized flags without turning them into
errors:

```sh
node examples/handle-unknown-flags.mjs --mode safe --extra=1 file.txt
```

`unknown` contains `--extra=1`, `rest` contains `file.txt`, and `ok` remains
true. Unknown flags and positional arguments are intentionally separate.
For exact pass-through ordering, use [`--`](pass-through-double-dash.md) and
forward `rest`.

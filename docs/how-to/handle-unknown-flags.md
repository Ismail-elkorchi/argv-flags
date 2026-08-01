# Collect unknown flags

Use `unknownFlagPolicy: "collect"` when another parser or command owns
unrecognized flags:

```ts
const result = parser.parse({
  argv,
  unknownFlagPolicy: "collect",
});
```

For `--other=1`, the result retains:

```json
{
  "argvElement": "--other=1",
  "flag": "--other",
  "argvIndex": 2,
  "inlineValue": "1"
}
```

Unknown flags consume no following argv element. Under the default `"error"`
policy the same record is retained and an `UNKNOWN_FLAG` issue is added.

Run the example:

```sh
node examples/handle-unknown-flags.mjs --mode safe --other=1 file.txt
```

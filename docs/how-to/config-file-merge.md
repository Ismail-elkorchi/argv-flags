# Merge configuration with CLI values

Apply application defaults first, configuration-file values second, and
explicit CLI values last:

```sh
node examples/config-file-merge.mjs --mode strict --retries 7 --verbose
```

Use `specified.<option>` to distinguish a CLI occurrence from a parser default:

```js
const merged = {
  ...applicationDefaults,
  ...configurationFile,
  ...(result.specified.mode ? { mode: result.values.mode } : {}),
};
```

`specified` becomes true when a recognized flag for the option appears.

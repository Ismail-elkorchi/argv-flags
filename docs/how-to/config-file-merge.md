# Merge configuration with CLI values

Merge application defaults, a configuration file, then explicitly specified
CLI values:

```js
const merged = {
  ...applicationDefaults,
  ...configurationFile,
  ...(result.specified.mode ? { mode: result.values.mode } : {}),
  ...(result.specified.retries ? { retries: result.values.retries } : {}),
};
```

`specified.<option>` becomes true when a recognized flag appears, including an
occurrence whose value is later rejected. Read it with `values` only after a
successful parse, as in the runnable example:

```sh
node examples/config-file-merge.mjs --mode strict --retries 7 --verbose
```

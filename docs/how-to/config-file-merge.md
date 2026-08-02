# Merge configuration with CLI values

After a successful parse, merge application defaults, a configuration file,
then explicitly specified CLI values:

```js
if (result.success) {
  const merged = {
    ...applicationDefaults,
    ...configurationFile,
    ...(result.specified.mode ? { mode: result.values.mode } : {}),
    ...(result.specified.retries ? { retries: result.values.retries } : {}),
  };

  use(merged);
}
```

`specified.<option>` becomes true when a recognized flag appears, including an
occurrence whose value is later rejected. The successful branch is the only
branch that exposes `values`, as shown by the runnable example:

```sh
node examples/config-file-merge.mjs --mode strict --retries 7 --verbose
```

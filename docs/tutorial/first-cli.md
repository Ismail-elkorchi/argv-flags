# Tutorial: first CLI with exit codes

The included example parses `--src` and `--dest`, writes JSON, and maps invalid
arguments to exit code `2`:

```sh
node examples/first-cli.mjs --src input.txt --dest output.txt
```

To see the failure path, omit required `--dest`:

```sh
node examples/first-cli.mjs --src input.txt
echo $?
```

The successful command prints parsed `values` with `ok: true`. The failure
command writes structured `issues` to stderr and exits with status `2`. Branch
on `issues[].code`, such as `REQUIRED` or `INVALID_VALUE`; messages are for
people, not program logic.

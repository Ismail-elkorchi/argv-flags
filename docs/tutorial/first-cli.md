# Tutorial: first CLI with exit codes

## Goal
Build a tiny CLI that parses `--src` and `--dest`, returns JSON on success, and
returns structured issues on failure.

## Prereqs
- Node `>=24`
- Install dependencies: `npm install`
- Build once: `npm run build`

## Copy/paste
```sh
node examples/first-cli.mjs --src input.txt --dest output.txt
```

Failure path (missing required `--dest`):

```sh
node examples/first-cli.mjs --src input.txt
echo $?
```

## What you should see
- Success command prints JSON with `ok: true` and parsed `values`.
- Failure command prints JSON with `ok: false` and `issues` to stderr.
- Failure command exits with status code `2`.

## Safety notes
> [!NOTE]
> Treat `issues[].code` as the machine contract (`REQUIRED`, `INVALID_VALUE`,
> etc.). Do not parse human-readable `message`.

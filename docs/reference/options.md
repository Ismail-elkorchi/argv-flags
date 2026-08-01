# Options, values, grammar, and parse settings

## Definitions

`createParser()` accepts a plain or null-prototype object keyed by logical
option name. Every option has a `type` and a non-empty `flags` array. The
compiler validates, copies, and freezes everything it retains.

### Value options

```ts
import { createParser, value } from "argv-flags";

const parser = createParser({
  output: { type: "string", flags: ["-o", "--output"], required: true },
  ratio: { type: value.number({ minimum: 0, maximum: 1 }), flags: ["--ratio"] },
  jobs: { type: value.integer({ minimum: 1 }), flags: ["-j", "--jobs"] },
  color: {
    type: value.choice(["auto", "always", "never"]),
    flags: ["--color"],
    default: "auto",
  },
});
```

`"string"` rejects an empty raw value. `value.string({ empty: "allow" })`
accepts it. `"number"` parses finite decimal syntax and `"integer"` parses safe
integers. Their factory forms accept inclusive `minimum` and `maximum` bounds.
`value.choice()` preserves literal output types and suggests close configured
choices after a rejection.

Set `multiple: true` to collect one decoded value from each occurrence:

```ts
const parser = createParser({
  include: {
    type: value.choice(["src", "test", "docs"]),
    flags: ["-I", "--include"],
    multiple: true,
    default: ["src"],
  },
});
```

Explicit occurrences replace a multiple default. An absent multiple option
without a default produces `[]`.

A scalar value normally consumes an inline value or the next argv element.
Optional-inline mode instead uses a compiled implicit value when the flag is
bare:

```ts
const parser = createParser({
  color: {
    type: value.choice(["auto", "always", "never"]),
    flags: ["--color"],
    valueMode: "optional-inline",
    implicitValue: "auto",
  },
});
```

Here `--color` selects `"auto"`, `--color=always` selects `"always"`, and
`--color always` leaves `always` positional.

### Boolean and count options

```ts
const parser = createParser({
  verbose: {
    type: "boolean",
    flags: ["-v", "--verbose"],
    falseFlags: ["--no-verbose"],
    default: false,
  },
  quiet: { type: "count", flags: ["-q", "--quiet"] },
});
```

Positive flags contribute `true`; `falseFlags` contribute `false`. Boolean
flags consume no value. Count options start at zero and increment for every
occurrence, so `-qqq` contributes three.

### Presence and repetition

- `required: true` requires a recognized occurrence and cannot be combined
  with `default`.
- Defaults apply only when an option has no occurrence and the whole parse
  succeeds.
- Scalar and boolean `repeat` is `"error"` by default. `"first"` preserves the
  first successfully decoded value; `"last"` selects the latest.
- Multiple and count options do not accept `repeat`.

Definitions are closed. Properties that do not belong to the selected option
kind are rejected.

## Custom values

`value.custom()` accepts a synchronous, closed protocol:

```ts
const identifier = value.custom({
  parse(raw) {
    return raw.startsWith("id:")
      ? { success: true, value: { text: raw.slice(3) } }
      : { success: false, message: "Expected an id: prefix." };
  },
  accepts(candidate): candidate is { readonly text: string } {
    return typeof candidate === "object" && candidate !== null &&
      "text" in candidate && typeof candidate.text === "string";
  },
  snapshot(candidate) {
    return { text: candidate.text };
  },
});
```

`accepts()` validates defaults, implicit values, decoded values, and snapshots.
Use `snapshot()` when outputs are mutable; the parser calls it at ownership
boundaries. A failure may add `reason`, a shallow-copied `details` object, and
up to three `suggestions`. Promise results and malformed protocol results are
programming errors.

## Flag and argv grammar

- Short configured flags match `-[A-Za-z0-9]`.
- Long configured flags begin with `--` and contain ASCII letters, digits,
  underscores, or hyphens.
- Matching is case-sensitive and every spelling has one owner.

| Form | Behavior |
| --- | --- |
| `--name value` | A required-value long flag consumes the next element. |
| `--name=value` | A long flag receives the inline value. |
| `-n value` | A bare required-value short flag consumes the next element. |
| `-nvalue`, `-n=value` | A short flag receives the attached value. |
| `-abc` | Scans short members from left to right. |
| `--` | Ends parsing and moves later elements to `afterDoubleDash`. |

Boolean and count members continue a short cluster. A value-taking member owns
the remaining suffix and ends the cluster. If it is the final member, a
required-value option consumes the next element while an optional-inline
option selects its implicit value.

A separate required value is consumed verbatim even when it begins with `-`.
Only the exact argv element `--` interrupts it. Unknown flags consume no
following element. Malformed flag-like elements produce
`INVALID_FLAG_SYNTAX`.

## Parse settings

```ts
interface ParseSettings {
  readonly argv?: readonly string[];
  readonly unknownFlagPolicy?: "error" | "collect";
  readonly flagPlacement?: "interspersed" | "before-positionals";
}
```

- `argv` supplies an explicit vector. Without it, parsing uses
  `process.argv.slice(2)`, then `Deno.args`, then `[]`.
- `unknownFlagPolicy: "collect"` retains unknown flags without making the parse
  fail. The default is `"error"`.
- `flagPlacement: "before-positionals"` makes the first positional turn all
  later pre-`--` elements into positionals. The default is `"interspersed"`.

Settings are closed plain or null-prototype objects with own data properties.

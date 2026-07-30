# Design

## Public facade

`createParser()` compiles definitions into an immutable lookup and returns one
reusable `parse()` method. `DefinitionError` exposes structured compilation
failures. Lookup data, runtime detection, and parsing state remain internal.

## Vocabulary

- **argument**: one raw input string;
- **flag**: a literal CLI spelling parsed from an argument;
- **option**: one logical configured value selected by flags;
- **value**: parsed data belonging to an option;
- **positional**: an unconsumed argument before `--`.

## Deterministic classification

The parser classifies each argument once, from left to right:

1. `--` ends parsing.
2. Non-flag arguments become positionals.
3. Long flags may contain one inline value.
4. A two-character short argument is one short flag.
5. Longer short arguments are boolean clusters, except unsupported `=`
   syntax.

A recognized non-boolean flag consumes exactly one value. Without a long
inline value, it consumes the next argument verbatim unless that argument is
`--`. Boolean flags consume nothing. Unknown flags also consume nothing.

Scalar duplication and malformed clusters are errors. Multiple strings collect
one value per occurrence. Defaults are materialized only after an error-free
parse and only for absent options.

## Result boundary

Successful results expose typed values. Failed results expose diagnostics.
They never expose partial values or defaults. Both forms retain occurrence
metadata, positionals, post-`--` arguments, and allowed unknown flags.

## Runtime boundary

The default entrypoint imports no runtime-specific module. Runtime arguments
are read from `globalThis` only when `parse()` is called. Explicit `args`
always take precedence.

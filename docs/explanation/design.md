# Design

## Boundary

`argv-flags` is the layer between an argv vector and a trustworthy typed option
object. It deliberately leaves commands, help rendering, process exits,
configuration discovery, and prompts to the application.

The public runtime facade exports `createParser`, `createParserFromMap`,
`composeParsers`, `createArgvCursor`, `DefinitionError`, and `value`. `createParser()`
validates and snapshots literal definitions once, builds prototype-safe flag
lookups, and returns a frozen reusable parser. Parsing has no live dependency
on the caller's definition objects.

`createParserFromMap()` serves integration libraries that assemble definition
maps dynamically. It accepts the closed `OptionDefinitionMap` union while
leaving the stronger per-property inference of literal definitions to
`createParser()`.

## Vocabulary

- **argv vector**: the complete input string array;
- **argv element**: one string in that vector;
- **option**: one logical configured setting;
- **flag**: a configured spelling that selects an option;
- **positional argument**: an argv element classified as positional;
- **raw value**: text supplied to a value parser.

These words are not interchangeable in fields or diagnostics.

## Classification

The scanner moves left to right. It separates long forms, short members,
positional arguments, and the `--` boundary. Boolean and count members continue
a cluster; a value-taking member owns the remaining suffix. A bare required
value flag consumes exactly one following argv element, while optional-inline
and unknown flags consume none.

Recognition, conversion, repetition, and final materialization are distinct.
That separation lets failed results retain exact source locations without
exposing partial values or successful-looking defaults.

A scope-aware router owns one `ArgvCursor`. Each `scanNext()` advances one
complete span under the current parser; the router can change parser scopes
only between spans. `decode()` consumes the completed retained classification,
not a second scan. Standalone `scan()` and `parse()` drive these same operations.
An incomplete or fabricated cursor is a programming error.

`composeParsers()` unions declarations from owned parser handles. It retains
compiled declaration identities and snapshots instead of compiling defaults
again. Duplicate option names and flag spellings are rejected. Decoding permits
scope changes only when the final composition contains the exact declarations
that classified every recognized occurrence.

## Ownership and runtime independence

Records and arrays are adopted from own data properties without invoking caller
accessors or array iterators. Package-owned result containers are fresh and
shallow-frozen. Custom parsers
define snapshot behavior for their own mutable values. The default entrypoint
imports no runtime-specific module: argv is read from `globalThis` only when
`parse()` is called, and explicit `argv` always wins.

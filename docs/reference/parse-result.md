# Results and diagnostics

## Result union

`parse()` returns a TypeScript union discriminated by `success`:

```ts
const result = parser.parse({ args });

if (result.success) {
  console.log(result.values);
} else {
  console.error(result.issues);
}
```

Every result contains:

- `success`;
- `specified`: whether a recognized flag for each option appeared;
- `positionals`: unconsumed arguments encountered before `--`;
- `argumentsAfterDoubleDash`: every argument after `--`;
- `unknownArguments`: unknown flags collected when allowed.

A successful result contains `values` and no `issues`. Required, defaulted, and
multiple string options have guaranteed values in TypeScript. Other value
properties are optional.

A failed result contains `issues` and no `values`. Parsed fragments and
defaults are deliberately unavailable, so invalid input cannot resemble a
successful fallback.

Absent optional values are omitted rather than stored as `undefined`.

## Unknown arguments

Each collected unknown flag retains its source:

```ts
{
  argument: "--other=value",
  flag: "--other",
  index: 3,
}
```

For a short cluster, each unknown member uses its expanded flag spelling and
the index of the complete cluster argument.

## Parse issue codes

| Code | Meaning |
| --- | --- |
| `UNKNOWN_FLAG` | No definition recognizes the flag. |
| `MISSING_FLAG_VALUE` | A string or number flag has no value. |
| `INVALID_FLAG_VALUE` | A supplied value cannot be converted. |
| `UNEXPECTED_FLAG_VALUE` | A boolean flag received an inline value. |
| `EMPTY_FLAG_VALUE` | A string is empty when empty values are disabled. |
| `INVALID_FLAG_SYNTAX` | A short flag uses attached-value syntax or a value-taking flag appears in a cluster. |
| `MISSING_REQUIRED_OPTION` | A required option did not occur. |
| `DUPLICATE_OPTION` | A scalar option occurred more than once. |

Argument-related issues include the parsed `flag`, complete `argument`, and
zero-based `index`. Issues for recognized definitions also include `option`.
Use `code` for program logic and `message` for people.

## Definition diagnostics

Invalid definitions throw `DefinitionError`. The error contains an immutable
`issues` array with these codes:

| Code | Meaning |
| --- | --- |
| `INVALID_DEFINITIONS` | The definitions container is not an object. |
| `INVALID_OPTION_NAME` | An option key is not a valid string name. |
| `INVALID_OPTION_DEFINITION` | An option definition is not an object. |
| `INVALID_OPTION_TYPE` | `type` is missing or unsupported. |
| `UNSUPPORTED_DEFINITION_PROPERTY` | A definition contains an unknown field. |
| `INVALID_DEFINITION_PROPERTY` | A supported field has an invalid value. |
| `CONFLICTING_DEFINITION_PROPERTIES` | Valid fields cannot be used together. |
| `INVALID_FLAG` | A positive or negated flag is malformed. |
| `DUPLICATE_FLAG` | A flag is repeated or assigned more than once. |

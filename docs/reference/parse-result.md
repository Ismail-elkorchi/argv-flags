# Results and diagnostics

## Result union

`parse()` returns a union discriminated by `success`:

```ts
const result = parser.parse({ argv });

if (result.success) {
  use(result.values);
} else {
  report(result.issues);
}
```

Every result contains:

- `specified`: whether each option had a recognized flag;
- `positionals`: positional arguments before `--`;
- `afterDoubleDash`: argv elements after `--`;
- `unknownFlags`: unknown flags with source locations.

A successful result contains `values`. Required, defaulted, multiple, and count
options are guaranteed properties; optional scalars and booleans are omitted
when absent. A failed result contains `issues` and no `values`, partial decoded
state, or defaults.

Package-owned result objects and arrays are shallow-frozen. `values` and
`specified` use null prototypes, so option names such as `__proto__` are safe.

## Unknown flags

An unknown long flag preserves its original argv element:

```ts
{
  argvElement: "--other=value",
  flag: "--other",
  argvIndex: 3,
  inlineValue: "value",
}
```

An unknown short-cluster member additionally has `offset`, the zero-based
UTF-16 position of the member in the complete argv element.

## Parse issues

`ParseIssue` is a closed union. Narrow it with `issue.code`.

| Code | Meaning |
| --- | --- |
| `UNKNOWN_FLAG` | No definition owns the flag. |
| `INVALID_FLAG_SYNTAX` | A flag-like argv element is malformed. |
| `MISSING_OPTION_VALUE` | A required-value occurrence has no available value. |
| `INVALID_OPTION_VALUE` | The selected value parser rejected the raw value. |
| `UNEXPECTED_OPTION_VALUE` | A boolean or count flag received inline text. |
| `REPEATED_OPTION` | A scalar or boolean using `repeat: "error"` succeeded more than once. |
| `MISSING_REQUIRED_OPTION` | A required option had no recognized occurrence. |

Flag-related issues retain `flag`, `argvElement`, and `argvIndex`; short members
also retain `offset`. Invalid values include `rawValue`, `valueArgvIndex`, and
whether the value was inline. Choice, custom-value, and unknown-long failures
may include frozen `suggestions` without changing the failure.

Scan issues follow argv and cluster order. Missing-required issues follow in
definition order. Use codes and structured fields for program logic; messages
are for display.

## Definition diagnostics

Invalid definitions throw `DefinitionError` with a frozen `issues` array.

| Code | Meaning |
| --- | --- |
| `INVALID_DEFINITIONS` | The definitions container is invalid. |
| `INVALID_OPTION_NAME` | An option key is invalid. |
| `INVALID_OPTION_DEFINITION` | One definition is not a plain object. |
| `UNSUPPORTED_OPTION_PROPERTY` | A property is outside the selected definition shape. |
| `INVALID_OPTION_PROPERTY` | A supported property has an invalid value. |
| `CONFLICTING_OPTION_PROPERTIES` | Valid properties cannot be combined. |
| `INVALID_FLAG` | A configured flag is malformed. |
| `DUPLICATE_FLAG` | More than one entry claims a flag spelling. |
| `INVALID_VALUE_PARSER` | `type` is an object not produced by `value`. |
| `INVALID_DEFAULT` | A default violates the selected value contract. |

Compilation reports every independently discoverable definition issue.
Malformed settings and custom protocols are programming errors and throw
`TypeError`; exceptions from custom callbacks propagate unchanged.

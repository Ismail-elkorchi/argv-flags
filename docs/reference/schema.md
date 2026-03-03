# Schema reference

## Flag types

```ts
type FlagType = "string" | "boolean" | "number" | "array";
```

## Flag spec

```ts
interface FlagSpec<T extends FlagType = FlagType> {
  type: T;
  flags: readonly string[];
  required?: boolean;
  default?: FlagValue<T>;
  allowEmpty?: boolean;
  allowNo?: boolean;
}
```

### Rules

- `flags` must include at least one token; each token must start with `-` and have length `>= 2`.
- `--` is the reserved stop token (when `stopAtDoubleDash` is enabled) and should not be used as a schema flag.
- `allowNo` enables `--no-<flag>` for boolean specs (default: `true`).
- `allowEmpty` allows empty values for strings/arrays (default: `false`).
- Array defaults are cloned; repeated arrays append.

# argv-flags

Tiny helper for parsing simple CLI flags from `process.argv`.

## Installation

```sh
npm install argv-flags
```

## Usage

```js
const parseFlag = require('argv-flags');

const name = parseFlag('--name', 'string');
const enabled = parseFlag('--enabled', 'boolean');
const count = parseFlag('--count', 'number');
const items = parseFlag('--items', 'array');
```

### Inline values

Flags can be passed as `--flag=value` for string, number, boolean, and array types:

```sh
--enabled=false
--count=5
--items=a b
```

### Boolean flags

Boolean flags accept explicit values when provided:

```sh
--enabled true
--enabled false
```

If no value is provided, the presence of the flag returns `true`.

### Array flags

Array flags collect values until the next `--flag`:

```sh
--items a b c --other
```

### Testing / custom argv

You can pass a custom argv array (useful for tests):

```js
const argv = ['node', 'script.js', '--flag', 'true'];
parseFlag('--flag', 'boolean', argv);
```

## License

MIT

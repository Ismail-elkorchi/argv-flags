import { composeParsers, createArgvCursor, createParser, type ArgvCursor, type ArgvSpan } from 'argv-flags';

const root = createParser({ verbose: { type: 'boolean', flags: ['-v'] } });
const child = createParser({ source: { type: 'string', flags: ['--source'], required: true } });
const effective = composeParsers([root, child]);
const cursor: ArgvCursor = createArgvCursor({ argv: ['-v', 'build', '--source=x'] });
const span: ArgvSpan = root.scanNext(cursor);
const first: number = span.startIndex;
const end: number = span.endIndex;
void first;
void end;
while (!cursor.done) effective.scanNext(cursor);
const result = effective.decode(cursor, { unknownFlagPolicy: 'collect' });
if (result.success) {
	const unknown: unknown = result.values['source'];
	void unknown;
}
// @ts-expect-error Cursor state cannot be advanced by assignments.
cursor.index = 3;
// @ts-expect-error A structural object cannot forge the owned cursor capability.
const forged: ArgvCursor = { argv: [], index: 0, done: true };
void forged;
const settings = { argv: [], unsupported: true };
// @ts-expect-error Cursor settings are closed through variables.
createArgvCursor(settings);
// @ts-expect-error Decode accepts only its own settings.
effective.decode(cursor, { argv: [] });
const decodeSettings = { unknownFlagPolicy: 'collect', unsupported: true } as const;
// @ts-expect-error Decode settings are closed through variables.
effective.decode(cursor, decodeSettings);

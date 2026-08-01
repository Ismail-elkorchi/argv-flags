import { spawnSync } from 'node:child_process';
import {
	mkdtemp,
	mkdir,
	rm,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'argv-flags-consumers-'));
const packageManager = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, commandArguments, cwd) => {
	const result = spawnSync(command, commandArguments, {
		cwd,
		encoding: 'utf8',
		env: {
			...process.env,
			DENO_NO_UPDATE_CHECK: '1'
		}
	});
	if (result.status !== 0) {
		throw new Error(
			[
				`${command} ${commandArguments.join(' ')} failed with status ${String(result.status)}.`,
				result.stdout,
				result.stderr
			]
				.filter((line) => line.length > 0)
				.join('\n')
		);
	}
	return result;
};

try {
	const packResult = run(
		packageManager,
		['pack', '--json', '--pack-destination', temporaryRoot],
		repositoryRoot
	);
	const archives = JSON.parse(packResult.stdout);
	const archive = archives[0];
	if (archives.length !== 1 || archive === undefined) {
		throw new Error('Expected npm pack to produce exactly one tarball.');
	}
	const publishedPaths = new Set(archive.files.map((file) => file.path));
	for (const expected of [
		'docs/reference/options.md',
		'dist/index.js.map',
		'dist/index.d.ts.map',
		'src/index.ts'
	]) {
		if (!publishedPaths.has(expected)) {
			throw new Error(`Packed package is missing ${expected}.`);
		}
	}

	const tarballPath = path.join(temporaryRoot, archive.filename);
	const consumerRoot = path.join(temporaryRoot, 'consumer');
	await mkdir(consumerRoot);
	await writeFile(
		path.join(consumerRoot, 'package.json'),
		`${JSON.stringify(
			{
				private: true,
				type: 'module',
				dependencies: {
					'argv-flags': `file:${tarballPath}`
				}
			},
			null,
			2
		)}\n`
	);
	await writeFile(
		path.join(consumerRoot, 'consumer.mjs'),
		`import { DefinitionError, createParser, value } from 'argv-flags';

const parser = createParser({
  all: { type: 'boolean', flags: ['-a'] },
  brief: { type: 'boolean', flags: ['-b'] },
  color: { type: 'boolean', flags: ['-c'] },
  name: { type: 'string', flags: ['--name'], required: true },
  jobs: { type: value.integer({ minimum: 1 }), flags: ['-j'], default: 1 },
  quiet: { type: 'count', flags: ['-q'] },
});
const result = parser.parse({
  argv: ['-abc', '--name', '--literal', '-j3', '-qq', '--', 'after'],
});
if (
  !result.success ||
  result.values.all !== true ||
  result.values.brief !== true ||
  result.values.color !== true ||
  result.values.name !== '--literal' ||
  result.values.jobs !== 3 ||
  result.values.quiet !== 2 ||
  result.afterDoubleDash[0] !== 'after'
) {
  throw new Error('Installed package returned an unexpected parse result.');
}

try {
  createParser({ invalid: { type: 'boolean', flags: ['--invalid'], typo: true } });
  throw new Error('Installed package accepted an invalid definition.');
} catch (error) {
  if (!(error instanceof DefinitionError) || error.issues[0]?.code !== 'UNSUPPORTED_OPTION_PROPERTY') {
    throw error;
  }
}

const runtimeResult = createParser({
  quiet: { type: 'count', flags: ['-q'] },
}).parse();
if (!runtimeResult.success || runtimeResult.values.quiet !== 0) {
  throw new Error('Installed package could not resolve the runtime argv.');
}
`
	);
	await writeFile(
		path.join(consumerRoot, 'consumer.ts'),
		`import { createParser, value, type ParseIssue } from 'argv-flags';

const parser = createParser({
  source: { type: 'string', flags: ['--source'], required: true },
  count: { type: value.integer({ minimum: 0 }), flags: ['--count'], default: 1 },
  mode: { type: value.choice(['auto', 'always']), flags: ['--mode'], default: 'auto' },
});
const result = parser.parse({ argv: [] });
if (result.success) {
  const source: string = result.values.source;
  const count: number = result.values.count;
  const mode: 'auto' | 'always' = result.values.mode;
  void source;
  void count;
  void mode;
} else {
  const issues: readonly ParseIssue[] = result.issues;
  void issues;
}
`
	);
	await writeFile(
		path.join(consumerRoot, 'tsconfig.json'),
		`${JSON.stringify(
			{
				compilerOptions: {
					target: 'ES2022',
					module: 'NodeNext',
					moduleResolution: 'NodeNext',
					noEmit: true,
					strict: true,
					skipLibCheck: false
				},
				include: ['consumer.ts']
			},
			null,
			2
		)}\n`
	);

	run(
		packageManager,
		[
			'install',
			'--offline',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
			'--package-lock=false'
		],
		consumerRoot
	);
	run(
		process.execPath,
		[
			path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
			'-p',
			'tsconfig.json'
		],
		consumerRoot
	);
	run(process.execPath, ['consumer.mjs'], consumerRoot);
	run(
		'deno',
		['run', '--cached-only', '--node-modules-dir=manual', 'consumer.mjs'],
		consumerRoot
	);
	run('bun', ['run', '--no-install', 'consumer.mjs'], consumerRoot);
	process.stdout.write('packed-consumers: Node, Deno, and Bun PASS\n');
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}

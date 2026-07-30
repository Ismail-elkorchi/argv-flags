import { spawnSync } from 'node:child_process';
import {
	mkdtemp,
	mkdir,
	readdir,
	rm,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'argv-flags-consumers-'));
const packageManager = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, args, cwd) => {
	const result = spawnSync(command, args, {
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
				`${command} ${args.join(' ')} failed with status ${String(result.status)}.`,
				result.stdout,
				result.stderr
			]
				.filter((line) => line.length > 0)
				.join('\n')
		);
	}
};

try {
	run(
		packageManager,
		['pack', '--silent', '--pack-destination', temporaryRoot],
		repositoryRoot
	);
	const packageFiles = (await readdir(temporaryRoot)).filter((file) =>
		file.endsWith('.tgz')
	);
	if (packageFiles.length !== 1 || packageFiles[0] === undefined) {
		throw new Error('Expected npm pack to produce exactly one tarball.');
	}

	const tarballPath = path.join(temporaryRoot, packageFiles[0]);
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
		`import { DefinitionError, createParser } from 'argv-flags';

const parser = createParser({
  all: { type: 'boolean', flags: ['-a'] },
  brief: { type: 'boolean', flags: ['-b'] },
  color: { type: 'boolean', flags: ['-c'] },
  name: { type: 'string', flags: ['--name'], required: true },
});
const result = parser.parse({
  args: ['-abc', '--name', '--literal', '--', 'after'],
});
if (
  !result.success ||
  result.values.all !== true ||
  result.values.brief !== true ||
  result.values.color !== true ||
  result.values.name !== '--literal' ||
  result.argumentsAfterDoubleDash[0] !== 'after'
) {
  throw new Error('Installed package returned an unexpected parse result.');
}

try {
  createParser({ invalid: { type: 'boolean', flags: ['--invalid'], typo: true } });
  throw new Error('Installed package accepted an invalid definition.');
} catch (error) {
  if (!(error instanceof DefinitionError) || error.issues[0]?.code !== 'UNSUPPORTED_DEFINITION_PROPERTY') {
    throw error;
  }
}
`
	);
	await writeFile(
		path.join(consumerRoot, 'consumer.ts'),
		`import { createParser, type ParseIssue } from 'argv-flags';

const parser = createParser({
  source: { type: 'string', flags: ['--source'], required: true },
  count: { type: 'number', flags: ['--count'], default: 1 },
});
const result = parser.parse({ args: [] });
if (result.success) {
  const source: string = result.values.source;
  const count: number = result.values.count;
  void source;
  void count;
} else {
  const issues: ParseIssue[] = result.issues;
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

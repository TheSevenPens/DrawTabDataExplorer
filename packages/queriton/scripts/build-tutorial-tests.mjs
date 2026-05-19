#!/usr/bin/env node
// Extracts runnable code blocks from docs/tutorial/*.md and emits
// test/tutorial-snippets.generated.test.ts so vitest verifies that
// every snippet shown in the tutorial actually works.
//
// Convention: a fenced block tagged exactly `ts run` is treated as a
// runnable snippet. Plain `ts` blocks are unverified illustrations.
//
//   ```ts run
//   const n = await penguinsQ().count();
//   expect(n).toBe(344);
//   ```
//
// Each runnable snippet becomes one `it()` inside a chapter-named
// `describe()` block. Snippets share no state across blocks — each
// runs in its own function scope with the common preamble (Query
// constructors, fixture imports, helpers) in lexical scope.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');
const tutorialDir = join(pkgRoot, 'docs/tutorial');
const outFile = join(pkgRoot, 'test/tutorial-snippets.generated.test.ts');

function* extractSnippets(md) {
	const lines = md.split(/\r?\n/);
	let inFence = false;
	let fenceStart = -1;
	let buf = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!inFence) {
			if (/^```ts run\s*$/.test(line)) {
				inFence = true;
				fenceStart = i + 1; // 1-based first content line
				buf = [];
			}
		} else {
			if (/^```\s*$/.test(line)) {
				inFence = false;
				yield { startLine: fenceStart, code: buf.join('\n') };
			} else {
				buf.push(line);
			}
		}
	}
}

function indent(code, prefix) {
	return code
		.split('\n')
		.map((l) => (l.length ? prefix + l : l))
		.join('\n');
}

const files = readdirSync(tutorialDir)
	.filter((f) => /^\d+-.+\.md$/.test(f))
	.sort();

const parts = [
	'// AUTO-GENERATED from docs/tutorial/*.md — do not edit by hand.',
	'// Regenerate with: node scripts/build-tutorial-tests.mjs',
	'// (this runs automatically as `pretest`).',
	'',
	"import { describe, it, expect } from 'vitest';",
	"import { Query, DataSet } from '../src/index.js';",
	"import { penguins, penguinFields, type Penguin } from './fixtures/penguins.js';",
	'import {',
	'\tcustomers,',
	'\tcustomerFields,',
	'\torders,',
	'\torderFields,',
	'\ttype Customer,',
	'\ttype Order,',
	"} from './fixtures/orders-customers.js';",
	'',
	'// Helpers in lexical scope for every tutorial snippet.',
	'function penguinsQ(): Query<Penguin> {',
	'\treturn new Query<Penguin>(async () => penguins, penguinFields);',
	'}',
	'function customersQ(): Query<Customer> {',
	'\treturn new Query<Customer>(async () => customers, customerFields);',
	'}',
	'function ordersQ(): Query<Order> {',
	'\treturn new Query<Order>(async () => orders, orderFields);',
	'}',
	'',
];

let totalSnippets = 0;
for (const file of files) {
	const md = readFileSync(join(tutorialDir, file), 'utf8');
	const snippets = [...extractSnippets(md)];
	if (snippets.length === 0) continue;
	parts.push(`describe('tutorial / ${file}', () => {`);
	for (const { startLine, code } of snippets) {
		totalSnippets++;
		parts.push(`\tit('snippet at line ${startLine}', async () => {`);
		parts.push(indent(code, '\t\t'));
		parts.push('\t});');
	}
	parts.push('});');
	parts.push('');
}

if (totalSnippets === 0) {
	parts.push("describe.skip('tutorial snippets', () => {});");
}

writeFileSync(outFile, parts.join('\n') + '\n');
console.log(
	`[build-tutorial-tests] wrote ${relative(pkgRoot, outFile)} — ${totalSnippets} snippets from ${files.length} chapters`,
);

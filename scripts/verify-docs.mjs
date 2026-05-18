#!/usr/bin/env node
/**
 * Verifies docs/FUTURES.txt Open entries are still open on GitHub.
 * Skips with exit 0 if `gh` is unavailable (warn only).
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const futuresPath = join(root, 'docs', 'FUTURES.txt');
const text = readFileSync(futuresPath, 'utf8');

const openBlock = text.split('## Open')[1]?.split('## Shipped')[0] ?? '';
// Only lines like "- Some title — #123" (ignore "#139" mentioned inside another issue's title)
const ids = [...openBlock.matchAll(/^- .+ — #(\d+)\s*$/gm)].map((m) => Number(m[1]));

if (ids.length === 0) {
	console.log('verify-docs: no issue IDs in FUTURES Open section');
	process.exit(0);
}

function ghAvailable() {
	try {
		execSync('gh --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

if (!ghAvailable()) {
	console.warn('verify-docs: `gh` not found — skipping issue state checks');
	process.exit(0);
}

let failed = false;
for (const id of ids) {
	try {
		const out = execSync(`gh issue view ${id} --json state`, {
			encoding: 'utf8',
			cwd: root,
		});
		const { state } = JSON.parse(out);
		if (state === 'CLOSED') {
			console.error(
				`verify-docs: docs/FUTURES.txt lists #${id} under Open but GitHub state is CLOSED`,
			);
			failed = true;
		}
	} catch (err) {
		console.warn(`verify-docs: could not check #${id}: ${err.message}`);
	}
}

if (failed) {
	console.error('verify-docs: failed — move closed issues to Shipped in docs/FUTURES.txt');
	process.exit(1);
}

console.log(`verify-docs: OK (${ids.length} open issue(s) checked)`);

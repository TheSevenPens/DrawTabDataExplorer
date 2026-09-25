// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { initSources } from '../data-repo/test/fixtures.js';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { readSources, sourceCollection } from '../data-repo/lib/sources.js';
import { generateDataset } from '../data-repo/lib/generate-dataset.js';
const app = path.resolve(import.meta.dirname, '..');
let tmp: string;
let repo: string;
beforeEach(() => {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'data-writer-'));
	repo = path.join(tmp, 'repo');
	for (const dir of ['source', 'data'])
		fs.cpSync(path.join(app, 'data-repo', dir), path.join(repo, dir), { recursive: true });
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
function run(script: string, args: string[], input?: string) {
	return spawnSync(process.execPath, ['--import', 'tsx', path.join(app, script), ...args], {
		cwd: app,
		input,
		encoding: 'utf8',
		timeout: 30000,
	});
}
function digest() {
	const hash = createHash('sha256');
	const walk = (dir: string) => {
		for (const name of fs.readdirSync(dir).sort()) {
			const file = path.join(dir, name);
			if (fs.statSync(file).isDirectory()) walk(file);
			else hash.update(path.relative(repo, file)).update(fs.readFileSync(file));
		}
	};
	walk(repo);
	return hash.digest('hex');
}
function json(name: string, value: unknown) {
	const file = path.join(tmp, name);
	fs.writeFileSync(file, JSON.stringify(value));
	return file;
}
function sessions() {
	return readSources(repo, sourceCollection('pressure-response')).records;
}
function expectFresh() {
	const result = generateDataset(repo, { write: false });
	expect(result.sourceIssues).toEqual([]);
	expect(result.changed).toEqual([]);
	expect(result.missing).toEqual([]);
	expect(result.extra).toEqual([]);
}

it('imports a session with fresh bundles/metadata and rejects invalid references without any write', () => {
	const prior = sessions().find((s) => s.record.Brand === 'WACOM')!.record;
	const input = json(`2099-01-01-${prior.InventoryId}.json`, {
		captures: [
			{ physicalGf: 1, logicalNorm: 0 },
			{ physicalGf: 500, logicalNorm: 1 },
		],
	});
	const before = digest();
	const bad = run('scripts/add-pressure-session.mjs', [
		input,
		'--repo-root',
		repo,
		'--tablet',
		'wacom.tablet.missing',
	]);
	expect(bad.status, bad.stderr).not.toBe(0);
	expect(digest()).toBe(before);
	const good = run('scripts/add-pressure-session.mjs', [
		input,
		'--repo-root',
		repo,
		'--tablet',
		String(prior.TabletEntityId),
	]);
	expect(good.status, good.stderr).toBe(0);
	expectFresh();
	expect(sessions().some((s) => s.record.Date === '2099-01-01')).toBe(true);
}, 30000);

it('validates a complete backfill batch before writing and leaves dry runs untouched', () => {
	const prior = sessions()[0].record;
	const edit = {
		_id: prior._id,
		brand: prior.Brand,
		inventoryId: prior.InventoryId,
		date: prior.Date,
		prependPiafForce: 0.1,
	};
	const input = json('edits.json', [edit]);
	const before = digest();
	const dry = run('scripts/apply-pressure-backfill.mjs', [input, '--repo-root', repo, '--dry-run']);
	expect(dry.status, dry.stderr).toBe(0);
	expect(digest()).toBe(before);
	json('edits.json', [edit, { ...edit, _id: 'missing' }]);
	expect(run('scripts/apply-pressure-backfill.mjs', [input, '--repo-root', repo]).status).not.toBe(
		0,
	);
	expect(digest()).toBe(before);
	json('edits.json', [edit]);
	const applied = run('scripts/apply-pressure-backfill.mjs', [input, '--repo-root', repo]);
	expect(applied.status, applied.stderr).toBe(0);
	expectFresh();
}, 30000);

it('rejects an invalid later pen in a Python-style JSON plan without writing the earlier pen', () => {
	const pens = readSources(repo, sourceCollection('pens')).records;
	const before = digest();
	const updates = [
		{ collection: 'pens', record: { ...pens[0].record, Notes: 'candidate' } },
		{ collection: 'pens', record: { ...pens[1].record, PenTech: 'LASER' } },
	];
	const bad = run(
		'data-repo/scripts/apply-update.ts',
		['--repo-root', repo],
		JSON.stringify(updates),
	);
	expect(bad.status, bad.stderr).not.toBe(0);
	expect(digest()).toBe(before);
	const good = run(
		'data-repo/scripts/apply-update.ts',
		['--repo-root', repo],
		JSON.stringify(updates.slice(0, 1)),
	);
	expect(good.status, good.stderr).toBe(0);
	expectFresh();
}, 30000);

it('validates the brand template before writing any new source or grouped records', () => {
	const before = digest();
	const result = run('scripts/gen-brand-data.example.mjs', ['--repo-root', repo]);
	expect(result.status, result.stderr).not.toBe(0);
	expect(digest()).toBe(before);
}, 30000);

it('generates a customized brand template with sources, grouped records and fresh metadata', () => {
	const empty = path.join(tmp, 'new-brand');
	initSources(empty);
	const source = fs
		.readFileSync(path.join(app, 'scripts/gen-brand-data.example.mjs'), 'utf8')
		.replaceAll('FOOBAR', 'WACOM')
		.replaceAll('foobar', 'wacom')
		.replaceAll('../data-repo/', pathToFileURL(path.join(app, 'data-repo') + path.sep).href);
	const script = path.join(tmp, 'brand.mjs');
	fs.writeFileSync(script, source);
	const result = spawnSync(process.execPath, ['--import', 'tsx', script, '--repo-root', empty], {
		cwd: app,
		encoding: 'utf8',
	});
	expect(result.status, result.stderr).toBe(0);
	const check = generateDataset(empty, { write: false });
	expect(check).toMatchObject({ sourceIssues: [], changed: [], missing: [], extra: [] });
	const manifest = JSON.parse(fs.readFileSync(path.join(empty, 'data/version.json'), 'utf8'));
	expect(manifest.counts).toMatchObject({ tablets: 1, pens: 1, tabletFamilies: 1 });
}, 30000);

it('commits grouped pressure measurements with metadata and validates dry runs', () => {
	const prior = sessions().find((s) => s.record.Brand === 'WACOM')!.record;
	const input = json('ranges.json', [
		{
			Date: '2099-01-01',
			PenInventoryId: prior.InventoryId,
			IAF: 2,
			TabletEntityId: prior.TabletEntityId,
		},
	]);
	const args = [input, '--data-dir', path.join(repo, 'data')];
	const before = digest();
	const dry = run('scripts/add-pressure-range.mjs', [...args, '--dry-run']);
	expect(dry.status, dry.stderr).toBe(0);
	expect(digest()).toBe(before);
	const applied = run('scripts/add-pressure-range.mjs', args);
	expect(applied.status, applied.stderr).toBe(0);
	expectFresh();
	const records = JSON.parse(
		fs.readFileSync(path.join(repo, 'data/pressure-range/WACOM-pressure-range.json'), 'utf8'),
	).PressureRange;
	expect(records.at(-1)).toMatchObject({ Value: '2', Date: '2099-01-01' });
}, 30000);

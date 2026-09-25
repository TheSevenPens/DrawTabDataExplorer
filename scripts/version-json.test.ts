import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { vi } from 'vitest';
import { initSources, penFixture } from '../data-repo/test/fixtures.js';
import { sourceCollection, writeSourceRecord } from '../data-repo/lib/sources.js';
import { regenerateDataset } from '../data-repo/lib/generate-dataset.js';
import { writeVersionJson } from './version-json.js';

const appRoot = path.resolve(__dirname, '..');
const dataRepoRoot = path.join(appRoot, 'data-repo');

let tmp: string;
beforeEach(() => {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'version-json-'));
});
afterEach(() => {
	fs.rmSync(tmp, { recursive: true, force: true });
});

describe('writeVersionJson', () => {
	it('writes the data version plus the build commits', () => {
		const outFile = path.join(tmp, 'version.json');
		const now = new Date('2026-09-24T12:00:00Z');
		writeVersionJson({
			dataRepoRoot,
			appRoot,
			outFile,
			now,
			requireClean: false,
			onWarning: () => {},
		});
		const info = JSON.parse(fs.readFileSync(outFile, 'utf8'));
		expect(info.commit).toMatch(/^[0-9a-f]{40}$/);
		expect(info.counts.tablets).toBeGreaterThan(0);
		expect(info.build.appCommit).toMatch(/^[0-9a-f]{40}$/);
		expect(info.build.queritonCommit).toMatch(/^[0-9a-f]{40}$/);
		expect(info.build.builtAt).toBe('2026-09-24T12:00:00.000Z');
	});

	it('replaces a hard link instead of writing through it', () => {
		// The old setup hard-linked static/version.json to the tracked
		// data-repo file; writing through the link would rewrite that file.
		const tracked = path.join(tmp, 'tracked.json');
		const outFile = path.join(tmp, 'version.json');
		fs.writeFileSync(tracked, '{"stale":true}\n');
		fs.linkSync(tracked, outFile);
		writeVersionJson({ dataRepoRoot, appRoot, outFile, requireClean: false, onWarning: () => {} });
		expect(fs.readFileSync(tracked, 'utf8')).toBe('{"stale":true}\n');
		expect(JSON.parse(fs.readFileSync(outFile, 'utf8')).stale).toBeUndefined();
	});
});

it('rejects dirty publication inputs before replacing output, but labels local previews', () => {
	const repo = path.join(tmp, 'repo');
	initSources(repo);
	writeSourceRecord(repo, sourceCollection('pens'), penFixture('WACOM', 'p1'));
	regenerateDataset(repo);
	const git = (...args: string[]) =>
		execFileSync(
			'git',
			['-C', repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
			{ stdio: 'ignore' },
		);
	git('init', '-q');
	git('add', '.');
	git('commit', '-qm', 'fixture');
	const outFile = path.join(tmp, 'published.json');
	writeVersionJson({ dataRepoRoot: repo, appRoot, outFile, requireClean: true });
	const clean = fs.readFileSync(outFile);
	writeSourceRecord(repo, sourceCollection('pens'), {
		...penFixture('WACOM', 'p1'),
		Notes: 'local edit',
	});
	regenerateDataset(repo);
	expect(() =>
		writeVersionJson({ dataRepoRoot: repo, appRoot, outFile, requireClean: true }),
	).toThrow('differ from the recorded commit');
	expect(fs.readFileSync(outFile)).toEqual(clean);
	const onWarning = vi.fn();
	writeVersionJson({ dataRepoRoot: repo, appRoot, outFile, requireClean: false, onWarning });
	expect(onWarning).toHaveBeenCalledOnce();
	expect(JSON.parse(fs.readFileSync(outFile, 'utf8')).provenance.dirty).toBe(true);
});

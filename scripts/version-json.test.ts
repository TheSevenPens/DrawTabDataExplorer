import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
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
		writeVersionJson({ dataRepoRoot, appRoot, outFile, now });
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
		writeVersionJson({ dataRepoRoot, appRoot, outFile });
		expect(fs.readFileSync(tracked, 'utf8')).toBe('{"stale":true}\n');
		expect(JSON.parse(fs.readFileSync(outFile, 'utf8')).stale).toBeUndefined();
	});
});

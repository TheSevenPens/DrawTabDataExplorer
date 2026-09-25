// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';
import { dataPipelinePlugin } from './data-pipeline.js';
import { initSources, penFixture } from '../data-repo/test/fixtures.js';
import { sourceCollection, writeSourceRecord } from '../data-repo/lib/sources.js';
import { generateDataset } from '../data-repo/lib/generate-dataset.js';
import { writeDataJson } from '../data-repo/lib/data-json.js';
let root: string;
let server: ViteDevServer | undefined;
afterEach(async () => {
	await server?.close();
	vi.restoreAllMocks();
	if (root) fs.rmSync(root, { recursive: true, force: true });
});
it('refreshes real source add/change/delete events through bundles and metadata, and surfaces invalid sources', async () => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'data-watcher-'));
	initSources(root);
	writeSourceRecord(root, sourceCollection('pens'), penFixture('WACOM', 'p1'));
	expect(generateDataset(root, { write: true }).sourceIssues).toEqual([]);
	const git = (...args: string[]) =>
		execFileSync(
			'git',
			['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
			{ stdio: 'ignore' },
		);
	git('init', '-q');
	git('add', 'source', 'data');
	git('commit', '-qm', 'fixture');
	const outFile = path.join(root, 'public/version.json');
	fs.mkdirSync(path.dirname(outFile));
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	server = await createServer({
		configFile: false,
		root,
		publicDir: false,
		appType: 'custom',
		logLevel: 'silent',
		server: { port: 0 },
		plugins: [
			dataPipelinePlugin({ dataRepoRoot: root, appRoot: root, outFile, requireClean: false }),
		],
	});
	await server.listen();
	await vi.waitFor(
		() =>
			expect(
				Object.keys(server!.watcher.getWatched()).some((dir) =>
					dir.replaceAll('\\', '/').endsWith('/source/pens/wacom'),
				),
			).toBe(true),
		{ timeout: 10000 },
	);
	const send = vi.spyOn(server.ws, 'send');
	const version = () => JSON.parse(fs.readFileSync(outFile, 'utf8'));
	const bundled = () =>
		JSON.parse(fs.readFileSync(path.join(root, 'data/pens/WACOM-pens.json'), 'utf8')).Pens;
	const p2 = path.join(root, 'source/pens/wacom/wacom.pen.p2.json');
	writeSourceRecord(root, sourceCollection('pens'), penFixture('WACOM', 'p2'));
	await vi.waitFor(() => expect(version().counts.pens).toBe(2), { timeout: 10000 });
	writeDataJson(p2, { ...penFixture('WACOM', 'p2'), Notes: 'changed' });
	await vi.waitFor(() => expect(bundled()[1].Notes).toBe('changed'), { timeout: 10000 });
	const good = fs.readFileSync(outFile, 'utf8');
	writeDataJson(p2, { ...penFixture('WACOM', 'p2'), PenTech: 'LASER' });
	await vi.waitFor(
		() =>
			expect(
				send.mock.calls.some(
					([message]) => typeof message === 'object' && message.type === 'error',
				),
			).toBe(true),
		{ timeout: 10000 },
	);
	expect(fs.readFileSync(outFile, 'utf8')).toBe(good);
	expect(bundled()[1].Notes).toBe('changed');
	fs.rmSync(p2);
	await vi.waitFor(() => expect(version().counts.pens).toBe(1), { timeout: 10000 });
	expect(bundled()).toHaveLength(1);
}, 30000);

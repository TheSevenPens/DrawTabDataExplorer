import path from 'node:path';
import type { Plugin } from 'vite';
import { regenerateDataset } from '../data-repo/lib/generate-dataset.js';
import { SOURCE_COLLECTIONS } from '../data-repo/lib/sources.js';
import { writeVersionJson, type VersionJsonOptions } from './version-json.js';

/** One ordered source -> bundles -> metadata refresh, shared by dev and build. */
export function dataPipelinePlugin(options: VersionJsonOptions): Plugin {
	const root = path.resolve(options.dataRepoRoot);
	const refresh = () => {
		const changed = regenerateDataset(root);
		writeVersionJson(options);
		return changed;
	};
	return {
		name: 'data-pipeline',
		buildStart() {
			try {
				refresh();
			} catch (error) {
				this.error(error instanceof Error ? error.message : String(error));
			}
		},
		configureServer(server) {
			server.watcher.add([path.join(root, 'source'), path.join(root, 'data')]);
			let timer: ReturnType<typeof setTimeout> | undefined;
			const schedule = (file: string) => {
				const rel = path.relative(root, file).replace(/\\/g, '/');
				if (rel === 'data/version.json') return;
				if (SOURCE_COLLECTIONS.some((c) => rel.startsWith(`data/${c.name}/`))) return;
				if (!rel.startsWith('source/') && !(rel.startsWith('data/') && rel.endsWith('.json')))
					return;
				clearTimeout(timer);
				timer = setTimeout(() => {
					try {
						refresh();
						server.ws.send({ type: 'full-reload' });
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						server.config.logger.error(`[data-pipeline] ${message}`);
						server.ws.send({ type: 'error', err: { message, stack: '', plugin: 'data-pipeline' } });
					}
				}, 150);
			};
			for (const event of ['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const)
				server.watcher.on(event, schedule);
			server.httpServer?.once('close', () => {
				clearTimeout(timer);
				for (const event of ['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const)
					server.watcher.off(event, schedule);
			});
		},
	};
}

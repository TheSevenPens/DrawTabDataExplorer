import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { writeVersionJson } from './scripts/version-json.js';
import { regenerate } from './data-repo/lib/sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const localDataDir = process.env.VITE_DATA_DIR || '';
const hasLocalData = localDataDir !== '' && localDataDir !== 'data-repo';
const localDataPath = hasLocalData ? path.resolve(__dirname, localDataDir) : '';

function localDataPlugin(): Plugin {
	const dataRoot = path.join(localDataPath, 'data');
	return {
		name: 'local-data',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url) return next();
				// Check cookie for opt-in
				const cookies = req.headers.cookie || '';
				if (!cookies.includes('drawtab-local-data=1')) return next();
				const clean = req.url.split('?')[0];
				if (!clean.endsWith('.json')) return next();
				const filePath = path.join(dataRoot, clean);
				if (fs.existsSync(filePath)) {
					res.setHeader('Content-Type', 'application/json');
					fs.createReadStream(filePath).pipe(res);
				} else {
					next();
				}
			});
		},
	};
}

// Tablets and pens are authored one file per record under data-repo/source/
// and the brand bundles under data-repo/data/ are generated from them
// (DrawTabData#45). Regenerate on dev start / build start, and in dev on
// every source add, change or delete, so the running site always reflects
// the sources. Writes land in data/, which the version-json watcher below
// picks up, so the chain is source -> bundles -> version.json.
//
// CI never relies on this: verify.yml runs `generate --check` BEFORE any
// build, so a stale committed bundle fails there instead of being repaired
// here. A bad source file is reported and nothing is written.
function sourceBundlesPlugin(): Plugin {
	const dataRepoRoot = hasLocalData ? localDataPath : path.resolve(__dirname, 'data-repo');
	const sourceDir = path.join(dataRepoRoot, 'source');
	const run = (log: (msg: string) => void, fail: (msg: string) => void) => {
		try {
			const changed = regenerate(dataRepoRoot);
			if (changed.length) log(`regenerated ${changed.join(', ')}`);
		} catch (e) {
			fail(e instanceof Error ? e.message : String(e));
		}
	};
	return {
		name: 'source-bundles',
		buildStart() {
			run(
				(m) => this.info(m),
				(m) => this.error(m),
			);
		},
		configureServer(server) {
			const logger = server.config.logger;
			server.watcher.add(sourceDir);
			// Coalesce bursts (an editor saving several files, a git checkout)
			// into one run, and never run two at once.
			let timer: ReturnType<typeof setTimeout> | undefined;
			const schedule = (file: string) => {
				if (!file.startsWith(sourceDir) || !file.endsWith('.json')) return;
				clearTimeout(timer);
				timer = setTimeout(
					() =>
						run(
							(m) => logger.info(`[source-bundles] ${m}`, { timestamp: true }),
							(m) => logger.error(`[source-bundles] ${m}`, { timestamp: true }),
						),
					150,
				);
			};
			server.watcher.on('add', schedule);
			server.watcher.on('change', schedule);
			server.watcher.on('unlink', schedule);
		},
	};
}

// Regenerate static/version.json from the data this build ships (#333).
// buildStart runs for dev and build alike, before SvelteKit copies static/.
// version.json also carries the file manifest and the session-count index
// the URL loaders trust (#346), so in dev it is rewritten whenever a data
// file is added, removed or edited — otherwise a new brand file would be
// skipped, or a count stale, until the server restarted.
function versionJsonPlugin(): Plugin {
	const dataRepoRoot = hasLocalData ? localDataPath : path.resolve(__dirname, 'data-repo');
	const write = () =>
		writeVersionJson({
			dataRepoRoot,
			appRoot: __dirname,
			outFile: path.resolve(__dirname, 'static', 'version.json'),
		});
	return {
		name: 'version-json',
		buildStart: write,
		configureServer(server) {
			const dataDir = path.join(dataRepoRoot, 'data');
			server.watcher.add(dataDir);
			const onChange = (file: string) => {
				if (file.startsWith(dataDir) && file.endsWith('.json')) write();
			};
			server.watcher.on('add', onChange);
			server.watcher.on('unlink', onChange);
			server.watcher.on('change', onChange);
		},
	};
}

export default defineConfig({
	// source-bundles first: its buildStart must finish before version-json's
	// reads the bundles (both are synchronous, so plugin order is run order).
	plugins: [
		sourceBundlesPlugin(),
		versionJsonPlugin(),
		...(hasLocalData ? [localDataPlugin()] : []),
		sveltekit(),
	],
	define: {
		__DEV_LOCAL_DATA_AVAILABLE__: JSON.stringify(hasLocalData),
	},
	resolve: {
		alias: {
			$data: hasLocalData ? localDataPath : path.resolve(__dirname, 'data-repo'),
		},
	},
	server: {
		fs: {
			allow: [path.resolve(__dirname), ...(hasLocalData ? [localDataPath] : [])],
		},
	},
	// NOTE: no build.rollupOptions.output here, deliberately.
	//
	// A manualChunks() entry used to force pptxgenjs into a chunk named 'pptx',
	// with a comment claiming that kept it out of the entry bundle. It did the
	// opposite: naming the group made Rolldown hoist the chunk into the app
	// entry's static graph, so every page — /about included — carried a
	// modulepreload for ~120 KB gzipped of PowerPoint exporter, defeating the
	// lazy import in src/lib/pptx-export.ts. Measured on /entity/<id>: 234,064
	// bytes gz of initial JS with it, 111,530 without. See #310.
	//
	// SvelteKit's Vite plugin overrides the output keys it owns (chunkFileNames
	// and friends) but leaves manualChunks alone — which is why that option kept
	// working while a chunkFileNames probe appeared to show the whole object was
	// ignored. Don't reintroduce chunk grouping here to "optimise" a large
	// dependency; break the static import edge at the call site instead, the way
	// ExportDialog.svelte does.
});

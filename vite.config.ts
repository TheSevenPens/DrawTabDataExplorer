import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

export default defineConfig({
	plugins: [...(hasLocalData ? [localDataPlugin()] : []), sveltekit()],
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

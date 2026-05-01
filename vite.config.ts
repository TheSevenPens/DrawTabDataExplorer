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
});

import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ fallback: '404.html' }),
		prerender: {
			handleUnseenRoutes: 'ignore',
		},
		paths: {
			// BASE_PATH override lets the e2e build serve at `/` instead of
			// the GitHub Pages prefix. Default: production = pages prefix,
			// dev = empty.
			base:
				process.env.BASE_PATH !== undefined
					? process.env.BASE_PATH
					: process.env.NODE_ENV === 'production'
						? '/DrawTabDataExplorer'
						: '',
		},
		files: {
			routes: 'src/routes',
			lib: 'src/lib',
			appTemplate: 'src/app.html',
			assets: 'static',
		},
		alias: {
			$data:
				process.env.VITE_DATA_DIR && process.env.VITE_DATA_DIR !== 'data-repo'
					? process.env.VITE_DATA_DIR
					: 'data-repo',
		},
	},
};

export default config;

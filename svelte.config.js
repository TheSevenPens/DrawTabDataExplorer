import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		files: {
			routes: 'src/routes',
			lib: 'src/lib',
			appTemplate: 'src/app.html',
			assets: 'static',
		},
		alias: {
			'$data': 'data-repo',
		},
	},
};

export default config;

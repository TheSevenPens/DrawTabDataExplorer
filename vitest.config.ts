import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	test: {
		environment: 'jsdom',
		include: [
			'src/**/*.{test,spec}.ts',
			'packages/*/test/**/*.{test,spec}.ts',
			'data-repo/lib/**/*.{test,spec}.ts',
		],
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, 'src/lib'),
			$data: path.resolve(__dirname, 'data-repo'),
			// `$app/paths` is a SvelteKit virtual module; tests stub the only
			// export we use (`base`).
			'$app/paths': path.resolve(__dirname, 'src/lib/__test-stubs__/app-paths.ts'),
		},
	},
});

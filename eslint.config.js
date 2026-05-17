// Flat config (ESLint 9+).
//
// Intentionally conservative — recommended rules only. Strict typescript-eslint
// would flag dozens of pre-existing patterns; we'd rather have a green lint
// step that runs on every commit than a noisy one that gets bypassed.
//
// To extend: add overrides per-glob below; lift to `tseslint.configs.strict`
// when the codebase is ready.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	{
		ignores: ['node_modules/', 'build/', 'dist/', '.svelte-kit/', 'data-repo/', 'static/'],
	},

	js.configs.recommended,
	...tseslint.configs.recommended,

	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			// Don't fail on unused vars prefixed with _ (common pattern in Svelte 5
			// $derived/$effect closures and event handler args).
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			// `any` shows up intentionally in field-def generics and several
			// pipeline helpers. Downgrade to warn rather than block CI.
			'@typescript-eslint/no-explicit-any': 'warn',
			// Globals like `__DEV_LOCAL_DATA_AVAILABLE__` are defined via Vite's
			// `define` and aren't visible to ESLint.
			'no-undef': 'off',
			// `try { ... } catch {}` is intentional in a couple of localStorage
			// helpers — silent failure is the desired behavior. Allow.
			'no-empty': ['warn', { allowEmptyCatch: true }],
		},
	},

	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte', 'src/**/*.ts'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
				// Project-aware parsing lets `svelte/no-navigation-without-resolve`
				// see the `ResolvedPathname` branded type from `$app/types` and
				// trust it without inline `eslint-disable` comments.
				projectService: true,
				extraFileExtensions: ['.svelte'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Pre-existing patterns throughout the codebase. Downgrade to warn
			// so lint passes; address opportunistically when files are touched.
			'svelte/require-each-key': 'warn',
			'svelte/prefer-svelte-reactivity': 'warn',
			'svelte/no-navigation-without-resolve': 'warn',
			'svelte/no-unused-svelte-ignore': 'warn',
			'svelte/no-at-html-tags': 'warn',
			'svelte/no-useless-mustaches': 'warn',
		},
	},

	{
		files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs,ts}'],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
];

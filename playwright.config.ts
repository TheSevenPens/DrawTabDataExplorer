import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

	// Build once, then serve the static output. BASE_PATH='' tells
	// svelte.config.js to skip the GitHub Pages `/DrawTabDataExplorer`
	// prefix so routes live at `/` for both build AND preview.
	webServer: {
		command: `npm run build && npm run preview -- --port ${PORT}`,
		env: { BASE_PATH: '' },
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});

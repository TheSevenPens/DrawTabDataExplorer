import { test, expect, type Page } from '@playwright/test';

// Routes to smoke-test. Each entry: { path, expectedH1 }. The h1 check
// proves the SPA hydrated and rendered the route — a blank shell would
// fail it.
const ROUTES: { path: string; h1: RegExp }[] = [
	{ path: '/', h1: /Tablets|Tablet Models|Drawing Tablets/i },
	{ path: '/brands', h1: /Brands/i },
	{ path: '/tablet-families', h1: /Tablet Families/i },
	{ path: '/pens', h1: /Pens/i },
	{ path: '/pen-families', h1: /Pen Families/i },
	{ path: '/pen-compat', h1: /Pen Compat|Compatibility/i },
	{ path: '/drivers', h1: /Drivers/i },
	{ path: '/pressure-response', h1: /Pressure Response/i },
	{ path: '/inventory', h1: /Inventory/i },
	{ path: '/timeline', h1: /Timeline/i },
	{ path: '/compare-tablets', h1: /Compare/i },
	{ path: '/tablet-analysis', h1: /Analysis/i },
	{ path: '/reference', h1: /Reference/i },
	{ path: '/data-quality', h1: /Data Quality/i },
	{ path: '/about', h1: /About/i },
];

// Console errors that aren't from our code and shouldn't fail the test
// (third-party scripts, browser extensions, dev-only warnings).
const IGNORED_ERROR_PATTERNS = [/favicon/i, /404 \(Not Found\)/i];

async function watchConsoleErrors(page: Page): Promise<string[]> {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (msg) => {
		if (msg.type() !== 'error') return;
		const text = msg.text();
		if (IGNORED_ERROR_PATTERNS.some((p) => p.test(text))) return;
		errors.push(`console.error: ${text}`);
	});
	return errors;
}

test.describe('Smoke — every route renders without console errors', () => {
	for (const { path, h1 } of ROUTES) {
		test(`${path} renders`, async ({ page }) => {
			const errors = await watchConsoleErrors(page);
			await page.goto(path, { waitUntil: 'networkidle' });
			await expect(page.locator('h1').first()).toContainText(h1);
			expect(errors, `console errors on ${path}`).toEqual([]);
		});
	}
});

test.describe('List → detail navigation', () => {
	test('Tablets list → tablet detail page', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		// Wait for the table to populate. The first link in the results table
		// should point at /entity/<brand>.tablet.<id>.
		const firstTabletLink = page.locator('a[href*="/entity/"][href*=".tablet."]').first();
		await expect(firstTabletLink).toBeVisible({ timeout: 10_000 });
		await firstTabletLink.click();
		await page.waitForURL(/\/entity\/[a-z0-9._-]+\.tablet\./);
		await expect(page.locator('h1').first()).toBeVisible();
	});

	test('Pens list → pen detail page', async ({ page }) => {
		await page.goto('/pens', { waitUntil: 'networkidle' });
		const firstPenLink = page.locator('a[href*="/entity/"][href*=".pen."]').first();
		await expect(firstPenLink).toBeVisible({ timeout: 10_000 });
		await firstPenLink.click();
		await page.waitForURL(/\/entity\/[a-z0-9._-]+\.pen\./);
		await expect(page.locator('h1').first()).toBeVisible();
	});

	test('Brands list → brand detail page', async ({ page }) => {
		await page.goto('/brands', { waitUntil: 'networkidle' });
		const firstBrandLink = page.locator('a[href^="/entity/"]').first();
		await expect(firstBrandLink).toBeVisible({ timeout: 10_000 });
		await firstBrandLink.click();
		await page.waitForURL(/\/entity\/[a-z]+/);
		await expect(page.locator('h1').first()).toBeVisible();
	});
});

test.describe('Reference left-nav sections', () => {
	const REFERENCE_SECTIONS = [
		{ id: 'tablet-sizes', heading: /Tablet/i },
		{ id: 'iso-paper-a', heading: /ISO A/i },
		{ id: 'iaf-ranking', heading: /IAF Ranking/i },
		{ id: 'max-pressure', heading: /Max Physical Pressure/i },
	];

	for (const { id, heading } of REFERENCE_SECTIONS) {
		test(`/reference#${id} renders the section`, async ({ page }) => {
			const errors = await watchConsoleErrors(page);
			await page.goto(`/reference#${id}`, { waitUntil: 'networkidle' });
			await expect(page.locator('h2').first()).toContainText(heading);
			expect(errors).toEqual([]);
		});
	}
});

test.describe('Compare workflow', () => {
	test('flag a tablet from the list, then see it on /compare-tablets', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		// Flag the first tablet. The flag-toggle button at the start of every
		// row is `<button class="flag-btn" title="Flag for comparison">`.
		const firstFlagButton = page.locator('button.flag-btn').first();
		await expect(firstFlagButton).toBeVisible({ timeout: 10_000 });
		await firstFlagButton.click();

		// Compare sub-tab should now show a count badge.
		await expect(page.locator('a[href*="/compare-tablets"] .badge').first()).toBeVisible({
			timeout: 5_000,
		});

		await page.goto('/compare-tablets', { waitUntil: 'networkidle' });
		// Compare page should mention flagged tablets.
		await expect(page.locator('body')).toContainText(/flagged/i);
	});
});

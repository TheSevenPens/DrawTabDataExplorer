import { test, expect, type Page } from '@playwright/test';

// Routes to smoke-test. Each entry: { path, expectedH1 }. The h1 check
// proves the SPA hydrated and rendered the route — a blank shell would
// fail it.
const ROUTES: { path: string; h1: RegExp }[] = [
	{ path: '/tablets', h1: /Tablets|Tablet Models|Drawing Tablets/i },
	{ path: '/tablet-families', h1: /Tablet Families/i },
	{ path: '/pens', h1: /Pens/i },
	{ path: '/pen-families', h1: /Pen Families/i },
	{ path: '/drivers', h1: /Drivers/i },
	{ path: '/pressure-response', h1: /Pressure Response/i },
	{ path: '/pen-inventory', h1: /Pen Inventory/i },
	{ path: '/tablet-inventory', h1: /Tablet Inventory/i },
	{ path: '/timeline', h1: /Timeline/i },
	{ path: '/tablet-compare', h1: /Compare/i },
	{ path: '/tablet-analysis', h1: /Analysis/i },
	{ path: '/pen-analysis', h1: /Pen Analysis/i },
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
		await page.goto('/tablets', { waitUntil: 'networkidle' });
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
		// Brands now live as a Reference section rather than a standalone route.
		await page.goto('/reference#brands', { waitUntil: 'networkidle' });
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
		{ id: 'piaf-ranking', heading: /IAF Ranking/i },
		{ id: 'pmax-ranking', heading: /MAX Ranking/i },
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

test.describe('SectionedPage routes render their sections', () => {
	test('/tablet-analysis renders the default section with content', async ({ page }) => {
		const errors = await watchConsoleErrors(page);
		await page.goto('/tablet-analysis', { waitUntil: 'networkidle' });
		// SectionedPage renders the sidebar tree (Aspect Ratio, Digitizer, etc.)
		// and the active section's <h2> heading.
		await expect(page.locator('h1')).toContainText(/Analysis/i);
		await expect(page.locator('section.section h2').first()).toBeVisible({ timeout: 10_000 });
		expect(errors).toEqual([]);
	});

	test('/data-quality renders sidebar and main panel', async ({ page }) => {
		const errors = await watchConsoleErrors(page);
		await page.goto('/data-quality', { waitUntil: 'networkidle' });
		await expect(page.locator('h1')).toContainText(/Data Quality/i);
		// Default section "Entity Counts" should render a table.
		await expect(page.locator('section.section h2').first()).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('section.section table').first()).toBeVisible();
		expect(errors).toEqual([]);
	});
});

test.describe('Session detail navigation', () => {
	test('Pressure Response list → session detail page', async ({ page }) => {
		const errors = await watchConsoleErrors(page);
		await page.goto('/pressure-response', { waitUntil: 'networkidle' });
		// Sessions table has /entity/<brand>.session.<id>_<date> links.
		const firstSessionLink = page.locator('a[href*="/entity/"][href*=".session."]').first();
		await expect(firstSessionLink).toBeVisible({ timeout: 10_000 });
		await firstSessionLink.click();
		await page.waitForURL(/\/entity\/[a-z0-9._-]+\.session\./);
		await expect(page.locator('h1').first()).toBeVisible();
		// Session detail renders a PressureResponseChart canvas.
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
		expect(errors).toEqual([]);
	});

	test('a same-day repeat session has its own URL', async ({ page }) => {
		// WAP.0009 was measured twice on 2026-05-25, on two devices. Before
		// sessions stored their EntityId both answered to one URL.
		const tabletLink = (id: string) => page.locator(`a[href$="/entity/${id}"]`).first();
		await page.goto('/entity/wacom.session.wap.0009_2026-05-25', { waitUntil: 'networkidle' });
		await expect(tabletLink('wacom.tablet.ctc6110wl')).toBeVisible({ timeout: 10_000 });
		await expect(tabletLink('samsung.tablet.galaxybook5pro360')).toHaveCount(0);
		await page.goto('/entity/wacom.session.wap.0009_2026-05-25_galaxybook5pro360', {
			waitUntil: 'networkidle',
		});
		await expect(tabletLink('samsung.tablet.galaxybook5pro360')).toBeVisible({ timeout: 10_000 });
		await expect(tabletLink('wacom.tablet.ctc6110wl')).toHaveCount(0);
	});
});

test.describe('Compare workflow', () => {
	test('flag a tablet from the list, then see it on /tablet-compare', async ({ page }) => {
		await page.goto('/tablets', { waitUntil: 'networkidle' });

		// Flag the first tablet. The flag-toggle button at the start of every
		// row is `<button class="flag-btn" title="Flag for comparison">`.
		const firstFlagButton = page.locator('button.flag-btn').first();
		await expect(firstFlagButton).toBeVisible({ timeout: 10_000 });
		await firstFlagButton.click();

		// Compare sub-tab should now show a count badge.
		await expect(page.locator('a[href*="/tablet-compare"] .badge').first()).toBeVisible({
			timeout: 5_000,
		});

		await page.goto('/tablet-compare', { waitUntil: 'networkidle' });
		// Compare page should mention flagged tablets.
		await expect(page.locator('body')).toContainText(/flagged/i);
	});
});

// "What you see is what you search" (#324). These cases are the ones the unit
// tests cannot cover: they prove EntityExplorer actually threads the
// rendered-text resolver through to the search. Each query below is text the
// table draws but does NOT store, so a regression that reverts search to
// getValue makes them return nothing.
test.describe('Search matches the text on screen', () => {
	async function search(page: Page, path: string, query: string): Promise<number> {
		await page.goto(path, { waitUntil: 'networkidle' });
		const box = page.getByPlaceholder('Search...');
		await expect(box).toBeVisible({ timeout: 10_000 });
		await box.fill(query);
		// Let the derived pipeline settle before counting.
		await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5_000 });
		return page.locator('tbody tr').count();
	}

	test('inventory: a tablet name drawn by a cellLink is searchable', async ({ page }) => {
		// The Tablet column's field is TabletEntityId ("wacom.tablet.dth271")
		// but it draws the ModelName ("Cintiq Pro 27").
		expect(await search(page, '/tablet-inventory', 'cin')).toBeGreaterThan(0);
	});

	test('inventory: a pen name drawn by a cellLink is searchable', async ({ page }) => {
		expect(await search(page, '/pen-inventory', 'pro pen')).toBeGreaterThan(0);
	});

	test('tablets: the brand spelling on screen is searchable', async ({ page }) => {
		// Brand stores "XPPEN" and draws "XP-Pen". Both must match, so compare
		// the two counts rather than asserting a number that moves with the data.
		const drawn = await search(page, '/tablets', 'xp-pen');
		const stored = await search(page, '/tablets', 'xppen');
		expect(drawn).toBeGreaterThan(0);
		expect(drawn).toBe(stored);
	});
});

// A data file that fails must never render as a smaller-but-complete list
// (#331): before the fix, a 503 on WACOM-pens.json showed 64 of 143 pens
// with no warning. Now the load fails loudly, names the file, and a retry
// recovers once the file is reachable again.
test.describe('Data load failures are visible, not silent', () => {
	test('a 503 on one pen shard shows an error and Try again recovers', async ({ page }) => {
		let failing = true;
		await page.route('**/pens/WACOM-pens.json', (route) =>
			failing ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue(),
		);
		await page.goto('/pens');
		await expect(page.getByText(/Couldn't load .*WACOM-pens\.json: HTTP 503/)).toBeVisible();
		await expect(page.getByRole('table')).toHaveCount(0);

		failing = false;
		await page.getByRole('button', { name: 'Try again' }).click();
		await expect(page.locator('h1', { hasText: /Pens/i })).toBeAttached();
		await expect(page.getByRole('table').first()).toBeVisible();
	});
});

// #334: history and saved-view state.
test.describe('Tab history and saved views', () => {
	test('Back to the hashless URL restores the default tab', async ({ page }) => {
		await page.goto('/entity/wacom.tablet.ctl4100');
		const active = page.locator('.detail-tabs button.active');
		await expect(active).toHaveText(/model/i);
		await page.locator('.detail-tabs button', { hasText: /^specs$/i }).click();
		await expect(active).toHaveText(/specs/i);
		await page.goBack();
		await expect(active).toHaveText(/model/i);
		await page.goForward();
		await expect(active).toHaveText(/specs/i);
	});

	test('a loaded user view can be renamed, and a name collision is refused', async ({ page }) => {
		await page.goto('/pens');
		await page.evaluate(() =>
			localStorage.setItem(
				'drawtabdata-views-pens',
				JSON.stringify([
					{ name: 'A', steps: [] },
					{ name: 'B', steps: [] },
					{ name: 'Broken', steps: [null] },
				]),
			),
		);
		await page.reload();
		await page.getByRole('button', { name: 'Views' }).click();
		const picker = page.locator('.saved-views select');
		await expect(picker.locator('option')).toHaveText(['Default', '──────────', 'A', 'B']);

		// Loading a view closes the panel; reopening must keep it selected.
		await picker.selectOption('A');
		await page.getByRole('button', { name: 'Views' }).click();
		await expect(picker).toHaveValue('A');

		await page.getByRole('button', { name: 'Rename' }).click();
		await page.locator('.saved-views .rename-input').fill('b');
		await page.getByRole('button', { name: 'OK' }).click();
		await expect(page.locator('.saved-views')).toContainText('A view named "b" already exists.');
		const stored = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('drawtabdata-views-pens') ?? '[]').map(
				(v: { name: string }) => v.name,
			),
		);
		expect(stored).toEqual(['A', 'B', 'Broken']);
	});
});

// #335: keyboard contract for dialogs, tabs and sortable headers.
test.describe('Keyboard access', () => {
	async function focusIsInDialog(page: Page): Promise<boolean> {
		return page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
	}

	test('the Add Tablet picker keeps Tab inside and returns focus on Escape', async ({ page }) => {
		await page.goto('/tablet-compare');
		const opener = page.getByRole('button', { name: /add tablet/i });
		await opener.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog')).toBeVisible();
		// More presses than the dialog has controls, so a leak would show.
		for (let i = 0; i < 40; i++) {
			await page.keyboard.press('Tab');
			expect(await focusIsInDialog(page)).toBe(true);
		}
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Shift+Tab');
			expect(await focusIsInDialog(page)).toBe(true);
		}
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(opener).toBeFocused();
	});

	test('the export dialog keeps Tab inside and returns focus on Escape', async ({ page }) => {
		await page.goto('/tablets');
		const opener = page.getByRole('button', { name: /export/i }).first();
		await opener.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog')).toBeVisible();
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press('Tab');
			expect(await focusIsInDialog(page)).toBe(true);
		}
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(opener).toBeFocused();
	});

	test('detail tabs are a tablist: arrows move focus, Enter selects', async ({ page }) => {
		await page.goto('/entity/wacom.tablet.ctl4100');
		const selected = page.getByRole('tab', { selected: true });
		await expect(selected).toHaveText(/model/i);
		await selected.focus();
		await page.keyboard.press('ArrowRight');
		const focusedTab = page.locator('[role="tab"]:focus');
		await expect(focusedTab).not.toHaveText(/model/i);
		const label = (await focusedTab.textContent())?.trim() ?? '';
		await page.keyboard.press('Enter');
		await expect(page.getByRole('tab', { selected: true })).toHaveText(label);
	});

	test('sortable headers sort from the keyboard', async ({ page }) => {
		await page.goto('/data-quality');
		const header = page.locator('th:has(button.sort-btn)').first();
		await header.locator('button').focus();
		await page.keyboard.press('Enter');
		await expect(header).toHaveAttribute('aria-sort', 'ascending');
		await page.keyboard.press('Space');
		await expect(header).toHaveAttribute('aria-sort', 'descending');
	});
});

// #346: a page loads only the data it shows. The root layout used to
// preload inventory, every pressure session and every pen family (~1.6 MB)
// on every page, and every collection probed all brands, 404ing on files
// that don't exist.
test.describe('Data loading budget', () => {
	function watchDataRequests(page: Page): { url: string; status: number }[] {
		const seen: { url: string; status: number }[] = [];
		page.on('response', (r) => {
			if (new URL(r.url()).pathname.endsWith('.json'))
				seen.push({ url: r.url(), status: r.status() });
		});
		return seen;
	}

	test('/about fetches only version.json', async ({ page }) => {
		const seen = watchDataRequests(page);
		await page.goto('/about');
		await expect(page.getByText(/tablets, \d+ pens/)).toBeVisible();
		expect(seen.map((r) => new URL(r.url).pathname)).toEqual(['/version.json']);
	});

	test('/tablets skips pressure sessions and never requests a missing file', async ({ page }) => {
		const seen = watchDataRequests(page);
		await page.goto('/tablets');
		await expect(page.locator('tbody tr').first()).toBeVisible();
		expect(seen.some((r) => r.url.includes('/pressure-response/'))).toBe(false);
		expect(seen.filter((r) => r.status !== 200)).toEqual([]);
	});

	test('/pens computes session counts without downloading sessions', async ({ page }) => {
		const seen = watchDataRequests(page);
		await page.goto('/pens?filter=PressureSessionCount:>:0');
		await expect(page.locator('tbody tr').first()).toBeVisible();
		expect(await page.locator('tbody tr').count()).toBeGreaterThan(0);
		expect(seen.some((r) => r.url.includes('/pressure-response/'))).toBe(false);
	});
});

// #327: model IDs match with or without separators, on identity fields only.
test.describe('Separator-insensitive ID search', () => {
	async function rowsFor(page: Page, path: string, query: string): Promise<string> {
		await page.goto(path, { waitUntil: 'networkidle' });
		const box = page.getByPlaceholder('Search...');
		await expect(box).toBeVisible({ timeout: 10_000 });
		await box.fill(query);
		await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5_000 });
		return (await page.locator('tbody').innerText()).replace(/\s+/g, ' ');
	}

	test('/tablets: "ptk 1240" finds PTK-1240', async ({ page }) => {
		expect(await rowsFor(page, '/tablets', 'ptk 1240')).toContain('PTK-1240');
	});

	test('/tablet-inventory: "PTK_1240" finds PTK-1240 units', async ({ page }) => {
		expect(await rowsFor(page, '/tablet-inventory', 'PTK_1240')).toContain('PTK-1240');
	});

	test('/pens: "kp503e" finds KP-503E', async ({ page }) => {
		expect(await rowsFor(page, '/pens', 'kp503e')).toContain('KP-503E');
	});

	test('/pen-inventory: "KP 503E" finds KP-503E units', async ({ page }) => {
		expect(await rowsFor(page, '/pen-inventory', 'KP 503E')).toMatch(/\w/);
	});

	test('tablet picker: "ptk1240" lists PTK-1240', async ({ page }) => {
		await page.goto('/tablet-compare');
		await page.getByRole('button', { name: /add tablet/i }).click();
		const dialog = page.getByRole('dialog');
		await dialog.locator('input').first().fill('ptk1240');
		await expect(dialog).toContainText('PTK-1240');
	});

	test('pen picker: "kp503e" lists KP-503E', async ({ page }) => {
		await page.goto('/pen-compare');
		await page
			.getByRole('button', { name: /add pen/i })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		await dialog.locator('input').first().fill('kp503e');
		await expect(dialog).toContainText('KP-503E');
	});
});

// #348: API Explorer queries run in a Worker that can be stopped.
test.describe('API Explorer runs queries in a stoppable worker', () => {
	async function runCode(page: Page, code: string) {
		await page.locator('#api-code').fill(code);
		await page.getByRole('button', { name: 'Run', exact: true }).click();
	}

	test('a query returns its result', async ({ page }) => {
		await page.goto('/api-explorer');
		await runCode(page, "return await ds.Tablets.filter('Brand', '==', 'WACOM').count();");
		await expect(page.locator('.result-pane')).toHaveText(/^\d+$/);
	});

	test('records with relationship methods come back as plain JSON', async ({ page }) => {
		await page.goto('/api-explorer');
		await runCode(
			page,
			"const t = await ds.Tablets.findBy('ModelId', 'PTK-1240'); return (await t.getCompatiblePens()).map(p => p.PenId);",
		);
		await expect(page.locator('.result-pane')).toContainText('"');
		await expect(page.locator('.result-pane.error')).toHaveCount(0);
	});

	test('every built-in example runs through the worker without an error', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto('/api-explorer');
		// The options render after hydration; reading them straight after
		// goto() raced and sometimes found none.
		await expect(
			page.locator('.preset-select option[value]:not([value=""])').first(),
		).toBeAttached();
		const labels = await page
			.locator('.preset-select option[value]:not([value=""])')
			.evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
		expect(labels.length).toBeGreaterThan(10);
		const failures: string[] = [];
		for (const label of labels) {
			await page.locator('.preset-select').selectOption(label);
			await page.getByRole('button', { name: 'Run', exact: true }).click();
			await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({
				timeout: 30_000,
			});
			const err = page.locator('.result-pane.error');
			if (await err.count()) failures.push(`${label}: ${await err.textContent()}`);
		}
		expect(failures).toEqual([]);
	});

	test('an infinite loop can be stopped and the page stays usable', async ({ page }) => {
		await page.goto('/api-explorer');
		await runCode(page, 'while (true) {}');
		const stop = page.getByRole('button', { name: 'Stop' });
		await expect(stop).toBeVisible();
		// The main thread is free: the page still responds while the loop spins.
		expect(await page.evaluate(() => 1 + 1)).toBe(2);
		await stop.click();
		await expect(page.locator('.result-pane.error')).toHaveText('Stopped.');
		// A fresh worker takes the next run.
		await runCode(page, 'return 42;');
		await expect(page.locator('.result-pane')).toHaveText('42');
	});
});

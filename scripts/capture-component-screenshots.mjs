#!/usr/bin/env node
/**
 * Capture per-component screenshots for docs/UXCOMPONENTS.md.
 *
 * Drives a Playwright Chromium against the running dev server and saves
 * PNGs to docs/images/components/. Each entry below is a self-contained
 * capture spec: route to visit, optional clicks to open a dialog or
 * navigate to a tab, a CSS selector to crop the element, and an output
 * filename (lowercase ComponentName).
 *
 * Run with the dev server already running on http://localhost:5174:
 *   npm run dev          # in another terminal
 *   node scripts/capture-component-screenshots.mjs
 *
 * Idempotent — re-run any time the components or pages change.
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'images', 'components');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE ?? 'http://localhost:5174';

/**
 * @typedef Spec
 * @property {string} name        Output filename stem (no extension).
 * @property {string} route       URL path to visit.
 * @property {string} [selector]  CSS selector to crop. If omitted, a full
 *                                viewport screenshot is taken instead.
 * @property {Array<{ click: string } | { wait: number } | { hover: string }>} [actions]
 *                                Actions to run after navigation, before screenshot.
 * @property {number} [waitAfter] Extra ms to wait after the page settles
 *                                (e.g. for chart animations).
 * @property {{ width: number, height: number }} [viewport]
 *                                Override viewport for this capture.
 */

/** @type {Spec[]} */
const SPECS = [
	// --- Page shells / chrome ----------------------------------------------
	{ name: 'Nav', route: '/tablets', selector: 'nav' },
	{ name: 'SubNav', route: '/tablets', selector: '.subnav, [aria-label="subnav"]' },

	// --- EntityExplorer ecosystem (one page covers most of them) -----------
	{
		name: 'EntityExplorer',
		route: '/tablets',
		viewport: { width: 1400, height: 1000 },
		waitAfter: 1500,
	},
	// Toolbar row: SearchBar + filter / sort / column pills + saved views.
	{
		name: 'QueryPipelineBar',
		route: '/tablets',
		selector: '.query-pipeline, .toolbar, header + div',
		waitAfter: 1500,
	},
	{
		name: 'SearchBar',
		route: '/tablets',
		selector: '.searchbar, input[type="search"]',
		waitAfter: 1500,
	},
	{
		name: 'FilterBar',
		route: '/tablets',
		selector: '.filter-bar, .filters',
		waitAfter: 1500,
	},
	{
		name: 'SortBar',
		route: '/tablets',
		selector: '.sort-bar, .sorts',
		waitAfter: 1500,
	},
	{
		name: 'ColumnBar',
		route: '/tablets',
		selector: '.column-bar, .columns',
		waitAfter: 1500,
	},
	{
		name: 'ResultsTable',
		route: '/tablets',
		selector: 'table, .results-table',
		waitAfter: 2000,
	},
	{
		name: 'SavedViews',
		route: '/tablets',
		actions: [{ click: 'button:has-text("Views"), [aria-label*="Views"]' }, { wait: 400 }],
		selector: '.views-menu, .saved-views, [role="menu"]',
		waitAfter: 800,
	},

	// --- Top-level detail pages -------------------------------------------
	{
		name: 'TabletDetail',
		route: '/entity/wacom.tablet.ctl4100',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 1500,
	},
	{
		name: 'PenDetail',
		route: '/entity/wacom.pen.kp503e',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 1500,
	},
	{
		name: 'PenFamilyDetail',
		route: '/entity/wacom.penfamily.wacomkpgen3',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 1500,
	},
	{
		name: 'TabletFamilyDetail',
		route: '/entity/wacom.tabletfamily.wacomintuosprogen8',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 1500,
	},
	{
		name: 'BrandDetail',
		route: '/entity/wacom',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 1500,
	},
	{
		name: 'DriverDetail',
		route: '/entity/wacom.driver.6.4.13-2_windows',
		viewport: { width: 1280, height: 1000 },
		waitAfter: 1500,
	},
	{
		name: 'SessionDetail',
		route: '/entity/wacom.session.wap.0001_2024-09-02',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 2000,
	},
	{
		name: 'InventoryPenDetail',
		route: '/entity/sevenpens-inventory.invpen.wap.0001',
		viewport: { width: 1280, height: 1000 },
		waitAfter: 1500,
	},
	{
		name: 'InventoryTabletDetail',
		route: '/entity/sevenpens-inventory.invtablet.wat.0001',
		viewport: { width: 1280, height: 1000 },
		waitAfter: 1500,
	},
	{
		name: 'DetailView',
		route: '/entity/wacom.tablet.ctl4100',
		selector: '.detail-view, dl.fields, dl',
		viewport: { width: 1280, height: 1000 },
		waitAfter: 1500,
	},
	{
		name: 'Tabs',
		route: '/entity/wacom.tablet.ctl4100',
		selector: '.detail-tabs',
		waitAfter: 1500,
	},

	// --- Detail-page tabs --------------------------------------------------
	{
		name: 'PiafTab',
		route: '/entity/wacom.pen.kp503e#iaf',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 2500,
	},
	{
		name: 'PmaxTab',
		route: '/entity/wacom.pen.kp503e#max',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 2500,
	},

	// --- Charts and visualizations ----------------------------------------
	{
		name: 'PressureResponseChart',
		route: '/entity/wacom.session.wap.0001_2024-09-02',
		selector: '.chart-wrap, canvas',
		waitAfter: 2500,
	},
	{
		name: 'PressureResponseChartLegendTable',
		route: '/pressure-response',
		actions: [
			// Select first session to get the legend table populated.
			{ click: 'input[type="checkbox"]' },
			{ wait: 500 },
		],
		selector: '.legend-wrap',
		waitAfter: 1500,
	},
	{
		name: 'PressureBandsChart',
		route: '/reference#piaf-ranking',
		selector: '.bands-chart, svg.bands-chart',
		waitAfter: 1500,
	},
	{
		name: 'ValueHistogram',
		route: '/reference#tablet-sizes',
		selector: '.histogram-container',
		waitAfter: 1500,
	},
	{
		name: 'DistributionTable',
		route: '/tablet-analysis#aspect-ratio',
		selector: '.distribution-table, table',
		waitAfter: 1500,
	},
	{
		name: 'TabletSizeComparison',
		route: '/entity/wacom.tablet.ctl4100#size',
		selector: '.iso-chart-section',
		waitAfter: 1500,
	},
	{
		name: 'TabletDimensionComparison',
		route: '/tablet-compare',
		selector: '.iso-chart-scroll',
		waitAfter: 2000,
	},
	{
		name: 'ForceProportionsView',
		route: '/entity/wacom.tablet.ctl4100#force-proportions',
		viewport: { width: 1280, height: 1200 },
		waitAfter: 1500,
	},

	// --- Pickers / dialogs (need to be triggered) -------------------------
	{
		name: 'PenPicker',
		route: '/pen-compare',
		actions: [{ click: 'button:has-text("Add pen")' }, { wait: 600 }],
		selector: '.backdrop .modal',
		waitAfter: 800,
	},
	{
		name: 'TabletPicker',
		route: '/tablet-compare',
		actions: [{ click: 'button:has-text("Add tablet")' }, { wait: 600 }],
		selector: '.backdrop .modal',
		waitAfter: 800,
	},
	{
		name: 'ExportDialog',
		route: '/tablets',
		actions: [{ wait: 1500 }, { click: 'button:has-text("Export")' }, { wait: 600 }],
		selector: '.backdrop .dialog',
		waitAfter: 800,
	},

	// --- Listing-page layout ----------------------------------------------
	{
		name: 'EntityListLayout',
		route: '/brands',
		viewport: { width: 1280, height: 900 },
		waitAfter: 1500,
	},
	{
		name: 'SectionedPage',
		route: '/pen-analysis',
		viewport: { width: 1280, height: 1000 },
		waitAfter: 2000,
	},

	// --- Compat tables ----------------------------------------------------
	{
		name: 'CompatEntityTable',
		route: '/entity/wacom.pen.kp503e#compatible-tablets',
		selector: '.compat-table',
		waitAfter: 1500,
	},
	{
		name: 'SessionStats',
		route: '/pressure-response',
		actions: [{ click: 'input[type="checkbox"]' }, { wait: 500 }],
		selector: '.stats',
		waitAfter: 1500,
	},

	// --- Buttons / small atoms --------------------------------------------
	{
		name: 'FlagButton',
		route: '/tablets',
		selector: 'button.flag-btn, .flag-button',
		waitAfter: 1500,
	},
	{
		name: 'ExportTableButton',
		route: '/api-explorer',
		selector: '.export-btn',
		waitAfter: 1500,
	},
	{
		name: 'ChartExportButton',
		route: '/entity/wacom.session.wap.0001_2024-09-02',
		selector: '.chart-export-button, button:has-text("Export")',
		waitAfter: 2500,
	},
	{
		name: 'FieldPicker',
		route: '/tablets',
		actions: [
			// Open the Filters menu, then the field picker inside it.
			{ click: 'button:has-text("Filters"), button:has-text("+ Add filter")' },
			{ wait: 500 },
		],
		selector: '.field-picker',
		waitAfter: 800,
	},

	// --- Backfill dev tool (added in #212) --------------------------------
	{
		name: 'pressure-backfill',
		route: '/pressure-backfill',
		viewport: { width: 1280, height: 1400 },
		waitAfter: 2500,
	},
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const failures = [];

for (const spec of SPECS) {
	try {
		if (spec.viewport) await page.setViewportSize(spec.viewport);
		else await page.setViewportSize({ width: 1280, height: 900 });

		await page.goto(BASE + spec.route, { waitUntil: 'networkidle', timeout: 20_000 });
		if (spec.waitAfter) await page.waitForTimeout(spec.waitAfter);

		for (const action of spec.actions ?? []) {
			if ('click' in action) {
				const target = page.locator(action.click).first();
				if (await target.count()) await target.click({ trial: false }).catch(() => {});
			} else if ('hover' in action) {
				await page
					.locator(action.hover)
					.first()
					.hover()
					.catch(() => {});
			} else if ('wait' in action) {
				await page.waitForTimeout(action.wait);
			}
		}

		const outPath = path.join(OUT_DIR, `${spec.name}.png`);
		if (spec.selector) {
			const locator = page.locator(spec.selector).first();
			const count = await locator.count();
			if (count === 0) {
				// Fall back to a full viewport screenshot rather than failing.
				console.warn(
					`  ⚠ ${spec.name}: selector "${spec.selector}" found 0 — falling back to viewport`,
				);
				await page.screenshot({ path: outPath, fullPage: false });
			} else {
				await locator.screenshot({ path: outPath });
			}
		} else {
			await page.screenshot({ path: outPath, fullPage: false });
		}
		console.log(`✓ ${spec.name.padEnd(36)} ${spec.route}`);
	} catch (err) {
		failures.push({ name: spec.name, err: String(err.message ?? err).slice(0, 200) });
		console.error(`✗ ${spec.name}: ${err.message ?? err}`);
	}
}

await browser.close();

console.log(`\nCaptured ${SPECS.length - failures.length} / ${SPECS.length}.`);
if (failures.length) {
	console.log('Failures:');
	for (const f of failures) console.log(`  - ${f.name}: ${f.err}`);
	process.exitCode = 1;
}

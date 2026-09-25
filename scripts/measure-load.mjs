#!/usr/bin/env node
/**
 * Cold-load timing for one page, over several runs (#359).
 *
 * Each run launches a fresh Chromium — a new context alone still shares the
 * browser's HTTP/2 connection, which makes runs 2..n look warm. Optional
 * network emulation (Chrome's per-request latency + a download cap) for the
 * slow-link cases. Prints per-metric medians plus every run.
 *
 * Usage:
 *   node scripts/measure-load.mjs <url> [runs=5] [--rtt ms] [--kbps n] [--wait selector]
 *
 *   node scripts/measure-load.mjs https://thesevenpens.github.io/DrawTabDataExplorer/tablets
 *   node scripts/measure-load.mjs <url> 5 --rtt 150 --kbps 1600   # ≈ slow 4G
 *   node scripts/measure-load.mjs <url> 5 --rtt 40 --kbps 9000    # ≈ fast 4G
 *
 * "rows" is when the --wait selector (default: a table row) appears — the
 * page is useful. Measure the deployed site or an HTTP/2 server: `vite
 * preview` is HTTP/1.1, whose six-connection limit makes the JS phase look
 * far worse than production.
 *
 * Needs the Playwright Chromium the e2e tests use (npx playwright install
 * chromium). Read-only; writes nothing.
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const rtt = opt('--rtt');
const kbps = opt('--kbps');
const waitFor = opt('--wait') ?? 'table tbody tr';
const [url, runsArg] = args;
if (!url) {
	console.error(
		'Usage: node scripts/measure-load.mjs <url> [runs] [--rtt ms] [--kbps n] [--wait selector]',
	);
	process.exit(1);
}
const runs = Number(runsArg ?? 5);

const results = [];
for (let r = 0; r < runs; r++) {
	const browser = await chromium.launch();
	try {
		const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
		const page = await ctx.newPage();
		if (rtt !== undefined) {
			const cdp = await ctx.newCDPSession(page);
			await cdp.send('Network.enable');
			await cdp.send('Network.emulateNetworkConditions', {
				offline: false,
				latency: Number(rtt),
				downloadThroughput: kbps ? (Number(kbps) * 1024) / 8 : -1,
				uploadThroughput: -1,
			});
		}
		await page.goto(url, { waitUntil: 'load' });
		await page.waitForSelector(waitFor, { timeout: 60_000 });
		const usable = await page.evaluate(() => performance.now());
		const m = await page.evaluate(() => {
			const res = performance.getEntriesByType('resource');
			const js = res.filter((e) => e.name.endsWith('.js'));
			const data = res.filter((e) => e.name.endsWith('.json'));
			const nav = performance.getEntriesByType('navigation')[0];
			const ms = (x) => Math.round(x);
			const kb = (xs) => +(xs.reduce((a, e) => a + e.transferSize, 0) / 1024).toFixed(1);
			const first = (xs, k) => (xs.length ? ms(Math.min(...xs.map((e) => e[k]))) : -1);
			const last = (xs, k) => (xs.length ? ms(Math.max(...xs.map((e) => e[k]))) : -1);
			return {
				protocol: (data[0] ?? js[0])?.nextHopProtocol,
				html: ms(nav.responseEnd),
				domContentLoaded: ms(nav.domContentLoadedEventEnd),
				jsFiles: js.length,
				jsKB: kb(js),
				jsDone: last(js, 'responseEnd'),
				dataFiles: data.length,
				dataKB: kb(data),
				dataStart: first(data, 'startTime'),
				dataDone: last(data, 'responseEnd'),
			};
		});
		results.push({ ...m, usable: Math.round(usable) });
	} finally {
		await browser.close();
	}
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const net = rtt !== undefined ? ` rtt=${rtt}ms${kbps ? ` ${kbps}kbps` : ''}` : ' (no emulation)';
console.log(`${url}  runs=${runs}${net}  protocol=${results[0].protocol}`);
for (const k of Object.keys(results[0]).filter((k) => typeof results[0][k] === 'number')) {
	const xs = results.map((r) => r[k]);
	console.log(`  ${k.padEnd(17)} median ${String(median(xs)).padStart(6)}   [${xs.join(', ')}]`);
}

#!/usr/bin/env node
/**
 * Extracts external reference links (reviews, tutorials, product pages,
 * manuals, store, reddit) from the DrawingTabletDocs catalog and maps them to
 * our tablet/pen entities, for review on the /links-review page before they
 * land in entity data.
 *
 * Usage: node scripts/extract-doc-links.mjs [path-to-DrawingTabletDocs]
 * Default source: ../DrawingTabletDocs (sibling checkout).
 * Writes data-repo/data/links/doc-links.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, '..', 'DrawingTabletDocs');
const OUT = path.join(ROOT, 'data-repo', 'data', 'links', 'doc-links.json');

const norm = (s) =>
	String(s ?? '')
		.replace(/[^a-z0-9]/gi, '')
		.toUpperCase();
const hasDigit = (s) => /\d/.test(s);

// ---- build entity code index (tablet + pen) ----
function loadEntities(dir, topKey, idKey, nameKey, kind) {
	const out = [];
	for (const f of fs
		.readdirSync(path.join(ROOT, 'data-repo/data', dir))
		.filter((f) => f.endsWith('.json'))) {
		const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data-repo/data', dir, f)));
		for (const e of j[topKey] ?? []) {
			const m = kind === 'tablet' ? e.Model : e;
			const eid = kind === 'tablet' ? e.Meta.EntityId : e.EntityId;
			const ids = [m[idKey], m[nameKey], ...(m.AlternateNames ?? []), ...(m.OTDNames ?? [])];
			const codes = [...new Set(ids.map(norm).filter((c) => c.length >= 4 && hasDigit(c)))];
			out.push({ eid, kind, brand: m.Brand, codes });
		}
	}
	return out;
}
const tablets = loadEntities('tablets', 'DrawingTablets', 'Id', 'Name', 'tablet');
const pens = loadEntities('pens', 'Pens', 'PenId', 'PenName', 'pen');

// match a normalized haystack (filename) to entities of a kind, by longest code hit
function matchEntities(hay, kind) {
	const H = norm(hay);
	const hits = [];
	for (const e of kind === 'tablet' ? tablets : pens) {
		const best = e.codes.filter((c) => H.includes(c)).sort((a, b) => b.length - a.length)[0];
		if (best) hits.push({ eid: e.eid, brand: e.brand, code: best });
	}
	// keep only the longest-code matches (drop a short code subsumed by a longer one on another entity)
	const maxLen = Math.max(0, ...hits.map((h) => h.code.length));
	return hits.filter((h) => h.code.length >= Math.min(maxLen, 5) || h.code.length === maxLen);
}

// ---- link classification ----
const BRAND_BY_HOST = [
	[/wacom\.com|101\.wacom|estore\.wacom/, 'Wacom'],
	[/huion\.com|store\.huion/, 'Huion'],
	[/xp-?pen\.com/, 'XP-Pen'],
	[/gaomon\.net/, 'Gaomon'],
	[/xencelabs\.com/, 'Xencelabs'],
	[/ugee\.com/, 'Ugee'],
	[/veikk\.com/, 'Veikk'],
	[/samsung\.com/, 'Samsung'],
	[/apple\.com/, 'Apple'],
];
function classify(url, title) {
	const host = new URL(url).hostname.replace(/^www\./, '');
	const t = title.toLowerCase();
	const brand = BRAND_BY_HOST.find(([re]) => re.test(url))?.[1];
	// Kept types only: REVIEW, PRODUCTINFO, USERMANUAL, STORE. Tutorials,
	// reddit discussions, plain archives, and notes are dropped.
	if (/youtube\.com|youtu\.be/.test(host)) {
		if (/tutorial|how ?to|setup|unbox|connect|install|guide|timelapse/.test(t)) return null;
		return { type: 'REVIEW', author: ytAuthor(title) };
	}
	if (/reddit\.com/.test(host)) return null;
	if (
		/101\.wacom\.com/.test(host) ||
		/manual|user ?help|userhelp/.test(t) ||
		/manual|manaul|instruction|user_?help|\/help\/|_pdf/i.test(url)
	)
		return { type: 'USERMANUAL', author: brand ?? '' };
	if (/store\.|estore\.|amazon\./.test(host)) return { type: 'STORE', author: brand ?? '' };
	if (/archive\.org|archive\.is/.test(host)) {
		if (/manual/.test(t)) return { type: 'USERMANUAL', author: '' };
		return null;
	}
	if (/thesevenpens/.test(host)) return null;
	if (brand) return { type: 'PRODUCTINFO', author: brand };
	return null; // out of scope — skip
}
// Unescape markdown, pull out an embedded date, and blank bare-URL titles.
function cleanTitle(raw, url) {
	let t = raw.replace(/\\([\\`*_{}[\]()#+\-.!~])/g, '$1').trim();
	let date = '';
	const dm = t.match(/(\d{4}-\d{2}-\d{2})/);
	if (dm) {
		date = dm[1];
		t = t
			.replace(dm[1], '')
			.replace(/\s{2,}/g, ' ')
			.trim();
	}
	if (/^https?:\/\//i.test(t) || t === url) t = '';
	return { title: t, date };
}
function ytAuthor(title) {
	if (title.includes(' - ')) return title.split(' - ')[0].trim();
	const m = title.match(/^(.+?)\s+reviews?\b/i);
	return m ? m[1].trim() : '';
}

// ---- walk the catalog ----
const files = [];
for (const sub of ['catalog/drawtabs', 'catalog/pens']) {
	const base = path.join(SRC, sub);
	const kind = sub.endsWith('drawtabs') ? 'tablet' : 'pen';
	const walk = (d) => {
		for (const name of fs.readdirSync(d)) {
			const p = path.join(d, name);
			if (fs.statSync(p).isDirectory()) walk(p);
			else if (name.endsWith('.md') && name !== 'README.md') files.push({ p, name, kind });
		}
	};
	if (fs.existsSync(base)) walk(base);
}

const linkRe = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)(\s+(\d{4}-\d{2}-\d{2}))?/g;
const embedRe = /\{%\s*embed\s+url="(https?:\/\/[^"]+)"\s*%\}/g;

const records = [];
const seen = new Set(); // entityId|url
let mapped = 0,
	unmapped = 0;
for (const { p, name, kind } of files) {
	const text = fs.readFileSync(p, 'utf8');
	const ents = matchEntities(name, kind);
	if (!ents.length) {
		unmapped++;
		continue;
	}
	mapped++;
	const links = [];
	for (const line of text.split('\n')) {
		let m;
		linkRe.lastIndex = 0;
		while ((m = linkRe.exec(line))) {
			const { title, date } = cleanTitle(m[1], m[2]);
			links.push({ url: m[2], title, date: m[4] || date });
		}
		embedRe.lastIndex = 0;
		while ((m = embedRe.exec(line))) links.push({ url: m[1], title: '', date: '' });
	}
	for (const { url, title, date } of links) {
		let c;
		try {
			c = classify(url, title);
		} catch {
			c = null;
		}
		if (!c) continue;
		for (const e of ents) {
			const key = `${e.eid}|${url}`;
			if (seen.has(key)) continue;
			seen.add(key);
			records.push({
				entityId: e.eid,
				entityType: kind,
				brand: e.brand,
				type: c.type,
				url,
				title,
				author: c.author ?? '',
				publishDate: date,
				sourceFile: path.relative(SRC, p).replace(/\\/g, '/'),
			});
		}
	}
}

records.sort((a, b) => a.entityId.localeCompare(b.entityId) || a.url.localeCompare(b.url));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ links: records }, null, 2) + '\n');

// ---- stats ----
const byType = {};
for (const r of records) byType[r.type] = (byType[r.type] || 0) + 1;
const entities = new Set(records.map((r) => r.entityId));
console.log(`files: ${files.length} | mapped to ≥1 entity: ${mapped} | unmapped: ${unmapped}`);
console.log(`links extracted: ${records.length} across ${entities.size} entities`);
console.log('by type:', JSON.stringify(byType));
console.log(
	`with a date: ${records.filter((r) => r.publishDate).length} | with an author: ${records.filter((r) => r.author).length}`,
);
console.log(`\nwrote ${OUT}`);

// Scan pen and tablet records for marketing names that start with the
// human-readable brand name. These are entities where formatting as
// "${brandName} ${name}" doubles the brand — e.g. "Wacom Wacom One Pen".
import fs from 'node:fs';
import path from 'node:path';

// Build the BrandId → display-name map from the brands.json file.
const brandsRaw = JSON.parse(fs.readFileSync('data-repo/data/brands/brands.json', 'utf8'));
const brandDisplay = new Map();
for (const b of brandsRaw.Brands || brandsRaw) {
	brandDisplay.set(b.BrandId, b.BrandName);
}

function brandPrefixesName(brandId, name) {
	const display = brandDisplay.get(brandId);
	if (!display || !name) return false;
	const lower = name.toLowerCase();
	const prefix = display.toLowerCase();
	return lower === prefix || lower.startsWith(prefix + ' ');
}

function scanDir(dir, pickRecords, pickFields) {
	const out = [];
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith('.json')) continue;
		const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
		for (const r of pickRecords(data) || []) {
			const fields = pickFields(r);
			if (brandPrefixesName(fields.brandId, fields.name)) {
				out.push(fields);
			}
		}
	}
	return out.sort((a, b) => a.entityId.localeCompare(b.entityId));
}

const pens = scanDir(
	'data-repo/data/pens',
	(d) => d.Pens,
	(p) => ({ entityId: p.EntityId, brandId: p.Brand, name: p.PenName }),
);

const tablets = scanDir(
	'data-repo/data/tablets',
	(d) => d.DrawingTablets,
	(t) => ({
		entityId: t.Meta?.EntityId,
		brandId: t.Model?.Brand,
		name: t.Model?.Name,
	}),
);

console.log('=== Pens with brand prefix in PenName ===');
for (const r of pens) {
	console.log(`${r.entityId.padEnd(40)} | ${r.brandId.padEnd(10)} | "${r.name}"`);
}
console.log(`pens total: ${pens.length}\n`);

console.log('=== Tablets with brand prefix in Model.Name ===');
for (const r of tablets) {
	console.log(`${r.entityId.padEnd(40)} | ${r.brandId.padEnd(10)} | "${r.name}"`);
}
console.log(`tablets total: ${tablets.length}`);

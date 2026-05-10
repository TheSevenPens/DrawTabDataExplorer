// Scan pen and tablet records for marketing names that already contain the
// model ID as a token. These are entities where the computed FullName
// ("Brand Name (Id)") looks duplicated — e.g. "Asus ProArt Pen MPA01 (MPA01)"
// or "Wacom Cintiq 22 (DTK-2200)" when the name already says "DTK-2200".
import fs from 'node:fs';
import path from 'node:path';

function nameContainsId(name, id) {
	if (!id || !name) return false;
	if (name === id) return true;
	const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, 'i').test(name);
}

function scanDir(dir, pickRecords, pickFields) {
	const out = [];
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith('.json')) continue;
		const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
		for (const r of pickRecords(data) || []) {
			const fields = pickFields(r);
			if (nameContainsId(fields.name, fields.id) && fields.name !== fields.id) {
				out.push({
					entityId: fields.entityId,
					brand: fields.brand,
					name: fields.name,
					id: fields.id,
				});
			}
		}
	}
	return out.sort((a, b) => a.entityId.localeCompare(b.entityId));
}

const pens = scanDir(
	'data-repo/data/pens',
	(d) => d.Pens,
	(p) => ({ entityId: p.EntityId, brand: p.Brand, name: p.PenName, id: p.PenId }),
);

const tablets = scanDir(
	'data-repo/data/tablets',
	(d) => d.DrawingTablets,
	(t) => ({
		entityId: t.Meta?.EntityId,
		brand: t.Model?.Brand,
		name: t.Model?.Name,
		id: t.Model?.Id,
	}),
);

console.log('=== Pens with PenId in PenName ===');
for (const r of pens) {
	console.log(`${r.entityId.padEnd(40)} | ${r.brand.padEnd(10)} | "${r.name}" / "${r.id}"`);
}
console.log(`pens total: ${pens.length}\n`);

console.log('=== Tablets with Model.Id in Model.Name ===');
for (const r of tablets) {
	console.log(`${r.entityId.padEnd(40)} | ${r.brand.padEnd(10)} | "${r.name}" / "${r.id}"`);
}
console.log(`tablets total: ${tablets.length}`);

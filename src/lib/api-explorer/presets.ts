// Preset queries for the /api-explorer "Load example…" dropdown, plus the
// sidebar grouping and the runtime assertion that keeps the two in sync.
// Extracted from the route (GitHub #222) so the data + invariant are
// unit-testable and the page component stays focused on UI wiring.

export interface Preset {
	label: string;
	body: string;
}

// Sidebar grouping for the Load example… dropdown. Each label here must match
// a preset's `label` exactly; extras and misses are fenced by the runtime
// assertion in `buildGroupedPresets` below. Add a new preset → also add its
// label to the appropriate group.
export const PRESET_GROUPS: { group: string; labels: string[] }[] = [
	{
		group: 'Lookups & ranking',
		labels: [
			'Top 5 newest Wacom pen displays',
			'Find an entity by its canonical EntityId',
			'Find a record by a single field (.findBy)',
			'keyBy: lookup tablets by ModelId',
		],
	},
	{
		group: 'Filtering',
		labels: [
			'Predicate-function filter',
			'Boolean expression filter (OR / AND / NOT)',
			'filterIn: brand is one of a set',
			'between operator: launch year range',
			'Strict (case-sensitive) contains',
			'Distinct values of a field',
			'Pens tagged UDEMR',
		],
	},
	{
		group: 'Sorting & paging',
		labels: ['Pagination: skip + take', 'Multi-key sort (primary-by-first)'],
	},
	{
		group: 'Projection & reshape',
		labels: ['Project to specific columns with .select()', 'unroll: explode alternate names'],
	},
	{
		group: 'Aggregation',
		labels: [
			'Count tablets per brand',
			'Count tablets per brand and type',
			'countIf: Excel-style conditional counts in summarize',
			'Wacom launch-year stats (avg/min/max)',
			'Brands with > 30 tablets (filter after summarize = SQL HAVING)',
			'Median launch year per brand (with collect)',
			'Derive + summarize: tablet age buckets',
		],
	},
	{
		group: 'Joins',
		labels: [
			'Join: PenCompat × Pens (inner) for a tablet',
			'Semijoin: pens compatible with a tablet (no col merge)',
			'antijoin: pens with no compatible tablet (data-quality)',
			'Wacom pen tablets not in inventory (antijoin)',
			'leftjoin: every pen + its compat tablets (if any)',
			'concat: combine two filtered queries',
		],
	},
	{
		group: 'Record-method API',
		labels: [
			'Compatible pens for a tablet (record-method API)',
			'Tablet family + its members',
			'Reverse compatibility (pen → tablets)',
			'Brand → its tablets and pens',
			'Inventory: getPen() on first inventory record',
		],
	},
	{
		group: 'Pressure response',
		labels: [
			'Pressure-response session lookup',
			'Top 10 Piaf measurements (worst single sessions)',
			'Top 10 pens with highest Piaf (worst activation force)',
		],
	},
];

export const presets: Preset[] = [
	{
		label: 'Top 5 newest Wacom pen displays',
		body: `return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .filter('ModelType', '==', 'PENDISPLAY')
  .sort('ModelLaunchYear', 'desc')
  .take(5)
  .toArray();`,
	},
	{
		label: 'Find an entity by its canonical EntityId',
		body: `// ds.getEntity() dispatches on the 2nd dot-segment of the EntityId
// (or returns a Brand for a single-segment id). Same lookup the URL
// router uses, available across every entity type via one method.

return {
  tablet: await ds.getEntity('wacom.tablet.pth660'),
  pen:    await ds.getEntity('wacom.pen.up911e'),
  brand:  await ds.getEntity('wacom'),
};`,
	},
	{
		label: 'Find a record by a single field (.findBy)',
		body: `// .findBy(field, value) is sugar for the common
// .find(t => t.<field> === value) pattern. Routes through FieldDef
// so nested paths work too.

return {
  pl550: await ds.Tablets.findBy('ModelId', 'PL-550'),
  up911: await ds.Pens.findBy('PenId', 'UP-911E'),
};`,
	},
	{
		label: 'Compatible pens for a tablet (record-method API)',
		body: `const t = await ds.getEntity('wacom.tablet.pl550');
return await t.getCompatiblePens();`,
	},
	{
		label: 'Tablet family + its members',
		body: `const t = await ds.getEntity('wacom.tablet.pl550');
const family = await t.getFamily();
const members = await family.getTablets();
return { family: family.FamilyName, count: members.length, members: members.map(m => m.Model.Id) };`,
	},
	{
		label: 'Reverse compatibility (pen → tablets)',
		body: `const pen = await ds.Pens.findBy('PenId', 'UP-911E');
const tablets = await pen.getCompatibleTablets();
return tablets.map(t => t.Meta.EntityId);`,
	},
	{
		label: 'Count tablets per brand',
		body: `// .countBy(field) is sugar for .summarize({by:field, count:'count'})
// .sort('count','desc'). Default alias is 'count'; pass
// { countAlias: 'tablets' } if you want a custom column name.

return await ds.Tablets.countBy('Brand').toArray();`,
	},
	{
		label: 'Count tablets per brand and type',
		body: `// Multi-field grouping — one row per (Brand, ModelType) pair.
return await ds.Tablets.countBy(['Brand', 'ModelType']).toArray();`,
	},
	{
		label: 'Wacom launch-year stats (avg/min/max)',
		body: `return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .summarize({
    by: 'Brand',
    count: 'tablets',
    avg: { avgYear: 'ModelLaunchYear' },
    min: { firstYear: 'ModelLaunchYear' },
    max: { lastYear: 'ModelLaunchYear' },
  })
  .toArray();`,
	},
	{
		label: 'Brands with > 30 tablets (filter after summarize = SQL HAVING)',
		body: `// Chaining .filter() after .summarize() filters on the aggregated column —
// equivalent to SQL HAVING. Works because summarize swaps in synthetic
// field-defs over the summary rows.
return await ds.Tablets
  .summarize({ by: 'Brand', count: 'tablets' })
  .filter('tablets', '>', 30)
  .sort('tablets', 'desc')
  .toArray();`,
	},
	{
		label: 'Project to specific columns with .select()',
		body: `return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .select(['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'])
  .sort('ModelLaunchYear', 'desc')
  .take(5)
  .toArray();`,
	},
	{
		label: 'Distinct values of a field',
		body: `// .distinct() returns a sorted array of distinct non-empty values.
return await ds.Tablets.filter('Brand', '==', 'WACOM').distinct('ModelType');`,
	},
	{
		label: 'Pens tagged UDEMR',
		body: `// Pens whose Tags array includes "UDEMR" (a universal/active EMR pen
// tag — no tablet carries it; only pens have a Tags field). The Tags
// FieldDef joins the array to a string, so the case-insensitive
// 'contains' operator matches the tag.
return await ds.Pens
  .filter('Tags', 'contains', 'UDEMR')
  .select(['Brand', 'PenId', 'PenName', 'Tags'])
  .sort('Brand', 'asc')
  .toArray();`,
	},
	{
		label: 'Predicate-function filter',
		body: `// .filter() also accepts an arbitrary predicate function.
// Not serialisable — use string-tuple form for saved/URL state.
return await ds.Tablets
  .filter(t => (t.Model.LaunchYear ?? 0) >= 2020 && t.Display)
  .take(5)
  .toArray();`,
	},
	{
		label: 'Boolean expression filter (OR / AND / NOT)',
		body: `// Tree-shaped filter expression — also serialisable.
return await ds.Tablets
  .filter({
    or: [
      { and: [
        { field: 'Brand', op: '==', value: 'WACOM' },
        { field: 'ModelType', op: '==', value: 'PENDISPLAY' },
      ]},
      { field: 'Brand', op: '==', value: 'XENCELABS' },
    ],
  })
  .sort('ModelLaunchYear', 'desc')
  .take(10)
  .toArray();`,
	},
	{
		label: 'Derive + summarize: tablet age buckets',
		body: `// .derive() adds computed columns usable by downstream verbs.
return await ds.Tablets
  .derive({
    decade: t => Math.floor((t.Model.LaunchYear ?? 2000) / 10) * 10,
  })
  .summarize({ by: 'decade', count: 'tablets' })
  .sort('decade', 'asc')
  .toArray();`,
	},
	{
		label: 'Join: PenCompat × Pens (inner) for a tablet',
		body: `// Inner join merges right-side columns into matched rows.
return await ds.PenCompat
  .filter('TabletId', '==', 'PL-550')
  .join(ds.Pens, 'PenId', 'PenId')
  .toArray();`,
	},
	{
		label: 'Semijoin: pens compatible with a tablet (no col merge)',
		body: `// .semijoin() keeps left rows that have a match — same shape as left.
// Equivalent to tablet.getCompatiblePens() but expressed as a verb.
return await ds.Pens
  .semijoin(ds.PenCompat.filter('TabletId', '==', 'PL-550'), 'PenId', 'PenId')
  .toArray();`,
	},
	{
		label: 'Pagination: skip + take',
		body: `// Page 3 (rows 11-15) of Wacom tablets by launch year.
return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .sort('ModelLaunchYear', 'desc')
  .skip(10)
  .take(5)
  .toArray();`,
	},
	{
		label: 'Multi-key sort (primary-by-first)',
		body: `// Array form: primary by Brand asc, secondary by year desc.
return await ds.Tablets
  .filterIn('Brand', ['WACOM', 'HUION', 'XPPEN'])
  .sort([
    { field: 'Brand', direction: 'asc' },
    { field: 'ModelLaunchYear', direction: 'desc' },
  ])
  .take(15)
  .toArray();`,
	},
	{
		label: 'filterIn: brand is one of a set',
		body: `return await ds.Tablets
  .filterIn('Brand', ['WACOM', 'XENCELABS'])
  .countBy('Brand')
  .toArray();`,
	},
	{
		label: 'between operator: launch year range',
		body: `return await ds.Tablets
  .filter('ModelLaunchYear', 'between', '2018|2022')
  .summarize({ by: 'Brand', count: 'tablets' })
  .sort('tablets', 'desc')
  .toArray();`,
	},
	{
		label: 'antijoin: pens with no compatible tablet (data-quality)',
		body: `// Pens that don't appear in any PenCompat row.
return await ds.Pens
  .antijoin(ds.PenCompat, 'PenId', 'PenId')
  .select(['Brand', 'PenId', 'PenName'])
  .toArray();`,
	},
	{
		label: 'Wacom pen tablets not in inventory (antijoin)',
		body: `// Wacom PENTABLET models whose EntityId isn't referenced by any
// InventoryTablet — i.e. the pen tablets we don't physically own.
// antijoin keeps left rows with NO match on the right side.
return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .filter('ModelType', '==', 'PENTABLET')
  .antijoin(ds.InventoryTablets, 'EntityId', 'TabletEntityId')
  .select(['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'])
  .sort('ModelLaunchYear', 'desc')
  .toArray();`,
	},
	{
		label: 'leftjoin: every pen + its compat tablets (if any)',
		body: `return await ds.Pens
  .filter('Brand', '==', 'WACOM')
  .leftjoin(ds.PenCompat, 'PenId', 'PenId')
  .select(['PenId', 'TabletId'])
  .take(15)
  .toArray();`,
	},
	{
		label: 'unroll: explode alternate names',
		body: `// Lift the nested array via derive, then unroll to one row per name.
return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .derive({ name: t => t.Model.AlternateNames ?? [] })
  .unroll('name')
  .select(['ModelId', 'name'])
  .take(15)
  .toArray();`,
	},
	{
		label: 'concat: combine two filtered queries',
		body: `// All Wacom + all Apple tablets, side by side.
return await ds.Tablets.filter('Brand', '==', 'WACOM')
  .concat(ds.Tablets.filter('Brand', '==', 'APPLE'))
  .count();`,
	},
	{
		label: 'keyBy: lookup tablets by ModelId',
		body: `const byId = await ds.Tablets.keyBy('ModelId');
return byId['PL-550'];`,
	},
	{
		label: 'Strict (case-sensitive) contains',
		body: `// Default contains is case-insensitive. The *Strict variants are exact.
return {
  caseInsensitive: await ds.Tablets.filter('ModelName', 'contains', 'CINTIQ').count(),
  caseSensitive: await ds.Tablets.filter('ModelName', 'containsStrict', 'CINTIQ').count(),
};`,
	},
	{
		label: 'countIf: Excel-style conditional counts in summarize',
		body: `// Per group, count rows that match each condition. Each entry under
// countIf becomes its own column. The condition is either a predicate
// function (most ergonomic) or a FilterExpr leaf (URL-serialisable
// for saved views).

return await ds.Tablets
  .summarize({
    by: 'Brand',
    count: 'total',
    countIf: {
      penDisplays: { field: 'ModelType', op: '==', value: 'PENDISPLAY' },
      penTablets:  { field: 'ModelType', op: '==', value: 'PENTABLET' },
      standalones: { field: 'ModelType', op: '==', value: 'STANDALONE' },
      recent2020plus: (t) => (t.Model.LaunchYear ?? '') >= '2020',
    },
  })
  .sort('total', 'desc')
  .toArray();`,
	},
	{
		label: 'Median launch year per brand (with collect)',
		body: `return await ds.Tablets
  .summarize({
    by: 'Brand',
    count: 'tablets',
    median: { medianYear: 'ModelLaunchYear' },
    distinctCount: { distinctTypes: 'ModelType' },
  })
  .sort('tablets', 'desc')
  .toArray();`,
	},
	{
		label: 'Pressure-response session lookup',
		body: `const session = await ds.PressureResponse.findBy('InventoryId', 'WAP.0001');
const pen = await session.getPen();
const tablet = await session.getTablet();
return { session: session.InventoryId, pen: pen?.PenId, tablet: tablet?.Model.Id };`,
	},
	{
		label: 'Top 10 Piaf measurements (worst single sessions)',
		body: `// Per-session ranking sorted by the computed Piaf column.
// Piaf is the smallest force at which the pen first registers any
// pressure — lower is better, so 'desc' surfaces the worst sessions.

return await ds.PressureResponse
  .dropEmpty('Piaf')
  .select(['PenEntityId', 'InventoryId', 'Date', 'Piaf'])
  .sort('Piaf', 'desc')
  .take(10)
  .toArray();`,
	},
	{
		label: 'Top 10 pens with highest Piaf (worst activation force)',
		body: `// Pen-model aggregate: median Piaf per pen, ranked worst-first.
// Defective-unit sessions are filtered via the computed IsDefective
// field instead of building a Set from InventoryPens at call-site.

return await ds.PressureResponse
  .filter('IsDefective', '==', 'NO')
  .dropEmpty('Piaf')
  .summarize({
    by: 'PenEntityId',
    median: { medianPiaf: 'Piaf' },
    count: 'sessions',
  })
  .sort('medianPiaf', 'desc')
  .take(10)
  .toArray();`,
	},
	{
		label: 'Brand → its tablets and pens',
		body: `const brand = await ds.getEntity('wacom');
const tablets = await brand.getTablets();
const pens = await brand.getPens();
return { tablets: tablets.length, pens: pens.length };`,
	},
	{
		label: 'Inventory: getPen() on first inventory record',
		body: `const inv = await ds.InventoryPens.find(() => true);
const pen = await inv.getPen();
return { inventoryId: inv.InventoryId, pen: pen?.PenId };`,
	},
];

export function renderPreset(p: Preset): string {
	return `// ${p.label}\n${p.body}`;
}

// Resolve each PRESET_GROUPS entry to its actual Preset objects. Throws on a
// label that's listed in a group but missing from `presets[]` (or vice versa)
// so the assertion catches typos at build/import time instead of producing a
// silently-empty group. Exported as a function (rather than computed at module
// load) so a unit test can assert the invariant explicitly.
export function buildGroupedPresets(
	allPresets: Preset[] = presets,
	groups: { group: string; labels: string[] }[] = PRESET_GROUPS,
): { group: string; presets: Preset[] }[] {
	const byLabel = new Map(allPresets.map((p) => [p.label, p]));
	const grouped: { group: string; presets: Preset[] }[] = [];
	const seen = new Set<string>();
	for (const g of groups) {
		const items: Preset[] = [];
		for (const l of g.labels) {
			const p = byLabel.get(l);
			if (!p) throw new Error(`PRESET_GROUPS references unknown preset label: "${l}"`);
			items.push(p);
			seen.add(l);
		}
		grouped.push({ group: g.group, presets: items });
	}
	const ungrouped = allPresets.filter((p) => !seen.has(p.label));
	if (ungrouped.length > 0) {
		throw new Error(
			`Presets missing from PRESET_GROUPS: ${ungrouped.map((p) => `"${p.label}"`).join(', ')}`,
		);
	}
	return grouped;
}

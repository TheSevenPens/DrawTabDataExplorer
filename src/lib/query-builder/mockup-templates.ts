// Starter templates for the Query Builder — single-collection linear pipelines
// (filter → columns → sort → limit → output). Group labels feed the Example
// dropdown; buildGroupedTemplates() keeps groups and BASIC_TEMPLATES in sync.

export type BuilderCollection = 'Tablets' | 'Pens' | 'PenCompat' | 'Drivers' | 'PressureResponse';

export interface BuilderFilter {
	field: string;
	operator: string;
	value: string;
	disabled?: boolean;
}

export interface BuilderSort {
	field: string;
	direction: 'asc' | 'desc';
	disabled?: boolean;
}

export type BuilderOutput =
	| { mode: 'toArray' }
	| { mode: 'distinct'; field: string }
	| { mode: 'count' }
	| { mode: 'countBy'; fields: string[] };

export interface QueryBuilderTemplate {
	label: string;
	collection: BuilderCollection;
	filters: BuilderFilter[];
	sorts: BuilderSort[];
	columns: string[];
	skip?: number;
	take?: number;
	output: BuilderOutput;
}

/** Sidebar grouping for the Example dropdown. Each label must match a template exactly. */
export const TEMPLATE_GROUPS: { group: string; labels: string[] }[] = [
	{
		group: 'Tablets — Lookups & ranking',
		labels: [
			'Top 5 newest Wacom pen displays',
			'Find tablet by Model ID',
			'Project Wacom columns (top 5 by year)',
			'Pagination: Wacom page 3 (skip 10, take 5)',
			'Multi-key sort (brand asc, year desc)',
			'Apple tablets, newest first',
			'Cintiq tablets by name',
			'Tablets from 2020 onward',
			'Professional audience tablets',
		],
	},
	{
		group: 'Tablets — Filtering',
		labels: ['High digitizer density tablets', 'Tablets missing launch year'],
	},
	{
		group: 'Tablets — Aggregation',
		labels: [
			'Count all Wacom tablets',
			'Brands in set (filterIn) → count per brand',
			'Launch year between 2018–2022 → count per brand',
			'Tablets per brand and type',
			'Distinct tablet types (Wacom)',
		],
	},
	{
		group: 'Pens',
		labels: [
			'Find pen by Pen ID',
			'Wacom pens by year (newest first)',
			'Count pens per brand',
			'Pens with notes',
			'Pens tagged UDEMR',
		],
	},
	{
		group: 'Pen compatibility',
		labels: ['Pens for tablet PL-550', 'Tablets for pen UP-911E', 'Compat rows per brand'],
	},
	{
		group: 'Drivers',
		labels: ['Latest Wacom macOS drivers', 'Latest Wacom Windows drivers'],
	},
	{
		group: 'Pressure response',
		labels: [
			'Top 10 worst Piaf sessions',
			'Top 10 worst Pmax sessions',
			'Pressure sessions per brand',
		],
	},
];

export const BASIC_TEMPLATES: QueryBuilderTemplate[] = [
	{
		label: 'Top 5 newest Wacom pen displays',
		collection: 'Tablets',
		filters: [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'ModelType', operator: '==', value: 'PENDISPLAY' },
		],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear', 'ModelType'],
		take: 5,
		output: { mode: 'toArray' },
	},
	{
		label: 'Find tablet by Model ID',
		collection: 'Tablets',
		filters: [{ field: 'ModelId', operator: '==', value: 'PL-550' }],
		sorts: [],
		columns: ['FullName', 'ModelId', 'Brand', 'ModelLaunchYear'],
		take: 1,
		output: { mode: 'toArray' },
	},
	{
		label: 'Project Wacom columns (top 5 by year)',
		collection: 'Tablets',
		filters: [{ field: 'Brand', operator: '==', value: 'WACOM' }],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		take: 5,
		output: { mode: 'toArray' },
	},
	{
		label: 'Pagination: Wacom page 3 (skip 10, take 5)',
		collection: 'Tablets',
		filters: [{ field: 'Brand', operator: '==', value: 'WACOM' }],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		skip: 10,
		take: 5,
		output: { mode: 'toArray' },
	},
	{
		label: 'Multi-key sort (brand asc, year desc)',
		collection: 'Tablets',
		filters: [],
		sorts: [
			{ field: 'Brand', direction: 'asc' },
			{ field: 'ModelLaunchYear', direction: 'desc' },
		],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		take: 15,
		output: { mode: 'toArray' },
	},
	{
		label: 'Apple tablets, newest first',
		collection: 'Tablets',
		filters: [{ field: 'Brand', operator: '==', value: 'APPLE' }],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Cintiq tablets by name',
		collection: 'Tablets',
		filters: [{ field: 'ModelName', operator: 'contains', value: 'Cintiq' }],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Tablets from 2020 onward',
		collection: 'Tablets',
		filters: [{ field: 'ModelLaunchYear', operator: '>=', value: '2020' }],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Professional audience tablets',
		collection: 'Tablets',
		filters: [{ field: 'ModelAudience', operator: '==', value: 'Professional' }],
		sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelAudience', 'ModelLaunchYear'],
		output: { mode: 'toArray' },
	},
	{
		label: 'High digitizer density tablets',
		collection: 'Tablets',
		filters: [{ field: 'DigitizerDensity', operator: '>', value: '100' }],
		sorts: [{ field: 'DigitizerDensity', direction: 'desc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'DigitizerDensity', 'DigitizerDiagonal'],
		take: 10,
		output: { mode: 'toArray' },
	},
	{
		label: 'Tablets missing launch year',
		collection: 'Tablets',
		filters: [{ field: 'ModelLaunchYear', operator: 'empty', value: '' }],
		sorts: [{ field: 'Brand', direction: 'asc' }],
		columns: ['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Count all Wacom tablets',
		collection: 'Tablets',
		filters: [{ field: 'Brand', operator: '==', value: 'WACOM' }],
		sorts: [],
		columns: [],
		output: { mode: 'count' },
	},
	{
		label: 'Brands in set (filterIn) → count per brand',
		collection: 'Tablets',
		filters: [{ field: 'Brand', operator: 'in', value: 'WACOM,XENCELABS' }],
		sorts: [],
		columns: [],
		output: { mode: 'countBy', fields: ['Brand'] },
	},
	{
		label: 'Launch year between 2018–2022 → count per brand',
		collection: 'Tablets',
		filters: [{ field: 'ModelLaunchYear', operator: 'between', value: '2018|2022' }],
		sorts: [{ field: 'tablets', direction: 'desc' }],
		columns: ['Brand', 'tablets'],
		output: { mode: 'countBy', fields: ['Brand'] },
	},
	{
		label: 'Tablets per brand and type',
		collection: 'Tablets',
		filters: [],
		sorts: [{ field: 'count', direction: 'desc' }],
		columns: [],
		output: { mode: 'countBy', fields: ['Brand', 'ModelType'] },
	},
	{
		label: 'Distinct tablet types (Wacom)',
		collection: 'Tablets',
		filters: [{ field: 'Brand', operator: '==', value: 'WACOM' }],
		sorts: [],
		columns: [],
		output: { mode: 'distinct', field: 'ModelType' },
	},
	{
		label: 'Pens tagged UDEMR',
		collection: 'Pens',
		filters: [{ field: 'Tags', operator: 'contains', value: 'UDEMR' }],
		sorts: [{ field: 'Brand', direction: 'asc' }],
		columns: ['Brand', 'PenId', 'PenName', 'Tags'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Find pen by Pen ID',
		collection: 'Pens',
		filters: [{ field: 'PenId', operator: '==', value: 'UP-911E' }],
		sorts: [],
		columns: ['FullName', 'PenId', 'Brand', 'PenYear'],
		take: 1,
		output: { mode: 'toArray' },
	},
	{
		label: 'Wacom pens by year (newest first)',
		collection: 'Pens',
		filters: [{ field: 'Brand', operator: '==', value: 'WACOM' }],
		sorts: [{ field: 'PenYear', direction: 'desc' }],
		columns: ['Brand', 'PenId', 'PenName', 'PenYear'],
		take: 15,
		output: { mode: 'toArray' },
	},
	{
		label: 'Count pens per brand',
		collection: 'Pens',
		filters: [],
		sorts: [{ field: 'count', direction: 'desc' }],
		columns: [],
		output: { mode: 'countBy', fields: ['Brand'] },
	},
	{
		label: 'Pens with notes',
		collection: 'Pens',
		filters: [{ field: 'Notes', operator: 'notempty', value: '' }],
		sorts: [{ field: 'Brand', direction: 'asc' }],
		columns: ['Brand', 'PenId', 'PenName', 'Notes'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Pens for tablet PL-550',
		collection: 'PenCompat',
		filters: [{ field: 'TabletId', operator: '==', value: 'PL-550' }],
		sorts: [{ field: 'PenFullName', direction: 'asc' }],
		columns: ['TabletId', 'PenId', 'PenFullName', 'Brand'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Tablets for pen UP-911E',
		collection: 'PenCompat',
		filters: [{ field: 'PenId', operator: '==', value: 'UP-911E' }],
		sorts: [{ field: 'TabletFullName', direction: 'asc' }],
		columns: ['PenId', 'TabletId', 'TabletFullName', 'Brand'],
		output: { mode: 'toArray' },
	},
	{
		label: 'Compat rows per brand',
		collection: 'PenCompat',
		filters: [],
		sorts: [{ field: 'count', direction: 'desc' }],
		columns: [],
		output: { mode: 'countBy', fields: ['Brand'] },
	},
	{
		label: 'Latest Wacom macOS drivers',
		collection: 'Drivers',
		filters: [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'OSFamily', operator: '==', value: 'MACOS' },
		],
		sorts: [{ field: 'ReleaseDate', direction: 'desc' }],
		columns: ['Brand', 'DriverVersion', 'DriverName', 'OSFamily', 'ReleaseDate'],
		take: 10,
		output: { mode: 'toArray' },
	},
	{
		label: 'Latest Wacom Windows drivers',
		collection: 'Drivers',
		filters: [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'OSFamily', operator: '==', value: 'WINDOWS' },
		],
		sorts: [{ field: 'ReleaseDate', direction: 'desc' }],
		columns: ['Brand', 'DriverVersion', 'DriverName', 'OSFamily', 'ReleaseDate'],
		take: 10,
		output: { mode: 'toArray' },
	},
	{
		label: 'Top 10 worst Piaf sessions',
		collection: 'PressureResponse',
		filters: [{ field: 'IsDefective', operator: '==', value: 'NO' }],
		sorts: [{ field: 'Piaf', direction: 'desc' }],
		columns: ['PenEntityId', 'InventoryId', 'Date', 'Piaf', 'IsDefective'],
		take: 10,
		output: { mode: 'toArray' },
	},
	{
		label: 'Top 10 worst Pmax sessions',
		collection: 'PressureResponse',
		filters: [{ field: 'IsDefective', operator: '==', value: 'NO' }],
		sorts: [{ field: 'Pmax', direction: 'desc' }],
		columns: ['PenEntityId', 'InventoryId', 'Date', 'Pmax', 'IsDefective'],
		take: 10,
		output: { mode: 'toArray' },
	},
	{
		label: 'Pressure sessions per brand',
		collection: 'PressureResponse',
		filters: [{ field: 'IsDefective', operator: '==', value: 'NO' }],
		sorts: [{ field: 'count', direction: 'desc' }],
		columns: [],
		output: { mode: 'countBy', fields: ['Brand'] },
	},
];

export function buildGroupedTemplates(
	allTemplates: QueryBuilderTemplate[] = BASIC_TEMPLATES,
	groups: { group: string; labels: string[] }[] = TEMPLATE_GROUPS,
): { group: string; templates: QueryBuilderTemplate[] }[] {
	const byLabel = new Map(allTemplates.map((t) => [t.label, t]));
	const grouped: { group: string; templates: QueryBuilderTemplate[] }[] = [];
	const seen = new Set<string>();
	for (const g of groups) {
		const items: QueryBuilderTemplate[] = [];
		for (const label of g.labels) {
			const t = byLabel.get(label);
			if (!t) throw new Error(`TEMPLATE_GROUPS references unknown template label: "${label}"`);
			items.push(t);
			seen.add(label);
		}
		grouped.push({ group: g.group, templates: items });
	}
	const ungrouped = allTemplates.filter((t) => !seen.has(t.label));
	if (ungrouped.length > 0) {
		throw new Error(
			`Templates missing from TEMPLATE_GROUPS: ${ungrouped.map((t) => `"${t.label}"`).join(', ')}`,
		);
	}
	return grouped;
}

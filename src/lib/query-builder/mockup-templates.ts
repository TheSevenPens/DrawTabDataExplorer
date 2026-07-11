// Starter templates for the Query Builder prototype — maps to API Explorer
// "basic tier" examples (single collection, linear filter → sort → project → limit).

export type BuilderCollection =
	| 'Tablets'
	| 'Pens'
	| 'PenCompat'
	| 'Drivers'
	| 'PressureResponse';

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

/** v1 target: examples the graphical builder should express without typing code. */
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
];

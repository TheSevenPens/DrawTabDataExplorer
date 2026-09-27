import { executePipeline } from '@thesevenpens/queriton';
import { brandName } from '$data/lib/drawtab-loader.js';
import {
	TABLET_FIELDS,
	TABLET_DEFAULT_COLUMNS,
	tabletFullName,
} from '$data/lib/entities/tablet-fields.js';
import { buildActiveSteps, type SortItem } from '$lib/entity-explorer/view-state.js';
import { buildFilterParams, type UrlFilter } from '$lib/filter-url.js';
import type { TabletSpecsContext } from './tablet-specs.js';
import type { OpenTabletSpecsContext } from './open-tablet-specs.js';

const tabletTypes = TABLET_FIELDS.find((field) => field.key === 'ModelType')!.enumValues!;
const activeAreaField = TABLET_FIELDS.find((field) => field.key === 'DigitizerActiveAreaMm2')!;
const sizeColumns = [
	'Brand',
	'ModelName',
	'ModelId',
	'DigitizerDimensions',
	'DigitizerActiveAreaCm2',
	'ModelReleaseYear',
	'ModelStatus',
];

export function createQueryTabletsTool(context: TabletSpecsContext) {
	return {
		name: 'query_tablets',
		description:
			'Query tablets by type and/or exact release year, optionally ranking by active drawing area. For largest pen tablets use tabletType PENTABLET and sortBy activeArea (descending by default); ascending gives smallest. Size is drawing area, not body size or diagonal. Missing/nonpositive areas are excluded from ranking and counted. Includes discontinued models; availability filtering is not supported. Returns every match and a reproducible list URL without navigating.',
		inputSchema: {
			type: 'object',
			properties: {
				tabletType: {
					type: 'string',
					enum: tabletTypes,
					description: 'Optional tablet type; use PENDISPLAY for pen displays.',
				},
				releaseYear: {
					type: 'integer',
					minimum: 1000,
					maximum: 9999,
					description: 'Optional exact four-digit release year, e.g. 2026.',
				},
				sortBy: {
					type: 'string',
					enum: ['activeArea'],
					description: 'Rank by active drawing area (width × height), largest first by default.',
				},
				sortDirection: {
					type: 'string',
					enum: ['asc', 'desc'],
					description: 'Use desc for largest or asc for smallest; requires sortBy. Default desc.',
				},
			},
			minProperties: 1,
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
		async execute(input: unknown) {
			if (
				!input ||
				typeof input !== 'object' ||
				Array.isArray(input) ||
				Object.keys(input).length === 0 ||
				Object.keys(input).some(
					(key) => !['tabletType', 'releaseYear', 'sortBy', 'sortDirection'].includes(key),
				) ||
				('sortBy' in input && input.sortBy !== 'activeArea') ||
				('sortDirection' in input &&
					(!('sortBy' in input) ||
						(input.sortDirection !== 'asc' && input.sortDirection !== 'desc'))) ||
				('tabletType' in input &&
					(typeof input.tabletType !== 'string' || !tabletTypes.includes(input.tabletType))) ||
				('releaseYear' in input &&
					(typeof input.releaseYear !== 'number' ||
						!Number.isInteger(input.releaseYear) ||
						input.releaseYear < 1000 ||
						input.releaseYear > 9999))
			) {
				return {
					status: 'invalid_input' as const,
					message:
						'Provide tabletType, releaseYear and/or sortBy: activeArea. Use a listed tablet type, an integer four-digit year, and asc or desc only with sortBy. Other query options are not supported.',
				};
			}
			const filters: UrlFilter[] = [];
			if ('tabletType' in input)
				filters.push({ field: 'ModelType', operator: '==', value: String(input.tabletType) });
			if ('releaseYear' in input)
				filters.push({
					field: 'ModelReleaseYear',
					operator: '==',
					value: String(input.releaseYear),
				});
			const rankByArea = 'sortBy' in input;
			const direction = 'sortDirection' in input && input.sortDirection === 'asc' ? 'asc' : 'desc';
			// Pipeline sorts are stable and run in sequence: the last is primary.
			const sorts: SortItem[] = rankByArea
				? [
						{ field: 'EntityId', direction: 'asc' },
						{ field: activeAreaField.key, direction },
					]
				: [{ field: 'Brand', direction: 'asc' }];
			const columns = rankByArea ? sizeColumns : TABLET_DEFAULT_COLUMNS;
			try {
				const tablets = await context.loadTablets();
				if (tablets.length === 0)
					return {
						status: 'unavailable' as const,
						message: 'Tablet data is unavailable; this is not a zero-match result.',
					};
				// Use an ordinary, visible list filter for rankable area values.
				// Missing dimensions never become a zero-sized tablet.
				const beforeAreaFilter = rankByArea
					? executePipeline(tablets, buildActiveSteps(filters, [], columns), TABLET_FIELDS, columns)
							.data.length
					: 0;
				if (rankByArea) filters.push({ field: activeAreaField.key, operator: '>', value: '0' });
				const steps = buildActiveSteps(filters, sorts, columns);
				const matches = executePipeline(tablets, steps, TABLET_FIELDS, TABLET_DEFAULT_COLUMNS).data;
				const url = new URL('tablets', context.baseUrl);
				url.search = buildFilterParams(filters, rankByArea ? { sorts, columns } : {}).toString();
				return {
					status: 'ok' as const,
					filters,
					sorts,
					...(rankByArea
						? {
								ranking: {
									basis: 'active_area',
									field: activeAreaField.key,
									direction,
									excludedMissingArea: beforeAreaFilter - matches.length,
								},
							}
						: {}),
					count: matches.length,
					truncated: false,
					tablets: matches.map((tablet) => ({
						entityId: tablet.Meta.EntityId,
						name: tabletFullName(tablet),
						brand: brandName(tablet.Model.Brand),
						modelId: tablet.Model.Id,
						type: tablet.Model.Type,
						releaseYear: tablet.Model.ReleaseYear || null,
						releaseDate: tablet.Model.ReleaseDate || null,
						...(rankByArea
							? {
									modelStatus: tablet.Model.Status || null,
									activeArea: {
										widthMm: tablet.Digitizer?.Dimensions?.Width,
										heightMm: tablet.Digitizer?.Dimensions?.Height,
										areaMm2: Number(activeAreaField.getValue(tablet)),
									},
								}
							: {}),
						url: new URL(`entity/${encodeURIComponent(tablet.Meta.EntityId)}`, context.baseUrl)
							.href,
					})),
					url: url.href,
					source: {
						versionUrl: new URL('version.json', context.baseUrl).href,
						schemaVersion: context.version?.schemaVersion ?? null,
						commit: context.version?.provenance?.commit ?? context.version?.commit ?? null,
						dirty: context.version?.provenance?.dirty ?? null,
					},
				};
			} catch {
				return {
					status: 'unavailable' as const,
					message: 'Tablet data could not be queried. Retry; this is not a zero-match result.',
				};
			}
		},
	};
}

export function createOpenTabletQueryTool(context: OpenTabletSpecsContext) {
	const query = createQueryTabletsTool(context);
	return {
		name: 'open_tablet_query',
		description:
			'Show a tablet query in the Explorer browser with editable type/year filters and optional active-area ranking. Largest pen tablets: tabletType PENTABLET, sortBy activeArea. Opens the sorted list with dimension and area columns and returns all matches. Use query_tablets for chat-only results. Uses the regular Tablets list, not the advanced Query Builder.',
		inputSchema: query.inputSchema,
		annotations: { readOnlyHint: false, consequentialHint: false },
		async execute(input: unknown) {
			const result = await query.execute(input);
			if (result.status !== 'ok') return result;
			try {
				await context.navigate(result.url);
				return { ...result, status: 'opened' as const };
			} catch {
				return {
					...result,
					status: 'navigation_failed' as const,
					message:
						'The query completed, but the filtered Tablets list could not be opened. The returned results and URL are still available.',
				};
			}
		},
	};
}

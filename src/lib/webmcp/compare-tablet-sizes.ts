import { startWith } from '$lib/compare/entry.js';
import { MAX_COLUMNS, type Comparison } from '$lib/compare/model.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { createTabletSpecsTool, lookupTabletSpecs } from './tablet-specs.js';
import type { OpenTabletSpecsContext } from './open-tablet-specs.js';

export interface CompareTabletSizesContext extends OpenTabletSpecsContext {
	setTabletComparison: (comparison: Comparison) => void;
}

export function createCompareTabletSizesTool(context: CompareTabletSizesContext) {
	const querySchema = createTabletSpecsTool(context).inputSchema.properties.query;
	return {
		name: 'compare_tablet_sizes',
		description:
			'Compare drawing tablets visually in the Explorer browser. Resolves 2 to 8 tablet names or model IDs, replaces the working tablet comparison with exactly those tablets in separate columns, and opens its Sizes tab directly. Shows active drawing area outlines and diagonal sizes, not outer body dimensions. Ambiguous names or missing dimensions leave the comparison unchanged.',
		inputSchema: {
			type: 'object',
			properties: {
				tablets: {
					type: 'array',
					items: querySchema,
					minItems: 2,
					maxItems: MAX_COLUMNS,
					description:
						'Tablet names, model IDs or EntityIds, in comparison order; for example ["PTH660", "PTK670"].',
				},
			},
			required: ['tablets'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: false, consequentialHint: false },
		async execute(input: unknown) {
			if (
				!input ||
				typeof input !== 'object' ||
				Array.isArray(input) ||
				!('tablets' in input) ||
				!Array.isArray(input.tablets) ||
				Object.keys(input).some((key) => key !== 'tablets') ||
				input.tablets.length < 2 ||
				input.tablets.length > MAX_COLUMNS ||
				input.tablets.some(
					(query: unknown) =>
						typeof query !== 'string' || !query.trim() || query.length > querySchema.maxLength,
				)
			) {
				return {
					status: 'invalid_input' as const,
					message: `Provide only tablets: an array of 2 to ${MAX_COLUMNS} non-empty tablet names or IDs, each at most ${querySchema.maxLength} characters.`,
				};
			}

			let tablets: Tablet[];
			try {
				tablets = await context.loadTablets();
				if (tablets.length === 0) throw new Error('Empty tablet dataset');
			} catch {
				return {
					status: 'unavailable' as const,
					message: 'Tablet data is unavailable. The comparison has not changed; try again later.',
				};
			}

			const results = (input.tablets as string[]).map((query) => {
				const result = lookupTabletSpecs(tablets, query.trim(), context.baseUrl);
				if (result.status === 'found')
					return { status: result.status, query, tablet: result.tablet };
				return {
					...result,
					message:
						result.status === 'ambiguous'
							? 'Choose an entityId from these candidates, or refine this tablet name.'
							: result.message,
				};
			});
			if (results.some((result) => result.status !== 'found'))
				return {
					status: 'needs_resolution' as const,
					results,
					message:
						'Resolve each ambiguous or missing tablet, then call compare_tablet_sizes again with the full tablets array. The comparison has not changed.',
				};

			const resolved = results
				.filter((result) => result.status === 'found')
				.map((result) => result.tablet);
			if (new Set(resolved.map((tablet) => tablet.entityId)).size !== resolved.length)
				return {
					status: 'invalid_input' as const,
					message:
						'Each entry must resolve to a different tablet. Some names refer to the same model; the comparison has not changed.',
				};

			const byId = new Map(tablets.map((tablet) => [tablet.Meta.EntityId, tablet]));
			const missing = resolved.filter((tablet) => {
				const dims = byId.get(tablet.entityId)?.Digitizer?.Dimensions;
				return (
					!Number.isFinite(dims?.Width) ||
					!Number.isFinite(dims?.Height) ||
					(dims?.Width ?? 0) <= 0 ||
					(dims?.Height ?? 0) <= 0
				);
			});
			if (missing.length)
				return {
					status: 'missing_dimensions' as const,
					tablets: missing,
					message:
						'These tablets do not have usable active-area width and height recorded. The size comparison cannot include all requested tablets, so the comparison has not changed.',
				};

			const comparison = startWith(
				'tablets',
				resolved.map((tablet) => ({ type: 'model', id: tablet.entityId })),
			);
			const url = new URL('compare/tablets#sizes', context.baseUrl).href;
			try {
				// Finish navigation before replacing the working comparison, so a
				// cancelled navigation preserves the user's previous columns.
				await context.navigate(url);
			} catch {
				return {
					status: 'navigation_failed' as const,
					url,
					message:
						'The Sizes tab could not be opened. The comparison has not changed; retry the tool.',
				};
			}
			context.setTabletComparison(comparison);
			return {
				status: 'opened' as const,
				url,
				tablets: resolved,
				sizeBasis: 'active_area',
				message: 'The Sizes tab shows the requested tablets, one per comparison column.',
			};
		},
	};
}

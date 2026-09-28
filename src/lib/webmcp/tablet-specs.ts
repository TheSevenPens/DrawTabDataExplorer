// Read-only tablet lookup. Project the same field definitions as the UI so
// labels, derived values and units do not become a second hand-maintained schema.
import { brandName, type Tablet, type VersionInfo } from '$data/lib/drawtab-loader.js';
import {
	TABLET_FIELDS,
	tabletFullName,
	tabletBrandAndName,
} from '$data/lib/entities/tablet-fields.js';
import { comparableFields, TABLET_FIELD_ROLES } from '$lib/field-roles.js';
import { compileSearch, stripForSearch } from '$lib/search-match.js';

export interface TabletSpecsContext {
	loadTablets: () => Promise<Tablet[]>;
	/** Absolute Explorer root, including the deployment's base path. */
	baseUrl: string;
	version: VersionInfo | null;
}

const specFields = comparableFields(TABLET_FIELDS, TABLET_FIELD_ROLES);
const MAX_QUERY_LENGTH = 200;
const MAX_CANDIDATES = 10;

function sameIdentity(query: string, value: string): boolean {
	return (
		query.toLowerCase() === value.toLowerCase() ||
		(/\p{L}/u.test(query) && stripForSearch(query) === stripForSearch(value))
	);
}

function identityTexts(t: Tablet): string[] {
	return [
		t.Meta.EntityId,
		t.Model.Id,
		t.Model.Name,
		tabletFullName(t),
		tabletBrandAndName(t),
		...(t.Model.AlternateNames ?? []),
	];
}

function identify(t: Tablet, baseUrl: string) {
	return {
		entityId: t.Meta.EntityId,
		name: tabletFullName(t),
		modelId: t.Model.Id,
		type: t.Model.Type,
		releaseYear: t.Model.ReleaseYear || null,
		url: new URL(`entity/${encodeURIComponent(t.Meta.EntityId)}`, baseUrl).href,
	};
}

export function lookupTabletSpecs(tablets: readonly Tablet[], query: string, baseUrl: string) {
	// A pasted ID wins over a partial name. An ambiguous name never picks the
	// first record: callers must choose a returned EntityId and retry.
	const byId = tablets.filter(
		(t) =>
			sameIdentity(query, t.Meta.EntityId) ||
			sameIdentity(query, t.Model.Id) ||
			sameIdentity(query, `${brandName(t.Model.Brand)} ${t.Model.Id}`),
	);
	const byName = tablets.filter((t) => identityTexts(t).some((s) => sameIdentity(query, s)));
	const terms = query.split(/\s+/).map((term) => compileSearch(term)!);
	const matches = byId.length
		? byId
		: byName.length
			? byName
			: tablets.filter((t) => {
					const texts = identityTexts(t);
					return terms.every((term) => texts.some((s) => term.exact(s) || term.stripped(s)));
				});

	if (matches.length === 0) {
		return {
			status: 'not_found' as const,
			query,
			message:
				'No matching tablet in the dataset. Try a model ID, brand and model name, or an alternate name.',
		};
	}
	if (matches.length > 1) {
		return {
			status: 'ambiguous' as const,
			query,
			message:
				'Multiple tablets match. Choose an entityId from the candidates and call lookup_tablet_specs again. Refine the query if the desired model is not listed.',
			totalMatches: matches.length,
			truncated: matches.length > MAX_CANDIDATES,
			candidates: [...matches]
				.sort((a, b) => a.Meta.EntityId.localeCompare(b.Meta.EntityId))
				.slice(0, MAX_CANDIDATES)
				.map((t) => identify(t, baseUrl)),
		};
	}

	const tablet = matches[0];
	return {
		status: 'found' as const,
		tablet: identify(tablet, baseUrl),
		valueConventions:
			'Values use the units in unit or label, independent of the UI unit preference. YES/NO are recorded enum values. A null value is not recorded or not applicable, as indicated by status; it does not mean no or zero.',
		// Standalone fields only apply to STANDALONE; Connectivity applies to every type.
		specs: specFields
			.filter((f) => f.group !== 'Standalone' || tablet.Model.Type === 'STANDALONE')
			.map((f) => {
				const raw = String(f.getValue(tablet) ?? '').trim();
				const status = raw === '' ? 'not_recorded' : raw === '-' ? 'not_applicable' : 'recorded';
				const numeric = f.type === 'number' && raw !== '' && Number.isFinite(Number(raw));
				return {
					key: f.key,
					label: f.label,
					group: f.group,
					value: status !== 'recorded' ? null : numeric ? Number(raw) : raw,
					...(f.unit ? { unit: f.unit } : {}),
					status,
					...(f.computed ? { computed: true } : {}),
				};
			}),
	};
}

export function createTabletSpecsTool(context: TabletSpecsContext) {
	return {
		name: 'lookup_tablet_specs',
		description:
			'Look up drawing tablet specifications by name, alternate name, model ID or EntityId. Returns specs with units, missing-data status and a source link, or candidates when ambiguous. Read-only: does not navigate or change the comparison. Use the returned facts to answer the user; do not treat missing data as no.',
		inputSchema: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					minLength: 1,
					maxLength: MAX_QUERY_LENGTH,
					description:
						'Tablet name or model ID, e.g. Wacom CTL-4100, Cintiq Pro 27, or wacom.tablet.ctl4100.',
				},
			},
			required: ['query'],
			additionalProperties: false,
		},
		annotations: { readOnlyHint: true },
		async execute(input: unknown) {
			if (
				!input ||
				typeof input !== 'object' ||
				Array.isArray(input) ||
				!('query' in input) ||
				typeof input.query !== 'string' ||
				Object.keys(input).some((k) => k !== 'query') ||
				!input.query.trim() ||
				input.query.length > MAX_QUERY_LENGTH
			) {
				return {
					status: 'invalid_input' as const,
					message: `Provide only query: a non-empty tablet name or ID of at most ${MAX_QUERY_LENGTH} characters.`,
				};
			}
			try {
				const tablets = await context.loadTablets();
				if (tablets.length === 0)
					return {
						status: 'unavailable' as const,
						message: 'Tablet data is unavailable. Try again later.',
					};
				return {
					...lookupTabletSpecs(tablets, input.query.trim(), context.baseUrl),
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
					message:
						'Tablet data could not be loaded. Retry the lookup; this is not a no-match result.',
				};
			}
		},
	};
}

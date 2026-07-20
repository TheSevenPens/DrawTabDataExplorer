// Audit-curation page for OTD→entity correlations (see +page.svelte),
// linked from the reference "OTD To Tablet Entity" section. Mirrors that
// section's matching.
import { matchOtdToTablets, type OtdEntityMapRow } from '$lib/otd-entity-match.js';

// Unlinked route — served via the SPA fallback rather than prerendered.
export const prerender = false;

const OTD_VENDOR_BY_BRAND: Record<string, string> = {
	WACOM: 'Wacom',
	HUION: 'Huion',
	XPPEN: 'XP-Pen',
	UGEE: 'UGEE',
	GAOMON: 'Gaomon',
	XENCELABS: 'XenceLabs',
};

export async function load({ parent }) {
	const { ds } = await parent();
	const [allTablets, otdConfig, otdAudit] = await Promise.all([
		ds.Tablets.toArray(),
		ds.getOtdConfig(),
		ds.getOtdEntityAudit(),
	]);
	const otdTablets = otdConfig?.tablets ?? [];
	const otdEntityMatches: OtdEntityMapRow[] = Object.entries(OTD_VENDOR_BY_BRAND)
		.flatMap(([brand, vendor]) =>
			matchOtdToTablets(
				otdTablets.filter((t) => t.vendor === vendor),
				allTablets.filter((t) => t.Model.Brand === brand),
			),
		)
		.map(
			(m): OtdEntityMapRow => ({
				...m,
				audit: (m.entityId ? otdAudit[`${m.otdFile}|${m.entityId}`] : undefined) ?? 'unreviewed',
			}),
		);
	return { otdEntityMatches };
}

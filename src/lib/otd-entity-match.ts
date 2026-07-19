// Matches OpenTabletDriver configs to our tablet entities. OTD names for a
// given vendor are either a bare model number ("Wacom PTK-440") or a marketing
// name with the model in parens ("Wacom Cintiq 16 (DTK1660)"), so we try the
// parenthetical model id first, then the text after the vendor prefix. The
// digitizer active-area size (mm) is a second, independent signal: it confirms
// an id match (basis "id+area"), disambiguates a reused Model.Id, or — when no
// id matches — stands alone as a weak "area" match.
//
// Groundwork for #308. Callers pass already-brand-filtered lists (e.g. OTD
// Wacom vs our WACOM tablets); the matcher itself is brand-agnostic.
import type { Tablet, OTDTablet } from '$data/lib/drawtab-loader.js';
import { tabletFullName } from '$lib/tablet-helpers.js';

/** Active-area tolerance in mm for treating two dimensions as the same tablet. */
export const AREA_TOLERANCE_MM = 2;

export type MatchBasis = 'id+area' | 'id' | 'area' | 'none';

export interface OtdEntityMatchRow {
	otdName: string;
	otdVendor: string;
	otdWidthMM: number | null;
	otdHeightMM: number | null;
	entityId: string | null;
	modelId: string | null;
	fullName: string | null;
	ourWidthMM: number | null;
	ourHeightMM: number | null;
	basis: MatchBasis;
}

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase();

function ourArea(t: Tablet): { w: number; h: number } | null {
	const d = t.Digitizer?.Dimensions;
	return d && d.Width != null && d.Height != null ? { w: +d.Width, h: +d.Height } : null;
}

function areaClose(
	a: { w: number; h: number } | null,
	b: { w: number; h: number } | null,
	tol = AREA_TOLERANCE_MM,
): boolean {
	return !!a && !!b && Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol;
}

/** Candidate model-id keys from an OTD name: the parenthetical model number
 * first (if any), then the text after the vendor prefix, both normalized. */
export function candidateIds(name: string, vendor: string): string[] {
	const out: string[] = [];
	const paren = name.match(/\(([^)]+)\)/);
	if (paren) out.push(paren[1]);
	const escaped = vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	out.push(name.replace(new RegExp(`^${escaped}\\s+`, 'i'), '').replace(/\s*\([^)]*\)\s*/g, ''));
	return out.map(norm).filter(Boolean);
}

/** Match each OTD tablet to one of `ours` (same brand). Order preserved. */
export function matchOtdToTablets(otd: OTDTablet[], ours: Tablet[]): OtdEntityMatchRow[] {
	const byId = new Map<string, Tablet[]>();
	for (const t of ours) {
		const k = norm(t.Model.Id);
		(byId.get(k) ?? byId.set(k, []).get(k)!).push(t);
	}

	return otd.map((o) => {
		const otdA =
			o.specs.widthMM != null && o.specs.heightMM != null
				? { w: o.specs.widthMM, h: o.specs.heightMM }
				: null;

		let chosen: Tablet | null = null;
		let basis: MatchBasis = 'none';

		for (const c of candidateIds(o.name ?? '', o.vendor)) {
			const hits = byId.get(c) ?? [];
			if (hits.length === 1) {
				chosen = hits[0];
				basis = areaClose(otdA, ourArea(chosen)) ? 'id+area' : 'id';
				break;
			}
			if (hits.length > 1) {
				// Reused Model.Id (e.g. Wacom CT-0405-U across generations) —
				// disambiguate by active area.
				const byArea = hits.filter((t) => areaClose(otdA, ourArea(t)));
				if (byArea.length === 1) {
					chosen = byArea[0];
					basis = 'id+area';
					break;
				}
			}
		}

		if (!chosen && otdA) {
			const areaHits = ours.filter((t) => areaClose(otdA, ourArea(t)));
			if (areaHits.length === 1) {
				chosen = areaHits[0];
				basis = 'area';
			}
		}

		const oa = chosen ? ourArea(chosen) : null;
		return {
			otdName: o.name ?? o.file,
			otdVendor: o.vendor,
			otdWidthMM: otdA?.w ?? null,
			otdHeightMM: otdA?.h ?? null,
			entityId: chosen?.Meta.EntityId ?? null,
			modelId: chosen?.Model.Id ?? null,
			fullName: chosen ? tabletFullName(chosen) : null,
			ourWidthMM: oa?.w ?? null,
			ourHeightMM: oa?.h ?? null,
			basis,
		};
	});
}

// Unified band definitions used by:
//   - BandsChart (Piaf and Pmax horizontal ranking visualisations)
//   - ValueHistogram (the spec band overlays on Brightness, Contrast, etc.)
//   - The Reference page documentation tables
//
// One Band interface for all of them. `max: null` represents an
// open-ended right edge ("and above") — currently only used by the
// pressure bands.

/** Open-ended right edge allowed (used by BandsChart for Piaf / Pmax
 * where the trailing band is "AVOID" or "EXCESSIVE", i.e. ≥ N). */
export interface Band {
	label: string;
	min: number;
	max: number | null;
}

/** Closed interval, suitable for histograms. All spec bands satisfy this
 * tighter shape, which is also assignable to Band where the union is wider. */
export interface SpecBand {
	label: string;
	min: number;
	max: number;
}

// --- Pen Pressure (used by BandsChart) ---

/** Piaf (Initial Activation Force) ranking bands in gram-force. Lower is
 * better — a lighter touch means more natural shading and less hand
 * fatigue. Labelled S/A/B/C/D (tier-list style) so the single-letter
 * names fit comfortably above the narrow lower bands on a 22 gf axis. */
export const PIAF_BANDS: Band[] = [
	{ min: 0, max: 1, label: 'S' },
	{ min: 1, max: 2, label: 'A' },
	{ min: 2, max: 3.5, label: 'B' },
	{ min: 3.5, max: 5, label: 'C' },
	{ min: 5, max: null, label: 'D' },
];

/** Pmax (Maximum Force) ranking bands in gram-force. Higher = more
 * dynamic range before the pen saturates; too high = excessive arm
 * fatigue to reach full pressure. Labelled S/A/B/C/D/X (tier-list
 * style, with X reserved for the EXCESSIVE upper tail). */
export const PMAX_BANDS: Band[] = [
	{ min: 100, max: 150, label: 'D' },
	{ min: 150, max: 200, label: 'C' },
	{ min: 200, max: 350, label: 'B' },
	{ min: 350, max: 500, label: 'A' },
	{ min: 500, max: 900, label: 'S' },
	{ min: 900, max: null, label: 'X' },
];

// --- Display ---

export const BRIGHTNESS_BANDS: SpecBand[] = [
	{ label: 'Dim', min: 100, max: 250 },
	{ label: 'Average', min: 250, max: 350 },
	{ label: 'Bright', min: 350, max: 450 },
	{ label: 'Very Bright', min: 450, max: 600 },
];

export const CONTRAST_BANDS: SpecBand[] = [
	{ label: 'Low', min: 500, max: 1000 },
	{ label: 'Standard', min: 1000, max: 1500 },
	{ label: 'Good', min: 1500, max: 2500 },
	{ label: 'High', min: 2500, max: 3500 },
];

export const RESPONSE_TIME_BANDS: SpecBand[] = [
	{ label: 'Excellent', min: 0, max: 4 },
	{ label: 'Good', min: 4, max: 8 },
	{ label: 'OK', min: 8, max: 15 },
	{ label: 'Slow', min: 15, max: 30 },
];

// --- Digitizer ---

export const DENSITY_BANDS: SpecBand[] = [
	{ label: 'Low', min: 0, max: 50 },
	{ label: 'Standard', min: 50, max: 100 },
	{ label: 'High', min: 100, max: 200 },
	{ label: 'Very High', min: 200, max: 300 },
];

export const ACCURACY_CENTER_BANDS: SpecBand[] = [
	{ label: 'Excellent', min: 0, max: 0.3 },
	{ label: 'Good', min: 0.3, max: 0.5 },
	{ label: 'OK', min: 0.5, max: 1.0 },
	{ label: 'Poor', min: 1.0, max: 2.0 },
];

export const ACCURACY_CORNER_BANDS: SpecBand[] = [
	{ label: 'Excellent', min: 0, max: 0.5 },
	{ label: 'Good', min: 0.5, max: 1.0 },
	{ label: 'OK', min: 1.0, max: 2.0 },
	{ label: 'Poor', min: 2.0, max: 5.0 },
];

export const REPORT_RATE_BANDS: SpecBand[] = [
	{ label: 'Slow', min: 0, max: 100 },
	{ label: 'Standard', min: 100, max: 200 },
	{ label: 'Fast', min: 200, max: 250 },
	{ label: 'Very Fast', min: 250, max: 350 },
];

// Qualitative rank bands for spec values shown on the Tablets ▸ Analysis
// histograms. Each band is a half-open interval [min, max) labelled with
// a human-readable rank. Centralised so that:
//   - the analysis-page histograms,
//   - the Reference-page documentation tables,
// all agree on the same thresholds, and a tweak only needs one edit here.

export interface SpecBand {
	label: string;
	min: number;
	max: number;
}

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

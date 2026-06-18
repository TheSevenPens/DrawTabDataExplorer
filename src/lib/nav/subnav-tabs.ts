// Single source of truth for the Tablets and Pens sub-navigation tabs.
// Routes call these helpers with reactive badge counts; the SubNav
// component renders the result.

export interface SubNavTab {
	href: string;
	label: string;
	badge?: number;
}

export function tabletSubNavTabs(opts: { flaggedCount?: number } = {}): SubNavTab[] {
	return [
		{ href: '/tablets', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/tablet-inventory', label: 'Inventory' },
		{ href: '/tablet-compare', label: 'Compare', badge: opts.flaggedCount },
	];
}

export function dataSubNavTabs(): SubNavTab[] {
	return [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/api-explorer', label: 'API Explorer' },
		{ href: '/data-quality', label: 'Data Quality' },
	];
}

export function penSubNavTabs(
	opts: { flaggedPenCount?: number; flaggedPenModelCount?: number } = {},
): SubNavTab[] {
	return [
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-analysis', label: 'Analysis' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pen-flagged', label: 'Flagged', badge: opts.flaggedPenCount },
		{ href: '/pen-compare', label: 'Compare', badge: opts.flaggedPenModelCount },
		{ href: '/pressure-response', label: 'Pressure Response' },
	];
}

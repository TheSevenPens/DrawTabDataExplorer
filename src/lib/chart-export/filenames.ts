// Shared filename helpers for chart/table exports (GitHub #224). Consolidates
// the slug + date-stamp logic that was duplicated across ChartExportButton,
// ExportDialog, and the *Tab export-filename slugs.

/** Lowercase, non-alphanumerics → '-', trimmed. Filename-safe base from a title. */
export function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Date as YYYY-MM-DD for stamping export filenames (defaults to today). */
export function dateStamp(d: Date = new Date()): string {
	return d.toISOString().slice(0, 10);
}

/** `${base}-YYYY-MM-DD.${ext}`. `base` is used as-is (already a slug / id). */
export function datedFilename(base: string, ext: string): string {
	return `${base}-${dateStamp()}.${ext}`;
}

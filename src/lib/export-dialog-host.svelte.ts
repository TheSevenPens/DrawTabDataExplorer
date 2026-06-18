// Shared host for the single per-page ExportDialog (GitHub #236). The Data
// routes (/data-quality, /reference, /tablet-analysis, /pen-analysis) each
// declared an identical `exportDialog` $state + `openExport()` setter +
// "{#if exportDialog} <ExportDialog .../>" mount. This factory owns that
// state once; a route calls `host.open(...)` from its section triggers and
// mounts `<ExportDialog ...host.config onclose={host.close} />`.

export interface ExportDialogConfig {
	title: string;
	filename: string;
	headers: string[];
	rows: (string | number)[][];
}

export function createExportDialogHost() {
	let config = $state<ExportDialogConfig | null>(null);
	return {
		get config() {
			return config;
		},
		open(title: string, filename: string, headers: string[], rows: (string | number)[][]) {
			config = { title, filename, headers, rows };
		},
		close() {
			config = null;
		},
	};
}

// Text serialisers for ExportDialog: CSV, JSON, HTML and Markdown from one
// positional table. Extracted from the dialog so they're unit-testable
// (GitHub #329).
//
// Cells are addressed by column *position*, never by heading. The dialog
// used to rebuild each simple-mode row as `{ [heading]: value }`, so two
// columns with the same heading — two compared tablets both named "Wacom
// Intuos Small" — collapsed into one, and every export printed the second
// tablet's values under both headings.

/** A table ready to serialise: headings plus rows of already-stringified
 * cells, both in column order. */
export interface ExportTable {
	headers: string[];
	rows: string[][];
}

/** Stringify a raw cell value. `null`/`undefined` export as empty. */
export function cellString(v: unknown): string {
	return v == null ? '' : String(v);
}

/** Build a positional table from simple-mode `headers` + `rows`. Rows
 * shorter than the header list are padded with empty cells. */
export function tableFromArrays(
	headers: string[],
	rows: readonly (readonly unknown[])[],
): ExportTable {
	return {
		headers: [...headers],
		rows: rows.map((r) => headers.map((_, i) => cellString(r[i]))),
	};
}

/** Make headings unique for formats that key by name (JSON object keys):
 * repeats get " (2)", " (3)", … in order of appearance. */
export function uniqueKeys(headers: readonly string[]): string[] {
	const seen = new Map<string, number>();
	const taken = new Set(headers);
	return headers.map((h) => {
		const n = (seen.get(h) ?? 0) + 1;
		seen.set(h, n);
		if (n === 1) return h;
		let k = n;
		let candidate = `${h} (${k})`;
		while (taken.has(candidate)) candidate = `${h} (${++k})`;
		taken.add(candidate);
		return candidate;
	});
}

function csvEscape(v: string): string {
	if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
		return '"' + v.replace(/"/g, '""') + '"';
	}
	return v;
}

function htmlEscape(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function toCSV(t: ExportTable): string {
	const header = t.headers.map(csvEscape).join(',');
	const body = t.rows.map((r) => r.map(csvEscape).join(',')).join('\n');
	return header + '\n' + body;
}

/** JSON array of objects. `keys` names each column (defaults to the
 * headings); duplicates are disambiguated so no column is dropped. */
export function toJSON(t: ExportTable, keys: readonly string[] = t.headers): string {
	const names = uniqueKeys(keys);
	return JSON.stringify(
		t.rows.map((r) => Object.fromEntries(names.map((k, i) => [k, r[i] ?? '']))),
		null,
		2,
	);
}

export function toHTML(t: ExportTable): string {
	const ths = t.headers.map((h) => `<th>${htmlEscape(h)}</th>`).join('');
	const trs = t.rows
		.map((r) => `  <tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join('')}</tr>`)
		.join('\n');
	return `<table>\n<thead>\n  <tr>${ths}</tr>\n</thead>\n<tbody>\n${trs}\n</tbody>\n</table>`;
}

export function toMarkdown(t: ExportTable): string {
	// A newline inside a cell would end the table row, so multi-line values
	// (Notes) fold to <br>. Pipes still need escaping.
	const md = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
	const header = '| ' + t.headers.map(md).join(' | ') + ' |';
	const sep = '| ' + t.headers.map(() => '---').join(' | ') + ' |';
	const body = t.rows.map((r) => '| ' + r.map(md).join(' | ') + ' |').join('\n');
	return [header, sep, body].join('\n');
}

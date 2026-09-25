/**
 * A GitHub-flavoured Markdown table — the format a comparison is pasted into
 * a Reddit or forum reply as (#373). Pipes and newlines inside cells are
 * escaped so a note can't break the table.
 */

const cell = (v: string | number) =>
	String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || ' ';

export function toMarkdownTable(
	headers: readonly (string | number)[],
	rows: readonly (readonly (string | number)[])[],
): string {
	const line = (vals: readonly (string | number)[]) => `| ${vals.map(cell).join(' | ')} |`;
	const width = headers.length;
	const pad = (r: readonly (string | number)[]) =>
		[...r, ...Array(Math.max(0, width - r.length)).fill('')].slice(0, width);
	return (
		[
			line(headers),
			`|${headers.map(() => ' --- ').join('|')}|`,
			...rows.map((r) => line(pad(r))),
		].join('\n') + '\n'
	);
}

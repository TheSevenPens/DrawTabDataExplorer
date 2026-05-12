export async function load({ parent }) {
	const { ds } = await parent();
	const [allTablets, isoPaperSizes, usPaperSizes] = await Promise.all([
		ds.Tablets.toArray(),
		ds.getISOPaperSizes(),
		ds.getUSPaperSizes(),
	]);
	return { allTablets, isoPaperSizes, usPaperSizes };
}

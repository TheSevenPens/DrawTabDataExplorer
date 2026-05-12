export async function load({ parent }) {
	const { ds } = await parent();
	const [paperSizes, usPaperSizes, allTablets] = await Promise.all([
		ds.getISOPaperSizes(),
		ds.getUSPaperSizes(),
		ds.Tablets.toArray(),
	]);
	return { paperSizes, usPaperSizes, allTablets };
}

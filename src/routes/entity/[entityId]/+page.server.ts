// Build-time only. Exists solely to tell the prerenderer which /entity/<id>
// paths to emit; nothing here runs at request time (the app is `ssr = false`
// and deploys as static files with no server).
//
// Why it's worth emitting ~860 near-identical shells: without them, GitHub
// Pages has no file at /entity/<id> and falls back to 404.html — which
// renders the app correctly but answers HTTP 404. That's invisible to a
// browser and fatal to everything else that reads status codes: link
// previews, crawlers and search indexing, uptime checks, and proxies that
// block 404 bodies. Each shell is ~4KB.
//
// It lives in +page.server.ts, not +page.ts, because createDiskDataSet is
// the Node-only entry point — importing it from the universal module would
// drag node:fs into the client bundle.
import * as path from 'path';
import { createDiskDataSet } from '$data/lib/dataset-node.js';

export const prerender = true;

export async function entries() {
	const ds = createDiskDataSet({
		dataDir: path.resolve('data-repo/data'),
		userId: 'sevenpens',
	});

	const [tablets, pens, tabletFamilies, penFamilies, drivers, brands] = await Promise.all([
		ds.Tablets.toArray(),
		ds.Pens.toArray(),
		ds.TabletFamilies.toArray(),
		ds.PenFamilies.toArray(),
		ds.Drivers.toArray(),
		ds.Brands.toArray(),
	]);

	const ids = [
		...tablets.map((t) => t.Meta.EntityId),
		...pens.map((p) => p.EntityId),
		...tabletFamilies.map((f) => f.EntityId),
		...penFamilies.map((f) => f.EntityId),
		...drivers.map((d) => d.EntityId),
		...brands.map((b) => b.EntityId),
	];

	// Dedupe defensively — a duplicate EntityId is a data bug the CLI already
	// reports, and it shouldn't also fail the build.
	return [...new Set(ids.filter(Boolean))].map((entityId) => ({ entityId }));
}

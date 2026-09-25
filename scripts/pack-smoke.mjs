// Packs data-repo and packages/queriton exactly as npm would publish them,
// installs both tarballs into a throwaway project, and imports the library
// from there — the only way to see what an outside consumer sees (#337).
// Inside this repo the $data alias and the npm workspace read the sources
// directly, which is how data-repo's `exports` pointed at files that did
// not exist without anything here noticing.
//
// Needs network (installs `tsx` into the temp project). Runs in Verify;
// also run locally after touching package exports or metadata.
//
//   npm run pack-smoke

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drawtab-pack-smoke-'));
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString();

try {
	const tarballs = ['data-repo', 'packages/queriton'].map((dir) =>
		path.join(
			tmp,
			run(`npm pack --silent --pack-destination "${tmp}"`, path.join(root, dir)).trim(),
		),
	);
	fs.writeFileSync(
		path.join(tmp, 'package.json'),
		JSON.stringify({ name: 'pack-smoke', private: true, type: 'module' }),
	);
	run(`npm install --silent ${tarballs.map((t) => `"${t}"`).join(' ')} tsx`, tmp);

	fs.writeFileSync(
		path.join(tmp, 'smoke.ts'),
		`import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createDiskDataSet } from 'drawtabdata/dataset-node';
import { loadTabletsFromURL } from 'drawtabdata/loader';
import { TABLET_FIELDS } from 'drawtabdata/entities/tablet';

const require = createRequire(import.meta.url);
const dataDir = path.resolve(path.dirname(require.resolve('drawtabdata/data/brands/brands.json')), '..');
const ds = createDiskDataSet({ dataDir });
const content = JSON.parse(fs.readFileSync(path.join(dataDir, 'version.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(require.resolve('drawtabdata/snapshot'), 'utf8'));
if (content.commit || content.provenance || !snapshot.provenance?.commit || !snapshot.verification) throw new Error('Invalid content/publication metadata');
for (const manifest of [content, snapshot]) {
  if (manifest.counts.tablets !== await ds.Tablets.count()) throw new Error('Stale packed tablet count');
  if (manifest.counts.pens !== await ds.Pens.count()) throw new Error('Stale packed pen count');
  for (const b of manifest.bundles) {
    const bytes = fs.readFileSync(path.join(dataDir, b.path));
    const key = manifest.verification.bundleRootKeys[b.path.split('/')[0]];
    if (createHash('sha256').update(bytes).digest('hex') !== b.sha256 || JSON.parse(bytes.toString('utf8'))[key].length !== b.count) throw new Error('Packed bundle verification failed: ' + b.path);
  }
}
const result = {
	tablets: await ds.Tablets.count(),
	wacomPens: await ds.Pens.filter('Brand', '==', 'WACOM').count(),
	tabletFields: TABLET_FIELDS.length,
	urlLoader: typeof loadTabletsFromURL,
	verifiedBundles: snapshot.bundles.length,
};
console.log(JSON.stringify(result));
if (!result.tablets || !result.wacomPens || !result.tabletFields || result.urlLoader !== 'function') {
	process.exit(1);
}
`,
	);
	const out = run('npx tsx smoke.ts', tmp).trim();
	console.log(`pack-smoke: OK ${out}`);
} catch (err) {
	console.error('pack-smoke: FAILED — a packed consumer could not load the library.');
	process.exitCode = 1;
	throw err;
} finally {
	fs.rmSync(tmp, { recursive: true, force: true });
}

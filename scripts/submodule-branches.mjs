// Keep the submodules on their tracking branch.
//
// Git checks submodules out *detached* — `git pull --recurse-submodules`,
// `git checkout`, and `git submodule update` all move the submodule's HEAD to
// the recorded commit without touching its branch. Everything looks normal
// until you commit inside the submodule: the commit lands off-branch, `git
// push` has nothing to push to, and if the outer pointer bump gets pushed
// first, the superproject references a commit that exists on one machine only.
//
// That is exactly what happened on 2026-08-20 (see WAT.0083). This script
// makes it self-correcting: it runs on postinstall and from the git hooks in
// .githooks/, and reattaches each submodule to the branch named in
// .gitmodules whenever that is safe.
//
// Safe means one of:
//   - branch is already checked out                       -> nothing to do
//   - branch points at HEAD                               -> just check it out
//   - HEAD is ahead of the branch (fast-forward)          -> move branch, check out
//
// It deliberately refuses to act when the branch has commits HEAD does not,
// because reattaching would silently strand them. That case gets a loud
// warning and a suggested command instead — the one situation actually worth
// a human's attention.

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(args, cwd = root) {
	return execFileSync('git', args, {
		cwd,
		encoding: 'utf-8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function tryGit(args, cwd = root) {
	try {
		return { ok: true, out: git(args, cwd) };
	} catch (err) {
		return { ok: false, out: String(err.stderr ?? err.message ?? '').trim() };
	}
}

/** Submodule paths and their configured branch, from .gitmodules. */
function configuredSubmodules() {
	const res = tryGit([
		'config',
		'-f',
		'.gitmodules',
		'--get-regexp',
		String.raw`^submodule\..*\.path$`,
	]);
	if (!res.ok) return [];
	const out = [];
	for (const line of res.out.split('\n').filter(Boolean)) {
		const [key, subPath] = line.split(/\s+/);
		const name = key.slice('submodule.'.length, -'.path'.length);
		const branch = tryGit(['config', '-f', '.gitmodules', `submodule.${name}.branch`]);
		out.push({ name, path: subPath, branch: branch.ok ? branch.out : null });
	}
	return out;
}

let warned = false;

for (const sub of configuredSubmodules()) {
	const cwd = path.join(root, sub.path);
	if (!existsSync(path.join(cwd, '.git'))) {
		console.warn(
			`[submodules] ${sub.path} is not checked out — run: git submodule update --init --recursive`,
		);
		warned = true;
		continue;
	}
	if (!sub.branch) {
		console.warn(`[submodules] ${sub.path} has no branch in .gitmodules; skipping`);
		warned = true;
		continue;
	}

	const current = tryGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd);
	if (current.ok) {
		if (current.out !== sub.branch) {
			console.warn(
				`[submodules] ${sub.path} is on "${current.out}", not "${sub.branch}" — leaving it alone`,
			);
			warned = true;
		}
		continue;
	}

	// Detached. Decide whether reattaching is lossless.
	const head = git(['rev-parse', 'HEAD'], cwd);
	const branchRef = tryGit(['rev-parse', '--verify', `refs/heads/${sub.branch}`], cwd);
	if (!branchRef.ok) {
		const created = tryGit(['checkout', '-b', sub.branch], cwd);
		console.log(
			created.ok
				? `[submodules] ${sub.path}: created "${sub.branch}" at ${head.slice(0, 7)}`
				: `[submodules] ${sub.path}: could not create "${sub.branch}" — ${created.out}`,
		);
		continue;
	}

	const branchSha = branchRef.out;
	if (branchSha === head) {
		git(['checkout', sub.branch], cwd);
		console.log(`[submodules] ${sub.path}: reattached to "${sub.branch}"`);
		continue;
	}

	const branchIsBehind = tryGit(['merge-base', '--is-ancestor', branchSha, head], cwd).ok;
	if (branchIsBehind) {
		git(['branch', '-f', sub.branch, head], cwd);
		git(['checkout', sub.branch], cwd);
		console.log(
			`[submodules] ${sub.path}: fast-forwarded "${sub.branch}" to ${head.slice(0, 7)} and reattached`,
		);
		continue;
	}

	// Either the branch is simply ahead of the recorded commit, or the two have
	// genuinely forked. Both are refusals, for reasons worth telling apart.
	const headIsBehind = tryGit(['merge-base', '--is-ancestor', head, branchSha], cwd).ok;
	const what = headIsBehind
		? `"${sub.branch}" is ahead of the commit the superproject records`
		: `HEAD and "${sub.branch}" have forked`;
	const cost = headIsBehind
		? 'move the submodule off the recorded commit'
		: `strand commits on "${sub.branch}"`;
	console.warn(
		`[submodules] ${sub.path}: ${what} (HEAD ${head.slice(0, 7)}, ${sub.branch} ${branchSha.slice(0, 7)}).\n` +
			`             Not reattaching — that would ${cost}.\n` +
			`             Look at:  git -C ${sub.path} log --oneline --graph ${sub.branch} HEAD`,
	);
	warned = true;
}

if (warned) process.exitCode = 0; // advisory only — never fail a pull or an install

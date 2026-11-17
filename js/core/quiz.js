/* What Dog Breeds asks, and in what order. No page code: the unit tests import this directly.
 *
 *   pool()        the breeds in a set (Popular, AKC, Every breed) and group
 *   choices()     the four names to pick from: the breed and three wrong ones, look-alikes first
 *   tellFor()     how to tell two breeds apart, when they are look-alikes
 *   pickNext()    the next breed to practise: unseen and shaky ones first, never one just asked
 *   createReview() bringing a missed breed back a few questions later
 *   crossChoices() the four pairs of parents to pick from for a designer cross
 */

export const SETS = ['popular', 'akc', 'every', 'crosses'];
// a breed counts as learned after this many right answers in a row in practice (or one right in a test)
export const LEARNED = 2;

/** A seeded random number generator, for tests and repeatable runs: mulberry32. */
export function seeded(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function shuffle(list, rand = Math.random) {
	const a = list.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export const inSet = (b, set) => (set === 'popular' ? !!b.pop : set === 'akc' ? !!b.akc : set === 'every');
/** The breeds of a set, in one group or all of them, in the list's order. */
export function pool(breeds, set, group = 'all') {
	return breeds.filter((b) => inSet(b, set) && (group === 'all' || b.group === group));
}

/** id -> the ids it is grouped with in the look-alike list (each group once, so the tells can be found). */
export function lookalikeMap(groups) {
	const map = new Map();
	for (const g of groups) for (const id of g.ids) map.set(id, [...new Set([...(map.get(id) || []), ...g.ids.filter((x) => x !== id)])]);
	return map;
}
/** How to tell a from b: the first look-alike group with both, or null. */
export function tellFor(a, b, groups) {
	const g = groups.find((x) => x.ids.includes(a) && x.ids.includes(b));
	return g ? g.tell : null;
}
/** Every tell a breed appears in. */
export const tellsOf = (id, groups) => groups.filter((g) => g.ids.includes(id));

/**
 * Four names to pick from (the right one among them), from the breeds of the set: up to two of the breed's look-alikes,
 * then breeds of the same group and size, then the same group, then any. So a right answer means telling it from the
 * breeds it is most easily confused with.
 */
export function choices(target, setBreeds, lookalikes, rand = Math.random, n = 4) {
	const others = setBreeds.filter((b) => b.id !== target.id);
	const picked = [];
	const take = (list, max) => {
		for (const b of shuffle(list, rand)) {
			if (picked.length >= n - 1 || max <= 0) break;
			if (!picked.includes(b)) picked.push(b), max--;
		}
	};
	const near = new Set(lookalikes.get(target.id) || []);
	take(others.filter((b) => near.has(b.id)), 2);
	take(others.filter((b) => b.group === target.group && b.size === target.size), n);
	take(others.filter((b) => b.group === target.group), n);
	take(others.filter((b) => b.size === target.size), n);
	take(others, n);
	return shuffle([target, ...picked], rand).map((b) => b.id);
}

/**
 * The next breed to practise. Breeds you haven't got right lately come first, then ones you're unsure of, then the rest;
 * none of the last few asked comes back straight away (unless the pool is that small).
 * known: id -> right answers in a row. recent: ids asked lately, newest last.
 */
export function pickNext(poolBreeds, known, recent, rand = Math.random) {
	const gap = Math.min(6, Math.max(0, poolBreeds.length - 2));
	const avoid = new Set(recent.slice(-gap));
	const fresh = poolBreeds.filter((b) => !avoid.has(b.id));
	const list = fresh.length ? fresh : poolBreeds;
	// weight: not yet learned counts five times as much as learned
	const weight = (b) => ((known[b.id] || 0) >= LEARNED ? 1 : 5);
	let total = 0;
	for (const b of list) total += weight(b);
	let r = rand() * total;
	for (const b of list) {
		r -= weight(b);
		if (r < 0) return b;
	}
	return list[list.length - 1];
}

/** Update a breed's streak after a practice answer: one more if right, back to none if wrong (kept at most 3). */
export const nextStreak = (streak, right) => (right ? Math.min(3, (streak || 0) + 1) : 0);
export const learnedIn = (poolBreeds, known) => poolBreeds.filter((b) => (known[b.id] || 0) >= LEARNED).length;

/* Bringing missed breeds back during practice. Miss one and it returns a few questions later; get it right then and it
 * returns once more, further on; get that right too and it's done. Miss it again and it starts over. */
export function createReview({ soon = 3, later = 9 } = {}) {
	const queue = []; // { id, due, step }
	let answered = 0;
	return {
		/** A breed whose turn has come back, or null. */
		due() {
			const i = queue.findIndex((x) => x.due <= answered);
			return i < 0 ? null : queue.splice(i, 1)[0];
		},
		/** Record an answer. item is what due() returned for this question, or null for a new one. */
		record(id, right, item) {
			answered++;
			if (!right) queue.push({ id, due: answered + soon, step: 0 });
			else if (item && item.step === 0) queue.push({ id, due: answered + later, step: 1 });
		},
		waiting: () => queue.length,
	};
}

/* ---------------------------------------------------------------- designer crosses */
const pairKey = (a, b) => [a, b].sort().join('+');
const parentKey = (p) => p.id || p.name;
/** Every parent breed the crosses use, each once. */
export function parentPool(crosses) {
	const seen = new Map();
	for (const c of crosses) for (const p of c.parents) if (!seen.has(parentKey(p))) seen.set(parentKey(p), p);
	return [...seen.values()];
}
/**
 * Four pairs of parents to pick from: the right pair, the right pair with one parent swapped (twice, once each side),
 * and one more pair. Never the right pair twice, in either order.
 */
export function crossChoices(cross, crosses, rand = Math.random) {
	const parents = parentPool(crosses);
	const [a, b] = cross.parents;
	const right = pairKey(parentKey(a), parentKey(b));
	const others = shuffle(parents.filter((p) => parentKey(p) !== parentKey(a) && parentKey(p) !== parentKey(b)), rand);
	const pairs = [[a, b]];
	const used = new Set([right]);
	const add = (x, y) => {
		const k = pairKey(parentKey(x), parentKey(y));
		if (parentKey(x) === parentKey(y) || used.has(k) || pairs.length >= 4) return;
		used.add(k);
		pairs.push([x, y]);
	};
	let i = 0;
	add(a, others[i++ % others.length]);
	add(others[i++ % others.length], b);
	while (pairs.length < 4 && i < others.length * 3) add(others[i++ % others.length], others[i++ % others.length]);
	return shuffle(pairs, rand);
}
export const isRightPair = (pair, cross) => pairKey(parentKey(pair[0]), parentKey(pair[1])) === pairKey(parentKey(cross.parents[0]), parentKey(cross.parents[1]));
